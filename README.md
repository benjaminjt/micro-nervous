[travis-image]: https://img.shields.io/travis/benjaminjt/micro-nervous.svg?style=flat-square
[travis-url]: https://travis-ci.org/benjaminjt/micro-nervous
[codecov-image]: https://img.shields.io/codecov/c/github/benjaminjt/micro-nervous/master.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/benjaminjt/micro-nervous
[license-image]: http://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license-url]: LICENSE

</br>

<p align="center">
  <img
    alt="Media Events Logo"
    src="https://raw.githubusercontent.com/benjaminjt/micro-nervous/master/logo/logo.png"
    width="100px"
  />
</p>

<p align="center">
<strong><code>micro-nervous</code></strong> is a minimal framework to help you build Node.js micro-services
</p>

<p align="center">
It aims to reduce boilerplate and improve code clarity by providing simple patterns to manage resource connections, healthchecks, stats, and graceful shutdown
</p>

<p align="center">
All with zero dependencies (because size matters)
</p>

</br>
---

[![Travis][travis-image]][travis-url]
[![Codecov][codecov-image]][codecov-url]
[![License][license-image]][license-url]

### Install

```bash
npm install micro-nervous
```

### Overview

```js
const { Nerve, Service } = require('micro-nervous');

// 'Nerves' are simple class wrappers for Resources or Connections
class RedisNerve extends Nerve {
  init() {
    // Connection logic goes here:
    this.redis = new Redis('redis://:password@my.redis.resource:6379');

    // When our connection is ready, just fire the `ready` event
    this.redis.once('ready', () => this.fire('ready'));
  }
  exit() {
    // Disconnection logic goes here, as expected:
    redis.once('end', () => this.fire('end'));
    redis.disconnect();
  }
}

// Nerves are re-usable, so can be shared between different microservices
const nerves = [
  new RedisNerve('pub'),
  new RedisNerve('sub'),
];

// And an instance of the Service class just ties together Nerve instances
const service = new Service({ nerves, enableStats: true, statsPort: 3000 });

// This gives you an event emitter, nothing too special
service.on('ready', () => console.log('Your service is ready!'));

// But this can be useful
service.on('end', code => process.exit(code));

// Events fired by your Nerves are prefixed with their name
service.on('pub-ready', () => console.log('Publish Nerve is ready');

// Service#poweroff shuts down your connections gracefully
process.once('SIGTERM', () => service.poweroff());

// Just like Service#connect gets your connections started
service.connect();

// You also get access to the Nerve instances
service.nerve.sub.redis.subscribe('channel', (message) => {
  // And a tasking system to prevent unwanted shutdowns
  const task = service.newTask();
  // Now Service#poweroff will wait...
  // You can do lots of stuff... async stuff...
  // And even if you get a SIGTERM, from say, kubernetes...
  // Your task be allowed to finish before your connections are dropped!
  console.log('Yay, message:', message);
  task.done();
});

// The Nerve instances are attached using the keys used in the constructor
service.nerve.pub.redis.publish('channel', 'hello world!');
```

### Healthchecks
Once you call `Service#start` you can hit `http://host:3000` (or the port of your choosing) for that `200 OK` feeling!
Obviously that goes away the moment something goes wrong. Or when you call `Service#poweroff`, I guess.

### Stats
You can also hit `http://host:3000/stats` for some sweet, sweet json. For example:

```json
{
  "ok": true,
  "currentTasks": 0
}
```

The stats json just comes off of `service.stats`, which can be easily overwritten

```js
class MyService extends Service {
  getStats() {
    return {
      ok: this.ok,
      currentTasks: this.stats.currentTasks,
      answer: askDeepThought(),
    };
  }
}
```

Incidentally, `stats.ok` is used for the healthcheck: `true` for `200`, anything else gives you a `503`.

### Roadmap

Some features that might make it into future versions, in no particular order:

- Example Nerves for common resources, e.g. Redis, Mongo, etc.
- Type annotations for Closure Compiler

### Contributing

All help is appreciated! Feel free to fork, branch `master` and open a PR. Thanks!
