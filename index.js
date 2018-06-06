const Application = exports.App = require('./application');

/**
 * Create a new application and start it.
 *
 * @param {Object} options Configuration
 * @param {Function} done callback
 * @public
 */
exports.start = function start(options, done) {
  if (!done && typeof options === 'function') {
    done = options;
    options = {};
  }

  const app = new Application(__dirname, options);

  app.start(function started(err) {
    done(err, app);
  });
};
