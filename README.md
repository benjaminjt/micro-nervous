<p align="center">
  <img
    alt="Media Events Logo"
    src="https://raw.githubusercontent.com/benjaminjt/micro-nervous/master/logo/logo.png"
    width="100px"
  />
</p>
<p align="center">
`micro-nervous` is a minimal micro-services framework for Node.js
</p>
<p align="center">
It aims to reduce boilerplate and improve code clarity by managing resource connections, healthchecks, stats, and graceful shutdown with simple patterns
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
import { Nerve, Service } from `micro-nervous`;

// Resources/Connections are 'Nerves'; just simple classes with a basic interface
class RedisNerve extends Nerve {
  connect(done) {
    // Connection logic goes here:
    const redis = new Redis('redis://:password@my.redis.resource:6379');

    // When our connection is ready, just call `done`
    redis.once('ready', () => done(redis));
  }
  poweroff(done) {
    // Disconnection logic goes here, as expected:
    redis.once('end', () => done());
    redis.disconnect();

    // You could also return promises from these methods
  }
}

// An instance of the Service class just ties together Nerves
const service = new Service(options, { 
  pubRedis: new RedisNerve(),
  subRedis: new RedisNerve(),
});

// This gives you an event emitter, nothing too special
service.on('ready', () => console.log('Your service is ready!'));

// But this can be useful
service.on('end', () => process.exit());

// Service#poweroff shuts down your connections gracefully
process.on('SIGTERM', () => service.poweroff());

// Just like Service#connect gets your connections started
service.connect();

// You also get access to watever you parse to `done` (or resolve your promise with)
service.nerve.subRedis.subscribe('channel', (message) => {
  // And a tasking system to prevent unwanted shutdowns
  const id = service.newTask();
  // Now poweroff will wait...
  // You can do lots of stuff... async stuff...
  // And even if you get a SIGTERM, from say, kubernetes...
  // Your task be allowed to finish before your connections are dropped!
  console.log('Yay, message:', message);
  service.endTask(id);
});

// Your objects are attached using the keys used in the constructor
service.nerve.pubRedis.publish('channel', 'hello world!');
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
