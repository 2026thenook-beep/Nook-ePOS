const fs=require('fs'); const path=require('path'); const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'google/Code.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function ok(v,m){if(!v)throw new Error(m);}
ok(app.includes("var kitchenRevision = ''"),'client Kitchen revision state missing');
ok(app.includes('KITCHEN_FULL_REFRESH_MS = 60000'),'periodic full consistency refresh missing');
ok(app.includes("api('kitchenSnapshot', { sinceRevision: kitchenRevision, forceFull: forceFull })"),'revision-gated Kitchen request missing');
ok(app.includes('res.data.unchanged === true'),'unchanged Kitchen response handling missing');
ok(backend.includes("getMetaReadOnly_('KitchenRevision')"),'read-only Kitchen revision lookup missing');
ok(backend.includes('incrementKitchenRevision_();'),'Kitchen revision increment missing');
ok(backend.includes('sinceRevision === revision'),'unchanged snapshot gate missing');
ok(app.includes('function renderEmergencyShell(error)'),'blank-screen emergency shell must remain');
ok(app.includes('var renderInProgress = false'),'render recursion guard must remain');
ok(app.includes('renderBurstCount > 6'),'render circuit breaker must remain');
ok(html.includes('startup-till-shell'),'static startup Till shell must remain');
ok(app.includes('Secondary Service URL'),'future secondary service field missing');
ok(app.includes('preventing two scripts from editing the same data without a shared lock'),'secondary writer safety explanation missing');
console.log('3.13.18 Kitchen revision and protected-render checks passed');
