const assume = require('assume');
const { execSync } = require('child_process');

describe('Swagger docs', function () {

  it('includes swagger documentation', function () {
    execSync('npm run swagger');
    const docs = require('../swagger/documentation.json');
    assume(docs.openapi).equal('3.0.2');
    assume(docs.paths).not.is.falsey();
    assume(docs.definitions.StatusEvent).not.is.falsey();
    assume(docs.paths['/progress/{pkg}/{env}/{version}'].get.responses['200'].description).to.equal('OK');
  });
});
