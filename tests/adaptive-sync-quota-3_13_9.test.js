const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const app = fs.readFileSync('js/app.js','utf8');
const ops = fs.readFileSync('js/operations.js','utf8');
const coord = fs.readFileSync('js/server-coordinator.js','utf8');
const release = fs.readFileSync('js/release.js','utf8');

test('3.13.18 declares foreground adaptive kitchen intervals', () => {
  assert.match(release, /appVersion: '3\.13\.20'/);
  assert.match(release, /kitchenPollIntervalMs: 1500/);
  assert.match(release, /kitchenNormalPollIntervalMs: 3000/);
  assert.match(release, /kitchenQuietPollIntervalMs: 5000/);
  assert.doesNotMatch(release, /kitchenHiddenPollIntervalMs/);
  assert.match(app, /document\.visibilityState !== 'hidden'/);
  assert.match(app, /function kitchenAdaptivePollInterval\(\)/);
});

test('poll coordinator coalesces overlapping runs', async () => {
  const context = { globalThis: {}, setInterval: () => 1, clearInterval: () => {} };
  vm.runInNewContext(ops, context);
  let resolveRun;
  let runs = 0;
  const coordinator = context.globalThis.NookOperations.createPollCoordinator({
    tickIntervalMs: 250,
    jobs: [{name:'kitchen', intervalMs:250, run:()=>{runs++; return new Promise(r=>{resolveRun=r;});}}]
  });
  coordinator.tick();
  coordinator.tick();
  assert.equal(runs, 0); // promise scheduling
  await Promise.resolve();
  assert.equal(runs, 1);
  await new Promise(r=>setTimeout(r,275));
  coordinator.tick();
  resolveRun();
  await new Promise(r=>setTimeout(r,10));
  assert.equal(runs, 2);
});

test('coordinator recognises quota and rate failures as transient', () => {
  assert.match(coord, /status === 429/);
  assert.match(coord, /quota\|rate limit\|too many/);
  assert.match(coord, /durationsByAction/);
});

test('kitchen refresh requests one follow-up while in flight', () => {
  assert.match(app, /if \(kitchenPollInFlight\) \{ kitchenRefreshAgain = true; return; \}/);
  assert.match(app, /if \(kitchenRefreshAgain && document\.visibilityState !== 'hidden'\)/);
});
