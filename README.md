# warehouse.ai-status-api
[![Build Status](https://travis-ci.org/godaddy/warehouse.ai-status-api.svg?branch=master)](https://travis-ci.org/godaddy/warehouse.ai-status-api)[![codecov](https://codecov.io/gh/godaddy/warehouse.ai-status-api/branch/master/graph/badge.svg)](https://codecov.io/gh/godaddy/warehouse.ai-status-api)

## Motivation

There are a handful of pieces to the warehouse system that all perform different
tasks. For building we have [`carpenterd`][carpenterd]
[`carpenterd-worker`][carpenterd-worker] and
eventually `carpenter-installer` to handle the different layers of the build
process. The responsibility of the `warehouse.ai-status-api` is to receive the
events from these services over [`NSQ`][nsq] and create database records to
track the status of a given build. In the future we may also hook in some
generic webhooks based on these events or integrate with a notification
dispatcher of some kind.

## Install

```sh
npm install warehouse.ai-status-api --save
```

## Example usage

Write your own wrapper and pull in the `slay` application that can reference
a `config` directory in your folder.

```js
const path = require('path');
const StatusApi = require('warehouse.ai-status-api').App;

// Directory that contains the `config` directory you want to use for config
// files for this server.
const root = path.join(__dirname, '..');

const status = new StatusApi(root);
status.start(err => {
  if (err) return status.log.error(err), process.exit(1);
  const port = status.servers.http.address().port;
  status.log.info('Warehouse.ai-tatus-api started on port %d', port);
});
```

## Routes

__TODO__

## Test

Make sure you are running cassandra locally. [Simple instructions for
OSX](https://gist.github.com/ssmereka/e41d4ad053a547611ba7ef1dac4cc826)

```sh
npm test
```

[nsq]: https://nsq.io/
[carpenterd]: https://github.com/godaddy/carpenterd
[carpenterd-worker]: https://github.com/godaddy/carpenterd-worker
.
