const Datastar = require('datastar');

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
  app.models = models(app.datastar);

  if (!ensure) return app.datastar.connect(callback);
  app.datastar.connect(err => {
    if (err) return callback(err);
    app.models.ensure(callback);
  });
};

/**
 * TODO: Add models
 *
 * @function models
 * @returns {Object} models object
 */
function models() {
  return {};
}
