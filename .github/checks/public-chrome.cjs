const { chromium } = require('playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = 'https://yluby-a11y.github.io/nacs-map/';
const api = 'https://nacs-map-recommend-test.hoy-kim.workers.dev';

async function visibleImages(page) {
  return page.locator('#map').evaluate(map => {
    const box = map.getBoundingClientRect();
    const visible = element => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left < box.right && r.right > box.left &&
        r.top < box.bottom && r.bottom > box.top && getComputedStyle(element).visibility !== 'hidden';
    };
    return Array.from(map.querySelectorAll('img')).filter(visible).map(img => img.src);
  });
}

(async () => {
  let browser, stage = 'Chrome startup';
  const statuses = {};
  const pendingScripts = new Map();
  try {
    browser = await chromium.launch({channel:'chrome', headless:false});
    const page = await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
    // Only hostnames / numeric statuses are logged. Query strings may contain widget keys.
    page.on('request', r=>{
      if(r.resourceType()==='script')pendingScripts.set(r,new URL(r.url()).hostname);
    });
    page.on('requestfinished', r=>pendingScripts.delete(r));
    page.on('requestfailed', r=>{
      pendingScripts.delete(r);
      if(['script','document'].includes(r.resourceType())){
        const reason=(r.failure()?.errorText||'').match(/net::ERR_[A-Z_]+/)?.[0]||'failed';
        console.log('Browser resource failure',new URL(r.url()).hostname,reason);
      }
    });
    page.on('response', response => {
      const u = new URL(response.url());
      if (u.origin === api && ['/v1/auth/config','/v1/auth/session','/v1/catalog','/v1/chargers','/v1/restaurants'].includes(u.pathname))
        statuses[u.pathname] = response.status();
    });
    stage = 'load candidate at the public origin';
    await page.route(origin, async route => {
      try{
        const live=await route.fetch({timeout:30000});
        console.log('Production document HTTP',live.status());
        assert.equal(live.status(),200);
        await route.fulfill({response:live,body:fs.readFileSync('index.html')});
      }catch(error){
        console.log('Production document fetch or override failed',error.name);
        await route.abort('failed').catch(()=>{});
      }
    });
    await page.goto(origin,{waitUntil:'commit',timeout:45000});
    assert.equal(page.url(),origin);
    stage='candidate document title';
    await page.waitForFunction(()=>document.title.includes('V3.45'),null,{timeout:20000});
    console.log('Candidate version and public origin verified');
    stage='application scripts and map controls';
    await page.waitForFunction(()=>typeof loadServerCatalog==='function' && typeof courseMapDialog!=='undefined',null,{timeout:90000});
    await page.locator('#courseMapButton').click();
    stage = 'public authentication';
    await page.waitForFunction(()=>catalogSource==='d1'||catalogSource==='error'||
      document.querySelector('#apiVerification')?.dataset.interactive==='true',null,{timeout:70000});
    if(await page.locator('#apiVerification[data-interactive="true"]').count()) {
      console.log('A human verification is required in this independent Chrome session');
      throw new Error('interactive');
    }
    await page.waitForFunction(()=>catalogSource==='d1'&&items.length&&favorites.length,null,{timeout:45000});
    assert.equal(statuses['/v1/auth/session'],200);
    console.log('Real public session and both catalogs loaded');
    stage = 'charger and restaurant pins';
    const on = await visibleImages(page);
    await page.locator('#chargerMapToggle').click();
    const off = new Set(await visibleImages(page));
    await page.locator('#chargerMapToggle').click();
    const restored = await visibleImages(page);
    assert.ok(on.some(src=>!off.has(src)&&restored.includes(src)));
    await page.locator('#foodMapToggle').click();
    await page.waitForFunction(()=>{
      const map=document.querySelector('#map').getBoundingClientRect();
      return Array.from(document.querySelectorAll('#map .favorite-pin')).some(e=>{
        const b=e.getBoundingClientRect(); return b.width>0&&b.height>0&&b.left>=map.left&&b.right<=map.right&&b.top>=map.top&&b.bottom<=map.bottom;
      });
    });
    console.log('Both pin layers verified');
    stage = 'real route recommendation';
    await page.getByRole('button',{name:'코스 지도 닫기'}).click();
    await page.getByRole('textbox',{name:'출발지'}).fill('광주송정역');
    await page.getByRole('button',{name:'출발지 검색'}).click();
    await page.getByRole('button',{name:/^광주송정역 광주송정역/}).click();
    await page.getByRole('textbox',{name:'목적지'}).fill('석굴암 주차장');
    await page.getByRole('button',{name:'목적지 검색'}).click();
    await page.getByRole('button',{name:/^석굴암 주차장 석굴암/}).click();
    await page.getByRole('button',{name:'충전소 추천',exact:true}).click();
    const stop = page.locator('#list .card').filter({hasText:'거창휴게소 대구방향'});
    await stop.waitFor({state:'visible',timeout:90000});
    stage = 'one-click recovery';
    let interrupted=0, retried=0, offline=true;
    await page.route(url=>url.origin===api&&url.pathname==='/route'&&url.searchParams.has('waypoints'),async route=>{
      if(route.request().method()!=='GET')return route.continue();
      if(offline){interrupted++;return route.abort('internetdisconnected');}
      retried++;return route.continue();
    });
    await stop.getByRole('button',{name:'충전소 경유지 추가'}).click();
    const retry=page.getByRole('button',{name:'경로 계산 재시도'});
    await retry.waitFor({state:'visible',timeout:30000});
    offline=false;
    await retry.click();
    await page.waitForFunction(()=>!!currentSchedule?.places.some(p=>p.name.includes('거창휴게소 대구방향'))&&
      document.querySelector('#scheduleOutput')?.textContent.includes('거창휴게소 대구방향'),null,{timeout:35000});
    assert.ok(interrupted>0&&retried>0);
    console.log('PASS: travel card created after one retry');
  } catch (error) {
    console.error('Not passed at:',stage,error.name);
    console.log('Outstanding script hosts:',[...new Set(pendingScripts.values())].join(',')||'none');
    process.exitCode=1;
  } finally {
    console.log('Public API HTTP statuses:', JSON.stringify(statuses));
    if(browser)await browser.close();
  }
})().catch(()=>{process.exitCode=1;});
