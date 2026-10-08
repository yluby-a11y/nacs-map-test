import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../src/worker.mjs';
const request=path=>new Request('https://fixture.workers.dev'+path,{headers:{Origin:'https://yluby-a11y.github.io','CF-Connecting-IP':'192.0.2.1'}});
const env={ALLOWED_ORIGINS:'https://yluby-a11y.github.io',KAKAO_REST_API_KEY:'fixture-secret',API_LIMITER:{limit:async()=>({success:true})},UPSTREAM_LIMITER:{limit:async()=>({success:true})}};
const path='/route?origin=126.85,35.16&destination=129.33,35.79';
test('Kakao cache avoids repeated upstream calls and keeps priorities separate',async()=>{
 const stored=new Map(),cacheImpl={match:async key=>stored.get(key.url)?.clone(),put:async(key,res)=>stored.set(key.url,res.clone())};let calls=0;
 const worker=createWorker({cacheImpl,fetchImpl:async(url,opt)=>{calls++;assert.equal(new URL(url).hostname,'apis-navi.kakaomobility.com');assert.equal(opt.headers.Authorization,'KakaoAK fixture-secret');return Response.json({routes:[{result_code:0,summary:{distance:123,duration:456},sections:[]}]});}});
 for(let i=0;i<2;i++){const res=await worker.fetch(request(path),env);assert.equal(res.status,200);assert(!(await res.text()).includes('fixture-secret'));}assert.equal(calls,1);
 await worker.fetch(request(path+'&priority=DISTANCE'),env);assert.equal(calls,2);assert([...stored.keys()].every(x=>!x.includes('126.85')));
 assert.equal((await worker.fetch(request(path),{...env,API_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
test('Kakao coalesces simultaneous requests, validates five vias, and sanitizes errors',async()=>{
 let calls=0;const worker=createWorker({cacheImpl:null,fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return Response.json({routes:[{result_code:0,summary:{distance:1,duration:1},sections:[]}]});}});
 const results=await Promise.all([worker.fetch(request(path),env),worker.fetch(request(path),env)]);assert(results.every(r=>r.status===200));assert.equal(calls,1);
 const via='127.0,35.5';assert.equal((await worker.fetch(request(path+'&waypoints='+Array(5).fill(via).join('|')),env)).status,200);
 assert.equal((await worker.fetch(request(path+'&waypoints='+Array(6).fill(via).join('|')),env)).status,400);
 assert.equal((await worker.fetch(request(path+'&priority=HIGHWAY'),env)).status,400);
 assert.equal((await worker.fetch(request(path),{...env,UPSTREAM_LIMITER:{limit:async()=>({success:false})}})).status,429);
 const failure=createWorker({cacheImpl:null,fetchImpl:async()=>{throw Error('fixture-secret');}});const res=await failure.fetch(request(path),env);assert.equal(res.status,502);assert(!(await res.text()).includes('fixture-secret'));
});
