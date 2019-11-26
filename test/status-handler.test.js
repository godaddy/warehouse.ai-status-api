const AWS = require('aws-sdk');
const AwsLiveness = require('aws-liveness');
const { Writable } = require('stream');
const assume = require('assume');
const dynamodb = require('dynamodb-x');
const models = require('warehouse.ai-status-models');
const sinon = require('sinon');
const through = require('through2');
const nock = require('nock');
const Warehouse = require('warehouse.ai-api-client');

const StatusHandler = require('../status-handler');
const fixtures = require('./fixtures');
const config = require('../config/development.json');
const { cleanupTables } = require('./util');

assume.use(require('assume-sinon'));

const liveness = new AwsLiveness();
const wait = ms => new Promise(r => setTimeout(r, ms));

describe('Status-Handler', function () {
  describe('unit', function () {
    let status;

    before(() => {
      status = new StatusHandler({
        models: models(dynamodb),
        webhooks: {
          endpoints: {
            whatever: [
              'http://example.com/webhooks'
            ]
          }
        },
        wrhs: new Warehouse('https://my.warehouse.endpoint.com')
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

    describe('_dispatchWebhook', function () {
      it('should dispatch build_started webhook', async function () {
        const shouldSendStub = sinon.stub(status, '_shouldSendWebhook').resolves(true);
        const sendStub = sinon.stub(status, '_sendWebhook').resolves();
        const repository = { type: 'git', url: 'repo.git' };
        const packagesGetStub = sinon.stub(status.wrhs.packages, 'get')
          .callsArgWith(1, null, { repository });
        await status._dispatchWebhook('build_started', fixtures.singleEvent);
        const { name: pkg, version, env } = fixtures.singleEvent;
        assume(shouldSendStub).is.calledWith(pkg);
        assume(sendStub).is.calledWith({ pkg, version, env, event: 'build_started', repository });
        assume(packagesGetStub).is.calledWith({ pkg });
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
        const eventStub = sinon.stub(status.models.StatusEvent, 'create').resolves();
        const statFindStub = sinon.stub(status.models.Status, 'findOne').resolves();
        const headFindStub = sinon.stub(status.models.StatusHead, 'findOne').resolves();
        const statCreateStub = sinon.stub(status.models.Status, 'create').resolves();
        const headCreateStub = sinon.stub(status.models.StatusHead, 'create').resolves();

        await status.event(fixtures.singleEvent);
        assume(eventStub).was.called(1);
        assume(statFindStub).was.called(1);
        assume(headFindStub).was.called(1);
        assume(statCreateStub).was.called(1);
        assume(headCreateStub).was.called(1);
      });

      it('should not create status when there is already a current Status record', async function () {
        const statusMock = status._transform(fixtures.singleEvent, 'status');
        const eventStub = sinon.stub(status.models.StatusEvent, 'create').resolves();
        const statFindStub = sinon.stub(status.models.Status, 'findOne').resolves(statusMock);
        const headFindStub = sinon.stub(status.models.StatusHead, 'findOne').resolves(statusMock);
        const statCreateStub = sinon.stub(status.models.Status, 'create').resolves();
        const headCreateStub = sinon.stub(status.models.StatusHead, 'create').resolves();

        await status.event(fixtures.singleEvent);
        assume(eventStub).was.called(1);
        assume(statFindStub).was.called(1);
        assume(headFindStub).was.called(1);
        assume(statCreateStub).was.not.called();
        assume(headCreateStub).was.not.called();
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
    let handler;
    let spec;

    before(async function () {
      const dynamoDriver = new AWS.DynamoDB(config.database);
      dynamodb.dynamoDriver(dynamoDriver);
      handler = new StatusHandler({
        models: models(dynamodb),
        webhooks: {
          endpoints: {
            whatever: [
              'https://example.com/webhooks',
              'https://fleetcommand.godaddy.com/v1/warehouse'
            ]
          }
        },
        conc: 1,
        wrhs: new Warehouse('https://my.warehouse.endpoint.com')
      });
      await liveness.waitForServices({
        clients: [dynamoDriver],
        waitSeconds: 60
      });
      await handler.models.ensure();
      const cleanupSpec = handler._transform(fixtures.singleEvent, 'counter');

      // I know this is bad code smell, but when this suite is run after routes.test.js,
      // localstack fails to delete the existing rows before dropping the table,
      // and then queues up an insert to add these rows back to the new table
      // somewhere in the first second of its launch. Rather than force the
      // test order of execution, I have decided to be defensive against this
      // behavior by waiting a second and then cleaning up the tables.
      await wait(1000);
      await cleanupTables(handler.models, cleanupSpec);
    });

    afterEach(async function () {
      if (!handler) return;
      await cleanupTables(handler.models, spec);
    });

    after(async function () {
      await handler.models.drop();
      nock.cleanAll();
      nock.restore();
    });

    it('should successfully handle multiple event messages and put them in the database', async function () {
      const { Status, StatusHead, StatusEvent } = handler.models;
      spec = handler._transform(fixtures.singleEvent, 'counter');

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
    });

    it('should handle initial event, queued and complete event for 1 build', async function () {
      const { Status } = handler.models;
      spec = handler._transform(fixtures.singleQueued, 'counter');
      await handler.event(fixtures.singleEvent);
      await handler.queued(fixtures.singleQueued);
      await handler.complete(fixtures.singleComplete);

      const status = await Status.findOne(spec);
      assume(status.complete).equals(true);
      assume(status.error).equals(false);
    });

    it('should send build_started webhook and be robust', async function () {
      const webhooksNock = nock('https://example.com')
        .post('/webhooks')
        .reply(204);
      const notificationsNock = nock('https://fleetcommand.godaddy.com')
        .post('/v1/warehouse')
        .socketDelay(8000) // Idle connection to simulate a socket timeout
        .reply(504);

      const repository = { type: 'git', url: 'repo.git' };
      const packagesGetStub = sinon.stub(handler.wrhs.packages, 'get')
        .callsArgWith(1, null, { repository });

      // Add a waiter proxy to ensure _sendWebhook completed
      // since _dispatchWebhook is not blocking the handler.event function
      const sendWebhook = handler._sendWebhook.bind(handler);
      const waiter = new Promise(resolve => {
        handler._sendWebhook = async function (body) {
          await sendWebhook(body);
          resolve();
        };
      });

      await handler.queued(fixtures.singleQueued);
      await waiter;

      assume(webhooksNock.isDone()).equals(true);
      assume(notificationsNock.isDone()).equals(true);
      assume(packagesGetStub).is.called(1);

      // Restore _sendWebhook
      // eslint-disable-next-line require-atomic-updates
      handler._sendWebhook = sendWebhook;
    });

    it('should handle setting previous version when we have one as StatusHead', async function () {
      const { StatusHead, Status, StatusEvent } = handler.models;
      spec = handler._transform(fixtures.singleEvent);

      await StatusHead.create(fixtures.previousStatusHead);
      await handler.event(fixtures.singleEvent);
      const status = await Status.findOne(spec);
      assume(status.previousVersion).equals(fixtures.previousStatusHead.version);
      const events = await StatusEvent.findAll(spec);
      assume(events).is.length(1);
    });

    it('should handle error case', async function () {
      const { Status, StatusEvent } = handler.models;
      spec = handler._transform(fixtures.singleEvent);

      await handler.event(fixtures.singleEvent);
      await handler.error(fixtures.singleError);

      const status = await Status.findOne(spec);
      assume(status.error).equals(true);
      const events = await StatusEvent.findAll(spec);
      assume(events).is.length(2);
    });

    it('should handle a series of events via stream', function (done) {
      const { Status } = handler.models;
      spec = handler._transform(fixtures.singleEvent);
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
          done();
        });

      source.write(fixtures.singleEvent);
      source.write(fixtures.singleQueued);
      source.write(fixtures.singleComplete);
      source.end();
    });
  });

});
