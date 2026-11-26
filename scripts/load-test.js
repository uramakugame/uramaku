'use strict';
// Local, isolated real-network benchmark. Never connects to a public service.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fork}=require('node:child_process'),{performance}=require('node:perf_hooks');
const {io}=require('socket.io-client');
const root=path.resolve(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(values,p)=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];};
async function until(fn,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await sleep(5);}throw Error('Timed out: '+label);}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
async function runCase(roomCount,{duration=30,thinkMs=300,seed=20261124}={}){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-load-')),filename=path.join(folder,'game.sqlite');
 const samples=[],clients=new Set(),stats={commands:0,errors:0,timeouts:0,completed:0,reconnects:0,departures:0,discovery:0,stateBytes:0,commandBytes:0,events:{},latencies:[],actionLatencies:[]};
 let startup='',stderr='',measuring=false,startAt=0,serial=0;
 // Simulate a fixed one-hop proxy with distinct source IPs. The real Railway
 // proxy path must still be verified before enabling forwarded-IP trust there.
 // Default production quotas remain enabled; the server is private to this run.
 const child=fork(path.join(root,'server/index.js'),[],{cwd:root,env:{...process.env,NODE_ENV:'production',PORT:'0',HOST:'127.0.0.1',SQLITE_PATH:filename,RAILWAY_PROJECT_ID:'local-benchmark',RAILWAY_VOLUME_MOUNT_PATH:folder,TRUSTED_PROXY_HOPS:'1',URAMAKU_BENCHMARK:'1',ALLOWED_ORIGINS:''},silent:true});
 child.stdout.on('data',data=>startup+=data);child.stderr.on('data',data=>stderr+=data);
 child.on('message',message=>{if(message.type==='uramaku:metrics')samples.push(message);});
 let url;
 async function connect(bot){
  const c=io(url,{transports:[bot.number%10===0?'polling':'websocket'],forceNew:true,reconnection:false,extraHeaders:{'X-Forwarded-For':`10.23.${Math.floor(bot.number/250)}.${bot.number%250+1}`}});
  clients.add(c);bot.socket=c;bot.state=null;
  c.on('state',state=>{bot.state=state;if(measuring)stats.stateBytes+=Buffer.byteLength(JSON.stringify(state));});
  let failure;c.on('connect_error',error=>failure=error);
  await until(()=>c.connected||failure,'client connection');if(failure)throw failure;
 }
 async function send(bot,event,data={},durable=true){
  const own=bot.state?.you,room=bot.state?.room;
  if(durable&&own&&room){
   const loss=event==='loseInfluence'?(room.pending?.kind==='lose'&&room.pending.loserId===own.id?room.pending:room.challengeLosses?.find(q=>q.loserId===own.id)):room.pending;
   const response=['counter','declineCounter'].includes(event)&&['claim','counterOffer'].includes(loss?.kind);
   data={...data,commandId:`load-${++serial}`,commandSequence:own.commandSequence+1,expectedRoom:room.code,expectedTurn:room.turnNumber,expectedDecision:(response?loss.responseDecisionId:loss?.decisionId)||null};
  }
  const started=performance.now();let reply;
  try{reply=await bot.socket.timeout(30000).emitWithAck(event,data);}catch(error){stats.timeouts++;throw Error('ACK timeout: '+event);}
  if(measuring){stats.commands++;stats.events[event]=(stats.events[event]||0)+1;stats.commandBytes+=Buffer.byteLength(JSON.stringify(data));stats.latencies.push(performance.now()-started);if(event==='action')stats.actionLatencies.push(performance.now()-started);}
  if(reply?.error){stats.errors++;throw Error(event+': '+reply.error);}
  if(reply?.revision&&event!=='leaveRoom')await until(()=>bot.state?.room.revision>=reply.revision,'acknowledged state for '+event);
  return reply;
 }
 async function enter(bot,kind,code){
  const p=await send(bot,'prepareEntry',{kind,nickname:'Player '+bot.number,...(code?{code}:{})},false);
  bot.credential=p;await send(bot,'confirmEntry',{code:p.code,token:p.resumeToken,intentId:p.intentId},false);
  await until(()=>bot.state?.room.code===p.code,'entry snapshot');
 }
 async function synchronize(crew){const revision=Math.max(...crew.map(b=>b.state?.room.revision||0));await until(()=>crew.every(b=>b.state?.room.revision>=revision),'room convergence');}
 async function setup(crew,index,first){
  await enter(crew[0],'create');const code=crew[0].credential.code;
  for(const bot of crew.slice(1))await enter(bot,'join',code);
  await synchronize(crew);
  // Exercise leaving/rejoining a waiting lobby before the first match.
  if(first){const guest=crew[3];await send(guest,'leaveRoom');guest.state=null;await enter(guest,'join',code);stats.departures++;}
  await send(crew[0],'setRoomDetails',{name:'Benchmark '+index,visibility:index%2?'private':'public'});
  if(index%3===1)await send(crew[0],'setRevealFactions',{enabled:true});
  if(index%3===2)await send(crew[0],'setTreasuryMode',{enabled:true});
  const listing=await send(crew[0],'listRooms',{query:code},false);if(index%2===0&&!listing.rooms.some(r=>r.code===code))throw Error('Public discovery missing room');stats.discovery++;
  for(const bot of crew.slice(1)){await send(bot,'ready',{ready:true});}
  await synchronize(crew);await send(crew[0],'startGame');await synchronize(crew);
 }
 async function loop(crew,index){
  const roll=random(seed+index),pick=a=>a[Math.floor(roll()*a.length)];let reconnected=false,lastChat=Date.now(),step=0;
  while(Date.now()<startAt+duration*1000){
   await synchronize(crew);
   let r=crew[0].state.room;
   if(r.status==='finished'){
    stats.completed++;for(const bot of crew){await send(bot,'leaveRoom');bot.state=null;}
    await setup(crew,index,false);continue;
   }
   if(!reconnected&&Date.now()>startAt+duration*350){
    const bot=crew[1],id=bot.state.you.id,hand=[...bot.state.you.influences],credential=bot.credential;
    bot.socket.disconnect();await until(()=>crew[0].state.room.players.find(p=>p.id===id).connected===false,'offline presence');
    await connect(bot);await send(bot,'resumeSession',{code:credential.code,token:credential.resumeToken},false);
    await until(()=>bot.state?.you.id===id,'resumed seat');
    if(JSON.stringify(bot.state.you.influences)!==JSON.stringify(hand))throw Error('Reconnect changed private hand');
    stats.reconnects++;reconnected=true;continue;
   }
   if(Date.now()-lastChat>10000){await send(crew[0],'chatMessage',{message:'Benchmark chat'});lastChat=Date.now();continue;}
   const botFor=id=>crew.find(b=>b.state.you.id===id),debt=r.challengeLosses?.length&&(!r.pending||roll()<.5)?r.challengeLosses[0]:null;
   let bot,event,data;
   const q=debt||r.pending;
   if(q){
    if(q.kind==='lose'){bot=botFor(q.loserId);event='loseInfluence';data={cardIndex:0};}
    else if(['claim','counterClaim'].includes(q.kind)){
     const eligible=crew.filter(b=>b.state.you.alive&&b.state.you.id!==q.claimantId&&!(q.passedBy||[]).includes(b.state.you.id));
     if(!eligible.length)throw Error('No eligible claim responder');bot=pick(eligible);event=roll()<.15?'challenge':'passChallenge';data={};
     if(q.kind==='claim'&&(q.options||[]).length&&q.targetId===bot.state.you.id){
      const options=(q.options||[]).filter(role=>bot.state.you.influences.includes(role));
      if(options.length&&roll()<.6){event='counter';data={counter:pick(options)};}else if(roll()<.5){event='declineCounter';data={};}
     }
    }else if(q.kind==='counterOffer'){
     bot=botFor(q.targetId);const options=q.options.filter(role=>bot.state.you.influences.includes(role)&&(role!=='swordsman'||bot.state.you.coins>=5));
     event=options.length&&roll()<.7?'counter':'declineCounter';data=event==='counter'?{counter:pick(options)}:{};
    }else if(q.kind==='summon'){bot=botFor(q.claimantId);event='summonChoice';data=roll()<.75?{choice:'replace',cardIndex:0}:{choice:'discard'};}
    else if(q.kind==='information'){
     bot=botFor(q.targetId);const privateChoice=bot.state.you.informationChoice;
     if(q.stage==='selectHidden'){event='intrigueReveal';data={cardIndex:privateChoice.unknownIndices[0]};}
     else{event='counter';data={counter:bot.state.you.coins&&roll()<.5?'keepOne':'revealAll'};}
    }else if(q.kind==='informationShare'){bot=botFor(q.claimantId);event='intrigueSharing';data={share:roll()<.5};}
    else throw Error('Unknown pending decision: '+q.kind);
   }else{
    bot=botFor(r.turnPlayerId);const own=bot.state.you,opponents=r.players.filter(p=>p.alive&&p.id!==own.id),target=pick(opponents),wealth=opponents.filter(p=>p.coins>0);
    let action='earn',targetId;
    if(r.mandatoryPurge||own.coins>=r.purgeCost){action=r.riot?'overthrow':'purge';targetId=target.id;}
    else if(own.coins>=3&&own.influences.includes('assassin')){action='assassinate';targetId=target.id;}
    else if(own.coins>=5&&own.influences.includes('swordsman')){action='hireBlade';targetId=target.id;}
    else if(own.influences.includes('magistrate')&&roll()<.22)action='summon';
    else if(own.influences.includes('courtesan')&&own.intrigueEligibleTargets.length&&roll()<.3){action='intrigue';targetId=pick(own.intrigueEligibleTargets);}
    else if(own.influences.includes('kingpin')&&wealth.length){action='extort';targetId=pick(wealth).id;}
    else if(own.influences.includes('lord')&&(!r.treasuryMode||!r.riot))action='tax';
    else if(r.riot){if(wealth.length){action='loot';targetId=pick(wealth).id;}else action='summon';}
    else if(roll()<.08)action='tax'; // Occasional plausible bluff; no hidden-hand inspection.
    event='action';data={action,...(targetId?{targetId}:{})};
   }
   await send(bot,event,data);step++;
   await synchronize(crew);await sleep(thinkMs);
  }
  if(crew[0].state.room.status==='finished')stats.completed++;
 }
 try{
  await until(()=>/localhost:\d+/.test(startup)||child.exitCode!==null,'server startup');if(child.exitCode!==null)throw Error(stderr);
  url='http://127.0.0.1:'+startup.match(/localhost:(\d+)/)[1];
  const crews=Array.from({length:roomCount},(_,i)=>Array.from({length:4},(_,j)=>({number:i*4+j+1})));
  // Bounded setup prevents connection bursts from dominating the activity sample.
  let next=0;await Promise.all(Array.from({length:Math.min(8,roomCount)},async()=>{while(next<roomCount){const index=next++;for(const bot of crews[index])await connect(bot);await setup(crews[index],index,true);}}));
  await sleep(1100);const baseline=samples.at(-1);startAt=Date.now();measuring=true;
  await Promise.all(crews.map((crew,index)=>loop(crew,index)));measuring=false;
  const elapsedSeconds=(Date.now()-startAt)/1000;await sleep(1100);const last=samples.at(-1),active=samples.filter(s=>s.at>=startAt&&s.at<=startAt+elapsedSeconds*1000);
  const db=last.db,counts=db.counts.map((v,i)=>v-baseline.db.counts[i]),transactions=db.transactions-baseline.db.transactions;
  let accumulated=0,dbP95=0;for(let i=0;i<counts.length;i++){accumulated+=counts[i];if(accumulated>=transactions*.95){dbP95=db.bounds[i];break;}}
  const sum=values=>values.reduce((a,b)=>a+b,0),mean=values=>values.length?sum(values)/values.length:0;
  const result={rooms:roomCount,playersPerRoom:4,elapsedSeconds,thinkMs,seed,commands:stats.commands,commandsPerSecond:stats.commands/elapsedSeconds,errors:stats.errors,timeouts:stats.timeouts,completedGames:stats.completed,reconnects:stats.reconnects,lobbyDepartures:stats.departures,discoveryQueries:stats.discovery,events:stats.events,latencyMs:{p50:percentile(stats.latencies,.5),p95:percentile(stats.latencies,.95),p99:percentile(stats.latencies,.99),max:Math.max(0,...stats.latencies)},actionLatencyMs:{p95:percentile(stats.actionLatencies,.95),p99:percentile(stats.actionLatencies,.99)},server:{peakConnections:Math.max(0,...active.map(s=>s.connections)),meanCpuCores:mean(active.map(s=>s.cpuCores)),peakCpuCores:Math.max(0,...active.map(s=>s.cpuCores)),meanRssMiB:mean(active.map(s=>s.rss))/1048576,peakRssMiB:Math.max(0,...active.map(s=>s.rss))/1048576,eventLoopP95MaxMs:Math.max(0,...active.map(s=>s.eventLoopP95Ms))},database:{transactions,failures:db.failed-baseline.db.failed,meanTransactionMs:(db.totalMs-baseline.db.totalMs)/transactions,p95TransactionUpperBoundMs:dbP95,maxTransactionMsIncludingSetup:db.maxMs,fileBytes:fs.statSync(filename).size,walBytes:fs.existsSync(filename+'-wal')?fs.statSync(filename+'-wal').size:0},traffic:{stateJsonBytes:stats.stateBytes,commandJsonBytes:stats.commandBytes,excludes:'Socket.IO framing, TLS, HTTP polling overhead and static asset downloads'}};
  if(stderr.trim())result.serverWarnings=stderr.split('\n').filter(Boolean).map(line=>line.slice(0,180));
  return result;
 }finally{
  measuring=false;for(const c of clients)c.disconnect();child.kill('SIGTERM');
  try{await until(()=>child.exitCode!==null||child.signalCode!==null,'server shutdown',10000);}catch{child.kill('SIGKILL');await until(()=>child.exitCode!==null||child.signalCode!==null,'forced shutdown',5000);}
  fs.rmSync(folder,{recursive:true,force:true});
 }
}
async function main(){
 const options={rooms:[25,50,100,200],duration:30,thinkMs:300,output:path.join(root,'load-results/results.json')},args=process.argv.slice(2);
 while(args.length){const key=args.shift(),value=args.shift();if(!value)throw Error('Missing option value');if(key==='--rooms')options.rooms=value.split(',').map(Number);else if(key==='--duration')options.duration=Number(value);else if(key==='--think-ms')options.thinkMs=Number(value);else if(key==='--output')options.output=path.resolve(value);else throw Error('Unknown option: '+key);}
 if(options.rooms.some(n=>!Number.isInteger(n)||n<1||n>200)||options.duration<2||options.duration>600||options.thinkMs<50||options.thinkMs>10000||!Number.isFinite(options.duration)||!Number.isFinite(options.thinkMs))throw Error('Rooms 1–200, duration 2–600 seconds, think-ms 50–10000.');
 const report={at:new Date().toISOString(),node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryGiB:os.totalmem()/1073741824,method:'Local isolated Node server, SQLite WAL/FULL on local disk, real Socket.IO clients (90% WebSocket/10% polling), synthetic proxy/source IPs, normal abuse quotas, 4 seats per room, mixed Classic/Faction/Treasury. Generator shares host. Aggregate results contain no credentials or hands.',cases:[]};
 for(const rooms of options.rooms){console.log('Testing '+rooms+' rooms…');const result=await runCase(rooms,options);report.cases.push(result);fs.mkdirSync(path.dirname(options.output),{recursive:true});fs.writeFileSync(options.output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({rooms,commands:result.commands,completed:result.completedGames,reconnects:result.reconnects,p95:result.latencyMs.p95,rssMiB:result.server.peakRssMiB,errors:result.errors}));}
 console.log(options.output);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={runCase,percentile};
