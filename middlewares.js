const bodyParser = require('body-parser');

const healthcheck = /healthcheck/;

/**
 * Middleware initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Configuration
 * @param {Function} callback Continuation function
 * @public
 */
module.exports = function middlewares(app, options, callback) {
  const auth = app.authboot && app.authboot.middleware || function (req, res, next) { next(); };

  app.use(function hcheck(req, res, next) {
    if (healthcheck.test(req.url)) {
      return res.end('ok');
    }
    next();
  });
  app.use(auth);
  app.use(bodyParser.json());

  callback();
};
