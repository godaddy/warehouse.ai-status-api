const url = require('url');

exports.address = function address(app, pathname, spec = {}) {
  const { pkg, env, version = '' } = spec;
  const { address: hostname, port } = app.servers.http.address();

  if (pkg && env) {
    pathname = `${pathname}/${pkg}/${env}/${version}`;
  }
  const uri = url.format({ protocol: 'http', hostname, port, pathname });
  return {
    uri,
    json: true
  };
};

exports.cleanupTables = async function (models, spec) {
  const { Status, StatusHead, StatusEvent, StatusCounter } = models;
  const events = await StatusEvent.findAll(spec);

  return Promise.all([
    Status.remove(spec),
    StatusCounter.remove(spec),
    StatusHead.remove(spec)
  ].concat(events.map(event =>
    StatusEvent.remove({ ...spec, eventId: event.eventId })
  )));
};
