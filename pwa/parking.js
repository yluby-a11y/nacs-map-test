function parkingFeeText(f){if(!f)return '요금 미확인';if(f.free)return '무료 (공공데이터 기준)';let text='기본 '+f.basicMinutes+'분 '+f.basicWon.toLocaleString('ko-KR')+'원';if(f.extraMinutes>0&&f.extraWon!==null)text+=' · 추가 '+f.extraMinutes+'분 '+f.extraWon.toLocaleString('ko-KR')+'원';if(f.dayWon>0)text+=' · 1일 '+f.dayWon.toLocaleString('ko-KR')+'원';return text;}
function parkingLiveText(p){return Number.isInteger(p.availableSpaces)?'빈자리 '+p.availableSpaces+' / '+p.totalSpaces+'면 · '+(p.occupancy||'혼잡도 미확인'):'빈자리·혼잡도 미확인';}
// Runs after the panel exists, including installed app launches at the host root.
const parkingTestSite=location.hostname==='nacs-map-preview.hoy-kim.workers.dev'||location.hostname==='yluby-a11y.github.io'&&/^\/nacs-map-test(?:\/|$)/.test(location.pathname);
document.getElementById('parkingPanel').hidden=!parkingTestSite;
function parkingDetailLink(p){return /^\d+$/.test(p.placeId||'')?'https://place.map.kakao.com/'+p.placeId:'';}
let parkingRequestRevision=0,parkingDestinationSignature='';
let parkingIndependentDestination=null,parkingRecentTargets=[];
function parkingTarget(){return parkingIndependentDestination||dest;}
function validParkingTarget(p){return !!p&&typeof p.name==='string'&&p.name.trim().length>0&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=33&&p.lat<=39&&p.lon>=124&&p.lon<=132;}
function renderParkingRecent(){
 try{const seen=new Set();parkingRecentTargets=savedSchedules().filter(p=>validParkingTarget(p.trip?.destination)).map(p=>({point:{...p.trip.destination},label:(p.tripKind==='return'?'귀가 · ':'')+p.trip.destination.name})).filter(p=>{const key=JSON.stringify([p.point.lat,p.point.lon,p.point.name]);if(seen.has(key))return false;seen.add(key);return true;});
 document.getElementById('parkingRecentDestination').innerHTML='<option value="">최근 목적지 선택</option>'+parkingRecentTargets.map((p,i)=>'<option value="'+i+'">'+escapeHTML(p.label)+'</option>').join('');
 }catch{parkingRecentTargets=[];document.getElementById('parkingRecentDestination').innerHTML='<option value="">저장한 코스를 읽지 못했습니다</option>';}
}
function chooseParkingRecent(value){const i=Number(value);if(value===''||!Number.isInteger(i)||!parkingRecentTargets[i])return;parkingIndependentDestination={...parkingRecentTargets[i].point};refreshParkingDestination();}
function useCurrentParkingDestination(){parkingIndependentDestination=null;refreshParkingDestination();}
function openParkingTarget(point){if(!validParkingTarget(point)){document.getElementById('parkingStatus').textContent='이 카드의 목적지를 확인하지 못했습니다.';return;}parkingIndependentDestination={...point};const panel=document.getElementById('parkingPanel');panel.open=true;refreshParkingDestination();renderParkingRecent();panel.scrollIntoView?.({behavior:'smooth',block:'start'});searchParkingPreview();}
function parkingFromTravelCard(){openParkingTarget(currentSchedule?.trip?.destination);}
function parkingFromSavedCard(i){try{openParkingTarget(savedSchedules()[i]?.trip?.destination);}catch{document.getElementById('parkingStatus').textContent='저장 자료를 읽지 못했습니다.';}}
function refreshParkingDestination(){
 const target=parkingTarget(),signature=target?JSON.stringify([target.lat,target.lon,target.name]):'';document.getElementById('parkingTargetLabel').textContent=target?'주차 확인 목적지: '+target.name:'최근 여행 목적지를 고르면 코스 설정 없이 주차장만 확인할 수 있습니다.';
 if(signature===parkingDestinationSignature)return;
 parkingDestinationSignature=signature;parkingRequestRevision++;
 document.getElementById('parkingResults').innerHTML='';document.getElementById('parkingSearchButton').disabled=false;
 document.getElementById('parkingStatus').textContent=target?'선택한 목적지 주변 주차장을 조회할 수 있습니다.':'경로 설정에서 목적지를 먼저 선택해 주세요.';
}

