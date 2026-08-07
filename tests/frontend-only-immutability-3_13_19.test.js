const fs=require('fs');const crypto=require('crypto');const assert=require('assert');
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
assert.strictEqual(sha('google/Code.gs'),'6895076f1cbac3dd4396c9c92c3ceb1c7739c63824982eafbf86a50d80bd8c17','Apps Script changed in a frontend-only release');
assert.strictEqual(sha('database/Nook_ePOS_Database_Template_1_0_6.xlsx'),'7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe','database template changed in a frontend-only release');
console.log('3.13.20 frontend-only backend/database immutability checks passed');
