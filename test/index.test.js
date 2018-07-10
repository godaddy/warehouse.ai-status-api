const index = require('..');
const assume = require('assume');

describe('index', function () {
  let app;

  before(function (done) {
    index.start((err, instance) => {
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

  it('it should respond with 404 on root');
});
