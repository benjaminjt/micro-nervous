/* eslint import/no-extraneous-dependencies: 0 */
import test from 'ava';
import taskId from '../source/taskId';

test('generates a string with more than 8 characters', async (t) => {
  const id = await taskId();
  t.is(typeof id, 'string');
  t.true(id.length > 8);
});

test('resolves with an id if parsed one', (t) => {
  const testId = 'testId';
  taskId(testId).then((id) => {
    t.is(id, testId);
  });
});
