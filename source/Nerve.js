/* eslint class-methods-use-this: 0 */

/**
 * Interface definition for the Nerve
 *
 * @record
*/
function NerveInterface() {}
NerveInterface.prototype.init = function init() {};
NerveInterface.prototype.exit = function exit() {};

/**
 * The nerve class to be extended to build Nerves.
 * Provides a `fire` method which an Service instance will attach to their emit method.
*/
class Nerve {
  /**
   * @extends {NerveInterface}
   * @param {string} name
  */
  constructor(name) {
    /**
     * @public
     * @const {string}
    */
    this.name = name;
    /**
     * @private
     * @const {!Array<function(string, ...)>}
    */
    this.attachments = [];
  }
  /**
   * Attach the Nerve to a fire method or an emitter class
   *
   * @public
   * @param {function(string, ...)} emit
  */
  attach(emit) {
    if (!emit) {
      throw new Error('Must parse an emit funcion to Nerve#attach');
    } else if (typeof emit === 'function') {
      this.bindFire(emit);
    } else {
      throw new Error('Can not attach fire method for', emit);
    }
  }
  /**
   * Assign #realFire to #fire (to actually fire events) and push it into this.attachments
   *
   * @private
   * @param {function(string, ...)} fire
  */
  bindFire(fire) {
    this.fire = this.realFire;
    this.attachments.push(fire);
  }
  /**
   * Calls each fucntion in this this.attachments
   *
   * @private
  */
  realFire(type, ...args) {
    this.attachments.forEach(fire => fire(this.event(type), ...args));
  }
  /**
   * Placeholder #fire method, to be overridden
   *
   * @public
  */
  fire() {
    throw new Error('Nerve#fire has not been attached.');
  }
  /**
   * Placeholder #init method, to be overridden
   *
   * @public
  */
  init() {
    throw new Error('Nerve init function no implimented.');
  }
  /**
   * Placeholder #exit method, to be overridden
   *
   * @public
  */
  exit() {
    throw new Error('Nerve exit function no implimented.');
  }
  /**
   * Static method to check a Nerve instance matches the interface
   *
   * @param {string} type
   * @returns {string}
  */
  event(type) {
    return `${this.name}-${type}`;
  }
  /**
   * Static method to check a Nerve instance matches the interface
   *
   * @param {?NerveInterface} nerve
  */
  static checkNerve(nerve) {
    // Fail silently if nothing is parsed
    if (!nerve) return;

    const fail = method => `Nerve#${method} is not a function`;
    const failProp = prop => `Nerve.${prop} is not a function`;
    if (typeof nerve.init !== 'function') throw new Error(fail('init'));
    if (typeof nerve.exit !== 'function') throw new Error(fail('exit'));
    if (nerve.name == null || typeof nerve.name !== 'string') throw new Error(failProp('name'));
  }
}

module.exports = { Nerve, NerveInterface };
