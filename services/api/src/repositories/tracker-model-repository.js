const { getPool } = require('../db/pool');

class TrackerModelRepository {
  constructor() {
    this.pool = getPool();
  }

  async listModels() {
    const { rows } = await this.pool.query(
      `SELECT m.*,
        (SELECT COUNT(*)::int FROM tracker_commands c WHERE c.model_id = m.id AND c.active = true) AS command_count
       FROM tracker_models m
       ORDER BY m.name ASC`,
    );
    return rows;
  }

  async findModelById(id) {
    const { rows } = await this.pool.query('SELECT * FROM tracker_models WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findModelByName(name) {
    const { rows } = await this.pool.query(
      'SELECT * FROM tracker_models WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name],
    );
    return rows[0] || null;
  }

  async createModel(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO tracker_models (name, manufacturer, protocol, description, active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.manufacturer || null, data.protocol || null, data.description || null, data.active ?? true],
    );
    return rows[0];
  }

  async updateModel(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE tracker_models SET
        name = COALESCE($2, name),
        manufacturer = COALESCE($3, manufacturer),
        protocol = COALESCE($4, protocol),
        description = COALESCE($5, description),
        active = COALESCE($6, active),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.name, data.manufacturer, data.protocol, data.description, data.active],
    );
    if (!rows[0]) throw new Error('Modelo de rastreador não encontrado.');
    return rows[0];
  }

  async deleteModel(id) {
    const { rowCount } = await this.pool.query('DELETE FROM tracker_models WHERE id = $1', [id]);
    if (!rowCount) throw new Error('Modelo de rastreador não encontrado.');
  }

  async listCommands(modelId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM tracker_commands WHERE model_id = $1 ORDER BY sort_order ASC, id ASC`,
      [modelId],
    );
    return rows;
  }

  async findCommand(modelId, actionKey) {
    const { rows } = await this.pool.query(
      `SELECT * FROM tracker_commands
       WHERE model_id = $1 AND action_key = $2 AND active = true`,
      [modelId, actionKey],
    );
    return rows[0] || null;
  }

  async findCommandById(id) {
    const { rows } = await this.pool.query('SELECT * FROM tracker_commands WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async createCommand(modelId, data) {
    const { rows } = await this.pool.query(
      `INSERT INTO tracker_commands (
        model_id, action_key, label, sms_template, gpswox_command,
        gpswox_sms_template_id, sort_order, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        modelId,
        data.action_key,
        data.label,
        data.sms_template,
        data.gpswox_command || null,
        data.gpswox_sms_template_id || null,
        data.sort_order ?? 0,
        data.active ?? true,
      ],
    );
    return rows[0];
  }

  async updateCommand(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE tracker_commands SET
        action_key = COALESCE($2, action_key),
        label = COALESCE($3, label),
        sms_template = COALESCE($4, sms_template),
        gpswox_command = COALESCE($5, gpswox_command),
        gpswox_sms_template_id = COALESCE($6, gpswox_sms_template_id),
        sort_order = COALESCE($7, sort_order),
        active = COALESCE($8, active),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        data.action_key,
        data.label,
        data.sms_template,
        data.gpswox_command,
        data.gpswox_sms_template_id,
        data.sort_order,
        data.active,
      ],
    );
    if (!rows[0]) throw new Error('Comando não encontrado.');
    return rows[0];
  }

  async deleteCommand(id) {
    const { rowCount } = await this.pool.query('DELETE FROM tracker_commands WHERE id = $1', [id]);
    if (!rowCount) throw new Error('Comando não encontrado.');
  }
}

let instance = null;

function getTrackerModelRepository() {
  if (!instance) instance = new TrackerModelRepository();
  return instance;
}

module.exports = { TrackerModelRepository, getTrackerModelRepository };
