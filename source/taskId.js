const crypto = require('crypto');

/**
 * Constants
*/
const SIZE = 8;
const ENCODING = 'hex';

/**
 * Cached function definition to parse to Promise constructor
*/
const cryptoBytes = resolve => resolve(crypto.randomBytes(SIZE).toString(ENCODING));

/**
 * taskId
 *
 * Small helper function to generate random ids for tasks. This is async to avoid blocking the main
 * thread while getting the random data for the id, and to kick of tasks in an async manner.
 *
 * It can be shortcut by passing an existing id.
 *
 * @param {?string} id
 * @returns {!Promies<string>}
*/
function taskId(id) {
  if (id) return Promise.resolve(id);
  return new Promise(cryptoBytes);
}

module.exports = taskId;
