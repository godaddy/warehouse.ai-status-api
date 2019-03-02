const swaggerDocumentation = require('../swagger/documentation.json');

module.exports = function (app, options, done) {
  app.swaggerDocumentation = swaggerDocumentation;
  done();
};
