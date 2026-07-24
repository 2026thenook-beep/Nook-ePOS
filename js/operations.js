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
    function tick() {
      var now = Date.now();
      (options.jobs || []).forEach(function (job) {
        if (!job || typeof job.run !== 'function') return;
        if (job.enabled && !job.enabled()) return;
        var interval = Math.max(250, Number(job.intervalMs) || 1000);
        if (!lastRuns[job.name] || now - lastRuns[job.name] >= interval) {
          lastRuns[job.name] = now;
          Promise.resolve().then(job.run).catch(function (error) {
            if (typeof options.onError === 'function') options.onError(job.name, error);
          });
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
      tick: tick
    });
  }

  root.NookOperations = Object.freeze({
    createSerialQueue: createSerialQueue,
    createPollCoordinator: createPollCoordinator
  });
})(typeof window !== 'undefined' ? window : globalThis);
