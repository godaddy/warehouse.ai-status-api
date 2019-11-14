const { Writable } = require('stream');
const assume = require('assume');
const models = require('warehouse.ai-status-models');
const { mocks, helpers } = require('datastar-test-tools');
const sinon = require('sinon');
const thenify = require('tinythen');
const Datastar = require('datastar');
const StatusHandler = require('../status-handler');
const fixtures = require('./fixtures');
const cassConfig = require('./cassandra.json');
const through = require('through2');
const nock = require('nock');

assume.use(require('assume-sinon'));

describe('Status-Handler', function () {
  describe('unit', function () {
    let status;

    before(() => {
      const data = helpers.connectDatastar({ mock: true }, mocks.datastar());
      status = new StatusHandler({
        models: models(data),
        webhooks: {
          endpoints: {
            whatever: [
              'http://example.com/webhooks'
            ]
          }
        }
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('_getPackageName', function () {
      it('should return the package name', function () {
        const pkg = status._getPackageName(fixtures.singleQueued);
        assume(pkg).equals('whatever');
      });
    });

    describe('_shouldSendWebhook', function () {
      it('should check if a package has registered endpoints', function () {
        assume(status._shouldSendWebhook('whatever')).equals(true);
        assume(status._shouldSendWebhook('whatever2')).equals(false);
      });
    });

    describe('_isBuildQueued', function () {
      it('should detect the build is queued', async function () {
        const findAllStub = sinon.stub(status.models.StatusEvent, 'findAll')
          .resolves([fixtures.secondEvent, fixtures.singleQueued, fixtures.singleFetchedTarball]);
        const { name: pkg, version, env } = fixtures.singleFetchedTarball;
        const result = await status._isBuildQueued(fixtures.singleFetchedTarball);
        assume(findAllStub).is.calledWith({ pkg, version, env });
        assume(result).equals(true);
      });

      it('should detect the build is not queued', async function () {
        const findAllStub = sinon.stub(status.models.StatusEvent, 'findAll')
          .resolves([fixtures.secondEvent, fixtures.singleFetchedTarball]);
        const { name: pkg, version, env } = fixtures.singleFetchedTarball;
        const result = await status._isBuildQueued(fixtures.singleFetchedTarball);
        assume(findAllStub).is.calledWith({ pkg, version, env });
        assume(result).equals(false);
      });
    });

    describe('_dispatchWebhook', function () {
      it('should dispatch build_started webhook', async function () {
        const shouldSendStub = sinon.stub(status, '_shouldSendWebhook').resolves(true);
        const isBuildStub = sinon.stub(status, '_isBuildQueued').resolves(true);
        const sendStub = sinon.stub(status, '_sendWebhook').resolves();
        await status._dispatchWebhook('build_started', fixtures.singleEvent);
        const { name: pkg, version, env } = fixtures.singleEvent;
        assume(shouldSendStub).is.calledWith(pkg);
        assume(isBuildStub).is.calledWith(fixtures.singleEvent);
        assume(sendStub).is.calledWith({ pkg, version, env, event: 'build_started' });
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

      it('should _transform complete message for counter', function () {
        const transformed = status._transform(fixtures.singleComplete, 'counter');
        assume(transformed.env).exists();
        assume(transformed.version).exists();
        assume(transformed.pkg).exists();

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
      });

      it('should error when any database call errors', async function () {
        sinon.stub(status.models.StatusEvent, 'create').resolves();
        sinon.stub(status.models.Status, 'findOne').rejects();
        sinon.stub(status.models.StatusHead, 'findOne').resolves();

        await assume(status.event(fixtures.singleEvent)).throwsAsync();
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
      });

      it('should throw an error if status fails to update', async function () {
        sinon.stub(status.models.Status, 'update').rejects();
        sinon.stub(status.models.StatusHead, 'update').resolves();

        await assume(status.queued(fixtures.singleQueued)).throwsAsync();
      });
    });

    describe('error', function () {
      it('should create event and update status with error', async function () {
        const statusupdatestub = sinon.stub(status.models.Status, 'update').resolves();
        const eventstub = sinon.stub(status, 'event').resolves();

        await status.error(fixtures.singleError);
        assume(statusupdatestub).is.called(1);
        assume(eventstub).is.called();
      });

      it('should error when a database call errors', async function () {
        sinon.stub(status.models.Status, 'update').resolves();
        sinon.stub(status, 'event').rejects();

        await assume(status.error(fixtures.singleError)).throwsAsync();
      });
    });

    describe('complete', function () {
      it('should increment counter, see if is complete, and update status when it sees it is', async function () {
        const statusupdatestub = sinon.stub(status.models.Status, 'update').resolves();
        const statuseventcreatestub = sinon.stub(status.models.StatusEvent, 'create').resolves();
        const statuscounterfindstub = sinon.stub(status.models.StatusCounter, 'findOne').resolves(fixtures.singleCompleteCounter);
        const statusfindstub = sinon.stub(status.models.Status, 'findOne').resolves(fixtures.singleCompleteStatus);
        const statuscounterincstub = sinon.stub(status.models.StatusCounter, 'increment').resolves();

        await status.complete(fixtures.singleComplete);
        assume(statuscounterincstub).is.called(1);
        assume(statuscounterfindstub).is.called(1);
        assume(statusfindstub).is.called(1);
        assume(statusupdatestub).is.called(1);
        assume(statuseventcreatestub).is.called(1);
      });

      it('should error if a database call errors', async function () {
        sinon.stub(status.models.StatusCounter, 'increment').rejects();

        await assume(status.complete(fixtures.singleComplete)).throwsAsync();
      });
    });

    describe('ignored', function () {
      it('logs when we get an ignored message', async function () {
        const info = sinon.stub(status.log, 'info');

        await status.ignored(fixtures.singleEvent);
        assume(info).is.called(1);
      });
    });
  });

  describe('integration', function () {
    this.timeout(6E4);
    let datastar;
    let handler;

    before(async function () {
      datastar = new Datastar(cassConfig);
      handler = new StatusHandler({
        models: models(datastar),
        webhooks: {
          endpoints: {
            whatever: [
              'https://example.com/webhooks',
              'https://fleetcommand.godaddy.com/v1/warehouse'
            ]
          }
        },
        conc: 1
      });
      await thenify(datastar, 'connect');
      await handler.models.ensure();
    });

    after(async function () {
      await handler.models.drop();
      await thenify(datastar, 'close');
      nock.cleanAll();
      nock.restore();
    });

    it('should successfully handle multiple event messages and put them in the database', async function () {
      const { Status, StatusHead, StatusEvent } = handler.models;
      const spec = handler._transform(fixtures.singleEvent, 'counter');
      await handler.event(fixtures.singleEvent);
      await handler.event(fixtures.secondEvent);

      const status = await Status.findOne(spec);
      const head = await StatusHead.findOne(spec);
      const events = await StatusEvent.findAll(spec);
      assume(status.env).equals(spec.env);
      assume(status.version).equals(spec.version);
      assume(status.pkg).equals(spec.pkg);
      assume(head.env).equals(spec.env);
      assume(head.version).equals(spec.version);
      assume(head.pkg).equals(spec.pkg);
      assume(events).is.length(2);
      const [first, second] = events;
      assume(first.message).equals(fixtures.singleEvent.message);
      assume(second.message).equals(fixtures.secondEvent.message);
      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec)
      ]);
    });

    it('should handle initial event, queued and complete event for 1 build', async function () {
      const { Status, StatusHead, StatusEvent, StatusCounter } = handler.models;
      const spec = handler._transform(fixtures.singleQueued, 'counter');
      await handler.event(fixtures.singleEvent);
      await handler.queued(fixtures.singleQueued);
      await handler.complete(fixtures.singleComplete);

      const status = await Status.findOne(spec);
      assume(status.complete).equals(true);
      assume(status.error).equals(false);
      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec),
        StatusCounter.decrement(spec, 1)
      ]);
    });

    it('should send build_started webhook and be robust', async function () {
      const webhooksNock = nock('https://example.com')
        .post('/webhooks')
        .reply(204);
      const notificationsNock = nock('https://fleetcommand.godaddy.com')
        .post('/v1/warehouse')
        .socketDelay(8000) // Idle connection to simulate a socket timeout
        .reply(504);

      const { Status, StatusHead, StatusEvent } = handler.models;
      const spec = handler._transform(fixtures.singleQueued, 'counter');
      await handler.event(fixtures.singleEvent);
      await handler.queued(fixtures.singleQueued);

      // Add a waiter proxy to ensure _sendWebhook completed
      // since _dispatchWebhook is not blocking the handler.event function
      const sendWebhook = handler._sendWebhook.bind(handler);
      const waiter = new Promise(resolve => {
        handler._sendWebhook = async function (body) {
          await sendWebhook(body);
          resolve();
        };
      });

      await handler.event(fixtures.singleFetchedTarball);
      await waiter;

      assume(webhooksNock.isDone()).equals(true);
      assume(notificationsNock.isDone()).equals(true);

      // Restore _sendWebhook
      handler._sendWebhook = sendWebhook;
      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec)
      ]);
    });

    it('should handle setting previous version when we have one as StatusHead', async function () {
      const { StatusHead, Status, StatusEvent } = handler.models;
      const spec = handler._transform(fixtures.singleEvent);

      await StatusHead.create(fixtures.previousStatusHead);
      await handler.event(fixtures.singleEvent);
      const status = await Status.findOne(spec);
      assume(status.previousVersion).equals(fixtures.previousStatusHead.version);
      const events = await StatusEvent.findAll(spec);
      assume(events).is.length(1);
      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec)
      ]);
    });

    it('should handle error case', async function () {
      const { StatusHead, Status, StatusEvent } = handler.models;
      const spec = handler._transform(fixtures.singleEvent);

      await handler.event(fixtures.singleEvent);
      await handler.error(fixtures.singleError);

      const status = await Status.findOne(spec);
      assume(status.error).equals(true);
      const events = await StatusEvent.findAll(spec);
      assume(events).is.length(2);

      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec)
      ]);
    });

    it('should handle a series of events via stream', function (done) {
      const { Status, StatusHead, StatusEvent, StatusCounter } = handler.models;
      const spec = handler._transform(fixtures.singleEvent);
      const source = through.obj();

      source
        .pipe(handler.stream())
        .pipe(new Writable({
          objectMode: true,
          write: (_, __, cb) => cb()
        }))
        .on('finish', async () => {
          const status = await Status.findOne(spec);
          assume(status.complete).equals(true);
          await Promise.all([
            Status.remove(spec),
            StatusHead.remove(spec),
            StatusEvent.remove(spec),
            StatusCounter.decrement(spec, 1)
          ]);
          done();
        });

      source.write(fixtures.singleEvent);
      source.write(fixtures.singleQueued);
      source.write(fixtures.singleComplete);
      source.end();
    });
  });

});
