const assume = require('assume');
const request = require('request-promise-native');
const thenify = require('tinythen');

const index = require('..');
const { address, cleanupTables } = require('./util');

describe('index', function () {
  this.timeout(6E4);
  let app;

  before(function (done) {
    index.start({ auth: false }, (err, instance) => {
      app = instance;
      done(err);
    });
  });

  after(async function () {
    if (!app) return;

    await cleanupTables(app.models, {
      version: '1.0.0',
      env: 'dev',
      name: 'whatever'
    });
    await app.models.drop();
    await thenify(app, 'close');
  });

  it('should correctly listen on a port', function () {
    const port = app.servers.http.address().port;
    assume(port).is.a('number');
  });

  it('it should respond with 404 on root', async function () {
    await assume(request(address(app, '/'))).throwsAsync();
  });
});
