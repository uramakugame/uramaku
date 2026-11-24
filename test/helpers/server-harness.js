'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const serverDirectory=path.resolve(__dirname,'../../server');
module.exports=function serverHarness(env={}){
  let io;
  class Server {constructor(){io=this;}use(fn){this.admit=fn;}on(event,fn){if(event==='connection')this.connect=fn;}close(fn){fn();}}
  const express=()=>({use(){},get(){}});express.static=()=>()=>{};
  const context=vm.createContext({__dirname:serverDirectory,Date,console,process:{env:{PORT:0,SQLITE_PATH:':memory:',...env}},require(id){
    if(id==='express')return express;
    if(id==='socket.io')return {Server};
    if(id==='http')return {createServer:()=>({listen(){}})};
    if(id.startsWith('./'))return require(path.resolve(serverDirectory,id));
    return require(id);
  }});
  vm.runInContext(fs.readFileSync(path.join(serverDirectory,'index.js'),'utf8'),context);
  return {sweep:()=>vm.runInContext('clearTimeout(cleanupTimer);sweepRooms()',context),close:()=>vm.runInContext('shutdown()',context),rooms:vm.runInContext('rooms',context),store:vm.runInContext('store',context),sockets:vm.runInContext('socketsByPlayer',context),client(id){
    const socket={id,data:{},events:[],handlers:{},on(event,fn){this.handlers[event]=fn;},emit(event,payload){this.events.push({event,payload});},
      disconnect(){this.closed=true;this.handlers.disconnect?.();},
      send(event,data={},ack){let result;this.handlers[event](data,ack===undefined?r=>{result=r;}:ack);return result;}
    };io.admit(socket,error=>{if(error)throw error;io.connect(socket);});return socket;
  }};
};
