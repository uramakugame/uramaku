'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=require('../../server/game'),session=require('../../server/session'),i18n=require('../../shared/i18n');
const realNow=Date.now;let now=100000;Date.now=()=>now;
const player=id=>({id,name:id,coins:8,alive:true,ready:true,influences:['magistrate','swordsman']});
function fixture(){const room=game.createGame('TIME',player('a'));room.players.push(player('b'),player('c'));room.deck=Array(18).fill('lord');return room;}
try{
 const defaults=fixture();assert.equal(defaults.challengeTimerEnabled,true);assert.equal(defaults.challengeDurationSeconds,15);
 const original=JSON.stringify(defaults);
 for(const settings of [{seconds:1},{seconds:4},{seconds:5},{seconds:9},{seconds:10.5},{seconds:0},{seconds:61},{seconds:1.5},{seconds:'6'},{enabled:'false'},null]){assert.equal(game.configureChallengeTimer(defaults,'a',settings).ok,false);assert.equal(JSON.stringify(defaults),original);}
 assert.equal(game.configureChallengeTimer(defaults,'b',{seconds:12}).ok,false);assert.equal(game.configureChallengeTimer(defaults,'watcher',{seconds:12}).ok,false);
 for(const seconds of [10,12,15,60]){
  const room=fixture();assert(game.configureChallengeTimer(room,'a',{seconds}).ok);room.status='playing';
  assert.equal(game.configureChallengeTimer(room,'a',{enabled:false}).ok,false,'Match settings are locked after start');
  assert(game.performAction(room,'a','assassinate','b').ok);assert.equal(room.pending.challengeDeadline,now+seconds*1000);assert.equal(room.pending.challengeDurationMs,seconds*1000);
  assert.equal(game.expireChallenge(room,room.pending.challengeDeadline-1),false);
  game.passChallenge(room,'b');game.passChallenge(room,'c');assert.equal(room.pending.kind,'counterOffer');game.chooseCounter(room,'b','swordsman');
  assert.equal(room.pending.kind,'counterClaim');assert.equal(room.pending.challengeDurationMs,seconds*1000);assert.equal(room.pending.challengeDeadline,now+seconds*1000);
  assert(game.expireChallenge(room,room.pending.challengeDeadline));assert.equal(room.pending.kind,'lose');
 }
 {
  const room=fixture();game.configureChallengeTimer(room,'a',{enabled:false,seconds:15});room.status='playing';game.performAction(room,'a','assassinate','b');
  assert.equal(room.pending.challengeDeadline,null);assert.equal(room.pending.challengeDurationMs,null);assert.equal(game.expireChallenge(room,now+1000000),false);
  game.passChallenge(room,'b');assert.equal(room.pending.kind,'claim');game.passChallenge(room,'c');game.chooseCounter(room,'b','swordsman');
  assert.equal(room.pending.kind,'counterClaim');assert.equal(game.expireChallenge(room,now+1000000),false);game.passChallenge(room,'a');game.passChallenge(room,'c');assert.equal(room.pending.kind,'lose');
  assert.equal(game.publicState(room).challengeTimerEnabled,false);assert.equal(game.publicState(room).challengeDurationSeconds,15);
 }
 // Exercise the actual Socket.IO boundary and timer scheduler with fake transports.
 const timers=[];let io;
 class Server{constructor(){io=this}use(fn){this.admit=fn;}on(type,fn){if(type==='connection')this.connect=fn}}
 const express=()=>({use(){},get(){}});express.static=()=>()=>{};
 const context=vm.createContext({require(id){if(id==='express')return express;if(id==='socket.io')return{Server};if(id==='http')return{createServer:()=>({listen(){}})};if(id==='./game')return game;if(id==='./session')return session;if(id==='node:timers')return{setTimeout(fn,delay){const t={fn,delay,unref(){}};timers.push(t);return t},clearTimeout(t){t.canceled=true}};if(id.startsWith('./'))return require(path.resolve(__dirname,'../../server',id));return require(id)},__dirname:path.resolve(__dirname,'../../server'),Date,console,process:{env:{SQLITE_PATH:':memory:'}}});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../server/index.js'),'utf8'),context);
 const client=id=>{const s={id,data:{},handlers:{},events:[],on(k,fn){this.handlers[k]=fn},emit(event,payload){this.events.push({event,payload})},disconnect(){},send(event,payload={}){let answer;this.handlers[event](payload,r=>answer=r);return answer}};io.admit(s,error=>{if(error)throw error;io.connect(s);});return s;};
 const a=client('a'),b=client('b');const {code}=a.send('createRoom',{nickname:'a'});b.send('joinRoom',{code,nickname:'b'});
 a.send('setChallengeTimer',{seconds:12});let room=vm.runInContext(`rooms.get('${code}')`,context);assert.equal(room.challengeDurationSeconds,12);
 b.send('setChallengeTimer',{enabled:false});assert.equal(room.challengeTimerEnabled,true);assert.equal(b.events.at(-1).event,'notice');
 a.send('setChallengeTimer',{enabled:false});Object.assign(room,{status:'playing',turn:0,deck:Array(18).fill('lord')});room.players.forEach(p=>Object.assign(p,player(p.id)));
 const backgroundTimers=timers.length;assert.equal(backgroundTimers,1,'Only room maintenance is scheduled before any claim');
 a.send('action',{action:'tax'});assert.equal(timers.length,backgroundTimers,'Untimed challenges must never schedule a zero-delay timeout');assert.equal(room.pending.challengeDeadline,null);
 a.send('setChallengeTimer',{enabled:true});assert.equal(room.challengeTimerEnabled,false,'Mid-match settings changes must be rejected');
 b.send('passChallenge');assert.equal(room.pending,null);
 const c=client('c'),d=client('d');const second=c.send('createRoom',{nickname:'c'});d.send('joinRoom',{code:second.code,nickname:'d'});c.send('setChallengeTimer',{seconds:12});
 room=vm.runInContext(`rooms.get('${second.code}')`,context);Object.assign(room,{status:'playing',turn:0,deck:Array(18).fill('lord')});room.players.forEach(p=>Object.assign(p,player(p.id)));
 c.send('action',{action:'tax'});const timer=timers.at(-1);assert.equal(timer.delay,12000);d.send('passChallenge');assert(timer.canceled);const saved=JSON.stringify(room);timer.fn();assert.equal(JSON.stringify(room),saved);
 // Untimed claims have no countdown, disabled response buttons, or deadline beep.
 const app=fs.readFileSync(path.resolve(__dirname,'../../public/js/app.js'),'utf8'),clock=app.slice(app.indexOf('function updateChallengeCountdown(){'),app.indexOf('// Current Turn status'));
 const browser={state:{status:'playing',pending:{kind:'claim',stage:'challenge',challengeDeadline:null}},challengeCountdownTimer:null,clearTimeout(){},setTimeout(){throw Error('Untimed countdown scheduled')},document:{querySelector(){throw Error('Untimed countdown rendered')}},UramakuAudio:{play(){throw Error('Untimed warning sounded')}}};vm.createContext(browser);vm.runInContext(clock,browser);browser.updateChallengeCountdown();
 assert.match(i18n.get('challengeTimerHelp','jp'),/オフ/);
 console.log('Host-only lobby timer settings, validation, 10–60s action/counter deadlines, untimed claims, early passes, stale timers and countdown guards passed.');
}finally{Date.now=realNow}
