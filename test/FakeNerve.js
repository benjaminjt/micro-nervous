const { Nerve } = require('../source');

/**
 * Fake nerve class for testing
*/
module.exports = class FakeNerve extends Nerve {
  constructor(name, options) {
    super(name);
    this.options = options || {};
    if (this.options.noInit === true) this.init = null;
    if (this.options.noExit === true) this.exit = null;
    if (this.options.noName === true) this.name = null;
  }
  fireReady() {
    this.fire('ready');
  }
  fireEnd() {
    this.fire('end');
  }
  init() {
    if (this.options.initThrows) throw new Error('Fake nerve init error');
    if (this.options.waitForReady !== true) this.fire('ready');
  }
  exit() {
    if (this.options.exitThrows) throw new Error('Fake nerve exit error');
    if (this.options.waitForEnd !== true) this.fire('end');
  }
};
