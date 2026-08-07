const fs=require('fs'); const path=require('path'); const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'); const css=fs.readFileSync(path.join(root,'css/app.css'),'utf8');
function ok(c,m){if(!c)throw new Error(m)}
ok(app.includes('Reports Dashboard'),'dashboard heading missing');
ok(app.includes("['Cash sales'"),'cash snapshot missing');
ok(app.includes("['Card sales'"),'card snapshot missing');
ok(app.includes("['Tickets'"),'ticket count snapshot missing');
ok(app.includes("['Staff discount'"),'staff discount snapshot missing');
ok(app.includes("['Loyalty discount'"),'loyalty discount snapshot missing');
ok(app.includes('Sales by hour'),'hourly report missing');
ok(app.includes('Category breakdown'),'category report missing');
ok(app.includes('Add-on performance'),'add-on report missing');
ok(app.includes('Business health'),'business health missing');
ok(app.includes('Quick insights'),'quick insights missing');
ok(app.includes('receipt-change-due') && app.includes('Cash received') && app.includes('CHANGE'),'cash change completion protection missing');
ok(css.includes('.report-snapshot-grid') && css.includes('.report-dashboard-grid'),'dashboard CSS missing');
console.log('3.13.18 reports dashboard and cash-change protection checks passed');
