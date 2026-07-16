const { VEHICLE_COMMANDS, normalizeVehicleAction } = require('../lib/vehicle-commands');
const { getTrackerModelRepository } = require('../repositories/tracker-model-repository');

class TrackerCommandService {
  constructor() {
    this.models = getTrackerModelRepository();
  }

  async listModelsWithCommands() {
    const models = await this.models.listModels();
    const result = [];
    for (const model of models) {
      const commands = await this.models.listCommands(model.id);
      result.push({ ...model, commands });
    }
    return result;
  }

  async resolveCommand(vehicle, actionKey) {
    const normalized = normalizeVehicleAction(actionKey);
    if (!normalized) return null;

    if (vehicle?.tracker_model_id) {
      const dbCmd = await this.models.findCommand(vehicle.tracker_model_id, normalized);
      if (dbCmd) {
        return {
          action: normalized,
          label: dbCmd.label,
          sms: dbCmd.sms_template,
          gpswox: dbCmd.gpswox_command || VEHICLE_COMMANDS[normalized]?.gpswox || null,
          source: 'library',
          command_id: dbCmd.id,
        };
      }
    }

    const fallback = VEHICLE_COMMANDS[normalized];
    if (!fallback) return null;

    return {
      action: normalized,
      label: fallback.label,
      sms: fallback.sms,
      gpswox: fallback.gpswox,
      source: 'default',
      command_id: null,
    };
  }

  async listActionKeysForVehicle(vehicle) {
    if (vehicle?.tracker_model_id) {
      const commands = await this.models.listCommands(vehicle.tracker_model_id);
      return commands.filter((c) => c.active).map((c) => ({
        action_key: c.action_key,
        label: c.label,
        sms_template: c.sms_template,
      }));
    }

    return Object.entries(VEHICLE_COMMANDS).map(([key, val]) => ({
      action_key: key,
      label: val.label,
      sms_template: val.sms,
    }));
  }

  async resolveCommandByModelId(modelId, actionKey) {
    const normalized = normalizeVehicleAction(actionKey) || actionKey;
    const dbCmd = await this.models.findCommand(modelId, normalized);
    if (!dbCmd) return null;
    return {
      action: dbCmd.action_key,
      label: dbCmd.label,
      sms: dbCmd.sms_template,
      gpswox: dbCmd.gpswox_command,
    };
  }
}

let instance = null;

function getTrackerCommandService() {
  if (!instance) instance = new TrackerCommandService();
  return instance;
}

module.exports = { TrackerCommandService, getTrackerCommandService };
