const crypto = require('crypto');
const { getReferralRepository } = require('../repositories/referral-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getContractRepository } = require('../repositories/contract-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const asaas = require('../integrations/asaas');
const firebase = require('./firebase');
const logger = require('../logger');

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_DISCOUNT_PERCENT = 50;

function getAppWebUrl() {
  return (process.env.APP_WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function currentYearMonth(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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
  const statusLabels = {
    awaiting_completion: 'Aguardando instalação e contrato',
    qualified: 'Confirmada — aplicando desconto',
    applied: 'Desconto aplicado',
  };
  return {
    id: row.id,
    referred_name: row.referred_name || null,
    referred_email: row.referred_email || null,
    referred_at: row.referred_at || row.created_at,
    discount_percent: row.discount_percent,
    discount_applied: row.discount_applied,
    discount_status: row.discount_status,
    discount_status_label: statusLabels[row.discount_status] || row.discount_status,
    qualified_at: row.qualified_at,
    created_at: row.created_at,
  };
}

class ReferralService {
  constructor() {
    this.referrals = getReferralRepository();
    this.invoices = getInvoiceRepository();
    this.contracts = getContractRepository();
    this.vehicles = getVehicleRepository();
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
      regra: `Cada indicação que concluir instalação e aceitar o contrato no mesmo mês garante ${REFERRAL_DISCOUNT_PERCENT}% de desconto na mensalidade. Duas indicações no mês = mensalidade isenta (100%).`,
      estatisticas: {
        total_indicacoes: stats.total,
        confirmadas: stats.confirmadas,
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

    return this.referrals.create({
      referrer_user_id: referrer.id,
      referred_user_id: referredUserId,
      referral_code: referrer.referral_code,
      discount_percent: REFERRAL_DISCOUNT_PERCENT,
    });
  }

  async isReferredUserQualified(referredUserId) {
    const [hasService, hasDelivery, activeVehicles] = await Promise.all([
      this.contracts.hasServiceAcceptance(referredUserId),
      this.contracts.hasDeliveryAcceptance(referredUserId),
      this.vehicles.countActiveByUser(referredUserId),
    ]);
    return hasService && hasDelivery && activeVehicles > 0;
  }

  async checkAndRewardForReferredUser(referredUserId) {
    const referral = await this.referrals.findByReferredUser(referredUserId);
    if (!referral) return null;

    if (referral.discount_status !== 'awaiting_completion') {
      if (referral.discount_status === 'qualified') {
        const yearMonth = referral.qualified_at
          ? currentYearMonth(new Date(referral.qualified_at))
          : currentYearMonth();
        return this.syncReferrerDiscountForMonth(referral.referrer_user_id, yearMonth);
      }
      return null;
    }

    const qualified = await this.isReferredUserQualified(referredUserId);
    if (!qualified) return { qualified: false };

    const updated = await this.referrals.markQualified(referral.id);
    if (!updated) return null;

    const yearMonth = currentYearMonth();
    const result = await this.syncReferrerDiscountForMonth(referral.referrer_user_id, yearMonth);

    this._notifyReferrerReward(referral.referrer_user_id, result).catch((err) => {
      logger.warn('Falha ao notificar indicador.', { err: err.message });
    });

    return { qualified: true, ...result };
  }

  async syncReferrerDiscountForMonth(referrerUserId, yearMonth) {
    const qualifiedCount = await this.referrals.countQualifiedInMonth(referrerUserId, yearMonth);
    if (!qualifiedCount) {
      return { synced: false, reason: 'Nenhuma indicação confirmada neste mês.' };
    }

    const totalPercent = Math.min(100, qualifiedCount * REFERRAL_DISCOUNT_PERCENT);
    let invoice = await this.invoices.findPendingMonthlyForMonth(referrerUserId, yearMonth);
    if (!invoice) {
      invoice = await this.invoices.findNextPendingMonthly(referrerUserId);
    }
    if (!invoice) {
      return { synced: false, reason: 'Mensalidade pendente ainda não gerada.', total_percent: totalPercent };
    }

    const baseAmount = Number(invoice.original_amount || invoice.amount);
    const discountedAmount = Math.round(baseAmount * (1 - totalPercent / 100) * 100) / 100;
    const qualifiedRows = await this.referrals.listQualifiedInMonth(referrerUserId, yearMonth);
    const description = totalPercent >= 100
      ? `Mensalidade isenta — ${qualifiedCount} indicações confirmadas`
      : `Mensalidade — ${totalPercent}% desconto (${qualifiedCount} indicação${qualifiedCount > 1 ? 'ões' : ''})`;

    let updatedPayment = null;
    const externalId = invoice.external_payment_id || invoice.asaas_payment_id;

    if (totalPercent >= 100) {
      if (externalId && invoice.payment_provider === 'asaas') {
        try {
          await asaas.deletePayment(externalId);
        } catch (err) {
          logger.warn('Falha ao cancelar cobrança Asaas (100% indicação).', {
            invoiceId: invoice.id,
            err: err.message,
          });
        }
      }

      const updatedInvoice = await this.invoices.applyReferralDiscount(invoice.id, {
        amount: 0,
        original_amount: baseAmount,
        discount_percent: totalPercent,
        referral_id: qualifiedRows[qualifiedRows.length - 1]?.id || null,
        status: 'waived',
        description,
      });

      await this.referrals.markAppliedForInvoice(
        qualifiedRows.map((r) => r.id),
        updatedInvoice.id
      );

      return {
        synced: true,
        invoice_id: updatedInvoice.id,
        total_percent: totalPercent,
        valor_original: baseAmount,
        valor_final: 0,
        isento: true,
      };
    }

    if (externalId && invoice.payment_provider === 'asaas' && invoice.status === 'pending') {
      try {
        updatedPayment = await asaas.updatePayment(externalId, {
          value: discountedAmount,
          description,
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
      original_amount: baseAmount,
      discount_percent: totalPercent,
      referral_id: qualifiedRows[qualifiedRows.length - 1]?.id || null,
      payment: updatedPayment,
      description,
    });

    await this.referrals.markAppliedForInvoice(
      qualifiedRows.map((r) => r.id),
      updatedInvoice.id
    );

    return {
      synced: true,
      invoice_id: updatedInvoice.id,
      total_percent: totalPercent,
      valor_original: baseAmount,
      valor_final: discountedAmount,
      isento: false,
    };
  }

  async syncAllPendingRewards() {
    const referrerIds = await this.referrals.listReferrersNeedingRewardSync();
    const yearMonth = currentYearMonth();
    const results = [];

    for (const referrerId of referrerIds) {
      try {
        const result = await this.syncReferrerDiscountForMonth(referrerId, yearMonth);
        results.push({ referrer_id: referrerId, ...result });
      } catch (err) {
        results.push({ referrer_id: referrerId, synced: false, error: err.message });
      }
    }

    const awaiting = await this.referrals.listAwaitingCompletion();
    for (const referral of awaiting) {
      try {
        await this.checkAndRewardForReferredUser(referral.referred_user_id);
      } catch (err) {
        logger.warn('Falha ao verificar qualificação de indicação.', {
          referralId: referral.id,
          err: err.message,
        });
      }
    }

    return { processed: results.length + awaiting.length, results };
  }

  async _notifyReferrerReward(referrerUserId, result) {
    if (!result?.synced) return;

    const body = result.isento
      ? 'Suas indicações confirmadas isentaram a mensalidade deste mês!'
      : `Desconto de ${result.total_percent}% aplicado na sua mensalidade.`;

    await firebase.sendPushToUser(referrerUserId, {
      title: 'Indique e Ganhe — desconto aplicado',
      body,
      data: { type: 'referral_reward', invoice_id: String(result.invoice_id || '') },
    });
  }
}

let instance = null;

function getReferralService() {
  if (!instance) instance = new ReferralService();
  return instance;
}

function startReferralRewardPoller(intervalMs = 60000) {
  const run = async () => {
    try {
      await getReferralService().syncAllPendingRewards();
    } catch (err) {
      logger.warn('Poller de indicações falhou.', { err: err.message });
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  ReferralService,
  getReferralService,
  startReferralRewardPoller,
  REFERRAL_DISCOUNT_PERCENT,
  getAppWebUrl,
};
