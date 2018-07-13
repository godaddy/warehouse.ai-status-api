const index = require('..');
const assume = require('assume');
const thenify = require('tinythen');
const request = require('request-promise-native');
const StatusHandler = require('../status-handler');
const fixtures = require('./fixtures');
const { address } = require('./util');
const rip = require('rip-out');


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

    beforeEach(async () => {
      if (!app) return;
      await status.event(fixtures.singleEvent);
      await status.queued(fixtures.singleQueued);
      await status.complete(fixtures.singleComplete);
    });

    afterEach(async () => {
      if (!app) return;
      const { Status, StatusHead, StatusEvent, StatusCounter } = app.models;
      await Promise.all([
        Status.remove(spec),
        StatusHead.remove(spec),
        StatusEvent.remove(spec),
        StatusCounter.decrement(spec, 1)
      ]);
    });

    it('/status should return status object when requested', async function () {
      const statusObj = await request(address(app, '/status', spec));
      assume(statusObj.complete).equals(true);
    });

    it('/status should error with 404 without enough parameters', async function () {
      const response = await request({ ...address(app, '/status'), simple: false, resolveWithFullResponse: true });
      assume(response.statusCode).equals(404);
    });

    it('/status-events should return events when requested', async function () {
      const statusEvents = await request(address(app, '/status-events', spec));
      assume(statusEvents).is.length(3);
    });

    it('/progress should return progress computed for spec requested without version', async function () {
      const { progress } = await request(address(app, '/progress', rip(spec, 'version')));
      assume(progress).is.equal(100);
    });

    it('/progress should return progress computed for spec requested with version', async function () {
      const { progress } = await request(address(app, '/progress', spec));
      assume(progress).is.equal(100);
    });
  });
});
