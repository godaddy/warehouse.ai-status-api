require('make-promises-safe');
const path = require('path');
const { App } = require('slay');

const defaults = {
  routes: path.join(__dirname, 'routes'),
  middlewares: path.join(__dirname, 'middlewares'),
  preboots: path.join(__dirname, 'preboots')
};

/**
 * Extend Slay and define environment on application
 *
 * @public
 */
class Application extends App {
  constructor(root, options) {
    options = { ...defaults, ...options };
    super(root, options);

    this.env = process.env.NODE_ENV // eslint-disable-line no-process-env
      || options.env
      || 'development';
  }
}

module.exports = Application;
