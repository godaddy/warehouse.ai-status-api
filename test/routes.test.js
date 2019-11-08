const index = require('..');
const assume = require('assume');
const thenify = require('tinythen');
const request = require('request-promise-native');
const StatusHandler = require('../status-handler');
const fixtures = require('./fixtures');
const { address } = require('./util');
const rip = require('rip-out');

async function cleanupTables(app, spec) {
  const { Status, StatusHead, StatusEvent } = app.models;
  const events = await StatusEvent.findAll(spec);

  return Promise.all([
    Status.remove(spec),
    StatusHead.remove(spec)
  ].concat(events.map(event =>
    StatusEvent.remove({ ...spec, eventId: event.eventId })
  )));
}

function assumeEvent(event) {
  assume(event.message).exists();
  assume(event).hasOwn('details');
  assume(event.error).is.falsey();
}

describe('routes', function () {
  describe('integration', function () {
    this.timeout(6E4);
    let status;
    let app;
    let spec;

    before(function (done) {
      index.start({ auth: false }, (err, instance) => {
        app = instance;
        status = new StatusHandler({
          models: app.models
        });
        spec = status._transform(fixtures.singleEvent);
        done(err);
      });
    });

    after(async function () {
      if (!app) return;
      await app.models.drop();
      await thenify(app, 'close');
    });

    describe('initial event', function () {
      beforeEach(async () => {
        if (!app) return;
        await status.event(fixtures.singleEvent);
      });

      it('/status should 404 when status requested and StatusHead doesnt exist', async function () {
        try {
          await request(address(app, '/status', { pkg: 'noway', env: 'dev' }));
        } catch (err) {
          assume(err.statusCode).equals(404);
          assume(err.message).includes('No Status exists for noway in dev');
        }
      });

      it('/status should 404 when status requested and specified spec doesnt exist', async function () {
        try {
          await request(address(app, '/status', { pkg: 'noway', env: 'dev', version: '7.6.1' }));
        } catch (err) {
          assume(err.statusCode).equals(404);
          assume(err.message).includes('No Status exists for noway@7.6.1 in dev');
        }
      });

      it('/status should return status object when requested', async function () {
        const statusObj = await request(address(app, '/status', spec));
        assume(statusObj.complete).is.falsey();
        assume(statusObj.createdAt).exists();
        assume(statusObj.error).is.falsey();
        assume(statusObj.total).is.falsey();
      });

      it('/status-events should return events when requested', async function () {
        const statusEvents = await request(address(app, '/status-events', spec));
        assume(statusEvents).is.length(1);
        const [one] = statusEvents;
        assumeEvent(one);
      });

      it('/progress should return progress computed for spec requested without version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', rip(spec, 'version')));
        assume(progress).is.equal(0);
        assume(count).is.equal(0);
        assume(total).is.equal(0);
      });

      it('/progress should return progress computed for spec requested with version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', spec));
        assume(progress).is.equal(0);
        assume(count).is.equal(0);
        assume(total).is.equal(0);
      });

      afterEach(async () => {
        if (!app) return;
        await cleanupTables(app, spec);
      });
    });

    describe('initial and queued events', function () {
      beforeEach(async () => {
        if (!app) return;
        await status.event(fixtures.singleEvent);
        await status.queued(fixtures.singleQueued);
      });

      it('/status should return status object when requested', async function () {
        const statusObj = await request(address(app, '/status', spec));
        assume(statusObj.complete).is.falsey();
        assume(statusObj.createdAt).exists();
        assume(statusObj.updatedAt).exists();
        assume(statusObj.error).is.falsey();
        assume(statusObj.total).is.equal(1);
      });

      it('/status-events should return events when requested', async function () {
        const statusEvents = await request(address(app, '/status-events', spec));
        assume(statusEvents).is.length(2);
        const [one, two] = statusEvents;
        assumeEvent(one);
        assumeEvent(two);
      });

      it('/progress should return progress computed for spec requested without version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', rip(spec, 'version')));
        assume(progress).is.equal(0);
        assume(count).is.equal(0);
        assume(total).is.equal(1);
      });

      it('/progress should return progress computed for spec requested with version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', spec));
        assume(progress).is.equal(0);
        assume(count).is.equal(0);
        assume(total).is.equal(1);
      });

      afterEach(async () => {
        if (!app) return;
        await cleanupTables(app, spec);
      });
    });

    describe('initial, queued and complete events', function () {
      beforeEach(async () => {
        if (!app) return;
        await status.event(fixtures.singleEvent);
        await status.queued(fixtures.singleQueued);
        await status.complete(fixtures.singleComplete);
      });

      it('/status should return status object when requested', async function () {
        const statusObj = await request(address(app, '/status', spec));
        assume(statusObj.complete).equals(true);
        assume(statusObj.createdAt).exists();
        assume(statusObj.updatedAt).exists();
        assume(statusObj.error).is.falsey();
        assume(statusObj.total).is.equal(1);
      });

      it('/status-events should return events when requested', async function () {
        const statusEvents = await request(address(app, '/status-events', spec));
        assume(statusEvents).is.length(3);
        const [one, two, three] = statusEvents;
        assumeEvent(one);
        assumeEvent(two);
        assumeEvent(three);
      });

      it('/progress should return progress computed for spec requested without version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', rip(spec, 'version')));
        assume(progress).is.equal(100);
        assume(count).is.equal(1);
        assume(total).is.equal(1);
      });

      it('/progress should return progress computed for spec requested with version', async function () {
        const { progress, count, total } = await request(address(app, '/progress', spec));
        assume(progress).is.equal(100);
        assume(count).is.equal(1);
        assume(total).is.equal(1);
      });

      afterEach(async () => {
        if (!app) return;
        const { StatusCounter } = app.models;
        await StatusCounter.decrement(spec, 1);
        await cleanupTables(app, spec);
      });
    });



    /* it('/status should error with 404 without enough parameters', async function () {
      const response = await request({ ...address(app, '/status'), simple: false, resolveWithFullResponse: true });
      assume(response.statusCode).equals(404);
    });*/
  });
});
