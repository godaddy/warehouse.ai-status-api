const parallel = require('parallel-transform');
const diagnostics = require('diagnostics');
const rip = require('rip-out');
const request = require('request-promise-native');
const uuid = require('uuid');
const Progress = require('./progress');

const defaultLogger = {
  info: diagnostics('warehouse.ai-status-api:status-handler:info'),
  warn: diagnostics('warehouse.ai-status-api:status-handler:warn'),
  error: diagnostics('warehouse.ai-status-api:status-handler:error')
};


/**
 * StatusHandler class for receiving messages from NSQ and taking the right
 * action with them
 *
 * @class StatusHandler
 */
class StatusHandler {
  /**
   * @constructor
   * @param {Object} opts - Configuration options
   */
  constructor(opts) {
    this.models = opts.models;
    this.progress = opts.progress || new Progress(this.models);
    this.conc = opts.conc || 10;
    this.log = opts.log || defaultLogger;
    this.webhooks = opts.webhooks || {};
  }

  /**
   * Main handler for messages, using command pattern to bucket them
   *
   * @function handle
   * @param {Object} msg - Data message to be handled from NSQ
   * @param {Function} next - Continuation function
   */
  handle(msg, next) {
    this[msg.eventType](msg)
      .then(next.bind(null, null), next);
  }

  /**
   * Handle event message to insert event into the database. We also create the
   * first Status and StatusHead for the initial event which is the first
   * message we will receive for a given build
   * TODO: In the future we could also dispatch out notifications etc
   *
   * @function event
   * @param {Object} data - Data message to be handled from NSQ
   * @returns {Promise} to resolve
   */
  async event(data) {
    const { StatusEvent, StatusHead, Status } = this.models;
    const ev = this._transform(data, 'event');
    const [, head, current] = await Promise.all([
      StatusEvent.create(ev),
      StatusHead.findOne(ev),
      Status.findOne(ev)
    ]);

    await this._sendBuildStartedWebhook(data);

    if (!current) {
      return this._status('create', {
        ...this._transform(data, 'status'),
        previousVersion: head && head.version
      });
    }
  }
  /**
   * Handle error message from carpenterd or carpenterd-worker
   *
   * @function queued
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  queued(data) {
    // Its safe to update status here because status is created by the first
    // `event` for npm install so that we can fetch the head and handle setting
    // the previous version from the prior HEAD
    return Promise.all([
      this._status('update', this._transform(data, 'status')),
      this.event(data)
    ]);
  }

  /**
   * Handle error message from carpenterd or carpenterd-worker
   *
   * @function error
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  error(data) {
    const { Status } = this.models;
    data = this._transform(data, 'error');

    return Promise.all([
      this.event(data),
      // Since we have hit an error we set the error state to true on the main
      // record, indicating at least one of the builds errored. This can be
      // corrected by a future build
      Status.update(this._transform(data, 'status'))
    ]);
  }

  /**
   * Handle complete messages from each carpenterd-worker
   *  1. Increment counter and create status event
   *  2. Compute progress
   *  3. Update if deemed "complete"
   *
   * @function complete
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  async complete(data) {
    const { Status, StatusEvent, StatusCounter } = this.models;
    //
    // If a build initially failed to completee
    //
    const spec = this._transform(data, 'counter');
    const event = this._transform(data, 'event');
    await Promise.all([
      StatusCounter.increment(spec),
      StatusEvent.create(event)
    ]);
    const complete = await this.isComplete(spec);

    if (!complete) return;
    // Overwrite error: true if it was set to error before, since the errored build
    // must have resolved if we get here
    return Status.update({ ...spec, complete, error: false });
  }

  /**
   * Handle ignored message by just logging so we can see what happened
   *
   * @function ignored
   * @param {Object} data - Message from NSQ
   */
  async ignored(data) {
    this.log.info(`Ignored status event, no build occurred`, data);
  }

  /**
   * Check if there are third-party apps that
   * subscribed for webhooks for a specific package
   *
   * @function _shouldSendWebhook
   * @param {String} pkg - The name of the package
   * @returns {Boolean} the computed value
   */
  _shouldSendWebhook(pkg) {
    const webhooks = this.webhooks[pkg];
    if (!webhooks || webhooks.length === 0) {
      this.log.info(`No webhooks for pkg ${pkg}`);
      return false;
    }
    return true;
  }

