/* eslint import/no-extraneous-dependencies: 0 */
import test from 'ava';
import sinon from 'sinon';
import { Service, Nerve, Stats } from '../source';
import FakeNerve from './FakeNerve';

// Stub createStats to avoid binding ports
sinon.stub(Service, 'createStats', () => sinon.createStubInstance(Stats));

/**
 * Helpers
*/
function newService(...nerves) {
  return new Service({ nerves: [...nerves] });
}
function resolveOn(service, event, value) {
  return new Promise(resolve => service.once(event, () => resolve(value)));
}

test('Does not throw if instantiated with missing or appropriate Nerves', (t) => {
  const fakeNerve = new Nerve('fakeNerve');
  t.notThrows(() => new Service(), 'Threw with a missing options object.');
  t.notThrows(() => new Service({}), 'Threw with a missing nerves array.');
  t.notThrows(() => new Service({ nerves: [] }), 'Threw with an empty nerves array.');
  t.notThrows(() => new Service({ nerves: [fakeNerve] }), 'Threw with an appropriate nerve.');
});

test('Throws if instantiated Nerves that do not impliment the appropriate interface', (t) => {
  t.throws(() => newService(new FakeNerve('nerve', { noInit: true })));
  t.throws(() => newService(new FakeNerve('nerve', { noExit: true })));
  t.throws(() => newService(new FakeNerve('nerve', { noName: true })));
});

test('Attach to the fire method of each Nerve when #connect is called', (t) => {
  const callback = sinon.stub();
  const nerve01 = new FakeNerve('nerve01');
  const nerve02 = new FakeNerve('nerve02');
  const service = newService(nerve01, nerve02);
  service.connect();

  // Check they are attached
  t.is(service.nerves.nerve01, nerve01);
  t.is(service.nerves.nerve02, nerve02);

  // Check fire methods
  service.once(nerve01.event('test-event'), callback);
  service.once('nerve02-test-event', callback);
  nerve01.fire('test-event');
  nerve02.fire('test-event');
  t.is(callback.callCount, 2);
});

test('Emits the ready event when all Nerves are ready', async (t) => {
  const nerveCallback = sinon.stub();
  const serviceCallback = sinon.stub();
  const fastNerve = new FakeNerve('fastNerve');
  const slowNerve = new FakeNerve('slowNerve', { waitForReady: true });
  const service = newService(fastNerve, slowNerve);

  // Attach listeners for callbacks and connect
  service.on('ready', serviceCallback);
  const serviceReady = resolveOn(service, 'ready');
  const fastNerveReady = resolveOn(service, fastNerve.event('ready'));
  service.on(fastNerve.event('ready'), nerveCallback);
  service.on(slowNerve.event('ready'), nerveCallback);
  service.connect();

  // Check one nerve is ready, but the service isn't
  await fastNerveReady;
  t.is(nerveCallback.callCount, 1);
  t.is(serviceCallback.callCount, 0);

  // Manually tell the slowNerve to fire it's 'ready' event
  slowNerve.fireReady();

  // Once the service is ready, check that the service and both nerves are now ready
  await serviceReady;
  t.is(nerveCallback.callCount, 2);
  t.is(serviceCallback.callCount, 1);
});

test('Resolves with a promise when all nerves are ready', async (t) => {
  const nerveCallback = sinon.stub();
  const serviceCallback = sinon.stub();
  const fastNerve = new FakeNerve('fastNerve');
  const slowNerve = new FakeNerve('slowNerve', { waitForReady: true });
  const service = newService(fastNerve, slowNerve);

  // Attach listeners for callbacks and connect
  service.on(fastNerve.event('ready'), nerveCallback);
  service.on(slowNerve.event('ready'), nerveCallback);
  const connectPromise = service.connect().then(serviceCallback);

  // Check one nerve is ready, but the service isn't
  t.is(nerveCallback.callCount, 1);
  t.is(serviceCallback.callCount, 0);

  // Manually tell the slowNerve to fire it's 'ready' event
  slowNerve.fireReady();

  // Once the service is ready, check that the service and both nerves are now ready
  await connectPromise;
  t.is(nerveCallback.callCount, 2);
  t.is(serviceCallback.callCount, 1);
});

