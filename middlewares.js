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
module.exports = function (app, options, callback) {
  app.middlewares = {
    auth: (app.authboot && app.authboot.middleware) || function (req, res, next) { next(); }
  };

  app.use(function hcheck(req, res, next) {
    if (healthcheck.test(req.url)) {
      return res.end('ok');
    }
    next();
  });
  app.use(bodyParser.json());
  callback();
};
