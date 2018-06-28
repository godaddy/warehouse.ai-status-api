const winston = require('winston');

/**
 * Preboot bootstrapper
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional configuration
 * @param {Function} callback Continuation function
 */
module.exports = function preboots(app, options, callback) {
  const auth = options.auth === false ? options.auth : app.config.get('auth');
  app.preboot(require('slay-log')({
    transports: [
      new (winston.transports.Console)({
        raw: app.env !== 'development',
        timestamp: true
      })
    ]
  }));

  app.preboot(require('slay-config')());
  if (auth !== false) app.preboot(require('authboot')());
  app.preboot(require('./environments'));
  app.preboot(require('./wrhs'));
  app.preboot(require('./models'));
  app.preboot(require('./nsq'));

  callback();
};
