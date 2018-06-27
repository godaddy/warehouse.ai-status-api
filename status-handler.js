const parallel = require('parallel-transform');
const diagnostics = require('diagnostics');
const thenify = require('thenify');

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
    this.conc = opts.conc || 10;
    this.log = opts.log || defaultLogger;
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
   * Handle event message to insert event into the database
   * TODO: In the future we could also dispatch out notifications etc
   *
   * @function event
   * @param {Object}
   * @returns {Promise} to resolve
   */
  event (data) {
    return this.models.StatusEvent.create(this._transform(data, 'event'));
  }
  /**
   * Handle error message from carpenterd or carpenterd-worker
   *
   * @function queued
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  queued (data) {
    // Remark: (jcrugzz) do we also want to create a status Event here?
    return this._status('create', this._transform(data, 'status'));
  }

  /**
   * Handle error message from carpenterd or carpenterd-worker
   *
   * @function error
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  async error (data) {
    const { Status } = this.models;
    data = this._transform(data, 'error');
    await this.event(data);
    // Since we have hit an error we set the error state to true on the main
    // record, indicating at least one of the builds errored. This can be
    // corrected by a future build
    return Status.update({
      ...this._transform(data, 'status'),
      error: true
    });
  }

  /**
   * Handle complete messages from each carpenterd-worker
   *  1. Increment counter
   *  2. Compute progress
   *  3. Update if deemed "complete"
   *
   * @function complete
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to resolve
   */
  async complete(data) {
    const { Status, StatusCounter } = this.models;
    //
    // If a build initially failed to completee
    //
    const spec = this._transform(data, 'counter');
    await StatusCounter.increment(spec);
    const complete = await this.isComplete(spec);
    if (!complete) return;
    const { pkg, env, version } = transformed;
    return Status.update({ pkg, env, version, complete, error: false });
  }

  /**
   * Handle ignored message by just logging so we can see what happened
   *
   * @function ignored
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to be resolved
   */
  async ignored(data) {
    this.log.info(`Ignored status event, no build occurred`, data);
  }

  /**
   * Create both status head and status models
   *
   * @function _status
   * @param {Object} data - Message from NSQ
   * @returns {Promise} to be resolved
   */
  _status(data) {
    const { Status, StatusHead } = this.models;
    return Promise.all([
      Status.create(data),
      StatusHead.create(this._headStrip(data))
    ]);
  }

  /**
   * Compute whether the build has completed or not
   *
   * @function isComplete
   * @param {Object} spec - Specification to fetch Status/Counter
   */
  isComplete(spec) {
    const [{ total }, { count }] = await Promise.all([StatusCounter, Status].map(m => m.findOne(spec)));
    const progress = (count / total) * 100;
    return progress === 100;
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

  }

  stream() {
    return parallel(this.conc, (data, cb) => {
      this.handle(data, (err) => {
        if (err) this.log.error('Status Handler errored %s', err.message, data);
        cb(null, data);
      });
    });
  }
}

