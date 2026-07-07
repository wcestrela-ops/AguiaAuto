const crypto = require('crypto');
const { getReferralRepository } = require('../repositories/referral-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getUserRepository } = require('../repositories/user-repository');
const asaas = require('../integrations/asaas');
const logger = require('../logger');

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_DISCOUNT_PERCENT = 50;

function getAppWebUrl() {
  return (process.env.APP_WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function generateReferralCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += REFERRAL_CODE_CHARS[bytes[i] % REFERRAL_CODE_CHARS.length];
  }
  return code;
}

function formatReferral(row) {
  if (!row) return null;
  return {
    id: row.id,
    referred_name: row.referred_name || null,
    referred_email: row.referred_email || null,
    referred_at: row.referred_at || row.created_at,
    discount_percent: row.discount_percent,
    discount_applied: row.discount_applied,
    discount_status: row.discount_status,
    created_at: row.created_at,
  };
}

class ReferralService {
  constructor() {
    this.referrals = getReferralRepository();
    this.invoices = getInvoiceRepository();
    this.users = getUserRepository();
  }

  async ensureReferralCode(userId) {
    let code = await this.referrals.getReferralCode(userId);
    if (code) return code;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateReferralCode();
      const exists = await this.referrals.codeExists(candidate);
      if (exists) continue;

      const saved = await this.referrals.setReferralCode(userId, candidate);
      if (saved?.referral_code) return saved.referral_code;
      code = await this.referrals.getReferralCode(userId);
      if (code) return code;
    }

    throw new Error('Não foi possível gerar código de indicação.');
  }

  async getSummary(userId) {
    const code = await this.ensureReferralCode(userId);
    const baseUrl = getAppWebUrl();
    const link = `${baseUrl}/cadastro?ref=${code}`;
    const stats = await this.referrals.countByReferrer(userId);
    const rows = await this.referrals.listByReferrer(userId);

    return {
      codigo: code,
      link,
      desconto_percentual: REFERRAL_DISCOUNT_PERCENT,
      regra: `Cada indicação que se cadastrar com seu código garante ${REFERRAL_DISCOUNT_PERCENT}% de desconto na sua próxima mensalidade pendente.`,
      estatisticas: {
        total_indicacoes: stats.total,
        descontos_aplicados: stats.com_desconto,
      },
      indicacoes: rows.map(formatReferral),
    };
  }

  async validateCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || normalized.length < 4) {
      return { valido: false, motivo: 'Código inválido.' };
    }

    const referrer = await this.referrals.findByCode(normalized);
    if (!referrer) {
      return { valido: false, motivo: 'Código de indicação não encontrado.' };
    }

    return {
      valido: true,
      codigo: referrer.referral_code,
      indicador: referrer.name || referrer.email,
    };
  }

  async processReferralOnRegister({ referredUserId, referralCode }) {
    const normalized = String(referralCode || '').trim().toUpperCase();
    if (!normalized) return null;

    const referrer = await this.referrals.findByCode(normalized);
    if (!referrer) {
      throw new Error('Código de indicação inválido.');
    }

    if (referrer.id === referredUserId) {
      throw new Error('Você não pode usar seu próprio código de indicação.');
    }

    const existing = await this.referrals.findByReferredUser(referredUserId);
    if (existing) {
      return existing;
    }

    const referral = await this.referrals.create({
      referrer_user_id: referrer.id,
      referred_user_id: referredUserId,
      referral_code: referrer.referral_code,
      discount_percent: REFERRAL_DISCOUNT_PERCENT,
    });

    try {
      await this.applyDiscountForReferral(referrer.id, referral.id);
    } catch (err) {
      logger.warn('Desconto de indicação pendente.', {
        referralId: referral.id,
        referrerId: referrer.id,
        err: err.message,
      });
    }

    return referral;
  }

  async applyDiscountForReferral(referrerUserId, referralId) {
    const referral = await this.referrals.findById(referralId);
    if (!referral || referral.referrer_user_id !== referrerUserId) {
      throw new Error('Indicação não encontrada.');
    }
    if (referral.discount_applied) {
      return { applied: true, already_applied: true, invoice_id: referral.discount_invoice_id };
    }

    const invoice = await this.invoices.findNextPendingMonthly(referrerUserId);

    if (!invoice) {
      return { applied: false, reason: 'Sem mensalidade pendente no momento.' };
    }

    const originalAmount = Number(invoice.amount);
    const discountPercent = REFERRAL_DISCOUNT_PERCENT;
    const discountedAmount = Math.round(originalAmount * (1 - discountPercent / 100) * 100) / 100;

    if (discountedAmount >= originalAmount) {
      return { applied: false, reason: 'Desconto já aplicado ou valor inválido.' };
    }

    let updatedPayment = null;
    const externalId = invoice.external_payment_id || invoice.asaas_payment_id;
    if (externalId && invoice.payment_provider === 'asaas' && invoice.status === 'pending') {
      try {
        updatedPayment = await asaas.updatePayment(externalId, {
          value: discountedAmount,
          description: `${invoice.description || 'Mensalidade'} — ${discountPercent}% desconto indicação`,
        });
      } catch (err) {
        logger.warn('Falha ao atualizar cobrança Asaas com desconto.', {
          invoiceId: invoice.id,
          err: err.message,
        });
      }
    }

    const updatedInvoice = await this.invoices.applyReferralDiscount(invoice.id, {
      amount: discountedAmount,
      original_amount: originalAmount,
      discount_percent: discountPercent,
      referral_id: referralId,
      payment: updatedPayment,
    });

    await this.referrals.markDiscountApplied(referralId, updatedInvoice.id);

    return {
      applied: true,
      invoice_id: updatedInvoice.id,
      valor_original: originalAmount,
      valor_com_desconto: discountedAmount,
      desconto_percentual: discountPercent,
    };
  }

  async retryPendingDiscounts(userId) {
    const pending = await this.referrals.listPendingDiscounts(userId);
    const results = [];

    for (const referral of pending) {
      try {
        const result = await this.applyDiscountForReferral(userId, referral.id);
        results.push({ referral_id: referral.id, ...result });
      } catch (err) {
        results.push({ referral_id: referral.id, applied: false, error: err.message });
      }
    }

    return results;
  }
}

let instance = null;

function getReferralService() {
  if (!instance) instance = new ReferralService();
  return instance;
}

module.exports = {
  ReferralService,
  getReferralService,
  REFERRAL_DISCOUNT_PERCENT,
  getAppWebUrl,
};
