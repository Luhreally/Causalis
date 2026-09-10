const fs = require('node:fs'), path = require('node:path');
const probe = path.resolve(__dirname, '../repo/scripts/continuing-city-probe.cjs');
const override = fs.readFileSync(path.join(__dirname, 'relief-override.js'), 'utf8');
const source = fs.readFileSync(probe, 'utf8').replace('loadRuntime()',
  `loadRuntime({transform: (code) => code.replace('\\nreturn {boot};', ${JSON.stringify(override)} + '\\nreturn {boot};')})`);
new Function('require', source)(require('node:module').createRequire(probe));
