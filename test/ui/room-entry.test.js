const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const dialogCode=source.slice(source.indexOf('function openEntryDialog(mode){'),source.indexOf('function render(){'));
function launch(mode, nickname,code){
 const sent=[];const elements={};
 function mockInput(value){return {value,focus(){this.focused=true},addEventListener(event,cb){this[event]=cb}};}
 const nick=mockInput(nickname),room=mode==='join'?mockInput(code):null;
 const error={hidden:true,textContent:''};
 const buttons=[{disabled:false},{disabled:false}];
 const close={addEventListener(event,cb){this[event]=cb}};
 const spectator=mode==='join'?{addEventListener(event,cb){this[event]=cb}}:null;
 const form={
  querySelector(sel){return {'#entryNickname':nick,'#entryCode':room,'#entryError':error,'.room-entry-close':close,'[data-entry-action="spectator"]':spectator}[sel]||null},
  querySelectorAll(){return buttons},addEventListener(event,cb){this[event]=cb},
 };
 const backdrop={innerHTML:'',isConnected:true,querySelector(sel){return sel==='form'?form:null},addEventListener(event,cb){this[event]=cb},remove(){this.isConnected=false}};
 const document={getElementById(){return null},createElement(){return backdrop},body:{appendChild(n){elements.dialog=n}}};
 const context={window:{},document,localizeRoom(){},socket:{emit(event,data,cb){if(event==='confirmEntry')assert(elements.seat,'Credential must be saved before finalizing the seat');sent.push({event,data});cb({code:'ABCD',resumeToken:'test-token'})}},rememberSeat(res){elements.seat=res},show(){},navigator:{},setTimeout(){},clearTimeout(){},console};
 vm.createContext(context);vm.runInContext('let roomCode=null;'+dialogCode+`openEntryDialog('${mode}')`,context);
 return {sent,context,backdrop,form,nick,room,error,spectator,elements};
}
let a=launch('create',' Akira ');
assert(a.backdrop.innerHTML.includes('Nickname'));
assert(!a.backdrop.innerHTML.includes('id="entryCode"'));
a.form.submit({preventDefault(){}});
assert.equal(a.sent[0].event,'prepareEntry');assert.equal(a.sent[0].data.kind,'create');assert.equal(a.sent[1].event,'confirmEntry');assert.equal(a.sent[0].data.nickname,'Akira');
assert(!a.sent[0].data.code);assert.equal(a.backdrop.isConnected,false);
a=launch('join',' Mei ','a1b2');
assert(a.backdrop.innerHTML.includes('Join as player')&&a.backdrop.innerHTML.includes('Spectate'));
a.form.submit({preventDefault(){}});
assert.equal(a.sent[0].event,'prepareEntry');assert.equal(a.sent[0].data.kind,'join');assert.equal(a.sent[0].data.code,'A1B2');
a=launch('join',' Sora ','C3D4');
a.spectator.click();assert.equal(a.sent[0].event,'prepareEntry');assert.equal(a.sent[0].data.kind,'spectator');assert.equal(a.sent[0].data.nickname,'Sora');
a=launch('join',' ','ABCD');a.form.submit({preventDefault(){}});
assert.equal(a.sent.length,0);assert.equal(a.error.hidden,false);
a=launch('join','Akira','a');a.form.submit({preventDefault(){}});
assert.equal(a.sent.length,0);assert.match(a.error.textContent,/four-character/);
console.log('Create/join/spectate dialog behavior and input validation passed.');
