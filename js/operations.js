(function (root) {
  'use strict';

  function createSerialQueue(options) {
    options = options || {};
    var chain = Promise.resolve();
    var pending = 0;
    function report() { if (typeof options.onChange === 'function') options.onChange(pending); }
    return Object.freeze({
      enqueue: function (label, operation) {
        pending += 1;
        report();
        var run = function () { return Promise.resolve().then(operation); };
        var task = chain.then(run, run);
        chain = task.catch(function () {}).then(function () {
          pending = Math.max(0, pending - 1);
          report();
        });
        return task;
      },
      pending: function () { return pending; }
    });
  }

  function createPollCoordinator(options) {
    options = options || {};
    var timer = null;
    var lastRuns = {};
    var running = {};
    var followUp = {};
    function intervalFor(job) {
      var raw = typeof job.intervalMs === 'function' ? job.intervalMs() : job.intervalMs;
      return Math.max(250, Number(raw) || 1000);
    }
    function startJob(job) {
      var name = job.name;
      if (running[name]) { followUp[name] = true; return; }
      running[name] = true;
      lastRuns[name] = Date.now();
      Promise.resolve().then(job.run).catch(function (error) {
        if (typeof options.onError === 'function') options.onError(name, error);
      }).finally(function () {
        running[name] = false;
        if (followUp[name]) {
          followUp[name] = false;
          if (!job.enabled || job.enabled()) startJob(job);
        }
      });
    }
    function tick() {
      var now = Date.now();
      (options.jobs || []).forEach(function (job) {
        if (!job || typeof job.run !== 'function') return;
        if (job.enabled && !job.enabled()) { followUp[job.name] = false; return; }
        var interval = intervalFor(job);
        if (!lastRuns[job.name] || now - lastRuns[job.name] >= interval) {
          if (running[job.name]) followUp[job.name] = true;
          else startJob(job);
        }
      });
    }
    return Object.freeze({
      start: function () {
        if (timer) return;
        tick();
        timer = setInterval(tick, Math.max(250, Number(options.tickIntervalMs) || 1000));
      },
      stop: function () { if (timer) clearInterval(timer); timer = null; },
      tick: tick,
      snapshot: function () { return { running: Object.assign({}, running), followUp: Object.assign({}, followUp), lastRuns: Object.assign({}, lastRuns) }; }
    });
  }

  root.NookOperations = Object.freeze({
    createSerialQueue: createSerialQueue,
    createPollCoordinator: createPollCoordinator
  });
})(typeof window !== 'undefined' ? window : globalThis);
