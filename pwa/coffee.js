let coffeeBrand='all',coffeeRevision=0,coffeeController=null,coffeeRows=[],coffeeProof=null;
const coffeeStatus=()=>document.getElementById('coffeeStatus');
function coffeeKey(){const target=selectedTripStops().find(p=>!p.coffee)||dest;return JSON.stringify([myPos&&[myPos.lat,myPos.lon],target&&[target.lat,target.lon],selectedTripStops().filter(p=>!p.coffee).map(p=>[p.lat,p.lon]),routePriority,document.getElementById('coffeeDeparture').value,document.getElementById('batteryRange').value,coffeeBrand]);}
function resetCoffee(){coffeeRevision++;coffeeController?.abort();coffeeController=null;coffeeRows=[];coffeeProof=null;document.getElementById('coffeeResults').innerHTML='';document.getElementById('coffeeRecommendButton').disabled=false;coffeeStatus().textContent='가까운 매장과 적은 우회 우선 · 비슷한 조건이면 DT 우선';}
function coffeeChanged(){resetCoffee();coffeeStatus().textContent='조건이 바뀌었습니다. To Go 카페추천을 다시 눌러주세요.';}
function coffeeTimeText(date){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));}
function coffeeHourText(hours){if(!hours||hours.closed)return '';const text=minute=>(minute>=1440?'다음날 ':'')+String(Math.floor(minute%1440/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');return text(hours.open)+'–'+text(hours.close);}
function coffeeInfoURL(p){if(/^https:\/\/(?:www\.starbucks\.co\.kr\/store\/store_map\.do\?in_biz_cd=\d+|place\.map\.kakao\.com\/\d+)$/.test(p.placeUrl||''))return p.placeUrl;return 'https://map.kakao.com/link/search/'+encodeURIComponent(p.name+' '+p.address);}
const coffeeOrderApps=Object.freeze({starbucks:{android:'com.starbucks.co',ios:'466682252'},mega:{android:'co.kr.waldlust.megacoffee',ios:'1473428031'},compose:{android:'ci.dvn.composecoffee.app',ios:'6742086811'},heiky:{android:'com.beaverworksinc.smartorder.heiky',ios:'6590620841'}});
function coffeeOrderURL(brand,ua=navigator.userAgent){const app=coffeeOrderApps[brand];if(!app)return '';const fallback='https://play.google.com/store/apps/details?id='+app.android;if(/Android/i.test(ua))return 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package='+app.android+';S.browser_fallback_url='+encodeURIComponent(fallback)+';end';return /iPhone|iPad|iPod/i.test(ua)?'https://apps.apple.com/kr/app/id'+app.ios:fallback;}
function renderCoffee(){
 const box=document.getElementById('coffeeResults');box.innerHTML=coffeeRows.map((p,i)=>{
  const open=p.availability==='open',verified=p.routeStatus==='verified',added=selectedTripStops().some(s=>s.coffee&&samePlace(s,p));
  const distance=verified?'출발지에서 '+p.driveKm.toFixed(1)+'km · 약 '+Math.ceil(p.driveMinutes)+'분':'출발지 직선 '+p.distanceKm.toFixed(1)+'km · 도로 경로 확인 실패';
  const hours=open?'예상 방문 시간 영업 · '+coffeeHourText(p.dayHours):'영업시간 확인 필요';
  const detour=Number.isFinite(p.detourMinutes)?'<p>'+(p.reserveCheckAt==='charger'?'첫 충전소':'첫 방문지')+' 경로 대비 우회 약 '+Math.ceil(p.detourMinutes)+'분 · '+p.detourKm.toFixed(1)+'km</p>':'';
  return '<article class="coffee-card"><h4>☕ '+escapeHTML(p.name)+(p.driveThrough&&!/DT|드라이브\s*스루/i.test(p.name)?' · DT':'')+'</h4><p>'+escapeHTML(p.address)+'</p><p>'+distance+(p.arrival?' · 도착 '+escapeHTML(coffeeTimeText(p.arrival)):'')+'</p>'+detour+(p.detourWarning?'<p class="coffee-hours-unknown">가까운 매장 참고 · 우회가 커서 방문 여부를 확인해 주세요.</p>':'')+'<p class="'+(open?'coffee-hours-open':'coffee-hours-unknown')+'">'+escapeHTML(hours)+'</p>'+(p.hoursSource?'<p class="meta">'+escapeHTML(p.hoursSource)+' · '+escapeHTML(coffeeTimeText(p.hoursCheckedAt))+' 조회</p>':'')+(!p.safeToReach&&verified?'<p>'+(p.reserveCheckAt==='charger'?'이 매장을 경유하면 첫 충전소에':'이 매장에')+' 주행가능거리 50km 여유를 남기고 도착할 수 없습니다.</p>':'')+'<div class="actions"><button type="button" data-coffee-add="'+i+'" '+(!verified||!p.safeToReach||added?'disabled':'')+'>'+(added?'경유지에 추가됨':'경유지 추가')+'</button><a class="btn search" href="'+escapeHTML(coffeeInfoURL(p))+'" target="_blank" rel="noopener">매장·영업시간 확인</a>'+(coffeeOrderURL(p.brand)?'<a class="btn coffee-order" data-order-brand="'+escapeHTML(p.brand)+'" href="'+escapeHTML(coffeeOrderURL(p.brand))+'">주문 앱</a>':'')+'</div><p class="meta">주문 앱에서 '+escapeHTML(p.name)+'을 선택해 주세요.</p></article>';
 }).join('');box.querySelectorAll('[data-coffee-add]').forEach(button=>button.addEventListener('click',()=>addCoffee(+button.dataset.coffeeAdd)));
}
async function recommendCoffee(){
 const button=document.getElementById('coffeeRecommendButton'),revision=++coffeeRevision;coffeeController?.abort();const controller=coffeeController=new AbortController();button.disabled=true;coffeeStatus().textContent='가까운 매장과 영업시간을 확인하고 있어요…';coffeeRows=[];coffeeProof=null;document.getElementById('coffeeResults').innerHTML='';
 try{
  if(!myPos)await getMyPos(false);if(revision!==coffeeRevision)return;
  const departureValue=document.getElementById('coffeeDeparture').value,departure=departureValue?new Date(departureValue+':00+09:00'):new Date();
  if(!Number.isFinite(departure.getTime())||departure.getTime()<Date.now()-15*60000||departure.getTime()>Date.now()+6*86400000)throw Error('출발 시간은 지금부터 6일 이내로 선택해 주세요.');
  const rangeValue=document.getElementById('batteryRange').value.trim(),rangeKm=rangeValue?Number(rangeValue):300;if(!Number.isFinite(rangeKm)||rangeKm<0||rangeKm>1500)throw Error('현재 주행가능거리를 확인해 주세요.');
  const selected=selectedTripStops().filter(p=>!p.coffee),target=selected[0]||dest,key=coffeeKey(),point=p=>({lat:p.lat,lon:p.lon}),firstCharge=selected.findIndex(p=>p.kind==='charger');
  const r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/coffee',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,origin:point(myPos),destination:target?point(target):null,brand:coffeeBrand,priority:routePriority,rangeKm,departure:departure.toISOString(),...(firstCharge>=0?{stopsBeforeCharge:selected.slice(0,firstCharge+1).map(point)}:{})}),signal:controller.signal,timeoutMs:45000});
  if(!r.ok)throw Error(r.status===429?'커피 조회가 많습니다. 잠시 후 다시 눌러주세요.':r.status===400?'출발 시간과 주행가능거리를 확인해 주세요.':'커피 매장 조회에 연결하지 못했습니다. 다시 시도해 주세요.');const data=await r.json();
  if(revision!==coffeeRevision)return;if(key!==coffeeKey()){coffeeStatus().textContent='조건이 바뀌었습니다. To Go 카페추천을 다시 눌러주세요.';return;}
  if(!Array.isArray(data.places))throw Error('매장 정보를 확인하지 못했습니다.');coffeeRows=data.places;coffeeProof={key,at:Date.now()};
  coffeeStatus().textContent=(coffeeRows.length?coffeeRows.length+'곳'+(data.nearbyReference?' · 가까운 매장 참고입니다.':'')+' · 커피를 살 시간 10분을 고려했습니다.':'추천할 매장을 찾지 못했습니다.')+(data.closedCount?' · 예상 방문 시간에 영업하지 않는 '+data.closedCount+'곳 제외':'')+(data.detourExcludedCount?' · 우회가 큰 '+data.detourExcludedCount+'곳 제외':'')+(data.failedBrands?.length?' · 일부 브랜드 조회에 실패했습니다.':'');renderCoffee();
 }catch(e){if(revision===coffeeRevision&&e.name!=='AbortError')coffeeStatus().textContent=e.name==='TimeoutError'?'조회가 지연됩니다. 다시 시도해 주세요.':e.message||'위치 권한을 확인하거나 출발지를 검색해 주세요.';}
 finally{if(revision===coffeeRevision){button.disabled=false;coffeeController=null;}}
}
function addCoffee(i){
 const p=coffeeRows[i];if(!p||!coffeeProof||coffeeProof.key!==coffeeKey()||Date.now()-coffeeProof.at>5*60000||(p.validUntil&&Date.now()>=Date.parse(p.validUntil))){coffeeChanged();return;}if(!p.safeToReach||p.routeStatus!=='verified')return;
 const existing=selectedTripStops().filter(s=>!s.coffee);if(existing.some(s=>samePlace(s,p))){coffeeStatus().textContent='이미 선택한 경유지입니다.';return;}if(existing.length>=(dest?5:6)){coffeeStatus().textContent='경유지가 가득 찼습니다. 기존 경유지를 빼고 추가해 주세요.';return;}
 routeStops=[{name:p.name,address:p.address,lat:p.lat,lon:p.lon,kind:'food',coffee:true,placeUrl:p.placeUrl},...existing];manualStopOrder=true;syncStopSelections();stopListChanged();waypointMarker=mapUI.favoriteMarker([p.lat,p.lon],p.name).addTo(map).bindPopup('☕ '+escapeHTML(p.name));coffeeStatus().textContent=p.name+'을 첫 경유지로 추가했습니다.';renderCoffee();
}
document.getElementById('coffeeRecommendButton').addEventListener('click',recommendCoffee);
document.querySelectorAll('[data-coffee-brand]').forEach(button=>button.addEventListener('click',()=>{coffeeBrand=button.dataset.coffeeBrand;document.querySelectorAll('[data-coffee-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));coffeeChanged();}));
for(const id of ['origin','destination','batteryRange','coffeeDeparture'])document.getElementById(id).addEventListener('input',coffeeChanged);
