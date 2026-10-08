import test from 'node:test';import assert from 'node:assert/strict';import {createWorker} from '../src/worker.mjs';
test('anonymous report validation, private read, bounded submission and SQL binding',async()=>{
 const writes=[],limiter={limit:async()=>({success:true})},env={ALLOWED_ORIGINS:'https://yluby-a11y.github.io',API_LIMITER:limiter,UPSTREAM_LIMITER:limiter,REPORT_LIMITER:limiter,DB:{prepare(sql){return {bind(...args){return {run:async()=>{writes.push({sql,args});}};}}}}};
 const worker=createWorker(),body={version:'V2.11',category:'return',platform:'PC',message:"QA 테스트 ' SQL"};
 const req=(b=body)=>new Request('https://api.test/v1/error-reports',{method:'POST',headers:{Origin:env.ALLOWED_ORIGINS,'CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json'},body:JSON.stringify(b)});
 let r=await worker.fetch(req(),env);assert.equal(r.status,201);assert((await r.json()).id);assert.equal(writes[1].args[4],body.message);assert(!writes[1].sql.includes(body.message));
 r=await worker.fetch(req({...body,location:{lat:1}}),env);assert.equal(r.status,400);
 r=await worker.fetch(req({...body,message:'x'.repeat(1501)}),env);assert.equal(r.status,400);
 r=await worker.fetch(new Request('https://api.test/v1/error-reports',{headers:{'CF-Connecting-IP':'192.0.2.1'}}),env);assert.equal(r.status,404);
 r=await worker.fetch(req(),{...env,REPORT_LIMITER:{limit:async()=>({success:false})}});assert.equal(r.status,429);
});

