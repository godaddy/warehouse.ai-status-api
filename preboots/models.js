const AWS = require('aws-sdk');
const AwsLiveness = require('aws-liveness');
const dynamodb = require('dynamodb-x');
const statusModels = require('warehouse.ai-status-models');

/**
 * Models initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Optional configuration
 * @param {Function} callback Continuation function
 * @returns {undefined} nothing to see here
 */
module.exports = function modelboot(app, options, callback) {
  const ensure = app.config.get('ensure') || options.ensure;

  const dynamoDriver = new AWS.DynamoDB(app.config.get('dynamodb'));
  dynamodb.dynamoDriver(dynamoDriver);
  app.models = statusModels(dynamodb);
  const liveness = new AwsLiveness();
  liveness.waitForServices({
    clients: [dynamoDriver],
    waitSeconds: 60
  }).then(async () => {
    if (ensure) await app.models.ensure();
    callback();
  }).catch(err => void callback(err));
};
