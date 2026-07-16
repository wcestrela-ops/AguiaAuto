const gpswox = require('../integrations/gpswox-gateway');
const { getTrackerModelRepository } = require('../repositories/tracker-model-repository');
const logger = require('../logger');

function slugifyActionKey(title) {
  return String(title || 'template')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'template';
}

function uniqueActionKey(base, used) {
  let key = base;
  let i = 2;
  while (used.has(key)) {
    key = `${base}_${i}`;
    i += 1;
  }
  used.add(key);
  return key;
}

function extractCreatedTemplateId(response) {
  const item = response?.item || response?.data?.item || response?.data;
  return item?.id ? Number(item.id) : null;
}

class GpswoxSmsTemplateService {
  constructor({ repo } = {}) {
    this.repo = repo || getTrackerModelRepository();
  }

  async listFromGpswox(lang = 'en') {
    const result = await gpswox.listSmsTemplates(lang);
    const payload = result?.data || result;
    return {
      items: payload?.items || [],
      total: payload?.total || 0,
      meta: payload?.meta || null,
    };
  }

  async importToModel(modelId, { dry_run = false, lang = 'en' } = {}) {
    const model = await this.repo.findModelById(modelId);
    if (!model) throw new Error('Modelo de rastreador não encontrado.');

    const { items } = await this.listFromGpswox(lang);
    const existingCommands = await this.repo.listCommands(modelId);
    const usedKeys = new Set(existingCommands.map((c) => c.action_key));
    const byGpswoxId = new Map(
      existingCommands
        .filter((c) => c.gpswox_sms_template_id)
        .map((c) => [Number(c.gpswox_sms_template_id), c]),
    );

    const preview = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const template of items) {
      const gpswoxId = Number(template.id);
      const title = template.title || template.título || `Template ${gpswoxId}`;
      const message = template.message || template.mensagem || '';
      if (!message) {
        skipped += 1;
        continue;
      }

      const existing = byGpswoxId.get(gpswoxId);
      if (existing) {
        preview.push({ action: 'update', gpswox_id: gpswoxId, label: title, message });
        if (!dry_run) {
          await this.repo.updateCommand(existing.id, {
            label: title,
            sms_template: message,
            gpswox_sms_template_id: gpswoxId,
          });
          updated += 1;
        }
        continue;
      }

      const actionKey = uniqueActionKey(slugifyActionKey(title), usedKeys);
      preview.push({ action: 'create', action_key: actionKey, gpswox_id: gpswoxId, label: title, message });

      if (!dry_run) {
        await this.repo.createCommand(modelId, {
          action_key: actionKey,
          label: title,
          sms_template: message,
          gpswox_sms_template_id: gpswoxId,
          sort_order: existingCommands.length + created + 1,
        });
        created += 1;
      }
    }

    logger.info('Import GPSWOX SMS templates', { modelId, dry_run, created, updated, skipped, total: items.length });

    return {
      model_id: modelId,
      model_name: model.name,
      dry_run,
      total_gpswox: items.length,
      created: dry_run ? preview.filter((p) => p.action === 'create').length : created,
      updated: dry_run ? preview.filter((p) => p.action === 'update').length : updated,
      skipped,
      preview: preview.slice(0, 50),
    };
  }

  async pushModelToGpswox(modelId, { lang = 'en', update_existing = true } = {}) {
    const model = await this.repo.findModelById(modelId);
    if (!model) throw new Error('Modelo de rastreador não encontrado.');

    const commands = await this.repo.listCommands(modelId);
    const results = [];

    for (const cmd of commands) {
      const title = cmd.label || cmd.action_key;
      const message = cmd.sms_template;
      if (!message) continue;

      try {
        if (cmd.gpswox_sms_template_id && update_existing) {
          const response = await gpswox.updateSmsTemplate(cmd.gpswox_sms_template_id, {
            title,
            message,
            lang,
          });
          results.push({
            command_id: cmd.id,
            action_key: cmd.action_key,
            action: 'updated',
            gpswox_sms_template_id: cmd.gpswox_sms_template_id,
            response,
          });
          continue;
        }

        const response = await gpswox.createSmsTemplate({ title, message, lang });
        const gpswoxId = extractCreatedTemplateId(response?.data || response);
        if (gpswoxId) {
          await this.repo.updateCommand(cmd.id, { gpswox_sms_template_id: gpswoxId });
        }

        results.push({
          command_id: cmd.id,
          action_key: cmd.action_key,
          action: 'created',
          gpswox_sms_template_id: gpswoxId,
        });
      } catch (err) {
        results.push({
          command_id: cmd.id,
          action_key: cmd.action_key,
          action: 'failed',
          error: err.message,
        });
      }
    }

    const summary = {
      model_id: modelId,
      model_name: model.name,
      pushed: results.filter((r) => r.action === 'created' || r.action === 'updated').length,
      failed: results.filter((r) => r.action === 'failed').length,
      results,
    };

    logger.info('Push SMS templates to GPSWOX', summary);
    return summary;
  }
}

let instance = null;

function getGpswoxSmsTemplateService() {
  if (!instance) instance = new GpswoxSmsTemplateService();
  return instance;
}

module.exports = { GpswoxSmsTemplateService, getGpswoxSmsTemplateService };
