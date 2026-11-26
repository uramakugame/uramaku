// Assemble source layers in cascade order for both the game and tutorial.
const fs = require('node:fs');
const path = require('node:path');

const files = [
  '01-foundations.css',
  '02-game-layout.css',
  '03-game-components.css',
  '04-component-overrides.css',
  '05-announcements.css',
  '06-lobby-and-interactions.css',
  '07-treasury-and-riot.css',
  '08-responsive-room.css',
  '09-floating-chat-and-polish.css',
  '10-turn-feedback.css',
  '11-intel-and-reactions.css',
  '12-six-player-table.css'
];
const root = path.join(__dirname, '..', 'public', 'css');
const header = '/* GENERATED from public/css/source/*.css. Edit those files, then run npm run build:css. */\n';
const output = header + files.map(file =>
  `\n/* === ${file} === */\n` + fs.readFileSync(path.join(root, 'source', file), 'utf8')
).join('\n');
const target = path.join(root, 'game.css');

if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
    console.error('game.css needs regeneration: npm run build:css');
    process.exitCode = 1;
  } else {
    console.log('Compiled stylesheet is up to date.');
  }
} else {
  fs.writeFileSync(target, output);
  console.log('Built public/css/game.css from', files.length, 'named CSS modules.');
}
