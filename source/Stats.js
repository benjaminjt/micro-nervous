const url = require('url');
const http = require('http');

class Stats {
  /**
   * Stats
   *
   * A basic class to serve stats and healthchecks on a HTTP port. Serves:
   * - Basic 200 OK healthckeck on host:port/healthcheck
   * - Stats JSON object on host:port/stats if provided with a getStats callback
   *
   * Options
   * - `port` {Number} http port
   * - `getStats` {Function} stats callback; should return a stats object with an `ok` boolean
   *
   * @param {{
   *   port: number,
   *   getStats: ?function():{ ok: boolean }
   * }} options
  */
  constructor(options) {
    /**
     * @const {function():{ ok: boolean }}
    */
    this.getStats = typeof options.getStats === 'function'
      ? options.getStats
      // If options.getStats isn't a function, just assume ok
      : () => ({ ok: true });

    /**
     * @const {number}
    */
    this.port = options.port;

    /**
     * @type {?http.Server}
    */
    this.server = null;
  }
  /**
   * init
   *
   * Creates and starts http status server for healtchecks and stats
  */
  init() {
    if (!this.port) throw new Error('Need to supply a port to initialise stats');

    this.server = Stats.createHttpServer(this.handler.bind(this));
    this.server.listen(this.port);
  }
  /**
   * handler
   *
   * Provider for the http.createServer method
   *
   * @private
  */
  static createHttpServer(handler) {
    return http.createServer(handler);
  }
  /**
   * handler
   *
   * Callback parsed to http.createServer()
   *
   * @private
   * @param {!http.IncomingMessage} req
   * @param {!http.ServerResponse} res
  */
  handler(req, res) {
    const pathname = url.parse(req.url).pathname;
    const method = req.method;

    // Only respond to GET requests
    if (method !== 'GET') {
      res.writeHead(501);
      res.end();
      return;
    }

    // Handle paths appropriately
    switch (pathname) {
      case '/healthcheck':
        this.healthcheckHandler(req, res);
        break;

      case '/stats':
        this.statsHandler(req, res);
        break;

      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('Not Found\n');
        break;
    }

    // End the response
    res.end();
  }
  /**
   * healcheckHandler
   *
   * Writes HTTP response for the /healthcheck http status route
   *
   * @private
   * @param {!http.IncomingMessage} req
   * @param {!http.ServerResponse} res
  */
  healthcheckHandler(req, res) {
    const stats = this.getStats();

    // If the service is okay respond with 200 OK
    if (stats && stats.ok === true) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('OK');
      return;
    }

    // Otherwise send a 503
    res.writeHead(503);
  }
  /**
   * statsHandler
   *
   * Writes HTTP response for the /stats http status route
   *
   * @private
   * @param {!http.IncomingMessage} req
   * @param {!http.ServerResponse} res
  */
  statsHandler(req, res) {
    const stats = this.getStats();
    let statsString;

    // Try to stringify stats string, and send a 503 if it fails
    try {
      if (!stats) throw new Error();
      statsString = JSON.stringify(stats);
    } catch (error) {
      res.writeHead(503);
      return;
    }

    // Then send stats as JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(statsString);
  }
  /**
   * exit
   *
   * Closes the http server instance
   * @return {string}
  */
  exit() {
    this.server.close();
  }
}

module.exports = Stats;
