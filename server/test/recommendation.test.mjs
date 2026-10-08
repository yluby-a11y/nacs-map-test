import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('async function compareRouteCandidates('),html.indexOf('// Activate only after AdSense'));
const compareRouteCandidates=Function(source+';return compareRouteCandidates;')();
test('bounded comparisons retain candidate order despite out-of-order replies',async()=>{
 let active=0,peak=0,calls=0;
 const result=await compareRouteCandidates([0,1,2,3,4,5],async x=>{
  active++;peak=Math.max(peak,active);calls++;
  await new Promise(r=>setTimeout(r,x===0?20:1));active--;return {x};
 });
 assert.equal(peak,3);assert.equal(calls,6);assert.deepEqual(result.results.map(r=>r.x),[0,1,2,3,4,5]);assert.equal(result.failedQueries,0);
});
test('rate limits stop launching new requests and count unfinished candidates',async()=>{
 let calls=0;const result=await compareRouteCandidates(Array(24).fill(0),async()=>{calls++;const error=new Error('limit');error.status=429;throw error;});
 assert.equal(calls,3);assert.equal(result.failedQueries,24);assert.equal(result.failureMessage,'limit');
});
test('stale input and expired comparison budgets launch no new requests',async()=>{
 let calls=0;const run=async()=>{calls++;return true;};
 const stale=await compareRouteCandidates([1,2],run,{isCurrent:()=>false});assert.equal(stale.cancelled,true);
 const expired=await compareRouteCandidates([1,2],run,{deadline:Date.now()-1});assert.equal(expired.failedQueries,2);assert.equal(calls,0);
});
