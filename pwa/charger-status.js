let chargerStatusPopup;
function getChargerStatusPopup(){
 if(chargerStatusPopup)return chargerStatusPopup;
 const style=document.createElement('style');style.textContent='#chargerStatusDialog{padding:0;width:calc(100% - 24px);max-width:520px;max-height:80dvh;border:0;border-radius:18px;background:#fff;color:#172334;overflow:hidden}#chargerStatusDialog::backdrop{background:#081623b3}#chargerStatusDialog .status-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e2e8f0}#chargerStatusDialog h2{margin:0;font-size:17px;line-height:1.5}#chargerStatusDialog .status-heading button{flex-shrink:0;min-height:38px;background:#edf2f5;color:#334155}#chargerStatusDialog .status-body{padding:4px 16px 16px;max-height:calc(80dvh - 100px);overflow-y:auto;overscroll-behavior:contain;font-size:14px;line-height:1.7}';document.head.appendChild(style);
 const dialog=document.createElement('dialog');dialog.id='chargerStatusDialog';dialog.setAttribute('aria-labelledby','chargerStatusTitle');
 const heading=document.createElement('div');heading.className='status-heading';
 const title=document.createElement('h2');title.id='chargerStatusTitle';
 const close=document.createElement('button');close.type='button';close.textContent='닫기';close.setAttribute('aria-label','충전기 상태 닫기');
 const panel=document.createElement('section');panel.className='status-body';panel.setAttribute('aria-live','polite');
 heading.append(title,close);dialog.append(heading,panel);document.body.appendChild(dialog);
 const popup={dialog,title,panel,trigger:null,revision:0};chargerStatusPopup=popup;
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{popup.revision++;if(popup.trigger){popup.trigger.setAttribute('aria-expanded','false');if(popup.trigger.isConnected)popup.trigger.focus({preventScroll:true});}});
 return popup;
}
function attachChargerStatus(card,index){
 if(location.hostname!=='nacs-map-preview.hoy-kim.workers.dev'&&!(location.hostname==='yluby-a11y.github.io'&&/^\/nacs-map(?:-test)?(?:\/|$)/.test(location.pathname)))return;
 const button=document.createElement('button');button.type='button';button.className='locate';button.textContent='충전기 상태 보기';button.setAttribute('aria-expanded','false');
 button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','chargerStatusDialog');
 (card.querySelector('.actions')||card).appendChild(button);
 button.addEventListener('click',async()=>{
  const popup=getChargerStatusPopup(),panel=popup.panel;const revision=++popup.revision;
  if(popup.trigger)popup.trigger.setAttribute('aria-expanded','false');popup.trigger=button;
  popup.title.textContent=(card.querySelector('.name')?.textContent||'충전소')+' · 충전기 상태';
  button.setAttribute('aria-expanded','true');panel.textContent='충전기 상태를 확인하고 있습니다…';panel.scrollTop=0;
  if(!popup.dialog.open)popup.dialog.showModal();
  try{
   const r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/charger-status?index='+index,{timeoutMs:20000});if(!r.ok)throw Error(r.status===429?'조회가 많습니다. 잠시 후 다시 확인해 주세요.':'상태를 불러오지 못했습니다. 다시 눌러 주세요.');const data=await r.json();if(revision!==popup.revision||!popup.dialog.open)return;
   const messages={setup_required:'공공데이터 API 승인 및 서버 연결 준비 중입니다.',mapping_pending:'운영사·충전소·충전기 번호를 대조 중입니다. 아직 상태를 제공하지 않습니다.',unsupported:'이 충전소의 실시간 상태는 아직 제공하지 않습니다. 테슬라 앱에서 확인해 주세요.',unconfirmed:'제공된 충전기 상태가 없습니다. 충전 가능하다는 뜻은 아닙니다.'};
   if(messages[data.state]){panel.textContent=messages[data.state];return;}
   if(!Array.isArray(data.chargers)||!data.checkedAt)throw Error('상태 정보를 확인하지 못했습니다.');
   const time=v=>v?escapeHTML(new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'미제공';
   panel.innerHTML='<p>조회 '+time(data.checkedAt)+' · 최대 2분 캐시</p><p>'+(data.nacsConfirmedCount?'NACS 확인 충전기 '+data.nacsConfirmedCount+'기 중 충전 가능 '+data.nacsAvailable+'기':'NACS 충전기별 지원 여부 미확인')+'</p>'+data.chargers.map(c=>'<div style="padding:12px;margin:8px 0;background:#f1f5f9;border-radius:12px"><b>'+escapeHTML(c.label)+'</b> · '+escapeHTML(c.id)+'번 충전기<br>'+(c.outputKw?escapeHTML(String(c.outputKw))+'kW · ':'')+(c.nacsConfirmed?'NACS 확인':'NACS 여부 미확인')+'<br>상태 변경 '+time(c.statusChangedAt)+'<br>마지막 충전 종료 '+time(c.lastEndedAt)+'</div>').join('')+'<p>출처: 한국환경공단 · 운영사 전송 지연이 있을 수 있습니다. 방문 시 상태가 달라질 수 있습니다.</p>';
  }catch(e){if(revision===popup.revision&&popup.dialog.open)panel.textContent=e.message||'조회 실패. 잠시 후 다시 확인해 주세요.';}
 });
}
