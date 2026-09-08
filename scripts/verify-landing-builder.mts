// Local builder regression: npm run build, then node --experimental-strip-types scripts/verify-landing-builder.mts
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
const output=mkdtempSync(join(tmpdir(),'mybookcms-a251-browser-'));
const mf=new Miniflare({name:'landing-browser-fixture',scriptPath:repo+'/dist/server/entry.mjs',modules:true,modulesRoot:repo+'/dist/server',modulesRules:[{type:'ESModule',include:['**/*.mjs','**/*.js']}],compatibilityDate:'2026-08-01',compatibilityFlags:['nodejs_compat'],bindings:{AUTH_SECRET:'fictional-a250-browser-root-secret-2026',PUBLIC_SITE_URL:origin,PUBLIC_SITE_LOCALE:'ms-MY'},assets:{directory:repo+'/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{OMS_DB:'landing-browser-fixture'},kvNamespaces:{SESSION:'landing-browser-fixture'},r2Buckets:{ASSET_BUCKET:'landing-browser-fixture'},host:'127.0.0.1',port:8897,cf:false,telemetry:{enabled:false}});
let ws: WebSocket | undefined, target: {id: string; webSocketDebuggerUrl: string} | undefined;
try {
 await mf.ready; const db=await mf.getD1Database('OMS_DB');
 const migrations=readdirSync(repo+'/src/db/migrations').filter(f=>f.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(repo+'/src/db/migrations/'+name,'utf8')}));
 await ensureSchemaUpgraded(db,{migrations,expected:migrations.length,cache:false});
 await db.batch(splitMigrationStatements(readFileSync(repo+'/scripts/seed-preview-local.sql','utf8')).map(sql=>db.prepare(sql)));
 await db.prepare('UPDATE stores SET site_url=? WHERE id=1').bind(origin).run();
 target=await (await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
 assert.ok(target);const socket=new WebSocket(target.webSocketDebuggerUrl);ws=socket;await new Promise<Event>((r,j)=>{socket.onopen=r;socket.onerror=j});
 let id=0;const pending=new Map();const exceptions: unknown[]=[];const responses: {url: string; status: number}[]=[]; let listMode='normal';
 const send=(method: string,params: Record<string, unknown>={})=>new Promise<any>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening'){send('Page.handleJavaScriptDialog',{accept:true});return;}if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});if(m.method==='Fetch.requestPaused'){const local=new URL(m.params.request.url).origin===origin;const proceed=()=>send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'BlockedByClient'})});const url=new URL(m.params.request.url);
     if(local&&((listMode==='fail-load'&&url.pathname.startsWith('/api/admin/landing-pages/')&&m.params.request.method==='GET')||(listMode==='fail-save'&&url.pathname.startsWith('/api/admin/landing-pages')&&m.params.request.method==='PUT')||(listMode==='fail-upload'&&url.pathname==='/api/admin/media'))){
    send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:'Fixture request unavailable.'})).toString('base64')});
   }else proceed();}};
 const ev=async (expression: string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async(expression: string,label=expression)=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}console.log(JSON.stringify({exceptions,responses:responses.filter(r=>r.url.includes('/api/')),diagnostic:await ev("JSON.stringify({inputs:[...document.querySelectorAll('input')].map(e=>({name:e.name,value:e.value})),text:document.body.innerText.slice(-1000)})")}));throw new Error('Timeout: '+label);};
 const nav=async (path: string)=>{await send('Page.navigate',{url:origin+path});await wait(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);};
 const fill=async(selector: string,value: string)=>{if(selector.startsWith('#lp-')&&await ev("Boolean(document.querySelector('[data-builder-view=settings]')?.getClientRects().length)"))await clickText('Pengaturan');return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field');e.focus();const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype: e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const clickText=async(text: string,selector='button')=>{await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length)`);await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length);e.scrollIntoView({block:"center"});e.click();})()`);};
 const screenshot=async (name: string)=>{await new Promise(r=>setTimeout(r,200));assert.ok(await ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),'page overflow');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(s.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
 const kv=await mf.getKVNamespace('SESSION'); const tokens: Record<string, string>={};
 for(const role of ['owner','admin','advertiser','customer_service'] as const){
  const username='fixture_'+role,updatedAt=new Date().toISOString();await db.prepare("INSERT INTO admin_credentials(username,password_hash,must_change_password,updated_at,role) VALUES(?,'fixture-disabled-hash',0,?,?)").bind(username,updatedAt,role).run();const {token,session}=await signJwt({username,role},'fictional-a250-browser-root-secret-2026');tokens[role]=token;await kv.put('admin-session:'+session.jti,JSON.stringify({username,role,must_change_password:false,credential_updated_at:updatedAt}),{expirationTtl:3600});
 }


 await send('Network.setCookie',{name:'mybook_session',value:tokens.owner,url:origin,httpOnly:true});
 await nav('/admin/landing-pages/new');
 await wait("document.querySelector('[data-landing-builder]')");
 await screenshot('new-mobile');
 assert.ok(await ev("document.querySelector('[data-builder-view=settings]').getAttribute('aria-pressed')==='true'&&document.querySelector('#lp-title').getClientRects().length>0"));
 await clickText('Konten');await clickText('Simpan halaman');await wait("document.querySelector('[role=alert]')");assert.ok(await ev("document.querySelector('[data-builder-view=settings]').getAttribute('aria-pressed')==='true'&&document.querySelector('#lp-title').getClientRects().length>0"),'required save opens settings');

 await fill('#lp-title','Fixture complete builder');
 await fill('#lp-slug','fixture-builder');
 await fill('#lp-title','Fixture complete builder updated');
 assert.equal(await ev("document.querySelector('#lp-slug').value"),'fixture-builder');
 const productId = await ev("document.querySelector('#lp-product option[value]:not([value=\"\"])').value");
 await fill('#lp-product',productId);
 await clickText('Konten');assert.equal(await ev("document.querySelector('#lp-title').getClientRects().length"),0);assert.ok(await ev("document.querySelector('[aria-label=\"Kanvas landing page\"]').getClientRects().length>0"));await screenshot('content-empty-mobile');await clickText('Pengaturan');assert.equal(await ev("document.querySelector('#lp-title').value"),'Fixture complete builder updated');

 const add=async(label: string,type: string)=>{if(await ev("Boolean(document.querySelector('[data-builder-view=content]')?.getClientRects().length)"))await clickText('Konten');if(await ev("!document.querySelector('[data-add-section]').open"))await clickText('Tambah bagian','summary');await clickText(label);await wait(`document.querySelector('[data-section-type="${type}"] fieldset')`);};
 await add('Judul','headline');await ev("document.querySelector('[data-add-section] summary').click()");await wait("!document.querySelector('[data-add-section]').open");await clickText('Hapus');await wait("!document.querySelector('[data-section-type]')&&document.activeElement===document.querySelector('[data-add-section] button')");
 await add('Judul','headline');await fill('[data-section-type=headline] textarea','A complete fixture landing page');await fill('[data-section-type=headline] select[id$="-align"]','center');await fill('[data-section-type=headline] select[id$="-size"]','large');await clickText('Selesai mengedit bagian');
 assert.ok(await ev("Boolean(document.querySelector('[aria-label=\"Urutan bagian\"] [aria-current=true]'))"));
 await ev("document.querySelector('details:has([aria-label=\"Urutan bagian\"]) summary').click()");await wait("document.querySelector('[aria-label=\"Urutan bagian\"] button').getClientRects().length>0");await ev("document.querySelector('[aria-label=\"Urutan bagian\"] button').click()");await wait("document.activeElement===document.querySelector('[data-section-type=headline] textarea')");assert.equal(await ev("document.querySelectorAll('[aria-label=\"Urutan bagian\"] [aria-current=true]').length"),1);await clickText('Selesai mengedit bagian');

 assert.equal(await ev("getComputedStyle(document.querySelector('.lp-headline')).textAlign"),'center');
 assert.equal(await ev("getComputedStyle(document.querySelector('.lp-headline')).fontSize"),'28px');
 await add('Paragraf','paragraph');await fill('[data-section-type=paragraph] textarea','Fixture paragraph\nSecond line');
 await add('Daftar bernomor','numbered_list');await fill('[data-section-type=numbered_list] textarea','First step\nSecond step');
 await add('Daftar poin','bullet_list');await fill('[data-section-type=bullet_list] textarea','First benefit\nSecond benefit');
 await add('Gambar','image');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
 const upload=async()=>ev(`(()=>{const bytes=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'fixture.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 listMode='fail-upload';await upload();await wait("document.querySelector('[data-section-type=image] [role=alert]')");
 listMode='normal';await upload();await wait("document.querySelector('[data-section-type=image] input[id$=\"-src\"]').value");
 const imageUrl=await ev("document.querySelector('[data-section-type=image] input[id$=\"-src\"]').value");
 await fill('[data-section-type=image] input[id$="-alt"]','Fixture image');
 listMode='fail-upload';await upload();await wait("document.querySelector('[data-section-type=image] [role=alert]')");assert.equal(await ev("document.querySelector('[data-section-type=image] input[id$=\"-src\"]').value"),imageUrl);listMode='normal';
 await add('HTML','html');await fill('[data-section-type=html] textarea','<p>{{product_name}} — {{product_price}}</p><img src=x onerror="window.fixtureXss=true"><script>window.fixtureXss=true</script>');await clickText('Selesai mengedit bagian');assert.equal(await ev('Boolean(window.fixtureXss)'),false);
 await add('Form checkout','form');
 const variantId=await ev("document.querySelector('[data-section-type=form] select option:not([value=\"\"])').value");
 await fill('[data-section-type=form] select',variantId);await fill('[data-section-type=form] input[id$="-title"]','Maklumat fixture');await fill('[data-section-type=form] input[id$="-button"]','Hantar fixture');
 // Reordering and duplication preserve all content, and deletion removes only the chosen copy.
 await ev("document.querySelector('[data-section-type=form] [title=Duplikat]').click()");await wait("document.querySelectorAll('[data-section-type=form]').length===2");
 await ev("[...document.querySelectorAll('[data-section-type=form]')].at(-1).querySelector('[title=Hapus]').click()");await wait("document.querySelectorAll('[data-section-type=form]').length===1");await wait("document.activeElement===document.querySelector('[data-section-type=form] select')");
 await ev("document.querySelector('[data-section-type=form] [title=Naik]').click()");
 await wait("document.querySelectorAll('[data-section-type]')[5].dataset.sectionType==='form'");
 await clickText('Preview');await screenshot('preview-mobile');
 await clickText('Simpan halaman');await wait("location.pathname.endsWith('/edit')&&document.querySelector('[data-landing-builder]')");
 const editPath=await ev('location.pathname');
 assert.ok(await ev("document.querySelector('[data-builder-view=content]').getAttribute('aria-pressed')==='true'&&document.querySelector('#lp-title').getClientRects().length===0&&!document.querySelector('[data-add-section]').open"),'existing mobile page starts in content with compact palette');

 const page=await db.prepare("SELECT * FROM landing_pages WHERE slug='fixture-builder'").first<any>();assert.ok(page);assert.equal(page.is_active,0);
 const rows=(await db.prepare('SELECT * FROM landing_sections WHERE landing_page_id=? ORDER BY sort_order').bind(page.id).all<any>()).results;assert.equal(rows.length,7);assert.equal(rows[5].type,'form');assert.equal(JSON.parse(rows[0].content_config).text,'A complete fixture landing page');assert.equal(JSON.parse(rows[4].content_config).src,imageUrl);
 assert.equal((await mf.dispatchFetch(origin+'/fixture-builder')).status,404,'anonymous draft hidden');
 for(const role of ['owner','admin','advertiser','customer_service']) assert.equal((await mf.dispatchFetch(origin+'/fixture-builder?preview=1',{headers:{Cookie:'mybook_session='+tokens[role]}})).status,role==='customer_service'?404:200,'draft preview role '+role);
 assert.equal((await mf.dispatchFetch(origin+'/fixture-builder?preview=1')).status,404);

 // Remove intentionally unsafe legacy HTML before opening its public operator-authored surface.
 await ev("document.querySelector('[data-section-type=html] [title=\"Edit bagian\"]').click()");await fill('[data-section-type=html] textarea','<p>{{product_name}} — {{product_price}}</p>');
 listMode='fail-save';await clickText('Simpan halaman');await wait("document.querySelector('[role=alert]')");assert.ok(await ev("document.querySelector('[data-section-type=html] textarea').value.includes('product_price')"));listMode='normal';await clickText('Simpan halaman');await wait("document.body.innerText.includes('Semua perubahan tersimpan')");
 await db.prepare('UPDATE landing_sections SET sort_order=sort_order*2 WHERE landing_page_id=?').bind(page.id).run();
 await db.prepare("INSERT INTO landing_sections(id,landing_page_id,sort_order,type,content_config,created_at,updated_at) SELECT 'fixture-adjacent-image',landing_page_id,sort_order+1,type,content_config,created_at,updated_at FROM landing_sections WHERE landing_page_id=? AND type='image'").bind(page.id).run();
 await nav('/fixture-builder?preview=1');await wait("document.querySelector('.lp-headline')");assert.equal(await ev("document.querySelector('.lp-headline').textContent"),'A complete fixture landing page');assert.ok(await ev("document.body.innerText.includes('Maklumat fixture')"));await fill('[name=customer_name]','Fixture Builder Buyer');await fill('[name=customer_phone]','60123456789');await fill('[name=address]','12 Fixture Road Kuala Lumpur');await fill('[data-location-search]','50450');await wait("document.querySelector('[data-location-results] [role=option], [role=listbox] [role=option]')");await ev("document.querySelector('[role=listbox] [role=option]').click()");await wait("document.querySelector('[data-submit-label]').textContent==='Hantar fixture'");await screenshot('public-draft');
 assert.equal(await ev("Boolean(document.querySelector('[data-privacy-notice]'))"),false);
 for(const width of [390,1280]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await wait("[...document.querySelectorAll('.lp-section > img:only-child')].every(img=>img.complete&&img.naturalWidth>0)");
  assert.ok(await ev("(()=>{const imgs=[...document.querySelectorAll('.lp-section > img:only-child')];if(imgs.length!==2)return false;const a=imgs[0].getBoundingClientRect(),b=imgs[1].getBoundingClientRect();return Math.abs(a.bottom-b.top)<1&&imgs.every(img=>{const s=getComputedStyle(img.parentElement),r=img.getBoundingClientRect();return ['paddingTop','paddingBottom','paddingLeft','paddingRight','marginTop','marginBottom'].every(k=>s[k]==='0px')&&getComputedStyle(img).borderRadius==='0px'&&Math.abs(r.width-img.parentElement.getBoundingClientRect().width)<1&&Math.abs(r.height/r.width-img.naturalHeight/img.naturalWidth)<0.01;});})()"),'full-width seamless images retain aspect ratio');
  await ev("document.querySelector('.lp-section > img:only-child').scrollIntoView({block:'start'})");await screenshot('seamless-images-'+width);
 }
 await db.prepare("DELETE FROM landing_sections WHERE id='fixture-adjacent-image'").run();

 listMode='fail-load';await nav(editPath);await wait("document.body.innerText.includes('Fixture request unavailable.')");assert.equal(await ev("Boolean(document.querySelector('#lp-title'))"),false);listMode='normal';await clickText('Coba muat lagi');await wait("document.querySelector('#lp-title')");
 for(const width of [390,1280]) {await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await send('Network.setCookie',{name:'sidebar_state',value:String(width===1280),url:origin});await nav(editPath);await wait("document.querySelector('[data-landing-builder]')");assert.equal(await ev("document.querySelector('#lp-title').getClientRects().length>0"),width===1280,'desktop shows settings while mobile content hides them');assert.ok(await ev("document.querySelector('[aria-label=\"Kanvas landing page\"]').getClientRects().length>0"));await screenshot('edit-'+width);await ev("document.querySelector('[data-section-type=headline] [title=\"Edit bagian\"]').click()");await wait("document.querySelector('[data-section-type=headline] textarea')");await ev("document.querySelector('[data-section-type=headline]').scrollIntoView({block:'start'})");await screenshot('canvas-edit-'+width);await clickText('Selesai mengedit bagian');assert.ok(await ev("[...document.querySelectorAll('[aria-label^=\"Aksi bagian\"]')].every(g=>{const a=[...g.children];return a.every(e=>e.getBoundingClientRect().width>=44&&Math.abs(e.getBoundingClientRect().top-a[0].getBoundingClientRect().top)<1)})"));}
 // Changing products clears explicit variants before save; the unsaved guard cancels leave events.
 const nextProduct=await ev("[...document.querySelector('#lp-product').options].find(o=>o.value&&o.value!==document.querySelector('#lp-product').value).value");
 await fill('#lp-product',nextProduct);assert.ok(await ev("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()"));await ev("document.querySelector('[data-section-type=form] [title=\"Edit bagian\"]').click()");assert.equal(await ev("document.querySelector('[data-section-type=form] select').value"),'');
 await fill('#lp-product',productId);await fill('[data-section-type=form] select',variantId);
 // Reordering loaded rows must replace their stored sort_order.
 await ev("document.querySelector('[data-section-type=form] [title=Turun]').click()");
 await clickText('Simpan halaman');await wait("document.body.innerText.includes('Semua perubahan tersimpan')");
 assert.equal((await db.prepare('SELECT type FROM landing_sections WHERE landing_page_id=? ORDER BY sort_order DESC LIMIT 1').bind(page.id).first<any>()).type,'form');
 await fill('#lp-status','active');await clickText('Simpan halaman');await wait("document.body.innerText.includes('Semua perubahan tersimpan')");assert.equal((await mf.dispatchFetch(origin+'/fixture-builder')).status,200,'published page available');
 await ev("document.querySelector('[data-section-type=bullet_list] [title=\"Edit bagian\"]').click()");await fill('[data-section-type=bullet_list] textarea','  Normalized benefit  \n\nSecond benefit');await fill('#lp-title','  Normalized fixture title  ');await clickText('Simpan halaman');await wait("document.body.innerText.includes('Semua perubahan tersimpan')");
 assert.equal(await ev("document.querySelector('#lp-title').value"),'Normalized fixture title');assert.ok(await ev("document.querySelector('[data-builder-view=content]').getAttribute('aria-pressed')==='true'"),'successful save returns to content');await ev("document.querySelector('[data-section-type=bullet_list] [title=\"Edit bagian\"]').click()");assert.equal(await ev("document.querySelector('[data-section-type=bullet_list] textarea').value"),'Normalized benefit\nSecond benefit');
 await db.prepare('DELETE FROM landing_pages WHERE id=?').bind(page.id).run();await fill('#lp-title','Retain after concurrent deletion');await clickText('Simpan halaman');await wait("document.querySelector('[role=alert]')");assert.equal(await ev("document.querySelector('#lp-title').value"),'Retain after concurrent deletion');assert.ok(await ev("document.body.innerText.includes('Perubahan belum disimpan')"));assert.ok(responses.some(r=>r.status===404&&r.url.includes('/api/admin/landing-pages/')));
 assert.deepEqual(exceptions,[]);
 const scripts=[...new Set(responses.filter(r=>r.url.includes('/_astro/')&&new URL(r.url).pathname.endsWith('.js')).map(r=>new URL(r.url).pathname))];const scriptGzip=scripts.reduce((total,path)=>total+gzipSync(readFileSync(repo+'/dist/client'+path)).length,0);
 assert.ok(scriptGzip<=200000,`Builder and public fixture JavaScript exceeds budget: ${scriptGzip}`);
 console.log(JSON.stringify({result:'PASS',scriptGzip,artifacts:output,sections:7,widths:[390,1280],checks:['typed-roundtrip','safe-preview','upload-retry','save-retry','load-retry','custom-slug','draft-visibility','reorder-duplicate-delete','public-checkout-copy']}));
} finally {ws?.close();if(target)await fetch(cdp+'/json/close/'+target.id).catch(()=>{});await mf.dispose();}
