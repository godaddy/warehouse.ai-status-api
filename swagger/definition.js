const { version } = require('../package.json');

module.exports = {
  openapi: '3.0.2',
  info: {
    title: 'warehouse.ai-status-api',
    version,
    description: 'wrhs status api'
  },
  apis: ['./routes/*.js']
};

