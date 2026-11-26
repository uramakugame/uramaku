const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const constants=app.slice(app.indexOf('const ACTION_ANNOUNCEMENT_DURATION='),app.indexOf('const SEAT_STORAGE_KEY='));
const method=app.slice(app.indexOf('function showActionAnnouncement('),app.indexOf('function showVictory('));
const timers=[];
let stack=null;
function element(){
 return {classList:{add(){}},setAttribute(){},children:[],get childElementCount(){return this.children.length},appendChild(child){this.children.push(child);child.parent=this},remove(){this.parent?.children.splice(this.parent.children.indexOf(this),1);if(this===stack)stack=null},isConnected:true};
}
const ctx={window:{},document:{getElementById(){return stack},createElement(){return element()},body:{appendChild(el){stack=el}}},performance:{now(){return 1000}},setTimeout(fn,delay){timers.push({fn,delay})}};
vm.runInNewContext(constants+'\n'+method+'\nshowActionAnnouncement("first");showActionAnnouncement("second");',ctx);
assert.equal(stack.children.length,2,'Events should appear immediately rather than queue');
assert.equal(timers.length,4,'Each event should have a fade and removal timer');
const [firstFade,firstRemove,secondFade,secondRemove]=timers.map(t=>t.delay);
assert.equal(firstRemove,2500,'First announcement should be visible for 2.5 seconds');
assert.equal(secondFade-firstRemove,1000,'Next fade must not start until one second after prior removal');
assert.equal(secondRemove-secondFade,540,'Fade-out duration should match the gentler fade');
console.log('Immediate stacking, 2.5-second lifetime, and staggered fade-out timing passed.');
