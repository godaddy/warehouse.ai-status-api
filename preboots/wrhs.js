const Warehouse = require('warehouse.ai-api-client');

/**
 * Wrhs preboot
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional Configuration
 * @param {Function} next Continuation function
 */
module.exports = function (app, options, next) {
  app.wrhs = new Warehouse(app.config.get('wrhs'));
  next();
};
