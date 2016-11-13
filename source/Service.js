/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "NerveInterface" }] */
const { EventEmitter } = require('events');
const { Nerve, NerveInterface } = require('./Nerve');
const Task = require('./Task');

/**
 * An event emitter which manage nerves and provies #newTask and #endTask
*/
class Service extends EventEmitter {
  /**
   * @extends {EventEmitter}
   * @param {?Service.OptionsType} options
  */
  constructor(options) {
    super();

    // Combine options and defaults
    const opts = Object.assign({}, Service.DEFAULTS, options || {});

    /**
     * @private
     * @const {?Stats}
    */
    this.stats = opts.stats;
    /**
     * @private
     * @const {number}
    */
    this.maxTasks = opts.maxTasks;
    /**
     * @private
     * @const {!Array<!NerveInterface>}
    */
    this.nerveList = Array.isArray(opts.nerves) ? opts.nerves.slice() : [];
    /**
     * @public
     * @enum {string}
    */
    this.tasks = {};
    /**
     * @public
     * @enum {!NerveInterface}
    */
    this.nerves = {};
    /**
     * @public
     * @type {bool}
    */
    this.started = false;
    /**
     * @public
     * @type {bool}
    */
    this.exiting = false;

    // Check each Nerve in the nerveList and assign each one to a key in this.nerves
    this.nerveList.forEach((nerve) => {
      Nerve.checkNerve(nerve);
      this.nerves[nerve.name] = nerve;
    });

    // Bind task functions
    this.taskCreate = this.taskCreate.bind(this);
    this.taskOnError = this.taskOnError.bind(this);
    this.taskOnFatal = this.taskOnFatal.bind(this);
    this.taskOnDone = this.taskOnDone.bind(this);
  }
  /**
   * Get the service's status
   *
   * @public
   * @returns {boolean}
  */
  get ok() {
    return this.started === true && this.exiting !== true;
  }
  /**
   * Get the current task count
   *
   * @public
   * @returns {number}
  */
  get taskCount() {
    return (Object.keys(this.tasks) || []).length;
  }
  /**
   * Produces stats to service healthchecks and stats
   *
   * @private
   * @returns {{
   *   ok: boolean,
   *   currentTasks: number
   * }}
  */
  getStats() {
    return { ok: this.ok, currentTasks: this.taskCount };
  }
  /**
   * Generates a task object which will block #poweroff until Task#done is called
   *
   * @public
   * @param {?string} id
   * @returns {Promise<!Task>}
  */
  newTask(id) {
    if (!this.started) return Promise.reject(new Error('can not create task until ready'));
    if (this.exiting) return Promise.reject(new Error('can not create task while exiting'));
    if (this.maxTasks !== 0 && this.taskCount >= this.maxTasks) {
      return Promise.reject(new Error('too many tasks being processed'));
    }

    return Task.getId(id).then(this.taskCreate);
  }
  /**
   * Creator for the task object
   *
   * @private
   * @param {string} id
   * @returns {!Task}
  */
  taskCreate(id) {
    this.tasks[id] = Date.now();

    return new Task({
      id,
      onError: this.taskOnError,
      onFatal: this.taskOnFatal,
      onDone: this.taskOnDone,
    });
  }
  /**
   * Clears a task from this.tasks
   *
   * @private
   * @param {string} id
  */
  taskClear(id) {
    delete this.tasks[id];
  }
  /**
   * Handler for Task#done
   *
   * @private
   * @param {string} id
  */
  taskOnDone(id) {
    const time = Date.now() - this.tasks[id];
    this.taskClear(id);
    this.emit('task-complete', id, time);
    this.emit('task-end');
  }
  /**
   * Handler for Task#error
   *
   * @private
   * @param {string} id
   * @param {!Error} error
  */
  taskOnError(id, error) {
    this.taskClear(id);
    this.emit('task-error', id, error);
    this.emit('task-end');
  }
  /**
   * Handler for Task#fatal
   *
   * @private
   * @param {string} id
   * @param {!Error} error
  */
  taskOnFatal(id, error) {
    this.taskClear(id);
    this.emit('task-error', id, error);
    this.emit('error', new Error('fatal task error'));
    this.poweroff(1);
  }
  /**
   * Starts nerves and returns a promise when done. This function has a convoluded promise in an
   * attempt to keep as much logic as possible execting synchronously.
   *
   * @private
   * @returns {!Promise}
  */
  initNerves() {
    const promises = this.nerveList.map((nerve) => {
      // This is the only real async bit for each promise
      const promise = new Promise(resolve => this.once(nerve.event('ready'), resolve()));

      // Do this sync and just pretend to handle errors like a promise
      try {
        nerve.init();
      } catch (error) {
        return Promise.reject(error);
      }

      // Return the real async promise
      return promise;
    });

    return Promise.all(promises);
  }
  /**
   * Ends nerves and returns a promise when done. This function has a convoluded promise in an
   * attempt to keep as much logic as possible execting synchronously.
   *
   * @private
   * @returns {!Promise}
  */
  exitNerves() {
    const promises = this.nerveList.map((nerve) => {
      // This is the only real async bit for each promise
      const promise = new Promise(resolve => this.once(nerve.event('end'), resolve()));

      // Do this sync and just pretend to handle errors like a promise
      try {
        nerve.exit();
      } catch (error) {
        return Promise.reject(error);
      }

      // Return the real async promise
      return promise;
    });

    return Promise.all(promises);
  }
  /**
   * Start the service by connecting and initialising nerves
   *
   * @public
   * @returns {!Promise}
  */
  connect() {
    if (this.stats && typeof this.stats.attach === 'function') {
      this.stats.attach(this.getStats.bind(this));
    }

    try {
      this.nerveList.forEach(nerve => nerve.attach(this.emit.bind(this)));
    } catch (error) {
      this.emit('error', error);
      return Promise.reject(error);
    }

    return this.initNerves()
      .then(() => {
        if (this.stats && typeof this.stats.init === 'function') {
          this.stats.init();
        }

        this.started = true;
        this.emit('ready');
      })
      .catch((error) => {
        this.emit('error', error);
        return Promise.reject(error);
      });
  }
  /**
   * Creates a promise that resolves when all tasks in the tasks array are complete. Resolves
   * instantly if there are no tasks.
   *
   * @private
   * @returns {!Promise}
  */
  waitForTasks() {
    if (this.taskCount === 0) return Promise.resolve();

    return new Promise((resolve) => {
      this.on('task-end', () => this.taskCount === 0 && resolve());
    });
  }
  /**
   * Ends the service by waiting for tasks to finish before exiting nerves
   *
   * @param {numner} code
   * @returns {!Promise}
  */
  poweroff(code) {
    if (this.exiting === true) {
      const error = new Error('asked to poweroff while exiting; quitting immediately');
      this.emit('error', error);
      this.emit('end', 1);
      return Promise.reject(error);
    }

    this.exiting = true;

    return this.waitForTasks()
      .then(() => this.stats && this.stats.exit && this.stats.exit())
      .then(() => this.exitNerves())
      .then(() => this.emit('end', code))
      .catch(error => this.emit('error', error) && Promise.reject(error));
  }
}

/**
 * Type definition for service options
 *
 * @typedef {{
 *   maxTasks: (number|undefined),
 *   nerves: (!Array<!NerveInterface>|undefined),
 *   statsEnabled: (boolean|undefined),
 *   statsPort: (number|undefined)
 * }}
*/
Service.OptionsType = {};

/**
 * Default service options
 *
 * @private
 * @const {!Service.OptionsType}
*/
Service.DEFAULTS = {
  nerves: [],
  maxTasks: 0,
};

module.exports = Service;
