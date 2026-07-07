const express = require('express');

function createModuleRouter(name, handlers) {
  const router = express.Router();
  for (const [path, handler] of Object.entries(handlers)) {
    router.all(path, handler);
  }
  return router;
}

module.exports = { createModuleRouter };
