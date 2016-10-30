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
</br>

### Install

```bash
npm install git+https://git@github.com/benjaminjt/micro-nervous.git
```

### Overview

```js
const { Nerve, Service } = require('micro-nervous');

// Resources/Connections are 'Nerves'; just simple classes with a basic interface
class RedisNerve extends Nerve {
  init() {
    // Connection logic goes here:
    this.redis = new Redis('redis://:password@my.redis.resource:6379');

    // When our connection is ready, just call `this.fire('ready')`
    this.redis.once('ready', () => this.fire('ready'));
  }
  exit() {
    // Disconnection logic goes here, as expected:
    redis.once('end', () => this.fire('end'));
    redis.disconnect();
  }
}

// Nerves are re-usable, so can be shared between different microservices
const nerves = {
  pub: new RedisNerve(),
  sub: new RedisNerve(),
};

// And an instance of the Service class just ties together Nerve instances
const service = new Service(options, nerves);

// This gives you an event emitter, nothing too special
service.on('ready', () => console.log('Your service is ready!'));

// But this can be useful
service.on('end', () => process.exit());

// Events fired by your Nerves are prefixed with the key from the `nerves` object
service.on('pub-ready', () => console.log('Publish Nerve is ready');

// Service#poweroff shuts down your connections gracefully
process.on('SIGTERM', () => service.poweroff());

// Just like Service#connect gets your connections started
service.connect();

// You also get access to the Nerve instances
service.nerve.sub.redis.subscribe('channel', (message) => {
  // And a tasking system to prevent unwanted shutdowns
  const id = service.newTask();
  // Now poweroff will wait...
  // You can do lots of stuff... async stuff...
  // And even if you get a SIGTERM, from say, kubernetes...
  // Your task be allowed to finish before your connections are dropped!
  console.log('Yay, message:', message);
  service.endTask(id);
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
  "currentTasks": 0,
  "totalTasks": 9000
}
```

Basic, but you can overwrite `Service#stats` to return whatever you like. Like this:

```js
class MyService extends Service {
  stats() {
    return { ok: this.started && !this.exiting, tasks: this.tasks.length, answer: 42 };
  }
}
```

Incidentally, `stats().ok` is used for the healthckec: `true` for `200`, anything else gives you a `503`.

### Nerves

The `Nerves` class also provides a `#fire` method to emit events on the `Service` instance. This is useful for hooking up logging or monitoring.
