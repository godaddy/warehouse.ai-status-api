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
   * @swagger
   * /healthcheck:
   *   get:
   *     summary: Healthcheck endpoint to verify that service is running and able to accept new connections
   *     security: []
   *     produces:
   *       - "text/plain"
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   */
    app.routes.get('/healthcheck(.html)?', function (req, res) {
      res.end('ok');
    });
    require('./status')(app);
    require('./swagger')(app);
    done();
  });

  next();
};
