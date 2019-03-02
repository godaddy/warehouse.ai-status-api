
const swaggerUI = require('swagger-ui-express');

module.exports = function (app) {
  //
  // ### /api-docs
  // Swagger docs
  //
  app.routes.use('/api-docs', swaggerUI.serve, swaggerUI.setup(app.swaggerDocumentation));

  // Global swagger defs:

/**
 * @swagger
 *
 * components:
 *   securitySchemes:
 *     basicAuth:
 *       type: http
 *       scheme: basic
 *
 * security:
 *   - basicAuth: []
 *
 * definitions:
 *   Environment:
 *     type: string
 *     minimum: 1
 *     enum:
 *       - dev
 *       - test
 *       - prod
 *
 *   PackageName:
 *     type: string
 *     minimum: 1
 *
 *   VersionNumber:
 *     type: string
 *     minimum: 1
 *
 *   Status:
 *     type: object
 *     properties:
 *       pkg:
 *         type: string
 *       env:
 *         type: string
 *       version:
 *         type: string
 *       previousVersion:
 *         type: string
 *       total:
 *         type: number
 *       error:
 *         type: string
 *       createDate:
 *         type: string
 *       updateDate:
 *         type: string
 *       complete:
 *         type: boolean
 *
 *   StatusEvent:
 *     type: object
 *     properties:
 *       pkg:
 *         type: string
 *       env:
 *         type: string
 *       version:
 *         type: string
 *       locale:
 *         type: string
 *       error:
 *         type: string
 *       message:
 *         type: string
 *       details:
 *         type: string
 *       createDate:
 *         type: string
 *       eventId:
 *         type: string
 *
 *
 *   Progress:
 *      type: object
 *      properties:
 *        progress:
 *          type: number
 *        count:
 *          type: number
 *        total:
 *          type: number
 *
 */

};

