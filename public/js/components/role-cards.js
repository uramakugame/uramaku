/* Shared influence card renderer: one markup path for the game and guided tutorial. */
(function(root){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selectionStyles={
    lose:{className:'selectable-loss',attribute:'data-lose'},
    conceal:{className:'selectable-conceal',attribute:'data-intrigue-reveal'},
    replace:{className:'selectable-replace',attribute:'data-summon-replace'},
  };
  function revealed({role,name,status='',classes=[],tooltip=null,select=null,dataRole=null,slot=null,revealIndex=null,extraHtml=''}){
    const selection=selectionStyles[select?.type];
    const selectionAttr=selection?`${selection.attribute}="${Number(select.index)}" tabindex="0" role="button"`:'';
    const label=select?`${select.label}: ${name}`:(tooltip||`${name} role abilities`);
    const tooltipAttr=!select&&tooltip?`data-tooltip="${esc(tooltip)}"`:'';
    const dataRoleAttr=dataRole?`data-role="${esc(dataRole)}"`:'';
    const slotAttr=Number.isInteger(slot)&&slot>=0?`data-influence-slot="${slot}"`:'';
    const revealAttr=Number.isInteger(revealIndex)&&revealIndex>=0?`data-reveal-index="${revealIndex}"`:'';
    const classNames=['room-role-card',`portrait-${role}`,...classes,selection?.className].filter(Boolean).map(esc).join(' ');
    return `<div class="${classNames}" ${selectionAttr} ${tooltipAttr} ${dataRoleAttr} ${slotAttr} ${revealAttr} aria-label="${esc(label)}"><img src="/assets/portraits/${esc(role)}.jpg" alt=""><div class="role-card-bottom"><span class="role-card-name">${esc(name)}</span>${status?`<small>${esc(status)}</small>`:''}${extraHtml}</div>${select?`<span class="influence-choice-overlay">${esc(select.label)}</span>`:''}</div>`;
  }
  function hidden({faction=null,slot=null}={}){
    const shown=faction==='order'||faction==='underworld';
    const slotAttr=Number.isInteger(slot)&&slot>=0?`data-influence-slot="${slot}"`:'';
    const back=shown?faction:'standard';
    return `<div class="room-role-card hidden-role-card default-hidden-portrait${shown?' faction-hidden-card faction-portrait '+faction:''}" ${slotAttr} aria-label="${shown?'Hidden role, '+(faction==='order'?'Order':'Underworld')+' faction':'Hidden role'}"><div class="default-hidden-art" aria-hidden="true"><img class="card-back-image" src="/assets/card-backs/${back}.png" alt=""></div></div>`;
  }
  function shareControl({targetId,slot,label,ariaLabel=label}){
    return `<button type="button" class="private-intel-share-control" data-share-private-target="${esc(targetId)}" data-share-private-slot="${Number(slot)}" aria-label="${esc(ariaLabel)}">${esc(label)}</button>`;
  }
  const api=Object.freeze({revealed,hidden,shareControl});
  if(root)root.URAMAKU_ROLE_CARDS=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
