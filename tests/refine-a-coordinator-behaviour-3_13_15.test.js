const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

function loadCoordinator(){
  const sandbox={globalThis:{}, setTimeout, clearTimeout, console, Set, Map, Promise, Date, Math, Error, Object, Array, Number, String, JSON};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','server-coordinator.js'),'utf8'),sandbox);
  return sandbox.NookServerCoordinator;
}

test('read failure is not multiplied by internal retries', async()=>{
  const module=loadCoordinator();
  let calls=0;
  const coord=module.create({transport:{request:async()=>{calls++; const e=new Error('temporary network failure'); e.status=503; throw e;}}});
  await assert.rejects(coord.request('kitchenSnapshot',{}));
  assert.equal(calls,1);
});

test('idempotent write receives controlled short retries', async()=>{
  const module=loadCoordinator();
  let calls=0;
  const coord=module.create({transport:{request:async()=>{calls++; if(calls<3){const e=new Error('server busy');e.status=503;throw e;} return {ok:true};}}});
  const result=await coord.request('commitTicket',{clientRequestId:'abc'});
  assert.equal(result.ok,true);
  assert.equal(calls,3);
});

test('404 is never retried internally', async()=>{
  const module=loadCoordinator();
  let calls=0;
  const coord=module.create({transport:{request:async()=>{calls++; const e=new Error('not found'); e.status=404; throw e;}}});
  await assert.rejects(coord.request('commitTicket',{}));
  assert.equal(calls,1);
});

test('maintenance invalidates an older in-flight read response', async()=>{
  const module=loadCoordinator();
  let release;
  const gate=new Promise(resolve=>release=resolve);
  const coord=module.create({transport:{request:async()=>{await gate; return {ok:true};}}});
  const pending=coord.request('kitchenSnapshot',{});
  await new Promise(r=>setTimeout(r,10));
  coord.beginMaintenance();
  release();
  await assert.rejects(pending,err=>err && err.code==='STALE_RESPONSE');
  coord.endMaintenance();
});
