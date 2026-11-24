'use strict';
const assert=require('node:assert/strict');
const {runCase,percentile}=require('../../scripts/load-test');
async function main(){
 assert.equal(percentile([4,1,2,3],.5),2);assert.equal(percentile([], .95),0);
 const result=await runCase(3,{duration:5,thinkMs:50});
 assert.equal(result.errors,0);assert.equal(result.timeouts,0);assert.equal(result.database.failures,0);
 assert.equal(result.reconnects,3);assert.equal(result.lobbyDepartures,3);assert(result.discoveryQueries>=3);
 assert.equal(result.server.peakConnections,12);assert(result.database.transactions>30);
 for(const event of ['action','passChallenge','resumeSession'])assert(result.events[event]>0,event+' exercised');
 assert(result.traffic.stateJsonBytes>0);assert(result.latencyMs.p95>0);
 console.log('Isolated real-network load runner: three concurrent modes, quota-preserving clients, durable commands, private-state reconnect, lobby departure/discovery and aggregate metrics passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
