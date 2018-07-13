const index = require('..');
const assume = require('assume');
const request = require('request-promise-native');
const { address } = require('./util');

describe('index', function () {
  let app;

  before(function (done) {
    index.start({ auth: false }, (err, instance) => {
      app = instance;
      done(err);
    });
  });

  after(function (done) {
    if (app) return app.close(done);
    done();
  });

  it('should correctly listen on a port', function () {
    const port = app.servers.http.address().port;
    assume(port).is.a('number');
  });

  it('it should respond with 404 on root', async function () {
    await assume(request(address(app, '/'))).throwsAsync();
  });
});
