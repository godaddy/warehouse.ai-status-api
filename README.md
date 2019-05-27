# `warehouse.ai-status-api`

[![Version npm](https://img.shields.io/npm/v/warehouse.ai-status-api.svg?style=flat-square)](https://www.npmjs.com/package/warehouse.ai-status-api)
[![License](https://img.shields.io/npm/l/warehouse.ai-status-api.svg?style=flat-square)](https://github.com/warehouseai/warehouse.ai-status-api/blob/master/LICENSE)
[![npm Downloads](https://img.shields.io/npm/dm/warehouse.ai-status-api.svg?style=flat-square)](https://npmcharts.com/compare/warehouse.ai-status-api?minimal=true)
[![Build Status](https://travis-ci.org/warehouseai/warehouse.ai-status-api.svg?branch=master)](https://travis-ci.org/warehouseai/warehouse.ai-status-api)
[![codecov](https://codecov.io/gh/godaddy/warehouse.ai-status-api/branch/master/graph/badge.svg)](https://codecov.io/gh/godaddy/warehouse.ai-status-api)
[![Dependencies](https://img.shields.io/david/warehouseai/warehouse.ai-status-api.svg?style=flat-square)](https://github.com/warehouseai/warehouse.ai-status-api/blob/master/package.json)

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

## Usage

Write your own wrapper and pull in the [`slay`][Slay] application that can reference
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

### Secure configuration

By default the Warehouse.ai status API runs as an service over `http` and has
no authentication in place. Setup the configuration to have [Slay] use `https`
and use authentication middleware, for example [authboot]. Store API keys and
tokens in an encrypted config with [whisper.json][whisper].

## API

The service exposes the following routes.

```scala
GET    /status/:pkg/:env                       # Get build status for HEAD
GET    /status/:pkg/:env/:version              # Get build status for version
GET    /status-events/:pkg/:env/               # Get status events for HEAD
GET    /status-events/:pkg/:env/:version       # Get status events for version
GET    /progress/:pkg/:env/                    # Get build progress for HEAD
GET    /progress/:pkg/:env/:version            # Get build progress for HEAD
```

## Test

Make sure you are running [cassandra] locally.

```sh
npm test
```

[nsq]: https://nsq.io/
[carpenterd]: https://github.com/godaddy/carpenterd
[carpenterd-worker]: https://github.com/godaddy/carpenterd-worker
[cassandra]: https://cassandra.apache.org/
[Slay]: https://github.com/godaddy/slay
[authboot]: https://github.com/warehouseai/authboot
[whisper]: https://github.com/jcrugzz/whisper.json
