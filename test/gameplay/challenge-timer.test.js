'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=require('../../server/game');
const i18n=require('../../shared/i18n');
const session=require('../../server/session');
const realNow=Date.now;
let now=100000;
Date.now=()=>now;

function fixture(){
  const players=['a','b','c'].map(id=>({id,name:id,coins:4,alive:true,influences:['lord','magistrate']}));
  const room=game.createGame('TIME',players[0]);
  Object.assign(room,{players,status:'playing',deck:Array(12).fill('swordsman')});
  return room;
}
try {
  const room=fixture();
  assert(game.performAction(room,'a','tax').ok);
  const deadline=room.pending.challengeDeadline;
  assert.equal(deadline,now+15000);
  assert(game.passChallenge(room,'b').ok);
  now=deadline-1;
  assert.equal(game.expireChallenge(room),false);
  now=deadline;
  assert(game.expireChallenge(room));
  assert.equal(room.players[0].coins,6);
  assert.equal(room.pending,null);
  assert.equal(game.publicState(room).turnPlayerId,'b');
  assert.equal(game.expireChallenge(room),false,'Expiration resolves once');
  assert.equal(room.players[0].coins,6);

  const early=fixture();
  assert(game.performAction(early,'a','tax').ok);
  assert(game.passChallenge(early,'b').ok);
  assert(game.passChallenge(early,'c').ok);
  assert.equal(early.pending,null,'Everyone can pass before the deadline');

  const challenged=fixture();
  assert(game.performAction(challenged,'a','tax').ok);
  const oldDeadline=challenged.pending.challengeDeadline;
  assert(game.challenge(challenged,'b').ok);
  now=oldDeadline+100;
  assert.equal(game.expireChallenge(challenged),false);
  assert.equal(game.lossDecision(challenged,'b').kind,'lose','Influence selection is never timed out');

  const late=fixture();
  assert(game.performAction(late,'a','tax').ok);
  now=late.pending.challengeDeadline;
  assert.equal(game.challenge(late,'b').ok,false);
  assert.equal(late.pending,null);
  assert.equal(late.players[1].influences.length,2,'A late challenge cannot cost an influence');

  const counter=fixture();
  assert(game.performAction(counter,'a','extort','b').ok);
  now=counter.pending.challengeDeadline;
  assert(game.expireChallenge(counter));
  assert.equal(counter.pending.kind,'counterOffer','Target still chooses whether to counter');
  now+=8000;
  assert.equal(game.expireChallenge(counter),false,'Counter choice has no deadline');
  assert(game.chooseCounter(counter,'b','magistrate').ok);
  assert.equal(counter.pending.challengeDeadline,now+15000,'Counter claim has a fresh fifteen seconds');
  now=counter.pending.challengeDeadline;
  assert(game.expireChallenge(counter));
  assert.equal(counter.players[0].coins,2);
  assert.equal(counter.players[1].coins,7,'Counter pays claimant then next-turn Income');
  assert.equal(counter.pending,null);

  // Real server handlers with deterministic timers exercise automatic expiry,
  // refreshes and canceled timers without opening ports.
  const timers=[];
  let io;
  class Server {constructor(){io=this;}use(fn){this.admit=fn;}on(event,fn){if(event==='connection')this.connect=fn;}}
  const express=()=>({use(){},get(){}});
  express.static=()=>()=>{};
  const context=vm.createContext({
    require(id){
      if(id==='express')return express;
      if(id==='socket.io')return {Server};
      if(id==='http')return {createServer:()=>({listen(){}})};
      if(id==='node:timers')return {
        setTimeout(fn,delay){const timer={fn,at:now+delay,unref(){}};timers.push(timer);return timer;},
        clearTimeout(timer){timer.canceled=true;}
      };
      if(id==='./game')return game;
      if(id==='./session')return session;
      if(id.startsWith('./'))return require(path.resolve(__dirname,'../../server',id));
    return require(id);
    },
    __dirname:path.resolve(__dirname,'../../server'),Date,console,process:{env:{SQLITE_PATH:':memory:'}}
  });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../server/index.js'),'utf8'),context);
  function client(id){
    const socket={id,data:{},handlers:{},events:[],
      on(event,fn){this.handlers[event]=fn;},
      disconnect(){},
      emit(event,payload){this.events.push({event,payload});},
      send(event,payload={}){let answer;this.handlers[event](payload,result=>answer=result);return answer;}
    };
    io.admit(socket,error=>{if(error)throw error;io.connect(socket);});
    return socket;
  }
  const a=client('a'),b=client('b'),c=client('c');
  const {code,resumeToken}=a.send('createRoom',{nickname:'a'});
  b.send('joinRoom',{code,nickname:'b'});
  c.send('joinRoom',{code,nickname:'c'});
  vm.runInContext(`Object.assign(rooms.get(${JSON.stringify(code)}),{status:'playing',turn:0,deck:Array(12).fill('swordsman')}); for(const p of rooms.get(${JSON.stringify(code)}).players){p.coins=4;p.alive=true;p.influences=['lord','magistrate'];}`,context);
  a.send('action',{action:'tax'});
  const initial=timers.at(-1);
  assert.equal(initial.at,now+15000);
  now+=2000;
  b.send('passChallenge');
  a.send('chatMessage',{message:'Still waiting'});
  assert.equal(timers.at(-1),initial,'Passing and chat do not reset the timer');
  const refreshed=client('refreshed');
  refreshed.send('resumeSession',{code,token:resumeToken});
  assert.equal(timers.at(-1),initial,'Refreshing does not reset the timer');
  const snapshot=refreshed.events.findLast(event=>event.event==='state').payload;
  assert.equal(snapshot.room.pending.challengeDeadline,initial.at);
  assert.equal(snapshot.serverNow,now);
  now=initial.at;
  initial.fn();
  const expired=b.events.findLast(event=>event.event==='state').payload;
  assert.equal(expired.room.pending,null);
  assert.equal(expired.room.players[0].coins,6);
  assert.equal(expired.room.turnPlayerId,'b');
  b.send('action',{action:'tax'});
  const canceled=timers.at(-1);
  refreshed.send('passChallenge');
  c.send('passChallenge');
  assert(canceled.canceled);
  c.send('action',{action:'summon'});
  const next=timers.at(-1);
  canceled.fn();
  assert.equal(vm.runInContext(`rooms.get(${JSON.stringify(code)}).pending.action`,context),'summon','Stale callbacks cannot resolve a newer claim');
  assert.equal(timers.at(-1),next,'A stale callback preserves the newer timer');
  now=next.at;
  timers.at(-1).fn();
  assert.equal(vm.runInContext(`rooms.get(${JSON.stringify(code)}).pending.stage`,context),'preview','Summon automatically draws after challenge expiry');
  const resolving=vm.runInContext(`rooms.get(${JSON.stringify(code)})`,context);
  resolving.treasuryMode=true;resolving.treasuryCoins=0;resolving.totalCoins=21;resolving.economyWinThreshold=12;
  resolving.players.forEach(player=>player.coins=7);
  const beforeLoot=JSON.stringify(resolving);
  refreshed.send('action',{action:'loot',targetId:'c'});
  assert.equal(JSON.stringify(resolving),beforeLoot,'Socket requests cannot bypass the Summon Loot guard');
  assert.equal(refreshed.events.at(-1).event,'notice');
  assert.equal(refreshed.events.at(-1).payload.message,'Loot is unavailable while Summon is resolving.');
  c.send('summonChoice',{choice:'keep'});
  const beforeReplacement=JSON.stringify(resolving);
  c.send('action',{action:'loot',targetId:'b'});
  assert.equal(JSON.stringify(resolving),beforeReplacement);
  c.send('summonChoice',{choice:'replace',cardIndex:0});
  assert.equal(resolving.pending,null);
  assert(game.treasuryInvariant(resolving));


  const app=fs.readFileSync(path.resolve(__dirname,'../../public/js/app.js'),'utf8');
  let label={textContent:''}, progress={style:{}}, clock={classList:{toggle(){}}};
  const buttons=[{disabled:false},{disabled:false}];
  const browser=vm.createContext({
    state:{status:'playing',pending:{kind:'claim',stage:'challenge',challengeDeadline:now+3000}},
    Date,serverClockOffset:0,challengeCountdownTimer:null,warnedChallengeKey:null,me:null,window:{URAMAKU_FEEDBACK:require('../../public/js/components/game-feedback')},
    document:{querySelector:sel=>sel==='[data-challenge-countdown]'?label:sel==='[data-challenge-progress]'?progress:clock,querySelectorAll:()=>buttons},
    t:(key,params)=>i18n.get(key,'en',params),clearTimeout(){},setTimeout(){}
  });
  vm.runInContext(app.slice(app.indexOf('function updateChallengeCountdown(){'),app.indexOf('function renderActionFlow(){')),browser);
  vm.runInContext('updateChallengeCountdown()',browser);
  assert.match(label.textContent,/in 3s unless challenged/);
  assert.equal(progress.style.width,'20%');
  now+=3000;
  vm.runInContext('updateChallengeCountdown()',browser);
  assert(buttons.every(button=>button.disabled));
  assert.match(i18n.get('challengeCountdown','jp',{seconds:6}),/残り6秒/);
  console.log('Fifteen-second action/counter deadlines, early passes, late challenges, reconnects, stale timers, Summon continuation, and EN/JP countdown passed.');
} finally { Date.now=realNow; }
