import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createWorker} from '../src/worker.mjs';
const database=new DatabaseSync(':memory:');
for(const file of ['0001_catalog.sql','0002_initial_catalog.sql'])database.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
const DB={prepare(sql){return {bind(...args){return {all:async()=>({results:database.prepare(sql).all(...args)})};},first:async()=>database.prepare(sql).get()};}};
const env={DB,DEPLOYMENT_ENV:'staging',ALLOWED_ORIGINS:'https://yluby-a11y.github.io',API_LIMITER:{limit:async()=>({success:true})},UPSTREAM_LIMITER:{limit:async()=>({success:true})}};
const request=(path,{method='GET',body,origin='https://yluby-a11y.github.io',headers={}}={})=>new Request('https://fixture.workers.dev'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1',...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
test('D1 imports 195 chargers and 464 restaurants without changing coordinates',async()=>{
 assert.equal(database.prepare("SELECT COUNT(*) n FROM places WHERE kind='charger'").get().n,195);
 assert.equal(database.prepare("SELECT COUNT(*) n FROM places WHERE kind='restaurant'").get().n,464);
 assert.equal(database.prepare("SELECT COUNT(*) n FROM places WHERE kind='restaurant' AND latitude IS NOT NULL").get().n,462);
 assert.equal(database.prepare("SELECT COUNT(*) n FROM places WHERE kind='charger' AND navigation_verified=1").get().n,142);
 const worker=createWorker();const catalog=await worker.fetch(request('/v1/catalog'),env);assert.deepEqual(await catalog.json(),{version:'V2.9',chargers:195,restaurants:464});
 let cursor='',count=0;do{const res=await worker.fetch(request('/v1/restaurants?limit=100&cursor='+encodeURIComponent(cursor)),env);assert.equal(res.status,200);const body=await res.json();count+=body.places.length;cursor=body.nextCursor;}while(cursor);assert.equal(count,464);
 const injection=await worker.fetch(request('/v1/chargers?q='+encodeURIComponent("' OR 1=1 --")),env);assert.equal((await injection.json()).places.length,0);
 const wildcard=await worker.fetch(request('/v1/chargers?q=%25'),env);assert.equal((await wildcard.json()).places.length,0);
 assert.equal((await worker.fetch(request('/v1/chargers?limit=5000'),env)).status,400);
 assert.equal((await worker.fetch(request('/v1/chargers',{method:'POST',body:{}}),env)).status,405);
});
test('public API origin handling, limit failure and no anonymous writes',async()=>{
 const worker=createWorker();const denied=await worker.fetch(request('/v1/catalog',{origin:'https://untrusted.invalid'}),env);assert.equal(denied.status,403);assert(!denied.headers.has('Access-Control-Allow-Origin'));
 const ok=await worker.fetch(request('/v1/catalog'),env);assert.equal(ok.headers.get('Access-Control-Allow-Origin'),'https://yluby-a11y.github.io');assert.equal(ok.headers.get('Cache-Control'),'no-store');
 assert.equal((await worker.fetch(request('/v1/catalog'),{...env,API_LIMITER:null})).status,503);
 assert.equal((await worker.fetch(request('/v1/catalog'),{...env,API_LIMITER:{limit:async()=>({success:false})}})).status,429);
 assert.equal((await worker.fetch(request('/v1/routes',{method:'OPTIONS'}),env)).status,204);
 assert.equal((await worker.fetch(request('/v1/admin'),env)).status,404);
});
test('routes validate points and prevent arbitrary upstream URLs and huge bodies',async()=>{
 const calls=[];const worker=createWorker({fetchImpl:async(url)=>{calls.push(url);return Response.json({code:'Ok',routes:[{duration:123,distance:2000,geometry:{coordinates:[[126.85,35.16],[127.49,35.24]]}}]});}});
 const body={version:1,points:[{lat:35.16,lon:126.85},{lat:35.24,lon:127.49}],overview:'full'};
 const res=await worker.fetch(request('/v1/routes',{method:'POST',body}),env);assert.equal(res.status,200);assert.equal((await res.json()).routes[0].duration,123);assert(calls[0].startsWith('https://router.project-osrm.org/route/v1/driving/'));
 for(const invalid of [{...body,url:'http://127.0.0.1/'},{...body,points:[{lat:999,lon:0},body.points[1]]},{...body,points:[body.points[0]]},{...body,overview:'evil'}])assert.equal((await worker.fetch(request('/v1/routes',{method:'POST',body:invalid}),env)).status,400);
 assert.equal(calls.length,1);
 assert.equal((await worker.fetch(request('/v1/routes',{method:'POST',body:{...body,padding:'x'.repeat(5000)}}),env)).status,413);
 const failing=createWorker({fetchImpl:async()=>{throw Error('private provider credentials must never leak');}});const error=await failing.fetch(request('/v1/routes',{method:'POST',body}),env);assert.equal(error.status,502);assert(!JSON.stringify(await error.json()).includes('private'));
});
test('place search uses server secret, safe fixed host and sanitized result',async()=>{
 const calls=[];const worker=createWorker({fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({documents:[{place_name:'하이텍팜',x:'127.925',y:'36.982',road_address_name:'충북 충주시 테스트 주소'}]});}});
 const missing=await worker.fetch(request('/v1/places/search?q=하이텍팜'),env);assert.equal(missing.status,503);
 const res=await worker.fetch(request('/v1/places/search?q=하이텍팜'),{...env,KAKAO_REST_API_KEY:'fixture-not-a-credential'});assert.equal(res.status,200);const text=await res.text();assert(text.includes('하이텍팜'));assert(!text.includes('fixture-not-a-credential'));assert(calls[0].url.startsWith('https://dapi.kakao.com/v2/local/search/keyword.json'));assert.equal(calls[0].options.headers.Authorization,'KakaoAK fixture-not-a-credential');
 assert.equal((await worker.fetch(request('/v1/places/search?q=a'),env)).status,400);
});
