const asynHandler = require('express-async-handler');

/**
 * Routes initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Extra configuration
 * @param {Function} next Continuation function
 * @public
 */
module.exports = function routes(app, options, next) {
  app.perform('actions', function (done) {

    /**
     * Returns a route handler for the given type.
     *
     * @param {string} type - Event type to get (`Status` or `StatusEvent`)
     * @returns {function} The async route handler
     */
    function statusRouteHandler(type) {
      const find = (type === 'StatusEvent') ? 'findAll' : 'findOne';

      return async function handler(req, res) {
        const { pkg, env, version } = req.params;

        if (pkg && env && version) {
          const status = await app.models[type][find]({ pkg, env, version });
          if (!status) return res.status(404).json(new Error(`No ${type} exists for ${pkg}@${version} in ${env}`));
          return res.json(status);
        }

        if (pkg && env) {
          const head = await app.models.StatusHead.findOne({ pkg, env });
          if (!head) return res.status(404).json(new Error(`No Status exists for ${pkg} in ${env}`));

          const status = await app.models[type][find]({ pkg, env, version: head.version });
          return res.json(status);
        }

        res.status(400).json(new Error(`Bad path. ${!pkg && 'Missing package.'} ${!env && 'Missing environment.'}`));
      };
    }

    app.routes.get('/status/:pkg/:env/:version?', asynHandler(statusRouteHandler('Status')));
    app.routes.get('/status-events/:pkg/:env/:version?', asynHandler(statusRouteHandler('StatusEvent')));

    /**
     * Route Handler for computing progress for the given pkg/env/version
     *
     * @param {Request} req - Request object
     * @param {Response} res - Response object
     *
     */
    app.routes.get('/progress/:pkg/:env/:version?', asynHandler(async function progressHandler(req, res) {
      let { pkg, env, version } = req.params;
      let head;

      if (!version) head = await app.models.StatusHead.findOne({ pkg, env });

      version = version || head.version;
      const result = await app.progress.compute({ pkg, env, version });

      res.status(200).json(result);
    }));

    done();
  });

  next();
};
