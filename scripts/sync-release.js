const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const build = JSON.parse(fs.readFileSync(path.join(root, 'build-info.json'), 'utf8'));
const app = build.frontendVersion || build.release;
const backend = build.backendVersion || app;
const db = build.databaseVersion;
function write(rel, transform) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(file, after);
}
write('js/release.js', s => s.replace(/appVersion: '[^']+'/, `appVersion: '${app}'`).replace(/databaseVersion: '[^']+'/, `databaseVersion: '${db}'`));
// Backend source follows build.backendVersion independently. Frontend-only releases must not promote Apps Script.
write('google/Code.gs', s => s.replace(/var NOOK_VERSION = '[^']+';/, `var NOOK_VERSION = '${backend}';`).replace(/var NOOK_DATABASE_VERSION = '[^']+';/, `var NOOK_DATABASE_VERSION = '${db}';`).replace(/"FrontendVersion": "[^"]+"/, `"FrontendVersion": "${backend}"`).replace(/"BackendVersion": "[^"]+"/, `"BackendVersion": "${backend}"`).replace(/"DatabaseVersion": "[^"]+"/, `"DatabaseVersion": "${db}"`));
write('js/seed-data.js', s => s.replace(/"FrontendVersion": "[^"]+"/, `"FrontendVersion": "${app}"`).replace(/"BackendVersion": "[^"]+"/, `"BackendVersion": "${backend}"`).replace(/"DatabaseVersion": "[^"]+"/, `"DatabaseVersion": "${db}"`));
write('index.html', s => s.replace(/\?v=[0-9]+\.[0-9]+\.[0-9]+/g, `?v=${app}`).replace(/id="uiVersion">[^<]+</, `id="uiVersion">${app}<`));
console.log(`Synchronized frontend ${app}, backend ${backend} and database ${db} from build-info.json.`);
