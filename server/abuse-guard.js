'use strict';
const {isIP}=require('node:net');
function integer(env,key,fallback,min=1,max=1000000){
  if(env[key]===undefined||env[key]==='')return fallback;
  const n=Number(env[key]);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Invalid ${key}`);return n;
}
function settings(env={}){return {
  lobbyTtl:integer(env,'EMPTY_LOBBY_TTL_MS',300000,1,2592000000),cleanupInterval:integer(env,'ROOM_CLEANUP_INTERVAL_MS',5000,1,60000),
  maxRooms:integer(env,'MAX_ROOMS',500),maxSpectators:integer(env,'MAX_SPECTATORS_PER_ROOM',32),
  maxConnections:integer(env,'MAX_CONNECTIONS',2048),maxConnectionsPerIp:integer(env,'MAX_CONNECTIONS_PER_IP',128),
  trustedProxyHops:integer(env,'TRUSTED_PROXY_HOPS',0,0,8),
  create:integer(env,'RATE_CREATE_PER_10_MIN',30),entry:integer(env,'RATE_ENTRY_PER_MIN',120),
  browse:integer(env,'RATE_BROWSE_PER_MIN',240),chat:integer(env,'RATE_CHAT_PER_MIN',30),
  packets:integer(env,'RATE_PACKETS_PER_SEC',30),ipPackets:integer(env,'RATE_IP_PACKETS_PER_SEC',300),
  maxBuckets:integer(env,'MAX_RATE_BUCKETS',10000)
};}
function address(socket,hops=0){
  const normalize=ip=>ip?.startsWith('::ffff:')&&isIP(ip.slice(7))===4?ip.slice(7):ip;
  const peer=normalize(socket.handshake?.address||socket.conn?.remoteAddress||socket.request?.socket?.remoteAddress)||'unknown';
  // Never trust a client-provided header by default. Enable fixed hops only
  // behind a known proxy path which overwrites/appends X-Forwarded-For.
  if(!hops)return peer;
  const raw=socket.handshake?.headers?.['x-forwarded-for'];
  if(typeof raw!=='string'||raw.length>512)return peer;
  const chain=raw.split(',').map(ip=>ip.trim());
  if(chain.length>8||chain.some(ip=>!isIP(ip))||!isIP(peer)||chain.length<hops)return peer;
  return normalize([...chain,peer][chain.length-hops]);
}
class AbuseGuard{
  constructor(config,now=()=>Date.now()){this.config=config;this.now=now;this.buckets=new Map();this.connections=new Map();this.total=0;}
  sweep(){const now=this.now();for(const [key,b] of this.buckets)if(now>=b.expires)this.buckets.delete(key);}
  take(key,limit,period){
    const now=this.now();let b=this.buckets.get(key);
    if(b){b.tokens=Math.min(limit,b.tokens+(now-b.at)*limit/period);b.at=now;}
    else{if(this.buckets.size>=this.config.maxBuckets){this.sweep();if(this.buckets.size>=this.config.maxBuckets)return false;}b={tokens:limit,at:now};this.buckets.set(key,b);}
    b.expires=now+period;
    if(b.tokens<1)return false;b.tokens--;return true;
  }
  admit(socket){
    const ip=address(socket,this.config.trustedProxyHops),n=this.connections.get(ip)||0;
    if(this.total>=this.config.maxConnections||n>=this.config.maxConnectionsPerIp)return false;
    this.total++;this.connections.set(ip,n+1);return true;
  }
  release(socket){
    const ip=address(socket,this.config.trustedProxyHops),n=this.connections.get(ip)||0;
    if(n<=1)this.connections.delete(ip);else this.connections.set(ip,n-1);this.total=Math.max(0,this.total-1);
    for(const key of this.buckets.keys())if(key.startsWith(`socket:${socket.id}:`))this.buckets.delete(key);
  }
  allow(socket,event,data){
    const ip=address(socket,this.config.trustedProxyHops),c=this.config;
    if(!this.take(`ip:${ip}:packets`,c.ipPackets,1000)||!this.take(`socket:${socket.id}:packets`,c.packets,1000))return false;
    let group,limit,period=60000;
    if(event==='createRoom'||event==='prepareEntry'&&data?.kind==='create'){group='create';limit=c.create;period=600000;}
    else if(['prepareEntry','confirmEntry','joinRoom','joinSpectator','resumeSession'].includes(event)){group='entry';limit=c.entry;}
    else if(event==='listRooms'){group='browse';limit=c.browse;}
    else if(event==='chatMessage'){
      // Bound individual chat seats as well as aggregate traffic behind NAT.
      if(!this.take(`ip:${ip}:chat`,c.chat*8,period))return false;
      group='chat';limit=c.chat;
      const identity=socket.data?.playerId||socket.id;
      return this.take(`seat:${identity}:chat`,limit,period);
    }else return true;
    return this.take(`ip:${ip}:${group}`,limit,period);
  }
}
module.exports={AbuseGuard,settings,address};
