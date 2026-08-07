const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');const css=fs.readFileSync(path.join(root,'css/app.css'),'utf8');function ok(c,m){if(!c)throw new Error(m)}
ok(app.includes("options.state ? 'Payment Complete'"),'payment complete title missing');
ok(app.includes("options.state ? '<div class=\"card\"><h3>Payment method</h3>"),'payment complete must not show ticket card');
ok(app.includes("function openAdminWizard(kind, parentId)"),'guided admin wizard missing');
ok(app.includes("create-guided-item")&&app.includes("create-guided-prompt")&&app.includes("create-guided-category"),'guided workflow actions missing');
ok(app.includes("Loading prompts — Please wait")&&app.includes("itemConfigurationSnapshot"),'server-fresh prompt duplication waiting path missing');
ok(app.includes("Duplicating prompts — Please wait"),'prompt duplicate save wait missing');
ok(app.includes('An item with this name already exists.'),'item duplicate validation missing');
ok(app.includes('This item already has a prompt with that title.'),'prompt duplicate validation missing');
ok(css.includes('.money-input'),'pound-prefixed money field styling missing');
console.log('3.13.18 Menu Admin overhaul checks passed');
