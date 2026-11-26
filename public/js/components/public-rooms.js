/* Public discovery reuses the room-entry dialog and its shared visual styles. */
(function(root){
'use strict';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function entries(rooms,lang,i18n){
  const t=(key,params)=>i18n.get(key,lang,params);
  return rooms.map(room=>`<tr><td><strong class="room-browser-name">${escape(room.name)}</strong><small class="room-browser-code">${escape(room.code)}</small></td><td data-label="${escape(t('roomGameMode'))}">${escape(t('mode'+room.mode[0].toUpperCase()+room.mode.slice(1)))}</td><td data-label="${escape(t('roomSeats'))}">${room.playerCount} / ${room.maxPlayers}</td><td data-label="${escape(t('roomStatus'))}">${escape(t('roomWaiting'))}</td><td><button type="button" class="primary small" data-room-code="${escape(room.code)}">${escape(t('roomJoin'))}</button></td></tr>`).join('');
}
function install({socket,document,getLanguage,onJoin,i18n=root.URAMAKU_I18N,schedule=setTimeout,cancel=clearTimeout}){
  let current=null,serial=0;
  const t=(key,params)=>i18n.get(key,getLanguage(),params);
  function close(){
    if(!current)return;
    const previous=current;current=null;serial++;cancel(previous.debounce);
    document.removeEventListener('keydown',previous.onKey);previous.backdrop.remove();
    if(socket.connected)socket.emit('stopRoomBrowser',{});
    previous.trigger?.focus();
  }
  function load(offset=0){
    const modal=current;if(!modal)return;
    if(!socket.connected){modal.status.textContent=t('roomBrowserDisconnected');return;}
    const request=++serial,query=modal.search.value.trim();
    modal.status.textContent=t('loadingRooms');
    socket.timeout(5000).emit('listRooms',{query,offset,subscribe:true},(failure,result)=>{
      if(current!==modal||request!==serial||query!==modal.search.value.trim())return;
      if(failure||result?.error){modal.status.textContent=failure?t('roomBrowserDisconnected'):i18n.translate(result.error,getLanguage());return;}
      modal.offset=result.offset;modal.nextOffset=result.nextOffset;
      modal.status.textContent=result.rooms.length?t('roomsFound',{count:result.total}):t('noPublicRooms');
      modal.rows.innerHTML=entries(result.rooms,getLanguage(),i18n);
      modal.previous.disabled=result.offset===0;modal.next.disabled=result.nextOffset===null;
      modal.rows.querySelectorAll('[data-room-code]').forEach(button=>button.onclick=()=>{const code=button.dataset.roomCode;close();onJoin({code});});
    });
  }
  function open(trigger){
    close();
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop room-entry-backdrop';backdrop.id='publicRoomBrowser';
    backdrop.innerHTML=`<section class="panel room-entry-dialog room-browser-dialog" role="dialog" aria-modal="true" aria-labelledby="roomBrowserTitle"><div class="room-entry-dialog-head"><h2 id="roomBrowserTitle">${escape(t('publicRooms'))}</h2><button type="button" class="room-entry-close" aria-label="${escape(t('dialogClose'))}">×</button></div><p>${escape(t('roomBrowserHelp'))}</p><label for="roomBrowserSearch">${escape(t('searchRooms'))}</label><div class="room-browser-search"><input id="roomBrowserSearch" type="search" maxlength="64" autocomplete="off"><button type="button" data-room-refresh>${escape(t('refreshRooms'))}</button></div><p data-room-status role="status"></p><div class="room-browser-scroll"><table class="room-browser-table"><thead><tr><th>${escape(t('roomNameLabel'))}</th><th>${escape(t('roomGameMode'))}</th><th>${escape(t('roomSeats'))}</th><th>${escape(t('roomStatus'))}</th><th>${escape(t('roomJoin'))}</th></tr></thead><tbody></tbody></table></div><div class="room-browser-pages"><button type="button" data-room-previous disabled>${escape(t('previousRooms'))}</button><button type="button" data-room-next disabled>${escape(t('nextRooms'))}</button></div></section>`;
    document.body.appendChild(backdrop);
    const modal={backdrop,trigger,offset:0,nextOffset:null,search:backdrop.querySelector('input'),status:backdrop.querySelector('[data-room-status]'),rows:backdrop.querySelector('tbody'),previous:backdrop.querySelector('[data-room-previous]'),next:backdrop.querySelector('[data-room-next]')};
    modal.onKey=event=>{if(event.key==='Escape')close();};current=modal;
    backdrop.querySelector('.room-entry-close').onclick=close;
    backdrop.onclick=event=>{if(event.target===backdrop)close();};
    document.addEventListener('keydown',modal.onKey);
    modal.search.oninput=()=>{cancel(modal.debounce);modal.debounce=schedule(()=>load(0),200);};
    backdrop.querySelector('[data-room-refresh]').onclick=()=>load(0);
    modal.previous.onclick=()=>load(Math.max(0,modal.offset-20));modal.next.onclick=()=>{if(modal.nextOffset!==null)load(modal.nextOffset);};
    load(0);modal.search.focus();
  }
  socket.on('publicRoomsChanged',()=>{if(current)load(current.offset);});
  socket.on('connect',()=>{if(current)load(0);});
  socket.on('disconnect',()=>{
    if(!current)return;serial++;current.status.textContent=t('roomBrowserDisconnected');current.rows.innerHTML='';current.next.disabled=true;current.previous.disabled=true;
  });
  return {open,close};
}
const api={install,entries};if(root)root.URAMAKU_PUBLIC_ROOMS=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
