const assume = require('assume');
const models = require('warehouse.ai-status-models');
const { mocks, helpers } = require('datastar-test-tools');
const sinon = require('sinon');
const StatusHandler = require('../status-handler');
const fixtures = require('./fixtures');

assume.use(require('assume-sinon'));

describe('Statu-Handler', function () {
  describe('unit', function () {
    let status;

    before(() => {
      const datastar = helpers.connectDatastar({ mock: true }, mocks.datastar());
      status = new StatusHandler({
        models: models(datastar)
      });
    });

    describe('_transform', function () {
      it('should _transform event message', function () {
        const transformed = status._transform(fixtures.singleEvent, 'event');
        assume(transformed.message).exists();
        assume(transformed.env).exists();
        assume(transformed.version).exists();
        assume(transformed.pkg).exists();
        assume(transformed.eventId).exists();
      });
    });

    describe('event', function () {
      it('should handle an initial event message', async function () {
        const eventstub = sinon.stub(status.models.StatusEvent, 'create').resolves();
        const statfindstub = sinon.stub(status.models.Status, 'findOne').resolves();
        const headfindstub = sinon.stub(status.models.StatusHead, 'findOne').resolves();
        const statcreatestub = sinon.stub(status.models.Status, 'create').resolves();
        const headcreatestub = sinon.stub(status.models.StatusHead, 'create').resolves();

        await status.event(fixtures.singleEvent);
        assume(eventstub).is.called(1);
        assume(statfindstub).is.called(1);
        assume(headfindstub).is.called(1);
        assume(statcreatestub).is.called(1);
        assume(headcreatestub).is.called(1);
        sinon.restore();
      });
    });

  });
});
