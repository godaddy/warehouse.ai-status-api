const Datastar = require('datastar');
const statusModels = require('warehouse.ai-status-models');

/**
 * Models initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional configuration
 * @param {Function} callback Continuation function
 */
module.exports = function modelboot(app, options, callback) {
  const ensure = app.config.get('ensure') || options.ensure;

  app.datastar = new Datastar(app.config.get('datastar'));
  app.models = statusModels(app.datastar);

  if (!ensure) return app.datastar.connect(callback);
  app.datastar.connect(err => {
    if (err) return callback(err);
    app.models.ensure(callback);
  });
};

