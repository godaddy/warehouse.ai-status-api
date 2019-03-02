/**
 * Routes initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Extra configuration
 * @param {Function} next Continuation function
 * @public
 */

module.exports = function routes(app, options, next) {
  app.perform('actions', function (done) {
    require('./status')(app);
    require('./swagger')(app);
    done();
  });

  next();
};
