const firebase = require('../services/firebase');

module.exports = {
  getConfig: firebase.getConfig,
  getPublicConfig: firebase.getPublicConfig,
  sendPush: firebase.sendPush,
  testConnection: firebase.testConnection,
};
