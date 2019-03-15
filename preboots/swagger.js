const swaggerDocumentation = require('../swagger/wrhs-status-api-spec.json');

module.exports = function (app, options, done) {
  app.swaggerDocumentation = swaggerDocumentation;
  done();
};
