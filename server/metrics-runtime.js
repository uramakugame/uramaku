'use strict';
// Bounded, in-memory timings, reset on restart. No request payloads or identities.
function runtimeMetrics(){
 const bounds=[1,2,5,10,25,50,100,250,500,1000,Infinity],counts=bounds.map(()=>0);
 let count=0,failed=0,total=0,max=0;
 return {
  recordTransaction(ms,ok){count++;if(!ok)failed++;total+=ms;max=Math.max(max,ms);counts[bounds.findIndex(bound=>ms<=bound)]++;},
  report(){let n=0;const index=counts.findIndex(c=>(n+=c)>=Math.ceil(count*.95));const upper=bounds[index];return {transactions:count,failed,meanMs:count?total/count:null,maxMs:count?max:null,p95UpperMs:count&&Number.isFinite(upper)?upper:null,p95Over1000Ms:count>0&&upper===Infinity};}
 };
}
module.exports={runtimeMetrics};
