'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {launch}=require('../helpers/live-server');
const {installDashboard}=require('../../server/metrics-dashboard');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-dashboard-')),file=path.join(dir,'rooms.sqlite');let server;
 const password='test-only-private-password-'.repeat(2),authorization='Basic '+Buffer.from('admin:'+password).toString('base64');
 try{
  assert.throws(()=>installDashboard(null,{env:{METRICS_PASSWORD:'short'}}),/24/);
  server=await launch(file,{METRICS_PASSWORD:''});assert.equal((await fetch(server.url+'/admin/metrics')).status,404);await server.stop();
  server=await launch(file,{METRICS_PASSWORD:password});
  for(const route of ['/admin/metrics','/admin/metrics/data','/admin/metrics/app.js','/admin/metrics/style.css']){
   const response=await fetch(server.url+route);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');assert(response.headers.get('www-authenticate'));
  }
  const get=route=>fetch(server.url+route,{headers:{authorization}});
  const html=await get('/admin/metrics');assert.equal(html.status,200);assert((await html.text()).includes('/shared/i18n.js'));assert(html.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.equal((await get('/admin/metrics/app.js')).status,200);assert.equal((await get('/admin/metrics/style.css')).status,200);
  assert.equal((await fetch(server.url+'/server/admin/metrics.html')).status,404);
  const c=await server.connect(),result=await c.timeout(2000).emitWithAck('createRoom',{nickname:'Private visitor'});assert(result.ok);
  const read=async(days='all')=>{const response=await get('/admin/metrics/data?days='+days);assert.equal(response.status,200);return response.json();};
  const data=await read();assert.equal(data.totals.roomsCreated,1);assert.equal(data.totals.playerSeatJoins,1);assert.equal(data.current.connectedPlayers,1);assert.equal(data.modes.length,4);assert(data.runtime.db.transactions>0);
  const raw=JSON.stringify(data);assert(!raw.includes('Private visitor'));assert(!raw.includes(result.resumeToken));assert(!raw.includes(result.code));assert(!raw.includes('token_hash'));assert(!raw.includes('state_json'));
  for(const days of ['7','30','90'])assert.equal((await read(days)).days,Number(days));
  assert.equal((await get('/admin/metrics/data?days=-1')).status,400);assert.equal((await get('/admin/metrics/data?days=7&days=30')).status,400);
  for(let i=0;i<6;i++)assert.equal((await fetch(server.url+'/admin/metrics',{headers:{authorization:'Basic '+Buffer.from('admin:wrong').toString('base64')}})).status,401);
  const limited=await fetch(server.url+'/admin/metrics');assert.equal(limited.status,429);assert(limited.headers.get('retry-after'));
  assert.equal((await fetch(server.url+'/health')).status,200,'Admin brute force does not prevent normal game requests');
  await server.stop();server=await launch(file,{METRICS_PASSWORD:password});assert.equal((await read()).totals.roomsCreated,1,'Metrics survive real process restart without recounting restored rooms');
  console.log('Private dashboard auth, protected assets, bounded login attempts, range validation, no hidden data, live seat counts and restart passed.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