async function searchParkingPreview(){
 const status=document.getElementById('parkingStatus'),box=document.getElementById('parkingResults'),button=document.getElementById('parkingSearchButton');
 const parkingDest=parkingTarget();box.innerHTML='';if(!parkingDest){status.textContent='최근 여행 목적지를 선택하거나 현재 코스 목적지를 설정해 주세요.';return;}
 const target={lat:parkingDest.lat,lon:parkingDest.lon,name:parkingDest.name||document.getElementById('destination').value},signature=JSON.stringify(target),rev=++parkingRequestRevision;button.disabled=true;status.textContent='목적지 주변 주차장을 확인하고 있습니다…';
 try{const q=new URLSearchParams({lat:target.lat,lon:target.lon,name:target.name}),r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/parking?'+q,{timeoutMs:70000});if(!r.ok)throw Error(r.status===429?'조회가 많습니다. 잠시 후 다시 눌러 주세요.':'주차장 검색에 연결하지 못했습니다. 다시 시도해 주세요.');const data=await r.json();if(rev!==parkingRequestRevision)return;if(!parkingTarget()||JSON.stringify({lat:parkingTarget().lat,lon:parkingTarget().lon,name:parkingTarget().name||document.getElementById('destination').value})!==signature){status.textContent='목적지가 변경됐습니다. 다시 조회해 주세요.';return;}
 if(!Array.isArray(data.places))throw Error('주차장 정보를 확인하지 못했습니다.');
 box.innerHTML=data.places.slice(0,5).map(p=>'<article class="coffee-card"><h4>'+escapeHTML(p.name)+'</h4><p>'+escapeHTML(p.address)+'</p><p>목적지에서 직선 약 '+Number(p.distanceKm).toFixed(1)+'km · 실제 도보거리 미확인</p><p>'+escapeHTML(p.category||'주차장')+' · 전화 '+escapeHTML(p.phone||'미등록')+'</p><p>'+escapeHTML(parkingLiveText(p))+'</p><p>'+escapeHTML(parkingFeeText(p.fee))+'</p><p class="meta">'+(p.publicParkingId?'한국교통안전공단 시설 매칭 · '+(p.liveFetchedAt?'조회 '+escapeHTML(new Date(p.liveFetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' · 측정시각 미제공':'실시간 정보 미확인'):'공공데이터 시설 매칭 미확인')+'</p>'+(parkingDetailLink(p)?'<a class="btn search" target="_blank" rel="noopener noreferrer" href="'+parkingDetailLink(p)+'">카카오 장소 상세</a>':'<p>장소 상세 연결 정보 미확인</p>')+'</article>').join('');status.textContent=data.places.length?data.places.length+'곳 · 최대 2분 공용 캐시 · '+(data.publicDataStatus==='lookup_failed'?'공공정보 조회 실패 · ':data.publicDataStatus==='partial_service_failure'?'일부 공공정보 조회 실패 · ':'')+'방문 전 요금·빈자리·진입로를 확인하세요.':'조건에 맞는 주차장을 찾지 못했습니다. 검색 누락일 수 있으며 주차장이 없다는 뜻은 아닙니다.';
 }catch(e){if(rev!==parkingRequestRevision)return;status.textContent=e.name==='TimeoutError'?'검색 시간이 초과됐습니다. 다시 시도해 주세요.':e.message;}finally{if(rev===parkingRequestRevision)button.disabled=false;}
}

document.getElementById('parkingPanel').addEventListener('toggle',()=>{if(document.getElementById('parkingPanel').open){renderParkingRecent();refreshParkingDestination();}});document.getElementById('travelParkingButton').hidden=!parkingTestSite;renderParkingRecent();refreshParkingDestination();
