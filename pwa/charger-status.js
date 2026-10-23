let chargerStatusPopup;
function getChargerStatusPopup(){
 if(chargerStatusPopup)return chargerStatusPopup;
 const style=document.createElement('style');style.textContent='#chargerStatusDialog{padding:0;width:calc(100% - 24px);max-width:480px;max-height:82dvh;border:0;border-radius:22px;background:#fff;color:#172334;overflow:hidden;box-shadow:0 24px 70px #0004}#chargerStatusDialog::backdrop{background:#081623aa}#chargerStatusDialog .status-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 14px;border-bottom:1px solid #e7edf1}#chargerStatusDialog h2{margin:0;font-size:18px;line-height:1.4;letter-spacing:-.5px}#chargerStatusDialog .status-place{margin:5px 0 0;color:#526273;font-size:13px;line-height:1.5;word-break:keep-all}#chargerStatusDialog .status-heading button{flex-shrink:0;min-height:36px;margin:0;padding:7px 11px;border-radius:11px;background:#edf2f5;color:#334155;font-size:13px}#chargerStatusDialog .status-body{padding:0 16px 14px;max-height:calc(82dvh - 120px);overflow-y:auto;overscroll-behavior:contain;font-size:13px;line-height:1.6}#chargerStatusDialog .status-summary{position:sticky;top:0;z-index:1;background:#fff;padding:13px 1px 12px;border-bottom:1px solid #edf2f5;margin-bottom:4px}#chargerStatusDialog .status-summary strong{display:block;color:#0b7665;font-size:16px}#chargerStatusDialog .status-summary small{color:#64748b;font-size:11px}#chargerStatusDialog .status-unit{padding:14px 1px;border-bottom:1px solid #e7edf1}#chargerStatusDialog .status-unit-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}#chargerStatusDialog .status-unit-head b{font-size:14px;font-variant-numeric:tabular-nums}#chargerStatusDialog .status-badge{padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;background:#eef2f6;color:#526273}#chargerStatusDialog .status-badge.available{background:#e0f5ee;color:#08745a}#chargerStatusDialog .status-badge.charging{background:#e8efff;color:#285ac0}#chargerStatusDialog .status-badge.issue{background:#fff0e4;color:#9b520e}#chargerStatusDialog .status-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}#chargerStatusDialog .status-tags span{font-size:11px;border:1px solid #dce5eb;border-radius:6px;padding:1px 6px;color:#536475}#chargerStatusDialog .status-end{display:flex;justify-content:space-between;gap:8px;color:#64748b;font-size:12px}#chargerStatusDialog .status-end time{white-space:nowrap;font-variant-numeric:tabular-nums}#chargerStatusDialog details{font-size:11px;color:#718096;margin-top:5px}#chargerStatusDialog details summary{cursor:pointer}#chargerStatusDialog .status-source{font-size:11px;color:#718096;line-height:1.6;margin:14px 0 0}';document.head.appendChild(style);
 const dialog=document.createElement('dialog');dialog.id='chargerStatusDialog';dialog.setAttribute('aria-labelledby','chargerStatusTitle');
 const heading=document.createElement('div');heading.className='status-heading';
 const title=document.createElement('h2');title.id='chargerStatusTitle';title.textContent='충전기 상태';
 const place=document.createElement('p');place.className='status-place';
 const titleGroup=document.createElement('div');titleGroup.append(title,place);
 const close=document.createElement('button');close.type='button';close.textContent='닫기';close.setAttribute('aria-label','충전기 상태 닫기');
 const panel=document.createElement('section');panel.className='status-body';panel.setAttribute('aria-live','polite');
 heading.append(titleGroup,close);dialog.append(heading,panel);document.body.appendChild(dialog);
 const popup={dialog,title,place,panel,trigger:null,revision:0};chargerStatusPopup=popup;
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
  popup.place.textContent=(card.querySelector('.name')?.textContent||'충전소').replace(/^[⭐★\s]*(?:\d+\.\s*)?/u,'');
  button.setAttribute('aria-expanded','true');panel.textContent='충전기 상태를 확인하고 있습니다…';panel.scrollTop=0;
  if(!popup.dialog.open)popup.dialog.showModal();
  try{
   const r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/charger-status?index='+index,{timeoutMs:20000});if(!r.ok)throw Error(r.status===429?'조회가 많습니다. 잠시 후 다시 확인해 주세요.':'상태를 불러오지 못했습니다. 다시 눌러 주세요.');const data=await r.json();if(revision!==popup.revision||!popup.dialog.open)return;
   const messages={setup_required:'공공데이터 API 승인 및 서버 연결 준비 중입니다.',mapping_pending:'운영사·충전소·충전기 번호를 대조 중입니다. 아직 상태를 제공하지 않습니다.',unsupported:'이 충전소의 실시간 상태는 아직 제공하지 않습니다. 테슬라 앱에서 확인해 주세요.',unconfirmed:'제공된 충전기 상태가 없습니다. 충전 가능하다는 뜻은 아닙니다.'};
   if(messages[data.state]){panel.textContent=messages[data.state];return;}
   if(!Array.isArray(data.chargers)||!data.checkedAt)throw Error('상태 정보를 확인하지 못했습니다.');
   const time=v=>{const d=new Date(v);return v&&Number.isFinite(d.getTime())?escapeHTML(d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})):'미제공';};
   const ago=v=>{if(!v)return '미제공';const minutes=Math.floor((Date.now()-new Date(v).getTime())/60000);if(!Number.isFinite(minutes)||minutes<0)return '시간 확인 필요';return minutes<1?'방금 전':minutes<60?minutes+'분 전':minutes<1440?Math.floor(minutes/60)+'시간 '+(minutes%60?minutes%60+'분':'')+' 전':Math.floor(minutes/1440)+'일 전';};
   const badge=label=>label==='충전 가능'?'available':label==='충전 중'?'charging':['운영 중지','점검 중','통신 이상'].includes(label)?'issue':'';
   panel.innerHTML='<div class="status-summary"><strong>'+(data.nacsConfirmedCount?'NACS 충전 가능 '+escapeHTML(String(data.nacsAvailable))+' / '+escapeHTML(String(data.nacsConfirmedCount))+'기':'NACS 충전기별 지원 여부 미확인')+'</strong><small>조회 '+time(data.checkedAt)+' · 최대 2분 캐시</small></div>'+data.chargers.map(c=>'<article class="status-unit"><div class="status-unit-head"><b>'+escapeHTML(String(c.id))+'번 충전기</b><span class="status-badge '+badge(c.label)+'">'+escapeHTML(c.label)+'</span></div><div class="status-tags">'+(c.outputKw?'<span>'+escapeHTML(String(c.outputKw))+' kW</span>':'')+'<span>'+(c.nacsConfirmed?'NACS 확인':'NACS 여부 미확인')+'</span></div><div class="status-end"><span>마지막 충전 종료 · '+ago(c.lastEndedAt)+'</span><time>'+time(c.lastEndedAt)+'</time></div><details><summary>상세 시간</summary>상태 변경 '+time(c.statusChangedAt)+'<br>충전 종료 '+time(c.lastEndedAt)+'</details></article>').join('')+'<p class="status-source">한국환경공단 제공 · 운영사 전송이 지연되거나 도착 시 상태가 달라질 수 있습니다.</p>';

  }catch(e){if(revision===popup.revision&&popup.dialog.open)panel.textContent=e.message||'조회 실패. 잠시 후 다시 확인해 주세요.';}
 });
}
