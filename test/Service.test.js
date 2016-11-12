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
function emitPromise(emitter, event, value) {
  return new Promise(resolve => emitter.once(event, () => resolve(value)));
}
function emitStub(emitter, ...events) {
  const stub = sinon.stub();
  events.forEach(event => emitter.on(event, stub));
  return stub;
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
  const nerve01 = new FakeNerve('nerve01');
  const nerve02 = new FakeNerve('nerve02');
  const service = newService(nerve01, nerve02);
  service.connect();

  // Check they are attached
  t.is(service.nerves.nerve01, nerve01);
  t.is(service.nerves.nerve02, nerve02);

  // Check fire methods
  const callback = emitStub(service, nerve01.event('test-event'), 'nerve02-test-event');
  nerve01.fire('test-event');
  nerve02.fire('test-event');
  t.is(callback.callCount, 2);
});

test('Emits the ready event when all Nerves are ready', async (t) => {
  const fastNerve = new FakeNerve('fastNerve');
  const slowNerve = new FakeNerve('slowNerve', { waitForReady: true });
  const service = newService(fastNerve, slowNerve);

  // Attach listeners for callbacks and connect
  const serviceCallback = emitStub(service, 'ready');
  const nerveCallback = emitStub(service, fastNerve.event('ready'), slowNerve.event('ready'));
  const serviceReady = emitPromise(service, 'ready');
  const fastNerveReady = emitPromise(service, fastNerve.event('ready'));
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
  const fastNerve = new FakeNerve('fastNerve');
  const slowNerve = new FakeNerve('slowNerve', { waitForReady: true });
  const service = newService(fastNerve, slowNerve);

  // Attach listeners for callbacks and connect
  const serviceCallback = sinon.stub();
  const nerveCallback = emitStub(service, fastNerve.event('ready'), slowNerve.event('ready'));
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
  const nerve = new FakeNerve('nerve', { initThrows: true });
  const service = newService(nerve);

  // Attach listeners for callbacks and connect
  const errorCallback = emitStub(service, 'error');
  const readyCallback = emitStub(service, 'ready');
  const serviceError = service.connect().catch(() => null);

  // Check callbacks
  await serviceError;
  t.is(errorCallback.callCount, 1);
  t.is(readyCallback.callCount, 0);
});

test('Emits the error event (and not the ready event) if Nerve#attach throws', async (t) => {
  const nerve = new FakeNerve('nerve');
  sinon.stub(nerve, 'attach').throws();
  const service = newService(nerve);

  // Attach listeners for callbacks and connect
  const errorCallback = emitStub(service, 'error');
  const readyCallback = emitStub(service, 'ready');
  const serviceError = service.connect().catch(() => null);

  // Check callbacks
  await serviceError;
  t.is(errorCallback.callCount, 1);
  t.is(readyCallback.callCount, 0);
});

test('Creates a stats instance and calls stats.init once nerves are ready', async (t) => {
  const nerve = new FakeNerve('nerve', { waitForReady: true });
  const service = newService(nerve);
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

test('Does not start a stats instance if statsEnabled is false', async (t) => {
  const service = new Service({ statsEnabled: false });
  await service.connect();

  // Check that stats instanceis blank
  t.false(service.stats instanceof Stats);
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

test('Generates task and blocks service#poweroff until the task done with #newTask', async (t) => {
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

test('Throws a promise rejection from #newTask if taskCount exceeds maxTasks', async (t) => {
  const errorHandler = sinon.stub();
  const service = new Service({ maxTasks: 3 });
  await service.connect();

  // Adding three tasks should be finr
  await service.newTask().catch(errorHandler);
  await service.newTask().catch(errorHandler);
  await service.newTask().catch(errorHandler);
  t.is(errorHandler.callCount, 0);
  t.is(service.taskCount, 3);

  // Check for an error on tasks 4 and 5
  await service.newTask().catch(errorHandler);
  await service.newTask().catch(errorHandler);
  t.is(errorHandler.callCount, 2);

  // Check taskCount is still 3
  t.is(service.taskCount, 3);
});

test('Emits the `task-error` event and clears the task when task.error() is called', async (t) => {
  const service = newService();
  await service.connect();

  // Get a stub callback and a new task
  const taskErrorCallback = emitStub(service, 'task-error');
  const task = await service.newTask();

  // Check for the proper order of events
  t.is(service.taskCount, 1);
  task.error(new Error('oops'));
  t.is(taskErrorCallback.callCount, 1);
  t.is(service.taskCount, 0);
});

test('Emits `task-error` and `error`, and exits when task.fatal() is called', async (t) => {
  const service = newService();
  sinon.spy(service, 'poweroff');
  await service.connect();

  // Get a stub callback and a new task
  const serviceEnd = emitPromise(service, 'end');
  const taskErrorCallback = emitStub(service, 'task-error');
  const errorCallback = emitStub(service, 'error');
  const task = await service.newTask();

  // Check for the proper order of events
  t.is(service.taskCount, 1);
  task.fatal(new Error('oops'));
  t.is(taskErrorCallback.callCount, 1);
  t.is(errorCallback.callCount, 1);
  t.is(service.taskCount, 0);
  t.is(service.poweroff.callCount, 1);

  // Also check the service actually exits
  await serviceEnd;
  t.pass();
});


test('Returns the current ok status and taskCount from getStats', async (t) => {
  const service = newService();
  t.deepEqual(service.getStats(), { ok: false, currentTasks: 0 });
  await service.connect();
  const task01 = await service.newTask();
  const task02 = await service.newTask();
  t.deepEqual(service.getStats(), { ok: true, currentTasks: 2 });
  task02.done();
  t.deepEqual(service.getStats(), { ok: true, currentTasks: 1 });
  task01.done();
  await service.poweroff();
  t.deepEqual(service.getStats(), { ok: false, currentTasks: 0 });
});

test('Emits the error event if Nerve#exit throws after #poweroff', async (t) => {
  const nerve = new FakeNerve('nerve', { exitThrows: true });
  const service = newService(nerve);

  // Attach listeners for callbacks and connect
  const errorCallback = emitStub(service, 'error');
  await service.connect().catch(() => {});
  const poweroff = service.poweroff().catch(() => {});

  // Check callbacks
  await poweroff;
  t.is(errorCallback.callCount, 1);
});

test('Emits the end event when exited', async (t) => {
  const nerve = new FakeNerve('nerve', { waitForEnd: true });
  const service = newService(nerve);

  // Attach listeners for connect
  const endCallback = emitStub(service, 'end');
  await service.connect();
  const task = await service.newTask();
  const poweroff = service.poweroff();

  // Check for the proper order of events
  t.is(endCallback.callCount, 0);
  t.is(service.taskCount, 1);
  task.done();
  t.is(endCallback.callCount, 0);
  t.is(service.taskCount, 0);
  nerve.fireEnd();
  await poweroff;
  t.is(endCallback.callCount, 1);
});

test('Ends if #poweroff is called while waiting to exit', async (t) => {
  const service = newService();

  // Attach listeners for connect
  const errorCallback = emitStub(service, 'error');
  const endCallback = emitStub(service, 'end');
  await service.connect();
  await service.newTask();

  // Call poweroff once and check end isn't called
  service.poweroff().catch(() => {});
  t.is(endCallback.callCount, 0);
  t.is(errorCallback.callCount, 0);
  t.true(service.exiting);

  // Call poweroff again and check that end is called
  await service.poweroff().catch(() => {});
  t.is(endCallback.callCount, 1);
  t.is(errorCallback.callCount, 1);
});
