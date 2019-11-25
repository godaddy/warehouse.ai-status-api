const asynHandler = require('express-async-handler');
/**
 * Routes initializer
 *
 * @param {slay.App} app Slay Application
 * @param {Object} options Extra configuration
 * @param {Function} next Continuation function
 * @public
 */

module.exports = function (app) {
  const auth = app.middlewares.auth;
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
  /**
  * @swagger
  * /status/{pkg}/{env}:
  *   get:
  *     summary: Gets the progress for a given package, environment
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/Status'
  *       400:
  *         description: Bad path. Missing package or missing environment
  *       404:
  *         description: No StatusEvent exists for package in environment
  * /status/{pkg}/{env}/{version}:
  *   get:
  *     summary: Gets the progress for a given package, environment and version
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *       - in: path
  *         name: version
  *         required: false
  *         schema:
  *           $ref: '#/definitions/VersionNumber'
  *         description: The package version
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/Status'
  *       400:
  *         description: Bad path. Missing package or missing environment
  *       404:
  *         description: No StatusEvent exists for package in environment
  */
  app.routes.get('/status/:pkg/:env/:version?', auth, asynHandler(statusRouteHandler('Status')));
  /**
  * @swagger
  * /status-events/{pkg}/{env}:
  *   get:
  *     summary: Gets the progress for a given package, environment
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/StatusEvent'
  *       400:
  *         description: Bad path. Missing package or missing environment
  *       404:
  *         description: No StatusEvent exists for package in environment
  * /status-events/{pkg}/{env}/{version}:
  *   get:
  *     summary: Gets the progress for a given package, environment and version
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *       - in: path
  *         name: version
  *         required: false
  *         schema:
  *           $ref: '#/definitions/VersionNumber'
  *         description: The package version
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/StatusEvent'
  *       400:
  *         description: Bad path. Missing package or missing environment
  *       404:
  *         description: No StatusEvent exists for package in environment
  */
  app.routes.get('/status-events/:pkg/:env/:version?', auth, asynHandler(statusRouteHandler('StatusEvent')));

  /**
  * @swagger
  * /progress/{pkg}/{env}:
  *   get:
  *     summary: Gets the progress for a given package, environment
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/Progress'
  *       404:
  *         description: Not found
  * /progress/{pkg}/{env}/{version}:
  *   get:
  *     summary: Gets the progress for a given package, environment and version
  *     security:
  *       - basicAuth: []
  *     produces:
  *       - "application/json"
  *     parameters:
  *       - in: path
  *         name: pkg
  *         required: true
  *         schema:
  *           $ref: '#/definitions/PackageName'
  *         description: The package name
  *       - in: path
  *         name: env
  *         required: true
  *         schema:
  *           $ref: '#/definitions/Environment'
  *         description: The environment
  *       - in: path
  *         name: version
  *         required: false
  *         schema:
  *           $ref: '#/definitions/VersionNumber'
  *         description: The package version
  *     responses:
  *       200:
  *         description: OK
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/definitions/Progress'
  *       404:
  *         description: Not found
  */
  /**
   * Route Handler for computing progress for the given pkg/env/version
   *
   * @param {Request} req - Request object
   * @param {Response} res - Response object
   *
   */
  app.routes.get('/progress/:pkg/:env/:version?', auth, asynHandler(async function progressHandler(req, res) {
    const { pkg, env } = req.params;
    let { version } = req.params;
    let head;

    if (!version) head = await app.models.StatusHead.findOne({ pkg, env });

    version = version || head.version;
    const result = await app.progress.compute({ pkg, env, version });

    res.status(200).json(result);
  }));
};
