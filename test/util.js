const url = require('url');

exports.address = function address(app, pathname, spec = {}) {
  const { pkg, env, version = '' } = spec;
  const { address, port } = app.servers.http.address();

  if (pkg && env) {
    pathname = `${pathname}/${pkg}/${env}/${version}`;
  }
  const uri = url.format({ protocol: 'http', hostname: address, port, pathname });
  return {
    uri,
    json: true
  };
};