  /**
   * Check if a build is in a queued status
   *
   * @function _isBuildQueued
   * @param {Object} build - Build params
   * @param {String} build.pkg - The package name
   * @param {String} build.version - The package version
   * @param {String} build.env - The build environnement
   * @returns {String} the package name
   */
  async _isBuildQueued(build) {
    // Fetch list of previous events for a certain build
    const previousEvents = await this.models.Status.findAll(build);

    // Ensure that last event is the 'queued' event from carpentd
    const lastEvent = previousEvents[previousEvents.length - 1];
    if (lastEvent && lastEvent.message === 'Builds Queued') return true;
    return false;
  }

  /**
   * Get package name from NSQ message
   *
   * @function _getPackageName
   * @param {Object} data - Message from NSQ
   * @returns {String} the package name
   */
  _getPackageName(data) {
    return data.pkg || data.name;
  }

  /**
   * Process and dispatch a webhook
   *
   * @function _dispatchWebhook
   * @param {String} event - Webhook event type
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  async _dispatchWebhook(event, data) {
    const { version, env } = data;
    const pkg = this._getPackageName(data);

    if (!this._shouldSendWebhook(pkg)) return;

    let body;

    switch (event) {
      case 'build_started':
        if (!await this._isBuildQueued({ pkg, version, env })) return;
        body = { event, pkg, version, env };
        break;
      default:
        throw new Error(`'${event}' is not a valid webhook type`);
    }

    // Send webhook to subscribed third-parties
    return this._sendWebhook(body);
  }

  /**
   * Send webhook to third-party applications
   *
   * @function _sendWebhook
   * @param {Object} body - Webhook body payload
   * @returns {Promise} to resolve
   */
  async _sendWebhook(body) {
    const webhooks = this.webhooks[body.pkg];
    try {
      const params = { body, method: 'POST', json: true };
      await Promise.all(webhooks.map(uri => request({ uri, ...params })));
    } catch (err) {
      this.log.error('Status Handler errored %s', err.message, body);
    }
    return Promise.resolve(); // Hack valid-jsdoc. See issue https://github.com/eslint/eslint/issues/7307
  }

  /**
   * Create both status head and status models
   *
   * @function _status
   * @param {String} type - Type of database operation
   * @param {Object} data - Normalized data to insert into database
   * @returns {Promise} to be resolved
   */
  _status(type, data) {
    const { Status, StatusHead } = this.models;
    return Promise.all([
      Status[type](data),
      StatusHead[type](rip(data, 'complete', 'error'))
    ]);
  }

  /**
   * Compute whether the build has completed or not
   *
   * @function isComplete
   * @param {Object} spec - Specification to fetch Status/Counter
   * @returns {Promise} resolves to boolean whether we are complete or not
   */
  async isComplete(spec) {
    const { progress } = await this.progress.compute(spec);
    return progress >= 100;
  }

  /**
   * Transform function to turn a status message into a database record by type
   *
   * @function _transform
   * @param {Object} data - NSQ message to transform
   * @param {String} type - Type of message to convert to
   * @returns {Object} normalized database record
   */
  _transform(data, type) {
    const { version, env, message, details, total, error, locale } = data;

    const ret = { version, env };
    ret.pkg = this._getPackageName(data);

    switch (type) {
      case 'status':
        if (total) ret.total = total;
        if (error) ret.error = error;
        break;
      case 'error':
        ret.error = true;
        ret.message = message;
        ret.details = details;
        ret.locale = locale;
        break;
      case 'event':
        ret.message = message;
        ret.details = details;
        ret.error = error;
        ret.locale = locale;
        ret.eventId = uuid.v1();
        break;
      case 'counter':
      default:
        break;
    }
    return ret;
  }

  /**
   * Method for creating a stream to handle all of the various types of
   * messages we expect
   *
   * @function stream
   * @returns {Stream} parallel stream for processing messages
   */
  stream() {
    return parallel(this.conc, (data, cb) => {
      this.handle(data, (err) => {
        if (err) this.log.error('Status Handler errored %s', err.message, data);
        cb(null, data);
      });
    });
  }
}

module.exports = StatusHandler;
