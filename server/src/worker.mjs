const jsonHeaders={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
class ApiError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
const fail=(status,code)=>{throw new ApiError(status,code);};
async function readJson(request,max=4096){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'json_required');
 if(!request.body)fail(400,'invalid_json');const reader=request.body.getReader(),parts=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();fail(413,'request_too_large');}parts.push(value);}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'invalid_json');}
}
export function validateRoute(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||body.version!==1||Object.keys(body).some(k=>!['version','points','overview'].includes(k)))fail(400,'invalid_trip');
 if(!Array.isArray(body.points)||body.points.length<2||body.points.length>5)fail(400,'invalid_points');
 const points=body.points.map(p=>{if(!p||typeof p!=='object'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat<31.43||p.lat>44.35||p.lon<122.37||p.lon>132)fail(400,'invalid_coordinates');return {lat:p.lat,lon:p.lon};});
 const overview=body.overview??'full';if(!['full','false'].includes(overview))fail(400,'invalid_overview');return {points,overview};
}
async function limitedUpstream(fetchImpl,url,options={},max=2_000_000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetchImpl(url,{...options,signal:controller.signal,redirect:'manual'});if(!response.ok)fail(502,'provider_http_'+response.status);
  const reader=response.body.getReader(),parts=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();fail(502,'provider_response_too_large');}parts.push(value);}
  const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{fail(502,'invalid_provider_response');}
 }catch(e){if(e instanceof ApiError)throw e;fail(502,'provider_unavailable');}finally{clearTimeout(timer);}
}
function validPlace(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=31.43&&p.lat<=44.35&&p.lon>=122.37&&p.lon<=132;}
export function createWorker({fetchImpl=globalThis.fetch,cacheImpl=globalThis.caches?.default}={}){const pending=new Map();return {async fetch(request,env,ctx){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const headers={...jsonHeaders,Vary:'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'origin_not_allowed'},403);
 if(origin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';}
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url);
 try{
  if(url.pathname==='/health'&&request.method==='GET')return reply({version:1,environment:env.DEPLOYMENT_ENV||'unconfigured',database:!!env.DB});
  if(!env.API_LIMITER||!env.UPSTREAM_LIMITER)fail(503,'rate_limit_not_configured');
  // Anonymous protection until user accounts exist. Shared networks may share this limit.
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)fail(503,'edge_identity_unavailable');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const key=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  if(!(await env.API_LIMITER.limit({key})).success)fail(429,'rate_limited');
  if(url.pathname==='/route'&&request.method==='GET'){
   const point=s=>typeof s==='string'&&/^\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(s)&&(()=>{const [x,y]=s.split(',').map(Number);return x>=124&&x<=132&&y>=33&&y<=39;})();
   const start=url.searchParams.get('origin'),end=url.searchParams.get('destination'),priority=url.searchParams.get('priority')||'RECOMMEND',vias=url.searchParams.get('waypoints');
   if(!point(start)||!point(end)||!['RECOMMEND','TIME','DISTANCE'].includes(priority)||(vias!==null&&(!vias||vias.split('|').length>5||!vias.split('|').every(point))))fail(400,'invalid_route_parameters');
   if(!env.KAKAO_REST_API_KEY)fail(503,'route_not_configured');
   const normalized=JSON.stringify([start,end,priority,vias||'']);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
   const digest=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');const cacheKey=new Request(url.origin+'/internal-cache/kakao-v1/'+digest);
   const hit=await cacheImpl?.match(cacheKey);if(hit){const response=reply(await hit.json());response.headers.set('X-Route-Cache','HIT');return response;}
   const coalesced=pending.has(digest);
   if(!pending.has(digest)){
    const task=(async()=>{if(!(await env.UPSTREAM_LIMITER.limit({key:'kakao-routes'})).success)fail(429,'provider_budget_limited');
     const target=new URL('https://apis-navi.kakaomobility.com/v1/directions');target.searchParams.set('origin',start);target.searchParams.set('destination',end);target.searchParams.set('priority',priority);target.searchParams.set('summary','false');target.searchParams.set('alternatives','false');if(vias)target.searchParams.set('waypoints',vias);
     const data=await limitedUpstream(fetchImpl,target.toString(),{headers:{Authorization:'KakaoAK '+env.KAKAO_REST_API_KEY}},8_000_000);const route=data.routes?.find(x=>x.result_code===0);if(!route)fail(422,'no_route');
     const result={provider:'kakao',priority,route};if(cacheImpl){const put=cacheImpl.put(cacheKey,Response.json(result,{headers:{'Cache-Control':'public, max-age=180'}}));if(ctx?.waitUntil)ctx.waitUntil(put);else await put;}return result;
    })();pending.set(digest,task);task.finally(()=>pending.delete(digest)).catch(()=>{});
   }
   const response=reply(await pending.get(digest));response.headers.set('X-Route-Cache',coalesced?'COALESCED':'MISS');return response;
  }
  if(url.pathname==='/v1/catalog'&&request.method==='GET'){
   if(!env.DB)fail(503,'database_not_configured');const row=await env.DB.prepare('SELECT version,chargers,restaurants FROM catalog_versions WHERE id=1').first();if(!row)fail(503,'catalog_not_imported');return reply(row);
  }
  if(['/v1/chargers','/v1/restaurants'].includes(url.pathname)&&request.method==='GET'){
   if(!env.DB)fail(503,'database_not_configured');const kind=url.pathname==='/v1/chargers'?'charger':'restaurant';
   const q=url.searchParams.get('q')||'',cursor=url.searchParams.get('cursor')||'',limit=Number(url.searchParams.get('limit')||100);
   if(q.length>80||cursor.length>80||!Number.isInteger(limit)||limit<1||limit>200)fail(400,'invalid_query');
   const escaped=q.replace(/[\\%_]/g,'\\$&');const result=await env.DB.prepare("SELECT id,payload FROM places WHERE kind=? AND id>? AND (name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\') ORDER BY id LIMIT ?").bind(kind,cursor,'%'+escaped+'%','%'+escaped+'%',limit+1).all();
   const more=result.results.length>limit,rows=result.results.slice(0,limit);return reply({version:1,places:rows.map(x=>JSON.parse(x.payload)),nextCursor:more?rows.at(-1).id:null});
  }
  if(url.pathname==='/v1/routes'&&request.method==='POST'){
   const {points,overview}=validateRoute(await readJson(request));if(!(await env.UPSTREAM_LIMITER.limit({key:'routes'})).success)fail(429,'provider_budget_limited');
   const path=points.map(p=>p.lon+','+p.lat).join(';'),target='https://router.project-osrm.org/route/v1/driving/'+path+'?overview='+overview+(overview==='full'?'&geometries=geojson':'&steps=false');
   const data=await limitedUpstream(fetchImpl,target);if(data.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)fail(502,'route_not_found');
   // Request coordinates and journeys are never written to D1.
   return reply({code:'Ok',routes:data.routes});
  }
  if(url.pathname==='/v1/places/search'&&request.method==='GET'){
   const q=(url.searchParams.get('q')||'').trim();if(q.length<2||q.length>80)fail(400,'invalid_query');if(!env.KAKAO_REST_API_KEY)fail(503,'search_not_configured');
   if(!(await env.UPSTREAM_LIMITER.limit({key:'places'})).success)fail(429,'provider_budget_limited');
   const auth={Authorization:'KakaoAK '+env.KAKAO_REST_API_KEY};const endpoint=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');endpoint.searchParams.set('query',q);endpoint.searchParams.set('size','15');
   let data=await limitedUpstream(fetchImpl,endpoint.toString(),{headers:auth});let places=(data.documents||[]).map(x=>({lat:+x.y,lon:+x.x,name:x.place_name,display:[x.place_name,x.road_address_name||x.address_name].join(' · ')}));
   if(!places.length){const address=new URL('https://dapi.kakao.com/v2/local/search/address.json');address.searchParams.set('query',q);data=await limitedUpstream(fetchImpl,address.toString(),{headers:auth});places=(data.documents||[]).map(x=>({lat:+x.y,lon:+x.x,name:x.address_name,display:x.address_name}));}
   return reply({version:1,places:places.filter(validPlace).slice(0,15)});
  }
  if(['/route','/v1/routes','/v1/catalog','/v1/chargers','/v1/restaurants','/v1/places/search'].includes(url.pathname))fail(405,'method_not_allowed');
  fail(404,'not_found');
 }catch(e){return reply({error:e instanceof ApiError?e.code:'internal_error'},e instanceof ApiError?e.status:500);}
}};}
export default createWorker();
