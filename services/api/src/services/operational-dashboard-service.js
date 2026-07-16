const { getPool } = require('../db/pool');
const { getGpswoxSyncService } = require('./gpswox-sync-service');
const { getBillingNotificationRepository } = require('../repositories/billing-notification-repository');
const { getVehicleFleetService } = require('./vehicle-fleet-service');
const { getEmergencyService } = require('./emergency-service');
const { getUserRepository, INACTIVE_ACCESS_DAYS_DEFAULT } = require('../repositories/user-repository');

class OperationalDashboardService {
  constructor() {
    this.pool = getPool();
  }

  async getSummary() {
    const [
      vehiclesMissingChip,
      vehiclesMissingDevice,
      vehiclesMissingImei,
      vehiclesMissingModel,
      pendingInstallations,
      provisioningIssues,
      failedCommands24h,
      failedSms24h,
      overdueInvoices,
      recentFailedCommands,
      recentFailedSms,
      billingSmsFallback24h,
      billingFailed24h,
      recentBillingFallbacks,
      recentBillingFailed,
      overdueInvoicesList,
      gpswoxSync,
      fleetOps,
      emergencyOps,
      inactiveAccessClients,
    ] = await Promise.all([
      this._vehiclesMissingChip(),
      this._vehiclesMissingDevice(),
      this._vehiclesMissingImei(),
      this._vehiclesMissingModel(),
      this._pendingInstallations(),
      this._provisioningIssues(),
      this._countFailedCommands(24),
      this._countFailedSms(24),
      this._overdueInvoices(),
      this._recentFailedCommands(10),
      this._recentFailedSms(10),
      getBillingNotificationRepository().countSince(24, { channel: 'sms', usedFallback: true, status: 'sent' }),
      getBillingNotificationRepository().countSince(24, { status: 'failed' }),
      getBillingNotificationRepository().listRecent({
        limit: 10,
        channel: 'sms',
      }).then((rows) => rows.filter((row) => row.used_fallback)),
      getBillingNotificationRepository().listRecentFailed(10),
      getGpswoxSyncService().getStatus().catch(() => null),
      getVehicleFleetService().getOperationalSummary().catch(() => null),
      getEmergencyService().getOperationalStats().catch(() => null),
      this._inactiveAccessClients(INACTIVE_ACCESS_DAYS_DEFAULT),
    ]);

    const alerts = [];

    if (vehiclesMissingChip.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'vehicles_missing_chip',
        title: 'Veículos ativos sem chip SIM',
        count: vehiclesMissingChip.count,
        link: '/admin/veiculos',
        hint: 'Failover 4G→SMS não funciona sem número do chip.',
      });
    }

    if (vehiclesMissingDevice.count > 0) {
      alerts.push({
        severity: 'error',
        key: 'vehicles_missing_device',
        title: 'Veículos sem device ID do rastreador',
        count: vehiclesMissingDevice.count,
        link: '/admin/veiculos',
      });
    }

    if (vehiclesMissingImei.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'vehicles_missing_imei',
        title: 'Veículos ativos sem IMEI',
        count: vehiclesMissingImei.count,
        link: '/admin/veiculos',
        hint: 'IMEI deve ser registrado na instalação para suporte e failover SMS.',
      });
    }

    if (vehiclesMissingModel.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'vehicles_missing_model',
        title: 'Veículos ativos sem modelo de rastreador',
        count: vehiclesMissingModel.count,
        link: '/admin/veiculos',
        hint: 'Modelo define comandos SMS e perfil do dispositivo.',
      });
    }

    if (provisioningIssues.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'provisioning_issues',
        title: 'Clientes com provisionamento incompleto',
        count: provisioningIssues.count,
        link: '/admin/financeiro',
      });
    }

    if (failedCommands24h > 0) {
      alerts.push({
        severity: 'error',
        key: 'failed_commands',
        title: 'Comandos ao rastreador falharam (24h)',
        count: failedCommands24h,
        link: '/admin/veiculos',
      });
    }

    if (failedSms24h > 0) {
      alerts.push({
        severity: 'warning',
        key: 'failed_sms',
        title: 'SMS falharam (24h)',
        count: failedSms24h,
        link: '/admin/sms',
        hint: 'Inclui rastreador e cobrança — filtre por ação na página SMS.',
      });
    }

    if (billingSmsFallback24h > 0) {
      alerts.push({
        severity: 'warning',
        key: 'billing_sms_fallback',
        title: 'Cobranças enviadas via SMS (WhatsApp indisponível)',
        count: billingSmsFallback24h,
        link: '/admin/financeiro',
        hint: 'WhatsApp falhou e o lembrete foi entregue por SMS.',
      });
    }

    if (billingFailed24h > 0) {
      alerts.push({
        severity: 'error',
        key: 'billing_notifications_failed',
        title: 'Lembretes de cobrança falharam (24h)',
        count: billingFailed24h,
        link: '/admin/financeiro',
      });
    }

    if (overdueInvoicesList.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'overdue_invoices',
        title: 'Faturas vencidas',
        count: overdueInvoicesList.count,
        link: '/admin/financeiro',
      });
    }

    if (fleetOps?.documents_expired > 0) {
      alerts.push({
        severity: 'error',
        key: 'fleet_documents_expired',
        title: 'Documentos de veículos vencidos',
        count: fleetOps.documents_expired,
        link: '/admin/frota',
      });
    }

    if (fleetOps?.documents_expiring > fleetOps?.documents_expired) {
      const expiringSoon = fleetOps.documents_expiring - (fleetOps.documents_expired || 0);
      if (expiringSoon > 0) {
        alerts.push({
          severity: 'warning',
          key: 'fleet_documents_expiring',
          title: 'Documentos vencendo (30 dias)',
          count: expiringSoon,
          link: '/admin/frota',
        });
      }
    }

    if (fleetOps?.maintenance_overdue > 0) {
      alerts.push({
        severity: 'error',
        key: 'fleet_maintenance_overdue',
        title: 'Manutenções em atraso',
        count: fleetOps.maintenance_overdue,
        link: '/admin/frota',
      });
    }

    if (fleetOps?.maintenance_due > fleetOps?.maintenance_overdue) {
      const dueSoon = fleetOps.maintenance_due - (fleetOps.maintenance_overdue || 0);
      if (dueSoon > 0) {
        alerts.push({
          severity: 'warning',
          key: 'fleet_maintenance_due',
          title: 'Manutenções próximas (30 dias)',
          count: dueSoon,
          link: '/admin/frota',
        });
      }
    }

    if (emergencyOps?.count_24h > 0) {
      alerts.push({
        severity: 'error',
        key: 'emergency_events_24h',
        title: 'Emergências acionadas (24h)',
        count: emergencyOps.count_24h,
        link: '/admin/emergencia',
        hint: 'Clientes usaram o botão SOS — veja eventos e localização.',
      });
    }

    if (inactiveAccessClients.count > 0) {
      alerts.push({
        severity: 'warning',
        key: 'clients_inactive_access',
        title: `Clientes sem acesso há ${INACTIVE_ACCESS_DAYS_DEFAULT}+ dias`,
        count: inactiveAccessClients.count,
        link: `/admin/clientes?access_inactive_days=${INACTIVE_ACCESS_DAYS_DEFAULT}&sort=last_access_asc`,
        hint: 'Contas ativas que nunca entraram ou estão inativas no app.',
      });
    }

    if (pendingInstallations.count > 0) {
      alerts.push({
        severity: 'info',
        key: 'pending_installations',
        title: 'Aguardando instalação',
        count: pendingInstallations.count,
        link: '/admin/veiculos',
      });
    }

    if (gpswoxSync) {
      const syncLabel = gpswoxSync.provider_label || 'GPSWOX';
      const integrationsPath = gpswoxSync.provider === 'traccar'
        ? '/admin/integracoes/traccar'
        : '/admin/integracoes/gpswox';

      if (gpswoxSync.auto_sync_enabled && gpswoxSync.due_now) {
        alerts.push({
          severity: 'info',
          key: 'gpswox_sync_due',
          title: `Sync ${syncLabel} pendente`,
          count: 1,
          link: '/admin/veiculos',
          hint: 'O sync automático deve rodar em breve (intervalo configurado).',
        });
      }

      if (gpswoxSync.last_run && !gpswoxSync.last_run.success) {
        alerts.push({
          severity: 'error',
          key: 'gpswox_sync_failed',
          title: `Último sync ${syncLabel} falhou`,
          count: 1,
          link: '/admin/veiculos',
          hint: gpswoxSync.last_run.error_message || `Verifique credenciais ${syncLabel} e gateway.`,
        });
      }

      if (gpswoxSync.unlinked_devices_last_success > 0) {
        alerts.push({
          severity: 'warning',
          key: 'gpswox_unlinked_devices',
          title: `Dispositivos ${syncLabel} sem cliente Águia`,
          count: gpswoxSync.unlinked_devices_last_success,
          link: '/admin/veiculos',
          hint: `Vincule users.tracker_user_id, atributo aguia_user_id no device ou cadastre o cliente. Config: ${integrationsPath}`,
        });
      }
    }

    return {
      generated_at: new Date().toISOString(),
      counts: {
        vehicles_missing_chip: vehiclesMissingChip.count,
        vehicles_missing_device: vehiclesMissingDevice.count,
        vehicles_missing_imei: vehiclesMissingImei.count,
        vehicles_missing_model: vehiclesMissingModel.count,
        pending_installations: pendingInstallations.count,
        provisioning_issues: provisioningIssues.count,
        failed_commands_24h: failedCommands24h,
        failed_sms_24h: failedSms24h,
        billing_sms_fallback_24h: billingSmsFallback24h,
        billing_notifications_failed_24h: billingFailed24h,
        overdue_invoices: overdueInvoicesList.count,
        gpswox_unlinked_devices: gpswoxSync?.unlinked_devices_last_success || 0,
        fleet_documents_expiring: fleetOps?.documents_expiring || 0,
        fleet_documents_expired: fleetOps?.documents_expired || 0,
        fleet_maintenance_due: fleetOps?.maintenance_due || 0,
        fleet_maintenance_overdue: fleetOps?.maintenance_overdue || 0,
        emergency_events_24h: emergencyOps?.count_24h || 0,
        clients_inactive_access_30d: inactiveAccessClients.count,
        inactive_access_days: inactiveAccessClients.days,
      },
      gpswox_sync: gpswoxSync,
      fleet: fleetOps,
      emergency: emergencyOps,
      alerts,
      details: {
        vehicles_missing_chip: vehiclesMissingChip.items,
        vehicles_missing_device: vehiclesMissingDevice.items,
        vehicles_missing_imei: vehiclesMissingImei.items,
        vehicles_missing_model: vehiclesMissingModel.items,
        pending_installations: pendingInstallations.items,
        provisioning_issues: provisioningIssues.items,
        recent_failed_commands: recentFailedCommands,
        recent_failed_sms: recentFailedSms,
        recent_billing_sms_fallback: recentBillingFallbacks,
        recent_billing_failed: recentBillingFailed,
        overdue_invoices: overdueInvoicesList.items,
        fleet_expiring_documents: fleetOps?.recent_expiring_documents || [],
        fleet_due_maintenance: fleetOps?.recent_due_maintenance || [],
        emergency_recent: emergencyOps?.recent || [],
        inactive_access_clients: inactiveAccessClients.items,
      },
    };
  }

  async _vehiclesMissingChip() {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.plate, v.status, u.email AS user_email, u.name AS user_name
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.status IN ('active', 'blocked')
         AND (v.tracker_phone IS NULL OR TRIM(v.tracker_phone) = '')
       ORDER BY v.updated_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE status IN ('active', 'blocked')
         AND (tracker_phone IS NULL OR TRIM(tracker_phone) = '')`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _vehiclesMissingDevice() {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.plate, v.status, u.email AS user_email
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.tracker_device_id IS NULL OR TRIM(v.tracker_device_id) = ''
       ORDER BY v.created_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE tracker_device_id IS NULL OR TRIM(tracker_device_id) = ''`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _vehiclesMissingImei() {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.plate, v.status, u.email AS user_email, u.name AS user_name
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.status IN ('active', 'blocked')
         AND (v.tracker_imei IS NULL OR TRIM(v.tracker_imei) = '')
       ORDER BY v.updated_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE status IN ('active', 'blocked')
         AND (tracker_imei IS NULL OR TRIM(tracker_imei) = '')`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _vehiclesMissingModel() {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.plate, v.status, u.email AS user_email, u.name AS user_name
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.status IN ('active', 'blocked')
         AND v.tracker_model_id IS NULL
       ORDER BY v.updated_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE status IN ('active', 'blocked')
         AND tracker_model_id IS NULL`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _pendingInstallations() {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.plate, v.status, v.created_at, v.installation_scheduled_at, v.assigned_at,
              u.id AS user_id, u.email AS user_email, u.name AS user_name,
              inst.id AS assigned_installer_id, inst.name AS assigned_installer_name, inst.email AS assigned_installer_email
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN users inst ON inst.id = v.assigned_installer_id
       WHERE v.status = 'pending_installation'
       ORDER BY v.installation_scheduled_at ASC NULLS LAST, v.created_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles WHERE status = 'pending_installation'`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _provisioningIssues() {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, provisioning_status, tracker_user_id, asaas_customer_id
       FROM users
       WHERE role = 'client'
         AND active = true
         AND COALESCE(provisioning_status, 'pending') NOT IN ('completed')
       ORDER BY created_at DESC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE role = 'client'
         AND active = true
         AND COALESCE(provisioning_status, 'pending') NOT IN ('completed')`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _countFailedCommands(hours) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_command_logs
       WHERE status = 'failed'
         AND created_at >= NOW() - ($1 || ' hours')::interval`,
      [String(hours)],
    );
    return rows[0].count;
  }

  async _countFailedSms(hours) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM sms_dispatches
       WHERE status = 'failed'
         AND created_at >= NOW() - ($1 || ' hours')::interval`,
      [String(hours)],
    );
    return rows[0].count;
  }

  async _overdueInvoices() {
    const { rows } = await this.pool.query(
      `SELECT i.id, i.description, i.amount, i.due_date, i.status,
              u.id AS user_id, u.email AS user_email, u.name AS user_name
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE i.status IN ('overdue', 'pending')
         AND i.due_date < CURRENT_DATE
       ORDER BY i.due_date ASC
       LIMIT 15`,
    );
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM invoices
       WHERE status IN ('overdue', 'pending')
         AND due_date < CURRENT_DATE`,
    );
    return { count: countRows[0].count, items: rows };
  }

  async _recentFailedCommands(limit) {
    const { rows } = await this.pool.query(
      `SELECT l.id, l.action, l.channel, l.error_message, l.created_at,
              v.plate, u.email AS user_email
       FROM vehicle_command_logs l
       JOIN vehicles v ON v.id = l.vehicle_id
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.status = 'failed'
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async _recentFailedSms(limit) {
    const { rows } = await this.pool.query(
      `SELECT id, phone, action, error_message, status, created_at
       FROM sms_dispatches
       WHERE status = 'failed'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async _inactiveAccessClients(days = INACTIVE_ACCESS_DAYS_DEFAULT) {
    const users = getUserRepository();
    const [count, items] = await Promise.all([
      users.countInactiveAccessClients(days),
      users.listInactiveAccessClients(days, 10),
    ]);
    return { count, items, days: Number(days) };
  }
}

let instance = null;

function getOperationalDashboardService() {
  if (!instance) instance = new OperationalDashboardService();
  return instance;
}

module.exports = { OperationalDashboardService, getOperationalDashboardService };
