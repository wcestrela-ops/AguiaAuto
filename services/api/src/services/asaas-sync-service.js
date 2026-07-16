const crypto = require('crypto');
const asaas = require('../integrations/asaas');
const { getUserRepository } = require('../repositories/user-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getAsaasSyncRunRepository } = require('../repositories/asaas-sync-run-repository');
const { getAuditService } = require('./audit-service');
const logger = require('../logger');

let syncInProgress = false;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isInitialChargeDescription(description) {
  const text = String(description || '').toLowerCase();
  return text.includes('adesão') || text.includes('adesao') || text.includes('inicial');
}

class AsaasSyncService {
  constructor() {
    this.users = getUserRepository();
    this.subscriptions = getSubscriptionRepository();
    this.invoices = getInvoiceRepository();
    this.runs = getAsaasSyncRunRepository();
  }

  async getStatus() {
    const config = await asaas.getConfig();
    const lastRun = await this.runs.getLastRun();
    const lastSuccess = await this.runs.getLastRun({ successOnly: true });
    const recent = await this.runs.listRecent(10);

    let remoteCount = null;
    if (config.api_key) {
      try {
        const page = await asaas.listCustomers({ offset: 0, limit: 1 });
        remoteCount = page?.totalCount ?? null;
      } catch (err) {
        logger.warn('Falha ao consultar total de clientes Asaas.', { err: err.message });
      }
    }

    return {
      configured: Boolean(config.api_key),
      in_progress: syncInProgress,
      remote_customer_count: remoteCount,
      last_run: lastRun,
      last_success: lastSuccess,
      recent_runs: recent,
    };
  }

  async preview({ create_users = true, import_invoices = true, import_subscriptions = true } = {}) {
    const customers = await asaas.listAllCustomers();
    const preview = [];
    let wouldCreate = 0;
    let wouldLink = 0;
    let wouldSkip = 0;

    for (const customer of customers) {
      const match = await this._matchUser(customer);
      let action = 'create';

      if (match.by === 'asaas_id') {
        action = 'linked';
        wouldLink += 1;
      } else if (match.user) {
        action = 'link';
        wouldLink += 1;
      } else if (!create_users) {
        action = 'skip';
        wouldSkip += 1;
      } else if (!normalizeEmail(customer.email)) {
        action = 'skip';
        wouldSkip += 1;
      } else {
        wouldCreate += 1;
      }

      preview.push({
        asaas_customer_id: customer.id,
        name: customer.name,
        email: customer.email,
        cpf_cnpj: customer.cpf_cnpj,
        action,
        matched_user_id: match.user?.id || null,
        matched_by: match.by,
      });
    }

    return {
      dry_run: true,
      total_customers: customers.length,
      would_create_users: wouldCreate,
      would_link_users: wouldLink,
      would_skip: wouldSkip,
      import_invoices,
      import_subscriptions,
      customers: preview,
    };
  }

  async runSync({
    dry_run = false,
    create_users = true,
    import_invoices = true,
    import_subscriptions = true,
    triggered_by = 'admin',
    adminUserId = null,
  } = {}) {
    if (syncInProgress) {
      throw new Error('Sincronização Asaas já em andamento.');
    }

    syncInProgress = true;
    const run = dry_run ? null : await this.runs.startRun({ triggered_by, dry_run: false });
    const summary = {
      total_customers: 0,
      users_created: 0,
      users_linked: 0,
      subscriptions_imported: 0,
      invoices_imported: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const customers = await asaas.listAllCustomers();
      summary.total_customers = customers.length;

      for (const customer of customers) {
        try {
          const result = await this._syncCustomer(customer, {
            dry_run,
            create_users,
            import_invoices,
            import_subscriptions,
          });
          summary.users_created += result.users_created;
          summary.users_linked += result.users_linked;
          summary.subscriptions_imported += result.subscriptions_imported;
          summary.invoices_imported += result.invoices_imported;
          summary.skipped += result.skipped;
          if (result.error) {
            summary.errors.push({
              asaas_customer_id: customer.id,
              email: customer.email,
              reason: result.error,
            });
          }
        } catch (err) {
          summary.errors.push({
            asaas_customer_id: customer.id,
            email: customer.email,
            reason: err.message,
          });
        }
      }

      if (!dry_run && run) {
        await this.runs.finishRun(run.id, {
          summary,
          success: summary.errors.length === 0,
          error_message: summary.errors.length ? `${summary.errors.length} cliente(s) com erro.` : null,
        });

        await getAuditService().adminAction('asaas.sync', {
          userId: adminUserId,
          resourceType: 'integration',
          resourceId: 'asaas',
          metadata: summary,
        });
      }

      return {
        dry_run,
        ...summary,
        success: summary.errors.length === 0,
      };
    } catch (err) {
      if (run) {
        await this.runs.finishRun(run.id, {
          summary,
          success: false,
          error_message: err.message,
        });
      }
      throw err;
    } finally {
      syncInProgress = false;
    }
  }

  async _matchUser(customer) {
    const byAsaas = await this.users.findByAsaasCustomerId(customer.id);
    if (byAsaas) return { user: byAsaas, by: 'asaas_id' };

    const email = normalizeEmail(customer.email);
    if (email) {
      const byEmail = await this.users.findByEmail(email);
      if (byEmail) return { user: byEmail, by: 'email' };
    }

    if (customer.cpf_cnpj) {
      const byCpf = await this.users.findByCpfCnpj(customer.cpf_cnpj);
      if (byCpf) return { user: byCpf, by: 'cpf_cnpj' };
    }

    return { user: null, by: null };
  }

  async _syncCustomer(customer, options) {
    const result = {
      users_created: 0,
      users_linked: 0,
      subscriptions_imported: 0,
      invoices_imported: 0,
      skipped: 0,
      error: null,
      user_id: null,
    };

    let user = null;
    const match = await this._matchUser(customer);

    if (match.user) {
      user = match.user;
      if (!options.dry_run) {
        if (!user.asaas_customer_id) {
          await this.users.updateProvisioning(user.id, {
            asaas_customer_id: customer.id,
            provisioning_status: user.provisioning_status === 'completed' ? 'completed' : 'partial',
          });
          result.users_linked += 1;
        } else if (user.asaas_customer_id !== customer.id) {
          result.skipped += 1;
          result.error = `Usuário ${user.id} já vinculado a outro cliente Asaas (${user.asaas_customer_id}).`;
          return result;
        }
      } else if (!user.asaas_customer_id || user.asaas_customer_id === customer.id) {
        result.users_linked += 1;
      } else {
        result.skipped += 1;
        result.error = `Conflito de vínculo Asaas para usuário ${user.id}.`;
        return result;
      }
      result.user_id = user.id;
    } else if (options.create_users) {
      const email = normalizeEmail(customer.email);
      if (!email) {
        result.skipped += 1;
        result.error = 'Cliente Asaas sem e-mail — não foi possível criar usuário.';
        return result;
      }

      if (!options.dry_run) {
        user = await this.users.createImportedFromAsaas({
          email,
          name: customer.name || email,
          phone: customer.phone,
          cpf_cnpj: customer.cpf_cnpj,
          asaas_customer_id: customer.id,
        });
        result.users_created += 1;
        result.user_id = user.id;
      } else {
        result.users_created += 1;
      }
    } else {
      result.skipped += 1;
      return result;
    }

    if (options.dry_run || !result.user_id) {
      return result;
    }

    user = user || await this.users.findByIdWithProvisioning(result.user_id);
    const subscriptionMap = new Map();

    if (options.import_subscriptions) {
      const subscriptions = await asaas.listCustomerSubscriptions(customer.id);
      for (const sub of subscriptions) {
        let local = await this.subscriptions.findByExternalSubscription('asaas', sub.id);
        if (!local) {
          local = await this.subscriptions.create({
            user_id: user.id,
            plan_id: null,
            status: sub.status,
            payment_provider: 'asaas',
            billing_type: sub.billing_type === 'UNDEFINED' ? 'PIX' : sub.billing_type,
            asaas_subscription_id: sub.id,
            external_subscription_id: sub.id,
          });
          result.subscriptions_imported += 1;
        }
        subscriptionMap.set(sub.id, local.id);
      }
    }

    if (options.import_invoices) {
      const payments = await asaas.listCustomerPayments(customer.id);
      for (const payment of payments) {
        const subscriptionId = payment.subscription_id
          ? subscriptionMap.get(payment.subscription_id) || null
          : null;

        await this.invoices.upsertFromAsaas({
          user_id: user.id,
          subscription_id: subscriptionId,
          asaas_payment_id: payment.external_payment_id,
          description: payment.description,
          amount: payment.amount,
          due_date: payment.due_date,
          status: payment.status,
          billing_type: payment.billing_type === 'UNDEFINED' ? 'PIX' : payment.billing_type,
          invoice_url: payment.invoice_url,
          bank_slip_url: payment.bank_slip_url,
          pix_qrcode: payment.pix_qrcode,
          pix_copy_paste: payment.pix_copy_paste,
          paid_at: payment.paid_at,
          is_initial_charge: isInitialChargeDescription(payment.description),
        });
        result.invoices_imported += 1;
      }
    }

    return result;
  }
}

let instance = null;

function getAsaasSyncService() {
  if (!instance) instance = new AsaasSyncService();
  return instance;
}

module.exports = { AsaasSyncService, getAsaasSyncService, isInitialChargeDescription };
