'use strict';
const fs=require('node:fs'),path=require('node:path');
function within(file,directory){const relative=path.relative(directory,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function runtimeConfig(env={}){
 const production=env.NODE_ENV==='production',filename=env.SQLITE_PATH||path.join(__dirname,'../data/uramaku.sqlite');
 if(production&&(!env.SQLITE_PATH||filename===':memory:'||!path.isAbsolute(filename)||!fs.existsSync(path.dirname(filename))))throw Error('Production requires SQLITE_PATH on an existing persistent volume.');
 if(production&&(env.RAILWAY_PROJECT_ID||env.RAILWAY_ENVIRONMENT_ID)){
  const mount=env.RAILWAY_VOLUME_MOUNT_PATH;
  if(!mount||!path.isAbsolute(mount)||!fs.existsSync(mount)||!within(path.resolve(filename),path.resolve(mount))||!within(path.join(fs.realpathSync(path.dirname(filename)),path.basename(filename)),fs.realpathSync(mount)))throw Error('Railway requires SQLITE_PATH inside RAILWAY_VOLUME_MOUNT_PATH. Attach the persistent volume before starting.');
  if(fs.existsSync(filename)&&!within(fs.realpathSync(filename),fs.realpathSync(mount)))throw Error('The database must remain on the persistent volume.');
 }
 const port=env.PORT===undefined?3000:Number(env.PORT);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT.');
 const allowedOrigins=env.ALLOWED_ORIGINS?env.ALLOWED_ORIGINS.split(',').map(value=>{
  let url;try{url=new URL(value.trim());}catch{throw Error('Invalid ALLOWED_ORIGINS. Use comma-separated absolute origins.');}
  if(!['http:','https:'].includes(url.protocol)||(production&&url.protocol!=='https:')||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid ALLOWED_ORIGINS. Use HTTPS origins without paths in production.');
  return url.origin;
 }):null;
 return {production,filename,port,host:env.HOST||'0.0.0.0',allowedOrigins};
}
function allowOrigin(request,config){
 const origin=request.headers?.origin;if(!origin)return true; // CLI/native clients still pass seat/rate validation.
 let url;try{url=new URL(origin);}catch{return false;}
 if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||(config.production&&url.protocol!=='https:'))return false;
 if(config.allowedOrigins)return config.allowedOrigins.includes(origin);
 return url.host.toLowerCase()===String(request.headers?.host||'').toLowerCase();
}
module.exports={runtimeConfig,allowOrigin};
