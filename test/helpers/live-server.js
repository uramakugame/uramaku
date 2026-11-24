'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const {io}=require('socket.io-client');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const end=Date.now()+8000;while(Date.now()<end){const value=predicate();if(value)return value;await wait(10);}throw Error('Timed out: '+label);}
async function launch(filename,env={}){
  const child=spawn(process.execPath,['server/index.js'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,PORT:'0',NODE_ENV:'test',SQLITE_PATH:filename,...env},stdio:['ignore','pipe','pipe']});
  let log='',errors='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  await until(()=>/localhost:\d+/.test(log)||child.exitCode!==null,'persistent server startup');
  if(child.exitCode!==null)throw Error('Server did not start: '+errors);
  const url='http://127.0.0.1:'+log.match(/localhost:(\d+)/)[1],clients=[];
  return {child,url,async connect(){
    const c=io(url,{transports:['websocket'],forceNew:true,reconnection:false});clients.push(c);c.on('state',s=>c.state=s);
    await until(()=>c.connected,'client connection');return c;
  },async stop(signal='SIGTERM'){
    child.kill(signal);await until(()=>child.exitCode!==null||child.signalCode!==null,'server stopped');for(const c of clients)c.disconnect();
  }};
}
module.exports={launch,until,wait};
