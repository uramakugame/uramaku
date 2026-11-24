'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const group = process.argv[2];
const testRoot = path.join(root, 'test');
const groups = fs.readdirSync(testRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
if (group && !groups.includes(group)) {
  console.error(`Unknown test group ${group}. Choose ${groups.join(', ')}.`);
  process.exit(1);
}
const selectedGroups = group ? [group] : groups;
let count = 0;
const failed = [];
for (const directory of selectedGroups) {
  const files = fs.readdirSync(path.join(testRoot, directory))
    .filter(name => name.endsWith('.test.js') && !name.endsWith('.stress.test.js'))
    .sort();
  for (const file of files) {
    const relativePath = path.join('test', directory, file);
    const result = spawnSync(process.execPath, [relativePath], { cwd: root, stdio: 'inherit' });
    count += 1;
    if (result.status !== 0 || result.error) failed.push(relativePath);
  }
}
console.log(`${count - failed.length}/${count} test files passed.`);
if (failed.length) {
  console.error('Failed test files\n' + failed.join('\n'));
  process.exitCode = 1;
}
