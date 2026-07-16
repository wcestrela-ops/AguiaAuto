const { getUserRepository, INACTIVE_ACCESS_DAYS_DEFAULT } = require('../repositories/user-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getReferralRepository } = require('../repositories/referral-repository');
const { getFcmTokenRepository } = require('../repositories/fcm-token-repository');
const { getFinanceiroService } = require('./financeiro-service');

function formatVehicle(row) {
  return {
    id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    status: row.status,
    status_label: row.status,
    tracker_phone: row.tracker_phone || null,
    gpswox_device_id: row.gpswox_device_id || null,
    created_at: row.created_at,
  };
}

// vehicle status labels inline to avoid circular deps - use simple map
const VEHICLE_STATUS_LABELS = {
  pending_installation: 'Aguardando instalação',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};

function withVehicleLabels(vehicle) {
  return {
    ...vehicle,
    status_label: VEHICLE_STATUS_LABELS[vehicle.status] || vehicle.status,
  };
}

class AdminClientService {
  constructor() {
    this.users = getUserRepository();
    this.vehicles = getVehicleRepository();
    this.invoices = getInvoiceRepository();
    this.subscriptions = getSubscriptionRepository();
    this.referrals = getReferralRepository();
    this.fcm = getFcmTokenRepository();
    this.financeiro = getFinanceiroService();
  }

  async getPanelSummary(days = INACTIVE_ACCESS_DAYS_DEFAULT) {
    return this.users.getClientPanelStats(days);
  }

  async listClients(filters = {}) {
    const [clients, total] = await Promise.all([
      this.users.listClients(filters),
      this.users.countClients(filters),
    ]);

    return {
      clients: clients.map((row) => ({
        ...row,
        provisioning_errors: row.provisioning_errors || null,
      })),
      total,
      limit: Math.min(Math.max(parseInt(filters.limit || '50', 10), 1), 200),
      offset: Math.max(parseInt(filters.offset || '0', 10), 0),
    };
  }

  async getClientDetail(userId) {
    const user = await this.users.findByIdWithProvisioning(userId);
    if (!user || user.role !== 'client') {
      throw new Error('Cliente não encontrado.');
    }

    const [
      vehicleRows,
      resumo,
      faturas,
      subscription,
      referralCode,
      referralsMade,
      referredBy,
      pushDevices,
    ] = await Promise.all([
      this.vehicles.listByUser(userId),
      this.financeiro.getResumo(userId),
      this.invoices.listByUser(userId, { limit: 10 }),
      this.subscriptions.findActiveByUser(userId),
      this.referrals.getReferralCode(userId),
      this.referrals.listByReferrer(userId),
      this.referrals.findByReferredUser(userId),
      this.fcm.listByUser(userId),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        cpf_cnpj: user.cpf_cnpj,
        active: user.active,
        asaas_customer_id: user.asaas_customer_id,
        mercadopago_payer_id: user.mercadopago_payer_id,
        gpswox_user_id: user.gpswox_user_id,
        provisioning_status: user.provisioning_status,
        provisioning_errors: user.provisioning_errors,
        referral_code: referralCode,
        last_access_at: user.last_access_at,
        last_access_ip: user.last_access_ip,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      resumo_financeiro: resumo,
      veiculos: vehicleRows.map((row) => withVehicleLabels(formatVehicle(row))),
      faturas_recentes: faturas.map((inv) => ({
        id: inv.id,
        description: inv.description,
        amount: Number(inv.amount),
        due_date: inv.due_date,
        status: inv.status,
        payment_provider: inv.payment_provider,
        paid_at: inv.paid_at,
      })),
      assinatura: subscription ? {
        id: subscription.id,
        plan_name: subscription.plan_name,
        price_monthly: Number(subscription.price_monthly),
        status: subscription.status,
        payment_provider: subscription.payment_provider,
      } : null,
      indicacoes: {
        codigo: referralCode,
        feitas: referralsMade.length,
        lista: referralsMade.slice(0, 5).map((row) => ({
          id: row.id,
          referred_name: row.referred_name,
          referred_email: row.referred_email,
          discount_status: row.discount_status,
          created_at: row.created_at,
        })),
        indicado_por: referredBy ? {
          referrer_user_id: referredBy.referrer_user_id,
          referral_code: referredBy.referral_code,
          discount_status: referredBy.discount_status,
        } : null,
      },
      push_devices: pushDevices.length,
    };
  }

  async updateClient(userId, data) {
    const updated = await this.users.updateAdminProfile(userId, {
      name: data.name,
      phone: data.phone,
      active: data.active,
    });

    if (!updated) {
      throw new Error('Cliente não encontrado.');
    }

    if (data.active === false) {
      await this.users.revokeAllUserTokens(userId);
    }

    return updated;
  }
}

let instance = null;

function getAdminClientService() {
  if (!instance) instance = new AdminClientService();
  return instance;
}

module.exports = {
  AdminClientService,
  getAdminClientService,
};
