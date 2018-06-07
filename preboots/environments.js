/**
 * environments preboot
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Configuration
 * @param {Function} callback Continuation callback
 */
module.exports = function envboot(app, options, callback) {
  app.envs = new Map([
    ['development', 'dev'],
    ['dev', 'dev'],
    ['staging', 'test'],
    ['testing', 'test'],
    ['test', 'test'],
    ['production', 'prod'],
    ['dist', 'prod'],
    ['prod', 'prod']
  ]);

  callback();
};