test('Emits the error event (and not the ready event) if Nerve#init throws', async (t) => {
  const errorCallback = sinon.stub();
  const readyCallback = sinon.stub();
  const nerve = new FakeNerve('nerve', { initThrows: true });
  const service = newService(nerve);

  // Attach listeners for callbacks and connect
  service.on('error', errorCallback);
  service.on('ready', readyCallback);
  const serviceError = service.connect().catch(() => null);

  // Check callbacks
  await serviceError;
  t.is(errorCallback.callCount, 1);
  t.is(readyCallback.callCount, 0);
});

test('Creates a stats instance and calls stats.init once nerves are ready', async (t) => {
  const nerveCallback = sinon.stub();
  const nerve = new FakeNerve('nerve', { waitForReady: true });
  const service = newService(nerve);

  // Attach listeners for callbacks and connect
  service.on(nerve.event('ready'), nerveCallback);
  const ready = service.connect();

  // Check for stats instance, and that init has not been called yet
  t.true(service.stats instanceof Stats);
  t.is(service.stats.init.callCount, 0);

  // Manually tell the slowNerve to fire it's 'ready' event
  nerve.fireReady();

  // Once the service is ready, check that init has been called
  await ready;
  t.is(service.stats.init.callCount, 1);
});

test('The #ok getter returns true while the service is okay', async (t) => {
  const nerve = new FakeNerve('nerve', { waitForReady: true });
  const service = newService(nerve);

  // Check service.ok is 'false' before ready, and 'true' after ready
  const ready = service.connect();
  t.false(service.ok);
  nerve.fireReady();
  await ready;
  t.true(service.ok);

  // Check it goes back to 'false' after poweroff is called
  service.poweroff();
  t.false(service.ok);
});

test('Allows a task to be created with #newTask,', async (t) => {
  const service = newService();
  await service.connect();
  const task = await service.newTask();
  t.is(typeof task.id, 'string');
});

test('Throws if #newTask is called before the service is started or ready', async (t) => {
  const nerve = new FakeNerve('nerve', { waitForReady: true });
  const service = newService(nerve);

  // Check that #newTask throws if called before #connect
  t.throws(service.newTask());

  // Check that #newTask throws after #connect is called, but before it is ready
  const ready = service.connect();
  t.throws(service.newTask());

  // Check that #newTask does not throw after the service is ready
  nerve.fireReady();
  await ready;
  t.notThrows(service.newTask());
});

test('Throws if #newTask is called after #poweroff', async (t) => {
  const service = newService();
  await service.connect();
  await service.poweroff();
  t.throws(service.newTask());
});

test('#newTask returns a task and blocks the service#poweroff until a it is done', async (t) => {
  const nerve = new FakeNerve('nerve');
  sinon.spy(nerve, 'exit');
  const service = newService(nerve);

  // Connect and create a task, and call poweroff
  await service.connect();
  const task01 = await service.newTask();
  const task02 = await service.newTask();
  const poweroff = service.poweroff();

  // At this point nothing should have happened, but two tasks should be on the service
  t.is(nerve.exit.callCount, 0);
  t.is(service.taskCount, 2);

  // Calling task02.done() should reduce the count but not let the service exit
  task01.done();
  t.is(service.taskCount, 1);
  t.is(nerve.exit.callCount, 0);

  // But calling task02.done() should allow the nerve to be closed
  task02.done();
  await poweroff;
  t.is(nerve.exit.callCount, 1);
});

test('Emits the end event when exited', async (t) => {
  const endCallback = sinon.stub();
  const nerve = new FakeNerve('nerve', { waitForEnd: true });
  const service = newService(nerve);

  // Attach listeners for connect
  service.on('end', endCallback);
  await service.connect();
  const task = await service.newTask();
  const poweroff = service.poweroff();

  // Assert the proper order of events
  t.is(endCallback.callCount, 0);
  t.is(service.taskCount, 1);
  task.done();
  t.is(endCallback.callCount, 0);
  t.is(service.taskCount, 0);
  nerve.fireEnd();
  await poweroff;
  t.is(endCallback.callCount, 1);
});
