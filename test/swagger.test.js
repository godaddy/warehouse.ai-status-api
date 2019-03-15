const assume = require('assume');

describe('Swagger docs', function () {

  it('includes swagger documentation', function () {
    const docs = require('../swagger/wrhs-status-api-spec.json');
    assume(docs.openapi).equal('3.0.2');
    assume(docs.paths).not.is.falsey();
    assume(docs.definitions.StatusEvent).not.is.falsey();
    assume(docs.paths['/progess/{pkg}/{env}/{version}'].get.responses['200'].description).to.equal('OK');
  });
});
