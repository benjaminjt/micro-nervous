const crypto = require('crypto');

/**
 * Constants
*/
const ID_BYTES = 8;
const ID_ENCODING = 'hex';

/**
 * Cached function definition to parse to Promise constructor
*/
const cryptoBytes = resolve => resolve(crypto.randomBytes(ID_BYTES).toString(ID_ENCODING));

class Task {
  /**
   * Task class for handling task operations
   *
   * @param {{
   *   id: string,
   *   onDone: function(string),
   *   onError: function(string, !Error),
   *   onFatal: function(string, !Error)
   * }}
  */
  constructor(options) {
    /**
     * @const {string}
    */
    this.id = options.id;
    /**
     * @const {!function(string)}
    */
    this.onDone = options.onDone;
    /**
     * @const {!function(string, !Error)}
    */
    this.onError = options.onError;
    /**
     * @const {!function(string, !Error)}
    */
    this.onFatal = options.onFatal;
  }
  /**
   * @public
  */
  done() {
    this.onDone(this.id);
  }
  /**
   * @public
   * @param {!Error} error
  */
  error(error) {
    this.onError(this.id, error);
  }
  /**
   * @public
   * @param {!Error} error
  */
  fatal(error) {
    this.onFatal(this.id, error);
  }
  /**
   * Small helper function to generate random ids for tasks. This is async to avoid blocking the
   * main thread while getting the random data for the id, and to kick off tasks in an async manner.
   *
   * It can be shortcut by passing an existing id.
   *
   * @param {?string} id
   * @returns {!Promies<string>}
  */
  static getId(id) {
    if (id) return Promise.resolve(id);
    return new Promise(cryptoBytes);
  }
}

module.exports = Task;
