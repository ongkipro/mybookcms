// Local UI regression: npm run build, then CDP_URL=http://127.0.0.1:9396 node --experimental-strip-types scripts/verify-checkout-recovery-ui.mts
// Requires an existing local Chrome CDP endpoint. Uses only a fresh fictional Worker/D1/KV;
// closes its own tab and Worker. Never connects to the running store or an external provider.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {ensureSchemaUpgraded,splitMigrationStatements} from '../src/lib/schema-version.ts';
import {signJwt} from '../src/lib/auth.ts';
const repo=new URL('..', import.meta.url).pathname, origin='http://127.0.0.1:8897';
const cdp=process.env.CDP_URL || 'http://127.0.0.1:9396';
const output=mkdtempSync(join(tmpdir(),'mybookcms-a250-browser-'));
const mf=new Miniflare({name:'lead-browser-fixture',scriptPath:repo+'/dist/server/entry.mjs',modules:true,modulesRoot:repo+'/dist/server',modulesRules:[{type:'ESModule',include:['**/*.mjs','**/*.js']}],compatibilityDate:'2026-08-01',compatibilityFlags:['nodejs_compat'],bindings:{AUTH_SECRET:'fictional-a250-browser-root-secret-2026',PUBLIC_SITE_URL:origin,PUBLIC_SITE_LOCALE:'ms-MY'},assets:{directory:repo+'/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{OMS_DB:'lead-browser-fixture'},kvNamespaces:{SESSION:'lead-browser-fixture'},r2Buckets:{ASSET_BUCKET:'lead-browser-fixture'},host:'127.0.0.1',port:8897,cf:false,telemetry:{enabled:false}});
let ws: WebSocket | undefined, target: {id: string; webSocketDebuggerUrl: string} | undefined;
try {
 await mf.ready; const db=await mf.getD1Database('OMS_DB');
 const migrations=readdirSync(repo+'/src/db/migrations').filter(f=>f.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(repo+'/src/db/migrations/'+name,'utf8')}));
 await ensureSchemaUpgraded(db,{migrations,expected:migrations.length,cache:false});
 await db.batch(splitMigrationStatements(readFileSync(repo+'/scripts/seed-preview-local.sql','utf8')).map(sql=>db.prepare(sql)));
 await db.prepare('UPDATE stores SET site_url=? WHERE id=1').bind(origin).run();
 target=await (await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
 assert.ok(target);const socket=new WebSocket(target.webSocketDebuggerUrl);ws=socket;await new Promise<Event>((r,j)=>{socket.onopen=r;socket.onerror=j});
 let id=0;const pending=new Map();const exceptions: unknown[]=[];const responses: {url: string; status: number}[]=[]; let listMode='slow', quoteFailure=false;
 const send=(method: string,params: Record<string, unknown>={})=>new Promise<any>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening'){send('Page.handleJavaScriptDialog',{accept:true});return;}if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});if(m.method==='Fetch.requestPaused'){const local=new URL(m.params.request.url).origin===origin;const proceed=()=>send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'BlockedByClient'})});const url=new URL(m.params.request.url);
   const list=url.pathname==='/api/admin/orders/leads'&&m.params.request.method==='GET';
   if(local&&((list&&listMode==='fail')||(url.pathname==='/api/shipping-rates'&&quoteFailure))){
    send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:'Fixture request unavailable.'})).toString('base64')});
   }else if(list&&listMode==='slow')setTimeout(proceed,600);else proceed();}};
 const ev=async (expression: string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async(expression: string,label=expression)=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}console.log(JSON.stringify({exceptions,responses:responses.filter(r=>r.url.includes('/api/')),diagnostic:await ev("JSON.stringify({inputs:[...document.querySelectorAll('input')].map(e=>({name:e.name,value:e.value})),text:document.body.innerText.slice(-1000)})")}));throw new Error('Timeout: '+label);};
 const nav=async (path: string)=>{await send('Page.navigate',{url:origin+path});await wait(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);};
 const fill=async(selector: string,value: string)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field');e.focus();const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype: e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const clickText=async(text: string,selector='button')=>{await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length)`);await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length);e.scrollIntoView({block:"center"});e.click();})()`);};
 const screenshot=async (name: string)=>{await new Promise(r=>setTimeout(r,200));assert.ok(await ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),'page overflow');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(s.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
 const kv=await mf.getKVNamespace('SESSION'); const tokens: Record<string, string>={};
 for(const role of ['owner','admin','advertiser','customer_service'] as const){
  const username='fixture_'+role,updatedAt=new Date().toISOString();await db.prepare("INSERT INTO admin_credentials(username,password_hash,must_change_password,updated_at,role) VALUES(?,'fixture-disabled-hash',0,?,?)").bind(username,updatedAt,role).run();const {token,session}=await signJwt({username,role},'fictional-a250-browser-root-secret-2026');tokens[role]=token;await kv.put('admin-session:'+session.jti,JSON.stringify({username,role,must_change_password:false,credential_updated_at:updatedAt}),{expirationTtl:3600});
 }

 const name='Fixture Recovery Customer With A Long Name';
 const product='Fixture journal for daily planning and reflective writing with a long product title';
 const variant='A5 hardcover edition with an extended variant description';
 await db.prepare("UPDATE products SET title=? WHERE id=(SELECT product_id FROM product_variants WHERE id=10001)").bind(product).run();
 await db.prepare('UPDATE product_variants SET title=? WHERE id=10001').bind(variant).run();
 await db.prepare("INSERT INTO checkout_leads(capture_token,customer_name,customer_phone,variant_id,created_at,updated_at) VALUES(?,?,?,10001,?,?)").bind('a'.repeat(64),name,'60123456701',new Date().toISOString(),new Date().toISOString()).run();
 await send('Network.setCookie',{name:'mybook_session',value:tokens.owner,url:origin,httpOnly:true});
 await db.prepare("UPDATE checkout_leads SET follow_up_note='Fixture legacy note.'").run();
 const hasRows="document.body?.innerText.includes('Fixture Recovery Customer')";
 const settled="document.body?.innerText.includes('1 lead ditemukan')";
 const queue='/admin/orders/abandoned';
 for(const width of [390,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await send('Network.setCookie',{name:'sidebar_state',value:String(width===1280),url:origin});
  listMode='slow';await nav(queue);
  await wait("document.querySelector('[data-slot=skeleton]')");await screenshot('loading-'+width);
  await wait(settled);listMode='normal';await screenshot('queue-'+width);
  assert.ok(await ev("[...document.querySelectorAll('[role=group][aria-label^=\"Aksi LEAD-\"]')].filter(g=>g.getClientRects().length).every(g=>{const a=[...g.children];return a.length===3&&a.every(e=>!e.textContent.trim()&&e.getAttribute('aria-label')&&e.getAttribute('title')&&e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44&&Math.abs(e.getBoundingClientRect().top-a[0].getBoundingClientRect().top)<1)})"),'icon actions stay on one line');
  assert.ok(await ev("[...document.querySelectorAll('button, a[href*=\"wa.me\"], input[type=search], select')].filter(e=>e.getClientRects().length&&e.closest('section')&&!e.closest('[data-sidebar]')).every(e=>e.getBoundingClientRect().height>=44)"),'queue action targets');
  listMode='fail';await clickText('Muat ulang');await wait("document.querySelector('[role=alert]')");
  assert.ok(await ev(hasRows));assert.ok(await ev("document.body.innerText.includes('Menampilkan hasil sebelumnya.')"));await screenshot('refresh-error-'+width);
  listMode='normal';await clickText('Coba lagi');await wait(settled);
  const before=responses.filter(r=>r.url.includes('/api/admin/orders/leads?')).length;
  await fill('input[aria-label="Cari pesanan tertinggal"]','zz');await fill('input[aria-label="Cari pesanan tertinggal"]','zzz');await fill('input[aria-label="Cari pesanan tertinggal"]','zzzz');
  await wait("document.body?.innerText.includes('Tidak ada lead yang cocok')");assert.equal(responses.filter(r=>r.url.includes('/api/admin/orders/leads?')).length-before,1,'search debounce');await screenshot('filtered-empty-'+width);
  await clickText('Atur ulang filter');await wait(settled);
  const priorStatus=await db.prepare('SELECT follow_up_status FROM checkout_leads').first();
  await clickText('Ubah status');await wait("document.querySelector('[role=dialog] select')");
  assert.deepEqual(await ev("[...document.querySelector('[role=dialog] select').options].map(o=>o.textContent)"),['Sudah dihubungi','Jadikan pesanan']);
  await fill('[role=dialog] select','convert');await wait("document.querySelector('[role=dialog] input[type=tel]')");
  await wait("document.activeElement===document.querySelector('[role=dialog] input')");await clickText('Batal');
  assert.deepEqual(await db.prepare('SELECT follow_up_status FROM checkout_leads').first(),priorStatus,'cancelled conversion preserves status');
  await clickText('Ubah status');await wait("document.querySelector('[role=dialog] select')");
  assert.equal(await ev("document.querySelector('[role=dialog] textarea')===null"),true);
  await ev("document.querySelector('[role=dialog] select').focus()");await screenshot('status-'+width);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await ev('document.activeElement.textContent.trim()'),'Batal');
  await clickText('Simpan status');await wait("!document.querySelector('[role=dialog]')&&document.body?.innerText.includes('Sudah dihubungi')");
  assert.equal((await db.prepare('SELECT follow_up_status FROM checkout_leads').first<{follow_up_status: string}>())?.follow_up_status,'contacted');
  assert.equal((await db.prepare('SELECT follow_up_note FROM checkout_leads').first<{follow_up_note: string}>())?.follow_up_note,'Fixture legacy note.');
  await clickText('Jadikan pesanan');await wait("document.querySelector('[role=dialog] input[type=search]')");
  quoteFailure=true;await fill('[role=dialog] textarea','12 Fixture Street, Kuala Lumpur');await fill('[role=dialog] input[type=search]','50450');await wait("document.querySelector('[role=dialog] [role=option]')");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('[role=dialog]')?.innerText.includes('Tarif belum tersedia')");assert.equal(await ev("document.querySelector('[role=dialog]').innerText.includes('Memuat tarif…')"),false);
  await ev("document.querySelector('[role=dialog]').scrollTop=document.querySelector('[role=dialog]').scrollHeight");await screenshot('quote-error-'+width);quoteFailure=false;await clickText('Coba tarif lagi');await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Buat pesanan COD'&&!b.disabled)");
  assert.equal(await ev("document.querySelector('[role=dialog] textarea').value"),'12 Fixture Street, Kuala Lumpur');await ev("document.querySelector('[role=dialog]').scrollTop=document.querySelector('[role=dialog]').scrollHeight");await screenshot('convert-'+width);await clickText('Batal');
 }
 listMode='fail';await nav(queue);await wait("document.body?.innerText.includes('Daftar belum tersedia.')");assert.equal(await ev("document.body.innerText.includes('0 lead ditemukan')"),false);
 listMode='normal';await clickText('Coba lagi');await wait(settled);
 await db.prepare('UPDATE stores SET is_cod_enabled=0 WHERE id=1').run();await db.prepare('UPDATE product_variants SET stock=0 WHERE id=10001').run();
 await clickText('Muat ulang');await wait(settled);await clickText('Jadikan pesanan');await wait("document.body?.innerText.includes('COD sedang dinonaktifkan')");assert.ok(await ev("document.body.innerText.includes('Stok varian habis')"));await ev("document.querySelector('[role=dialog]').scrollTop=document.querySelector('[role=dialog]').scrollHeight");await screenshot('unavailable');await clickText('Batal');
 await db.prepare('UPDATE stores SET is_cod_enabled=1 WHERE id=1').run();await db.prepare('UPDATE product_variants SET stock=80 WHERE id=10001').run();await clickText('Muat ulang');await wait(settled);
 await clickText('Jadikan pesanan');await wait("document.querySelector('[role=dialog] textarea')");await fill('[role=dialog] textarea','12 Fixture Street, Kuala Lumpur');await fill('[role=dialog] input[type=search]','50450');await wait("document.querySelector('[role=dialog] [role=option]')");await ev("document.querySelector('[role=dialog] [role=option]').click()");await clickText('Buat pesanan COD');await wait("document.body?.innerText.includes('Belum ada pesanan tertinggal')");await screenshot('true-empty');
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM orders').first<{n: number}>())?.n,1);
 assert.deepEqual(exceptions,[]);assert.deepEqual(responses.filter(r=>r.status>=400&&r.status!==503),[]);
 const scripts=[...new Set(responses.filter(r=>r.url.includes('/_astro/')&&new URL(r.url).pathname.endsWith('.js')).map(r=>new URL(r.url).pathname))];
 const scriptGzip=scripts.reduce((total,path)=>total+gzipSync(readFileSync(repo+'/dist/client'+path)).length,0);
 // Local regression budget for the full shared shell + recovery island, not a Core Web Vitals score.
 assert.ok(scriptGzip<=180000,`Recovery page JavaScript gzip budget exceeded: ${scriptGzip} bytes`);
 console.log(JSON.stringify({scriptGzip,result:'PASS',widths:[390,1280],states:['loading','refresh-error','initial-error','filtered-empty','true-empty','two-choice-status','cancelled-conversion','quote-error','conversion','cod-stock-disabled'],searchDebounce:true,artifacts:output}));
}finally{ws?.close();if(target)await fetch(cdp+'/json/close/'+target.id).catch(()=>{});await mf.dispose();}
