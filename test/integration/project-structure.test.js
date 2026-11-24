'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const roles = require('../../shared/roles');
const artwork = require('../../public/js/config/action-assets');
const root = path.resolve(__dirname, '../..');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}
function staticFile(url) {
  const pathname = url.split('?')[0];
  return pathname.startsWith('/shared/')
    ? path.join(root, pathname.slice(1))
    : path.join(root, 'public', pathname.slice(1));
}

// Follow the HTML entry points through the same two static roots as Express.
for (const page of ['index.html', 'tutorial.html', 'about.html']) {
  const html = fs.readFileSync(path.join(root, 'public', page), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map(match => match[1]);
  for (const url of references) {
    if (url === '/socket.io/socket.io.js') continue;
    assert(fs.statSync(staticFile(url)).isFile(), `Missing entry-point dependency ${url}`);
  }
}
for (const url of Object.values(artwork)) {
  assert(fs.statSync(staticFile(url)).isFile(), `Missing action illustration ${url}`);
}
for (const file of filesIn(path.join(root, 'public', 'css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const match of css.matchAll(/url\(["']?(\/[^\s)"']+)["']?\)/g)) {
    assert(fs.statSync(staticFile(match[1])).isFile(), `Missing CSS asset ${match[1]}`);
  }
}

// Relative CommonJS imports must resolve after moving server and shared modules.
for (const directory of ['server', 'shared', 'scripts', 'public/js']) {
  for (const file of filesIn(path.join(root, directory)).filter(file => file.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const dependency = path.resolve(path.dirname(file), match[1]);
      assert(fs.existsSync(dependency) || fs.existsSync(`${dependency}.js`), `Broken import ${match[1]} in ${file}`);
    }
  }
}

const expected = {
  lord: ['tax', 'authority'],
  courtesan: ['intrigue', 'gossip'],
  swordsman: ['hireBlade', 'hireGuard'],
  assassin: ['assassinate', 'falseTrail'],
  magistrate: ['summon', 'enforce'],
  kingpin: ['extort', 'intimidate']
};
assert.deepEqual(Object.keys(roles).sort(), Object.keys(expected).sort());
for (const [roleId, [actionId, counterId]] of Object.entries(expected)) {
  assert.equal(roles[roleId].id, roleId);
  assert.equal(roles[roleId].actionId, actionId);
  assert.equal(roles[roleId].counterId, counterId);
  assert.equal(artwork[actionId], `/assets/portraits/${roleId}.jpg`);
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.main, 'server/index.js');
assert.equal(packageJson.scripts.start, 'node server/index.js');
assert(fs.existsSync(path.join(root, packageJson.main)));
console.log('HTML dependencies, CSS assets, module imports, package entry point and canonical IDs resolve.');
