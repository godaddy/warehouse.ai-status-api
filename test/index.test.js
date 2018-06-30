const index = require('..');

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

  it('it should respond with 404 on root');
});
