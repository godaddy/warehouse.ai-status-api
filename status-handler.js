const parallel = require('parallel-transform');
const diagnostics = require('diagnostics');
const rip = require('rip-out');
const request = require('request-promise-native');
const uuid = require('uuid');
const pLimit = require('p-limit');
const Progress = require('./progress');

const defaultLogger = {
  info: diagnostics('warehouse.ai-status-api:status-handler:info'),
  warn: diagnostics('warehouse.ai-status-api:status-handler:warn'),
  error: diagnostics('warehouse.ai-status-api:status-handler:error')
};

const DEFAULT_WEBHOOKS_CONCURRENCY = 5;
const DEFAULT_WEBHOOKS_TIMEOUT = 2000;
const BUILD_COMPLETED = 'build_completed';
const BUILD_STARTED = 'build_started';

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
    this.webhooks = opts.webhooks || { endpoints: {} };
    this.wrhs = opts.wrhs;
  }

  /**
   * Main handler for messages, using command pattern to bucket them
   *
   * @function handle
   * @param {Object} msg - Data message to be handled from NSQ
   * @param {Function} next - Continuation function
   * @returns {undefined} void 0
   */
  handle(msg, next) {
    if (typeof this[msg.eventType] !== 'function') {
      this.log.warn('Invalid message sent, ignoring', msg);
      return void next();
    }
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
      StatusHead.findOne(ev, { ConsistentRead: true }),
      Status.findOne(ev, { ConsistentRead: true })
    ]);

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
    this._dispatchWebhook(BUILD_STARTED, data)
      .catch(err => {
        this.log.error('Dispatch webhook errored %s', err.message, data);
      });

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

    this._dispatchWebhook(BUILD_COMPLETED, data)
      .catch(err => {
        this.log.error('Dispatch webhook errored %s', err.message, data);
      });

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
    const endpoints = this.webhooks.endpoints[pkg];
    if (!endpoints || endpoints.length === 0) {
      this.log.info(`No webhook endpoints for pkg ${pkg}`);
      return false;
    }
    this.log.info(`Found ${endpoints.length} endpoints: ${JSON.stringify(endpoints)} for package ${pkg}`);
    return true;
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
      case BUILD_COMPLETED:
      case BUILD_STARTED:
        body = { event, pkg, version, env };
        break;
      default:
        throw new Error(`'${event}' is not a valid webhook type`);
    }

    const repository = await new Promise((resolve, reject) => {
      this.wrhs.packages.get({ pkg }, (err, result) => {
        if (err) return reject(err);
        resolve(result.repository || {});
      });
    });

    body.repository = repository;

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
  _sendWebhook(body) {
    const {
      concurrency = DEFAULT_WEBHOOKS_CONCURRENCY,
      timeout = DEFAULT_WEBHOOKS_TIMEOUT
    } = this.webhooks;
    const endpoints = this.webhooks.endpoints[body.pkg];

    const limit = pLimit(concurrency);
    const params = { body, method: 'POST', json: true, timeout };
    return Promise.all(endpoints.map(uri => limit(async () => {
      // Do not fail the other webhook requests if one fais
      try {
        await request({ uri, ...params });
        this.log.info(`Webhook ${body.event} for package ${pkg} sent to ${uri}`);
      } catch (err) {
        this.log.error(`Failed sending webhook for package %s`, body.pkg, body);
      }
    })));
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
