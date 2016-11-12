/* eslint import/no-extraneous-dependencies: 0 */
import test from 'ava';
import sinon from 'sinon';
import { Nerve } from '../source';

test('Calls #bindFire when #attach is called with a function', (t) => {
  const nerve = new Nerve('nerve');
  const emitter = sinon.stub();
  sinon.spy(nerve, 'bindFire');
  nerve.attach(emitter);
  t.is(nerve.bindFire.callCount, 1);
  t.is(nerve.bindFire.args[0][0], emitter);
});

test('Throws if #attach is called without an emit function', (t) => {
  const nerve = new Nerve('nerve');
  t.throws(() => nerve.attach());
});

test('Throws if #attach is called with a non-function', (t) => {
  const nerve = new Nerve('nerve');
  t.throws(() => nerve.attach('not-a-function'));
  t.throws(() => nerve.attach({}));
});

test('Calls all attached emitters with a prefixed event and all args when #fire is called', (t) => {
  const name = 'name';
  const event = 'event';
  const nerve = new Nerve(name);
  const emitter01 = sinon.stub();
  const emitter02 = sinon.stub();
  nerve.attach(emitter01);
  nerve.attach(emitter02);

  // Check the event name prefix
  const prefixed = nerve.event(event);
  t.is(prefixed, `${name}-${event}`);

  // Check the calls are made
  nerve.fire(event, 'arg1', 'arg2');
  t.is(emitter01.callCount, 1);
  t.is(emitter01.args[0][0], prefixed);
  t.is(emitter01.args[0][1], 'arg1');
  t.is(emitter01.args[0][2], 'arg2');
  t.is(emitter02.callCount, 1);
  t.is(emitter02.args[0][0], prefixed);
});

test('Throws if #fire is called before #attach', (t) => {
  const nerve = new Nerve('nerve');
  t.throws(() => nerve.fire('event'));
});

test('Throws if #init is called without being overridden', (t) => {
  const nerve = new Nerve('nerve');
  t.throws(() => nerve.init());
});

test('Throws if #exit is called without being overridden', (t) => {
  const nerve = new Nerve('nerve');
  t.throws(() => nerve.exit());
});

test('Fails silently if Nerve#checkNerve is called with a falsy value', (t) => {
  t.notThrows(() => Nerve.checkNerve());
});
