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

      it('should _transform queued message for status', function () {
        const transformed = status._transform(fixtures.singleQueued, 'status');
        assume(transformed.env).exists();
        assume(transformed.version).exists();
        assume(transformed.pkg).exists();
        assume(transformed.total).exists();
      });

      it('should _transform error message for event', function () {
        const transformed = status._transform(fixtures.singleError, 'error');
        assume(transformed.env).exists();
        assume(transformed.version).exists();
        assume(transformed.pkg).exists();
        assume(transformed.error).equals(true);
        assume(transformed.details).exists();
        assume(transformed.message).exists();
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

      it('should not create status when there is already a current Status record', async function () {
        const statusMock = status._transform(fixtures.singleEvent, 'status');
        const eventstub = sinon.stub(status.models.StatusEvent, 'create').resolves();
        const statfindstub = sinon.stub(status.models.Status, 'findOne').resolves(statusMock);
        const headfindstub = sinon.stub(status.models.StatusHead, 'findOne').resolves(statusMock);
        const statcreatestub = sinon.stub(status.models.Status, 'create').resolves();
        const headcreatestub = sinon.stub(status.models.StatusHead, 'create').resolves();

        await status.event(fixtures.singleEvent);
        assume(eventstub).is.called(1);
        assume(statfindstub).is.called(1);
        assume(headfindstub).is.called(1);
        assume(statcreatestub).is.not.called();
        assume(headcreatestub).is.not.called();
        sinon.restore();
      });

      it('should error when any database call errors', async function () {
        sinon.stub(status.models.StatusEvent, 'create').resolves();
        sinon.stub(status.models.Status, 'findOne').rejects();
        sinon.stub(status.models.StatusHead, 'findOne').resolves();

        await assume(status.event(fixtures.singleEvent)).throwsAsync();
        sinon.restore();
      });
    });

    describe('queued', function () {
      it('should update status and create event on queued message', async function () {
        sinon.stub(status, 'event').resolves();
        const statupdatestub = sinon.stub(status.models.Status, 'update').resolves();
        const headupdatestub = sinon.stub(status.models.StatusHead, 'update').resolves();

        await status.queued(fixtures.singleQueued);
        assume(statupdatestub).is.called(1);
        assume(headupdatestub).is.called(1);
        sinon.restore();
      });

      it('should throw an error if status fails to update', async function () {
        sinon.stub(status.models.Status, 'update').rejects();
        sinon.stub(status.models.StatusHead, 'update').resolves();

        await assume(status.queued(fixtures.singleQueued)).throwsAsync();
        sinon.restore();
      });
    });

    describe('error', function () {
      it('should create event and update status with error', async function () {
        const statusupdatestub = sinon.stub(status.models.Status, 'update').resolves();
        const eventstub = sinon.stub(status, 'event').resolves();

        await status.error(fixtures.singleError);
        assume(statusupdatestub).is.called(1);
        assume(eventstub).is.called();
        sinon.restore();
      });

      it('should error when a database call errors', async function () {
        sinon.stub(status.models.Status, 'update').resolves();
        sinon.stub(status, 'event').rejects();

        await assume(status.error(fixtures.singleError)).throwsAsync();
        sinon.restore();
      });
    });

    describe('complete', function () {
      it('should increment counter, see if is complete, and update status when it sees it is', async function () {
        const statusupdatestub = sinon.stub(status.models.Status, 'update').resolves();
        const statuscounterfindstub = sinon.stub(status.models.StatusCounter, 'findOne').resolves(fixtures.singleCompleteCounter);
        const statusfindstub = sinon.stub(status.models.Status, 'findOne').resolves(fixtures.singleCompleteStatus);
        const statuscounterincstub = sinon.stub(status.models.StatusCounter, 'increment').resolves();

        await status.complete(fixtures.singleComplete);
        assume(statuscounterincstub).is.called(1);
        assume(statuscounterfindstub).is.called(1);
        assume(statusfindstub).is.called(1);
        assume(statusupdatestub).is.called(1);
        sinon.restore();
      });
    });

  });
});
