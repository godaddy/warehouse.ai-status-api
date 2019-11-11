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

  const webhooks = app.config.get().webhooks || {};

  app.webhooks = Object.entries(webhooks).reduce((acc, [endpoint, pkgs]) => {
    for (const pkg of pkgs) {
      acc[pkg] = acc[pkg] || [];
      acc[pkg].push(endpoint);
    }
    return acc;
  }, {});

  next();
};
