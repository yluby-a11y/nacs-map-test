import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createWorker} from '../src/worker.mjs';
const limiter={limit:async()=>({success:true})};
const env={ALLOWED_ORIGINS:'https://yluby-a11y.github.io',KAKAO_REST_API_KEY:'fixture',API_LIMITER:limiter,UPSTREAM_LIMITER:limiter};
const request=path=>new Request('https://qa.test'+path,{headers:{Origin:env.ALLOWED_ORIGINS,'CF-Connecting-IP':'192.0.2.1'}});
function cache(){const map=new Map();return {match:async k=>map.get(k.url)?.clone(),put:async(k,r)=>map.set(k.url,r.clone())};}
test('catalog 10000 simulated visitors, five pages each, across three edge caches reuse SQL',async()=>{
 let sql=0;const DB={prepare(){return {first:async()=>{sql++;await new Promise(r=>setTimeout(r,1));return {version:'V2.9',chargers:195,restaurants:464};},bind(){return {all:async()=>{sql++;await new Promise(r=>setTimeout(r,1));return {results:[{id:'fixture',payload:'{}'}]};}}}}}};
 const workers=Array.from({length:3},()=>createWorker({cacheImpl:cache()}));
 for(let offset=0;offset<10000;offset+=100){await Promise.all(Array.from({length:100},async(_,n)=>{for(const path of ['/v1/catalog','/v1/chargers?limit=200','/v1/restaurants?limit=200','/v1/restaurants?limit=200&cursor=200','/v1/restaurants?limit=200&cursor=400']){const r=await workers[(offset+n)%3].fetch(request(path),{...env,DB});assert.equal(r.status,200);await r.json();assert.equal(r.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGINS);}}));}
 assert.equal(sql,15);console.log('SIMULATION 50000 catalog page reads -> 15 SQL reads; mock transport/edge/limiter, not real Cloudflare throughput');
});
test('compact and full route share provider cache without changing distances',async()=>{
 let upstream=0;const full={result_code:0,summary:{distance:292000,duration:12000},sections:[{distance:146000,duration:6000,roads:[{vertexes:Array.from({length:4000},(_,i)=>i)}]},{distance:146000,duration:6000,roads:[]}]};
 const worker=createWorker({cacheImpl:cache(),fetchImpl:async()=>{upstream++;return Response.json({routes:[full]});}}),path='/route?origin=126.85,35.16&destination=129.33,35.79';
 const small=await worker.fetch(request(path+'&geometry=0'),env),big=await worker.fetch(request(path+'&geometry=1'),env),smallText=await small.text(),bigText=await big.text();
 assert.equal(upstream,1);assert.equal(JSON.parse(smallText).route.summary.distance,full.summary.distance);assert.deepEqual(JSON.parse(smallText).route.sections.map(x=>x.distance),full.sections.map(x=>x.distance));assert(!smallText.includes('vertexes'));assert(bigText.includes('vertexes'));assert(smallText.length<bigText.length/10);console.log('FIXTURE compact bytes',smallText.length,'full bytes',bigText.length);
});
test('atomic daily budget remains capped across worker instances and caches bypass spend',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE api_daily_budget(day TEXT,provider TEXT,calls INTEGER,PRIMARY KEY(day,provider));');
 const DB={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)}}}}};let upstream=0;
 const workers=Array.from({length:4},()=>createWorker({cacheImpl:null,fetchImpl:async()=>{upstream++;return Response.json({routes:[{result_code:0,summary:{distance:100,duration:10},sections:[]}]});}}));
 const results=await Promise.all(Array.from({length:100},(_,i)=>workers[i%4].fetch(request('/route?origin='+String(126+i/10000)+',35.16&destination=129.33,35.79'),{...env,DB,KAKAO_DIRECTIONS_DAILY_FREE_LIMIT:'20'})));
 assert.equal(results.filter(r=>r.status===200).length,20);assert.equal(results.filter(r=>r.status===429).length,80);assert.equal(upstream,20);assert.equal(db.prepare('SELECT calls FROM api_daily_budget').get().calls,20);db.close();
});

