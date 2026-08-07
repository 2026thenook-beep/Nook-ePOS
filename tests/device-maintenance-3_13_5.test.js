const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const queue=fs.readFileSync(path.join(root,'js/queue-manager.js'),'utf8');
function ok(value,message){ if(!value) throw new Error(message); }
ok(app.includes('data-action=\"refresh-local-data\"'),'Refresh Local Data button missing');
ok(app.includes('data-action=\"repair-connection\"'),'Repair Connection button missing');
ok(app.includes('data-action=\"factory-reset-device\"'),'Factory Reset Device button missing');
ok(app.includes('async function refreshLocalDataWorkflow()'),'Refresh workflow missing');
ok(app.includes('async function repairConnectionWorkflow()'),'Repair workflow missing');
ok(app.includes('async function factoryResetDeviceWorkflow()'),'Factory reset workflow missing');
ok(app.includes('Tickets and queued transactions are being kept'),'Safe refresh wording missing');
ok(app.includes('QueueManager.clearAll'),'Factory reset must clear durable queues');
ok(queue.includes('async function clearAll()'),'Queue clearAll API missing');
ok(!app.includes('data-action=\"clear-local-data\"'),'Old ambiguous clear-local-data button still present');
console.log('device-maintenance-3.13.18: PASS');
