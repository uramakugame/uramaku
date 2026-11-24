const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/css/source/04-component-overrides.css'), 'utf8');
const announcements = fs.readFileSync(path.join(root, 'public/css/source/05-announcements.css'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'public/css/game.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');

function layer(css, name) {
  const match = css.match(new RegExp('\\.' + name + '\\s*\\{[^}]*z-index\\s*:\\s*(\\d+)'));
  assert.ok(match, `${name} must define an explicit layer`);
  return Number(match[1]);
}
const victoryLayer = layer(source, 'victory-backdrop');
const announcementLayer = layer(announcements, 'action-announcements');
assert.ok(victoryLayer > announcementLayer, 'Victory modal must be in front of final announcements');
assert.equal(layer(compiled, 'victory-backdrop'), victoryLayer, 'Compiled victory style must match source');
assert.equal(layer(compiled, 'action-announcements'), announcementLayer, 'Compiled announcement style must match source');
const victoryMethod = app.slice(app.indexOf('function showVictory('), app.indexOf('function show(s){'));
assert.match(victoryMethod, /document\.body\.appendChild\(backdrop\)/, 'Victory dialog must be attached to the document body');
assert.match(victoryMethod, /className='victory-backdrop'/);
console.log('Victory dialog stacking order above final announcements verified.');
