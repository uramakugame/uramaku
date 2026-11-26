'use strict';
/* Run the actual multiplayer controller against the same DOM adapter used by
 * the tutorial. Network commands are captured, not sent to a live room. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{harness}=require('../tutorial/browser-harness');
module.exports=function roomHarness(lang='en'){
 const h=harness(lang),sent=[],handlers={};h.app.remove();const app=h.document.createElement('main');app.setAttribute('id','app');h.document.body.appendChild(app);
 const socket={connected:true,on(event,fn){handlers[event]=fn;},emit(event,data,cb){sent.push([event,data]);cb?.({ok:true});}};
 h.window.URAMAKU_PUBLIC_ROOMS={install:()=>({close(){},open(){}})};
 h.window.URAMAKU_COMMAND_SENDER={create:()=>({send(event,data){sent.push([event,data]);return true;},reset(){},resume(){},disconnect(){}})};
 h.window.confirm=()=>true;h.window.location={search:'',pathname:'/'};
 const ctx=vm.createContext({window:h.window,document:h.document,io:()=>socket,console,UramakuAudio:h.window.UramakuAudio,performance:{now:()=>0},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout(){},clearTimeout(){},ResizeObserver:undefined,navigator:{clipboard:{writeText:async()=>{}}}});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../public/js/app.js'),'utf8'),ctx,{filename:'public/js/app.js'});
 return{...h,app,sent,handlers,context:ctx,value:code=>vm.runInContext(code,ctx),paint(room,you){ctx.fixtureRoom=room;ctx.fixtureYou=you;vm.runInContext('state=fixtureRoom;me=fixtureYou;roomCode=state.code;render()',ctx);},click(selector){const el=app.querySelector(selector);if(!el)throw Error('Missing control '+selector);el.click();}};
};
