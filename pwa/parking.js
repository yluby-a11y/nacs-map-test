let parkingRequestRevision=0,parkingDestinationSignature='';
function refreshParkingDestination(){
 const signature=dest?JSON.stringify([dest.lat,dest.lon,dest.name]):'';
 if(signature===parkingDestinationSignature)return;
 parkingDestinationSignature=signature;parkingRequestRevision++;
 document.getElementById('parkingResults').innerHTML='';document.getElementById('parkingSearchButton').disabled=false;
 document.getElementById('parkingStatus').textContent=dest?'선택한 목적지 주변 주차장을 조회할 수 있습니다.':'경로 설정에서 목적지를 먼저 선택해 주세요.';
}

async function searchParkingPreview(){
 const status=document.getElementById('parkingStatus'),box=document.getElementById('parkingResults'),button=document.getElementById('parkingSearchButton');
 box.innerHTML='';if(!dest){status.textContent='경로 설정에서 목적지를 먼저 검색해 선택해 주세요.';return;}
 const target={lat:dest.lat,lon:dest.lon,name:dest.name||document.getElementById('destination').value},signature=JSON.stringify(target),rev=++parkingRequestRevision;button.disabled=true;status.textContent='목적지 주변 주차장을 확인하고 있습니다…';
 try{const q=new URLSearchParams({lat:target.lat,lon:target.lon,name:target.name}),r=await apiFetch(KAKAO_ROUTE_BASE+'/v1/parking?'+q,{timeoutMs:15000});if(!r.ok)throw Error(r.status===429?'조회가 많습니다. 잠시 후 다시 눌러 주세요.':'주차장 검색에 연결하지 못했습니다. 다시 시도해 주세요.');const data=await r.json();if(rev!==parkingRequestRevision||!dest||JSON.stringify({lat:dest.lat,lon:dest.lon,name:dest.name||document.getElementById('destination').value})!==signature){status.textContent='목적지가 변경됐습니다. 다시 조회해 주세요.';return;}
 if(!Array.isArray(data.places))throw Error('주차장 정보를 확인하지 못했습니다.');
 box.innerHTML=data.places.slice(0,5).map(p=>'<article class="coffee-card"><h4>'+escapeHTML(p.name)+'</h4><p>'+escapeHTML(p.address)+'</p><p>목적지에서 직선 약 '+Number(p.distanceKm).toFixed(1)+'km · 실제 도보거리 미확인</p><p>빈자리·혼잡도 미확인 · 요금 미확인</p><a class="btn search" target="_blank" rel="noopener noreferrer" href="https://map.kakao.com/link/search/'+encodeURIComponent(p.name+' '+p.address)+'">주차장 상세 확인</a></article>').join('');status.textContent=data.places.length?data.places.length+'곳 · 장소 정보 참고용 · 최대 5분 공용 캐시 · 방문 전 운영시간·요금·진입로를 확인하세요.':'조건에 맞는 주차장을 찾지 못했습니다. 검색 누락일 수 있으며 주차장이 없다는 뜻은 아닙니다.';
 }catch(e){status.textContent=e.name==='TimeoutError'?'검색 시간이 초과됐습니다. 다시 시도해 주세요.':e.message;}finally{if(rev===parkingRequestRevision)button.disabled=false;}
}
