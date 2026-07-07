const firebase = require('../services/firebase');

module.exports = {
  getConfig: firebase.getConfig,
  getPublicConfig: firebase.getPublicConfig,
  sendPush: firebase.sendPush,
  sendPushToUser: firebase.sendPushToUser,
  registerToken: firebase.registerToken,
  unregisterToken: firebase.unregisterToken,
  listDevices: firebase.listDevices,
  testConnection: firebase.testConnection,
};
