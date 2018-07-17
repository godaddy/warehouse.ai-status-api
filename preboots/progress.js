const Progress = require('../progress');

/**
 * Progress preboot
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional Configuration
 * @param {Function} next Continuation function
 */

module.exports = function (app, options, next) {
  app.progress = new Progress(app.models);
  next();
};
