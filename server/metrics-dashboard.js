'use strict';
const path=require('node:path');
const {createHash,timingSafeEqual}=require('node:crypto');
const {address}=require('./abuse-guard');
const engagement=require('./engagement');
function installDashboard(app,{env,store,rooms,abuse,runtime}){
 const password=env.METRICS_PASSWORD;
 if(!password)return; // Disabled, including the HTML and assets, until configured.
 if(password.length<24||password.length>256||/[\r\n]/.test(password))throw Error('METRICS_PASSWORD must contain 24–256 characters without line breaks.');
 const digest=text=>createHash('sha256').update(text).digest(),expected=digest('admin:'+password);
 const attempts=new Map(),limit=10,period=60000;
 function auth(req,res,next){
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
  const ip=address({handshake:{address:req.socket.remoteAddress,headers:req.headers}},abuse.config.trustedProxyHops,abuse.config.trustRailwayProxy),now=Date.now();
  for(const [key,value] of attempts)if(now>=value.until)attempts.delete(key);
  // One shared fallback bucket keeps this bounded even under address churn.
  const key=attempts.has(ip)||attempts.size<1000?ip:'overflow';
  let bucket=attempts.get(key);
  if(bucket?.count>=limit){res.set('Retry-After',String(Math.max(1,Math.ceil((bucket.until-now)/1000))));return res.status(429).json({error:'Please try again later.'});}
  const raw=req.headers.authorization;
  const match=typeof raw==='string'&&raw.length<=2048&&/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(raw);
  const supplied=match?Buffer.from(match[1],'base64').toString('utf8'):'';
  if(!timingSafeEqual(digest(supplied),expected)){
   if(!bucket){bucket={count:0,until:now+period};attempts.set(key,bucket);}bucket.count++;
   return res.set('WWW-Authenticate','Basic realm="URAMAKU metrics", charset="UTF-8"').status(401).end();
  }
  next();
 }
 const directory=path.join(__dirname,'admin');
 for(const [route,file] of [['/admin/metrics','metrics.html'],['/admin/metrics/app.js','metrics.js'],['/admin/metrics/style.css','metrics.css']])app.get(route,auth,(_,res)=>res.sendFile(path.join(directory,file)));
 app.get('/admin/metrics/data',auth,(req,res)=>{
  const raw=req.query.days??'30';
  if(typeof raw!=='string'||!['all','7','30','90'].includes(raw))return res.status(400).json({error:'Invalid metrics range.'});
  try{
   const current={connections:abuse.total,waitingRooms:0,activeMatches:0,connectedPlayers:0,connectedSpectators:0};
   for(const room of rooms.values()){
    if(room.status==='lobby')current.waitingRooms++;
    if(room.status==='playing')current.activeMatches++;
    current.connectedPlayers+=room.players.filter(p=>p.connected===true).length;
    current.connectedSpectators+=(room.spectators||[]).filter(p=>p.connected===true).length;
   }
   res.json({...engagement.report(store.db,raw==='all'?0:Number(raw)),current,runtime:{since:Date.now()-process.uptime()*1000,db:runtime.report()}});
  }catch{res.status(503).json({error:'Metrics are temporarily unavailable.'});}
 });
}
module.exports={installDashboard};
