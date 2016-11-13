/* eslint import/no-extraneous-dependencies: 0 */
import test from 'ava';
import sinon from 'sinon';
import mock from 'mock-http';
import { Stats } from '../source';

/**
 * Helpers
*/

function httpMock(url, method) {
  return {
    res: new mock.Response(),
    req: new mock.Request({ url, method: method || 'GET' }),
  };
}

function createStats(fakeStats) {
  const stats = new Stats({});
  stats.attach(() => fakeStats || { ok: true });
  return stats;
}

/**
 * Tests for Stats#init
*/

test('#constructor provides a #getStats function which always returns ok = true', (t) => {
  const stats = new Stats({});
  t.true(stats.getStats().ok);
});

test('#init throws if Stats was initialised without a port', (t) => {
  const stats = new Stats({});
  t.throws(() => stats.init());
});

test('#init calls #createHttpServer followed by Server#listen with the provided port', (t) => {
  const port = 1000;
  const listenStub = sinon.stub();
  const createHttpServerStub = sinon.stub(Stats, 'createHttpServer');
  createHttpServerStub.returns({ listen: listenStub });
  const stats = new Stats({ port });
  stats.init();
  t.is(createHttpServerStub.callCount, 1);
  t.is(listenStub.callCount, 1);
  t.true(listenStub.calledWith(port));
  createHttpServerStub.restore();
});

/**
 * Tests for Stats#attach
*/

test('#attach assigns a new function to stats.getStats', (t) => {
  const stats = new Stats({});
  const getStats = () => ({ ok: true });
  stats.attach(getStats);
  t.is(stats.getStats, getStats);
});

test('#attach throws if parsed a non-function', (t) => {
  const stats = new Stats({});
  t.throws(() => stats.attach('fail'));
});

/**
 * Tests for Stats#handler
*/

test('#handler sends a 501 for anything other than a GET', (t) => {
  const stats = createStats();
  const { req, res } = httpMock('http://fakeserver:3001/stats', 'POST');
  stats.handler(req, res);
  t.is(res.statusCode, 501);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends a 404 for requests to /someBadRoute', (t) => {
  const stats = createStats();
  const { req, res } = httpMock('http://fakeserver:3001/someBadRoute');
  stats.handler(req, res);
  t.is(res.statusCode, 404);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends a 200 response for requests to /healthcheck when ok === true', (t) => {
  const stats = createStats({ ok: true });
  const { req, res } = httpMock('http://fakeserver:3001/healthcheck');
  stats.handler(req, res);
  t.is(res.statusCode, 200);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends a 200 response for requests to /ok when ok === true', (t) => {
  const stats = createStats({ ok: true });
  const { req, res } = httpMock('http://fakeserver:3001/ok');
  stats.handler(req, res);
  t.is(res.statusCode, 200);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends a 503 response for requests to /healthcheck when ok === false', (t) => {
  const stats = createStats({ ok: false });
  const { req, res } = httpMock('http://fakeserver:3001/healthcheck');
  stats.handler(req, res);
  t.is(res.statusCode, 503);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends 200 response with json stats for requests to /stats', (t) => {
  const fakeStats = { ok: false, someStats: 'yeahhh' };
  const stats = createStats(fakeStats);
  const { req, res } = httpMock('http://fakeserver:3001/stats');
  stats.handler(req, res);
  t.is(res.statusCode, 200);
  t.is(res.getHeader('Content-Type'), 'application/json');
  t.is(res.getBuffer(), JSON.stringify(fakeStats));
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#handler sends 503 for requests to /stats if #getStats fails to return an object', (t) => {
  const stats = new Stats({});
  stats.attach(() => null);
  const { req, res } = httpMock('http://fakeserver:3001/stats');
  stats.handler(req, res);
  t.is(res.statusCode, 503);
  t.true(res.headersSent);
  t.true(res.hasEnded());
});

test('#exit calls the server #close method', (t) => {
  const port = 1000;
  const server = { listen: sinon.stub(), close: sinon.stub() };
  const createHttpServerStub = sinon.stub(Stats, 'createHttpServer').returns(server);
  const stats = new Stats({ port });
  stats.init();
  t.is(server.close.callCount, 0);
  stats.exit();
  t.is(server.close.callCount, 1);
  createHttpServerStub.restore();
});

