'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {io}=require('socket.io-client');
const {runtimeConfig,allowOrigin}=require('../../server/runtime-config');
const {launch}=require('../helpers/live-server');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-runtime-')),filename=path.join(dir,'game.sqlite');let server;
 try{
  for(const env of [{},{SQLITE_PATH:':memory:'},{SQLITE_PATH:'game.sqlite'}])assert.throws(()=>runtimeConfig({...env,NODE_ENV:'production'}));
  const env={NODE_ENV:'production',SQLITE_PATH:filename,RAILWAY_PROJECT_ID:'test'};
  assert.throws(()=>runtimeConfig(env),/volume/);
  assert.throws(()=>runtimeConfig({...env,RAILWAY_VOLUME_MOUNT_PATH:path.join(dir,'missing')}),/volume/);
  assert.throws(()=>runtimeConfig({...env,SQLITE_PATH:path.join(os.tmpdir(),'outside.sqlite'),RAILWAY_VOLUME_MOUNT_PATH:dir}),/volume/);
  fs.symlinkSync(os.tmpdir(),path.join(dir,'escape'));
  assert.throws(()=>runtimeConfig({...env,SQLITE_PATH:path.join(dir,'escape','game.sqlite'),RAILWAY_VOLUME_MOUNT_PATH:dir}),/volume/);
  const config=runtimeConfig({...env,RAILWAY_VOLUME_MOUNT_PATH:dir});
  assert.equal(config.host,'0.0.0.0');assert.equal(config.port,3000);
  const req=(origin,host='game.example')=>({headers:{host,...(origin?{origin}:{})}});
  assert(allowOrigin(req('https://game.example'),config));assert(allowOrigin(req(null,'healthcheck.railway.app'),config));
  for(const origin of ['null','http://game.example','https://other.example','https://game.example/path'])assert(!allowOrigin(req(origin),config));
  const allowed=runtimeConfig({...env,RAILWAY_VOLUME_MOUNT_PATH:dir,ALLOWED_ORIGINS:'https://one.example, https://two.example'});
  assert(allowOrigin(req('https://two.example'),allowed));assert(!allowOrigin(req('https://game.example'),allowed));
  for(const origin of ['http://game.example','https://game.example/path','https://user:pw@game.example'])assert.throws(()=>runtimeConfig({...env,RAILWAY_VOLUME_MOUNT_PATH:dir,ALLOWED_ORIGINS:origin}));
  server=await launch(filename,{...env,RAILWAY_VOLUME_MOUNT_PATH:dir,ALLOWED_ORIGINS:'https://game.example'});
  const health=await fetch(server.url+'/health',{headers:{host:'healthcheck.railway.app'}});assert.equal(health.status,200);
  assert((await fetch(server.url+'/about.html').then(r=>r.text())).includes('about-app'));
  async function attempt(origin,transport){const c=io(server.url,{transports:[transport],forceNew:true,reconnection:false,timeout:1500,extraHeaders:{Origin:origin}});try{return await new Promise(resolve=>{c.once('connect',()=>resolve(true));c.once('connect_error',()=>resolve(false));});}finally{c.disconnect();}}
  for(const transport of ['websocket','polling']){assert(await attempt('https://game.example',transport));assert.equal(await attempt('https://hostile.example',transport),false);}
  console.log('Persistent-volume fail-closed startup, origin validation over polling/WebSocket, About serving and health checks passed.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
