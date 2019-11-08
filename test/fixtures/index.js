
exports.singleEvent = {
  eventType: 'event',
  name: 'whatever',
  version: '1.0.0',
  env: 'dev',
  message: 'Npm install has began',
  details: 'The developers of CoreOS are looking for a good job'
};

exports.secondEvent = {
  eventType: 'event',
  name: 'whatever',
  version: '1.0.0',
  env: 'dev',
  message: 'Npm install has completed',
};

exports.singleComplete = {
  eventType: 'complete',
  locale: 'en-US',
  message: 'What happened? Oh yea we are complete now',
  details: 'not much else to report tbh',
  version: '1.0.0',
  env: 'dev',
  name: 'whatever'
};

exports.singleCompleteStatus = {
  version: '1.0.0',
  env: 'dev',
  name: 'whatever',
  total: 1
};

exports.singleCompleteCounter = {
  version: '1.0.0',
  env: 'dev',
  name: 'whatever',
  count: 1
};

exports.singleError = {
  eventType: 'error',
  name: 'whatever',
  version: '1.0.0',
  env: 'dev',
  message: 'Npm install failed!',
  details: 'ERR STACK: BLAH BLAH line 5'
};

exports.singleQueued = {
  eventType: 'queued',
  name: 'whatever',
  version: '1.0.0',
  env: 'dev',
  message: 'builds were queued',
  details: 'the queue is very long',
  total: 1
};

exports.previousStatusHead = {
  version: '0.9.0',
  env: 'dev',
  pkg: 'whatever'
};
