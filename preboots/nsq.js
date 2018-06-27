const nsq = require('nsq.js-k8');
const nsqStream = require('nsq-stream');
const uuid = require('uuid');
const { Writable } = require('stream');
const StatusHandler = require('../status-handler.js');

/**
 * Nsq preboot
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional Configuration
 * @param {Function} callback Continuation function
 */
module.exports = function nsqboot(app, options, callback) {
  // options overrides config if passed in
  const config = Object.assign({}, app.config.get('nsq'), options.nsq);
  if (Object.keys(config).length === 0) return callback();
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

  app.nsq.handler = new StatusHandler({
    conc: app.config.get('nsq:concurrency'),
    models: app.models
  })


  const write = (data, enc, cb) => {
    app.log.info('Event handled', data);
    cb();
  };

  //
  // After the server starts we will start to listen for messages
  //
  app.after('start', (_, __, next) => {
    app.nsq.stream
      .pipe(app.nsq.handler.stream())
      .pipe(new Writable({
        objectMode: true,
        write
      }))
      .on('finish', () => {
        setImmediate(() => app.close());
      });
  });

  callback();

};


