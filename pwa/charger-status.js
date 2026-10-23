function attachChargerStatus(card,index){
 if(location.hostname!=='nacs-map-preview.hoy-kim.workers.dev'&&!(location.hostname==='yluby-a11y.github.io'&&/^\/nacs-map(?:-test)?(?:\/|$)/.test(location.pathname)))return;
 const button=document.createElement('button');button.type='button';button.className='locate';button.textContent='충전기 상태 보기';button.setAttribute('aria-expanded','false');
 const panel=document.createElement('section');panel.hidden=true;panel.className='meta';panel.setAttribute('aria-live','polite');
 (card.querySelector('.actions')||card).appendChild(button);card.appendChild(panel);
 button.addEventListener('click',async()=>{
  if(!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');return;}
  panel.hidden=false;button.setAttribute('aria-expanded','true');button.disabled=true;panel.textContent='충전기 상태를 확인하고 있습니다…';
  try{
   const r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/charger-status?index='+index,{timeoutMs:20000});if(!r.ok)throw Error(r.status===429?'조회가 많습니다. 잠시 후 다시 확인해 주세요.':'상태를 불러오지 못했습니다. 다시 눌러 주세요.');const data=await r.json();
   const messages={setup_required:'공공데이터 API 승인 및 서버 연결 준비 중입니다.',mapping_pending:'운영사·충전소·충전기 번호를 대조 중입니다. 아직 상태를 제공하지 않습니다.',unsupported:'이 충전소의 실시간 상태는 아직 제공하지 않습니다. 테슬라 앱에서 확인해 주세요.',unconfirmed:'제공된 충전기 상태가 없습니다. 충전 가능하다는 뜻은 아닙니다.'};
   if(messages[data.state]){panel.textContent=messages[data.state];return;}
   if(!Array.isArray(data.chargers)||!data.checkedAt)throw Error('상태 정보를 확인하지 못했습니다.');
   const time=v=>v?escapeHTML(new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'미제공';
   panel.innerHTML='<p>조회 '+time(data.checkedAt)+' · 최대 2분 캐시</p><p>'+(data.nacsConfirmedCount?'NACS 확인 충전기 '+data.nacsConfirmedCount+'기 중 충전 가능 '+data.nacsAvailable+'기':'NACS 충전기별 지원 여부 미확인')+'</p>'+data.chargers.map(c=>'<div style="padding:12px;margin:8px 0;background:#f1f5f9;border-radius:12px"><b>'+escapeHTML(c.label)+'</b> · '+escapeHTML(c.id)+'번 충전기<br>'+(c.outputKw?escapeHTML(String(c.outputKw))+'kW · ':'')+(c.nacsConfirmed?'NACS 확인':'NACS 여부 미확인')+'<br>상태 변경 '+time(c.statusChangedAt)+'<br>마지막 충전 종료 '+time(c.lastEndedAt)+'</div>').join('')+'<p>출처: 한국환경공단 · 운영사 전송 지연이 있을 수 있습니다. 방문 시 상태가 달라질 수 있습니다.</p>';
  }catch(e){panel.textContent=e.message||'조회 실패. 잠시 후 다시 확인해 주세요.';}finally{button.disabled=false;}
 });
}
