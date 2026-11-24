'use strict';
// Benchmark-only aggregate telemetry over a parent-owned IPC channel. No web
// endpoint, names, cards, credentials, or runtime metrics file is exposed.
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
function createTelemetry(env={}){
 if(env.URAMAKU_BENCHMARK!=='1'||typeof process.send!=='function')return null;
 const bounds=[.1,.25,.5,1,2,5,10,20,50,100,250,500,1000,Infinity],counts=bounds.map(()=>0);
 let transactions=0,failed=0,totalMs=0,maxMs=0,timer,readState=()=>({}),previousCpu=process.cpuUsage(),previousAt=performance.now();
 const loop=monitorEventLoopDelay({resolution:20});loop.enable();
 function recordTransaction(ms,ok){transactions++;if(!ok)failed++;totalMs+=ms;maxMs=Math.max(maxMs,ms);counts[bounds.findIndex(n=>ms<=n)]++;}
 function report(){const at=performance.now(),cpu=process.cpuUsage(),elapsed=at-previousAt;const sample={type:'uramaku:metrics',at:Date.now(),rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,cpuCores:elapsed>0?(cpu.user+cpu.system-previousCpu.user-previousCpu.system)/1000/elapsed:0,eventLoopP95Ms:loop.percentile(95)/1e6,db:{transactions,failed,totalMs,maxMs,bounds:bounds.map(x=>Number.isFinite(x)?x:null),counts},...readState()};previousAt=at;previousCpu=cpu;loop.reset();try{process.send(sample);}catch{}}
 return {recordTransaction,start(getState){readState=getState;report();timer=setInterval(report,1000);timer.unref();},stop(){if(timer)clearInterval(timer);report();loop.disable();}};
}
module.exports={createTelemetry};
