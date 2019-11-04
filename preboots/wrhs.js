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

  const webhooks = app.config.get('webhooks');
  const endpoints = Object.keys(webhooks);

  app.webhooks = {};

  endpoints.forEach(url => {
    webhooks[url].forEach(pkg => {
      if (!app.webhooks[pkg]) {
        app.webhooks[pkg] = [];
      }
      app.webhooks[pkg].push(url);
    });
  });

  next();
};
