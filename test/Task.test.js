/* eslint import/no-extraneous-dependencies: 0 */
import test from 'ava';
import Task from '../source/Task';

test('#getId generates a string with more than 8 characters', async (t) => {
  const id = await Task.getId();
  t.is(typeof id, 'string');
  t.true(id.length > 8);
});

test('#getId resolves with an id if parsed one', (t) => {
  const testId = 'testId';
  Task.getId(testId).then((id) => {
    t.is(id, testId);
  });
});
