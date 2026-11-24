/* Shared 3D card turn. Faces come from the existing card renderer. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const cards=node?require('./role-cards'):root.URAMAKU_ROLE_CARDS;
 const i18n=node?require('../../../shared/i18n'):root.URAMAKU_I18N;
 const active=new WeakMap();
 function animate(element,{fromRole=null,faction=null,lang='en',duration=650,delay=0,onComplete=null}={}){
  if(!element?.animate||root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return false;
  active.get(element)?.cancel();
  const doc=element.ownerDocument||document;
  let contents=Array.from(element.children);
  const layer=doc.createElement('div');layer.className='card-flip-layer';layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
  const turner=doc.createElement('div');turner.className='card-flip-turner';
  const back=doc.createElement('div');back.className='card-flip-face card-flip-back';
  back.innerHTML=fromRole?cards.revealed({role:fromRole,name:i18n.role(fromRole,lang)}):cards.hidden({faction});
  const face=doc.createElement('div');face.className='card-flip-face card-flip-front';
  const copy=element.cloneNode(true);copy.removeAttribute('id');
  for(const child of copy.querySelectorAll('[id]'))child.removeAttribute('id');
  face.appendChild(copy);turner.appendChild(back);turner.appendChild(face);layer.appendChild(turner);
  for(const child of contents)child.classList.add('card-flip-covered');
  element.classList.add('card-flipping');element.appendChild(layer);
  let finished=false,timer,animation;
  const cleanup=()=>{
   if(finished)return;finished=true;clearTimeout(timer);
   for(const child of contents)child.classList.remove('card-flip-covered');
   element.classList.remove('card-flipping');layer.remove();active.delete(element);onComplete?.();
  };
  const entry={cancel(){animation?.cancel();cleanup();},rebind(next){
   if(finished)return false;
   const nextCopy=next.cloneNode(true);nextCopy.removeAttribute('id');for(const child of nextCopy.querySelectorAll('[id]'))child.removeAttribute('id');
   for(const child of Array.from(face.children))child.remove();face.appendChild(nextCopy);
   for(const child of contents)child.classList.remove('card-flip-covered');element.classList.remove('card-flipping');active.delete(element);
   element=next;contents=Array.from(next.children);for(const child of contents)child.classList.add('card-flip-covered');next.classList.add('card-flipping');next.appendChild(layer);active.set(next,entry);return true;
  }};active.set(element,entry);
  try{
   animation=turner.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(180deg)'}],{duration,delay,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
   animation?.finished?.then(cleanup,cleanup);timer=setTimeout(cleanup,delay+duration+100);
  }catch(error){cleanup();return false;}
  return true;
 }
 const api={animate,cancel:element=>active.get(element)?.cancel(),rebind:(element,next)=>active.get(element)?.rebind(next)||false};if(node)module.exports=api;if(root)root.URAMAKU_CARD_FLIP=api;
})(typeof window!=='undefined'?window:null);
