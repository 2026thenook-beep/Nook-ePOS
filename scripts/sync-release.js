const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const build = JSON.parse(fs.readFileSync(path.join(root, 'build-info.json'), 'utf8'));
const app = build.release;
const db = build.databaseVersion;
function write(rel, transform) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(file, after);
}
write('js/release.js', s => s.replace(/appVersion: '[^']+'/, `appVersion: '${app}'`).replace(/databaseVersion: '[^']+'/, `databaseVersion: '${db}'`));
write('google/Code.gs', s => s.replace(/var NOOK_VERSION = '[^']+';/, `var NOOK_VERSION = '${app}';`).replace(/var NOOK_DATABASE_VERSION = '[^']+';/, `var NOOK_DATABASE_VERSION = '${db}';`).replace(/"FrontendVersion": "[^"]+"/, `"FrontendVersion": "${app}"`).replace(/"BackendVersion": "[^"]+"/, `"BackendVersion": "${app}"`).replace(/"DatabaseVersion": "[^"]+"/, `"DatabaseVersion": "${db}"`));
write('js/seed-data.js', s => s.replace(/"FrontendVersion": "[^"]+"/, `"FrontendVersion": "${app}"`).replace(/"BackendVersion": "[^"]+"/, `"BackendVersion": "${app}"`).replace(/"DatabaseVersion": "[^"]+"/, `"DatabaseVersion": "${db}"`));
write('index.html', s => s.replace(/\?v=[0-9]+\.[0-9]+\.[0-9]+/g, `?v=${app}`).replace(/id="uiVersion">[^<]+</, `id="uiVersion">${app}<`));
console.log(`Synchronized application ${app} and database ${db} from build-info.json.`);
