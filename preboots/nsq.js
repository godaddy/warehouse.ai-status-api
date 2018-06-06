const nsq = require('nsq.js-k8');

/**
 * Nsq preboot
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional Configuration
 * @param {Function} callback
 */
module.exports = function nsqboot(app, options, callback) {
  const config = Object.assign({}, options.nsq, app.config.get('nsq'));
  if (Object.keys(config).length === 0) return next();
  const opts = app.config.get('nsq-stream');

  //
  // NSQLOOKUPD doesnt quite get it right when fetching hosts.
  // We manually add the full DNS extension so the given hostname works in
  // every namespace.
  //
  config.addrModify = (addr) => {
    if (!config.nsqdHostExt) return addr;
    let [host, port] = addr.split(':');
    host = `${host}.${config.nsqdHostExt}`;
    return [host, port].join(':');
  };

  app.nsq = {};
  app.nsq.reader = nsq.reader(config);
  app.nsq.stream = nsqStream.createReadStream(app.nsq.reader, opts);

  app.nsq.reader.on('error', app.log.error.bind(app.log));
  app.nsq.reader.on('error response', app.log.error.bind(app.log));

  callback();

};
