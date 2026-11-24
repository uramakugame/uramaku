const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = require('../../server/game');
const app = fs.readFileSync(path.join(__dirname, '../../public/js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');

// The lobby and match must use the same conversation, not separate histories.
const host = {id:'p1',name:'Akira',coins:0,influences:[],alive:true,ready:true,connected:true};
const guest = {id:'p2',name:'Sora',coins:0,influences:[],alive:true,ready:true,connected:true};
const room=game.createGame('CHAT',host);
room.players.push(guest);
assert.equal(game.addChatMessage(room,'p1','Welcome to the lobby!').ok,true);
assert.equal(game.addChatMessage(room,'p2','Ready to play').ok,true);
const before=game.publicState(room).chat;
assert.equal(before.length,2);
game.startGame(room);
assert.deepEqual(game.publicState(room).chat,before,'Lobby messages must survive the start of the game');
assert.equal(game.addChatMessage(room,'p1','First turn!').ok,true);
assert.equal(game.publicState(room).chat.length,3);

// The shared dialog must be accessible in both the lobby and the game room.
assert(app.includes('class="lobby-roster-tools"'),'Lobby should expose the chat button');
assert(app.includes('id="chatToggle" class="lobby-chat-button'),'Lobby chat should use the same toggle as the match');
assert(app.includes('${chatOpen?renderChat():\'\'}'),'Lobby should render the existing chat dialog');
assert(app.includes('function bindChatUI()'),'Chat event binding should be shared across lobby and game');
assert.equal((app.match(/\bbindChatUI\(\);/g)||[]).length,2,'Both UI branches should bind chat controls');
assert(app.includes('if(chatOnly){'),'Chat-only updates must not rebuild the composer');
assert(app.includes('const hadFocus=chatOpen&&chatInput&&document.activeElement===chatInput;'),'Non-chat updates must restore compose focus');

// The Actions panel must contain its cards and Rules control, not collapse
// into a header-height panel that the action cards overflow.
assert(css.includes('grid-template-rows:repeat(8,minmax(32px,1fr))!important'),'Actions should use equal flexible rows');
assert(css.includes('align-self:stretch!important'),'Actions panel should stretch to the board row');
assert(css.includes('height:100%!important;min-height:0!important;max-height:none!important'),'Action buttons should scale with available height');
console.log('Lobby-to-game chat persistence, stable composer, and Actions panel containment passed.');
