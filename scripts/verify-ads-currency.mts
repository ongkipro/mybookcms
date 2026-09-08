// Isolated Ads currency regression: npm run build, then node --experimental-strip-types scripts/verify-ads-currency.mts
// Requires an existing local Chrome CDP endpoint. Uses only a fresh fictional Worker/D1/KV;
// closes its own tab and Worker. Never connects to the running store or an external provider.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {ensureSchemaUpgraded,splitMigrationStatements} from '../src/lib/schema-version.ts';
import {signJwt} from '../src/lib/auth.ts';
import {prepareMetaCapiPayload} from '../src/lib/meta-capi.ts';
const repo=new URL('..', import.meta.url).pathname, origin='http://127.0.0.1:8897';
const cdp=process.env.CDP_URL || 'http://127.0.0.1:9396';
const output=mkdtempSync(join(tmpdir(),'mybookcms-a258-browser-'));
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
 let id=0;const pending=new Map();const exceptions: unknown[]=[];const responses: {url: string; status: number}[]=[]; const ingress: any[]=[];
 const send=(method: string,params: Record<string, unknown>={})=>new Promise<any>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening'){send('Page.handleJavaScriptDialog',{accept:true});return;}if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});if(m.method==='Fetch.requestPaused'){const local=new URL(m.params.request.url).origin===origin;const proceed=()=>send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'BlockedByClient'})});const url=new URL(m.params.request.url);
     if(local && url.pathname==='/api/meta-event'){
      ingress.push(JSON.parse(m.params.request.postData || '{}'));
      send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{"success":true}').toString('base64')});
   }else proceed();}};
 const ev=async (expression: string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async(expression: string,label=expression)=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}console.log(JSON.stringify({exceptions,responses:responses.filter(r=>r.url.includes('/api/')),diagnostic:await ev("JSON.stringify({inputs:[...document.querySelectorAll('input')].map(e=>({name:e.name,value:e.value})),text:document.body.innerText.slice(-1000)})")}));throw new Error('Timeout: '+label);};
 const nav=async (path: string)=>{await send('Page.navigate',{url:origin+path});await wait(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);};
 const screenshot=async (name: string)=>{await new Promise(r=>setTimeout(r,200));assert.ok(await ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),'page overflow');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(s.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
 const kv=await mf.getKVNamespace('SESSION'); const tokens: Record<string, string>={};
 for(const role of ['owner'] as const){
  const username='fixture_'+role,updatedAt=new Date().toISOString();await db.prepare("INSERT INTO admin_credentials(username,password_hash,must_change_password,updated_at,role) VALUES(?,'fixture-disabled-hash',0,?,?)").bind(username,updatedAt,role).run();const {token,session}=await signJwt({username,role},'fictional-a250-browser-root-secret-2026');tokens[role]=token;await kv.put('admin-session:'+session.jti,JSON.stringify({username,role,must_change_password:false,credential_updated_at:updatedAt}),{expirationTtl:3600});
 }


 await send('Network.setCookie',{name:'mybook_session',value:tokens.owner,url:origin,httpOnly:true});

 await db.prepare("UPDATE stores SET meta_pixel_id='1234567890', google_ads_conversion_id='AW-123456789', google_ads_conversion_label='fixture', google_tag_manager_id='GTM-FIXTURE' WHERE id=1").run();
 const product=await db.prepare("SELECT p.slug FROM products p INNER JOIN product_variants v ON v.product_id=p.id WHERE v.id=10002").first<any>();
 await nav('/produk/'+product.slug+'?variant_id=10002');
 await wait("window.fbq?.queue?.some(e=>e[0]==='track'&&e[1]==='ViewContent')");
 const view=await ev("(()=>{const e=window.fbq.queue.find(e=>e[0]==='track'&&e[1]==='ViewContent');return {data:e[2],id:e[3].eventID}})()");
 assert.equal(view.data.value,134890);assert.equal(view.data.currency,'IDR');assert.deepEqual(view.data.content_ids,['p10001-v10002']);
 assert.equal(ingress.find(e=>e.event_name==='ViewContent').value,32.9);
 assert.equal(ingress.find(e=>e.event_name==='ViewContent').event_id,view.id);
 assert.equal(await ev("Number(document.querySelector('[name=variant_id]:checked').dataset.price)"),3290);
 const xml=await (await fetch(origin+'/feed/google-catalog.xml')).text();
 assert.match(xml,/<g:sale_price>32.90 MYR<\/g:sale_price>/);
 for(const name of ['InitiateCheckout','Purchase']){
  await ev(`window.__MYBOOK_TRACK__(${JSON.stringify(name)}, {event_id:'fixture:'+ ${JSON.stringify(name)}, content_id:'p10001-v10002', order_number:'FIXTURE', value:32.9})`);
  await wait(`window.fbq.queue.some(e=>e[0]==='track'&&e[1]===${JSON.stringify(name)})`);
  const pixel=await ev(`(()=>{const e=window.fbq.queue.find(e=>e[0]==='track'&&e[1]===${JSON.stringify(name)});return {data:e[2],id:e[3].eventID}})()`);
  const server=await prepareMetaCapiPayload({eventName:name as 'InitiateCheckout'|'Purchase',eventId:pixel.id,eventSourceUrl:origin,customData:{value:32.9,contentIds:['p10001-v10002']}});
  assert.equal(server.data[0].custom_data.value,pixel.data.value);assert.equal(server.data[0].custom_data.currency,pixel.data.currency);
  assert.equal(server.data[0].event_id,pixel.id);
 }
 await ev("window.__MYBOOK_GOOGLE_PURCHASE__(32.9,'FIXTURE')");
 const google=await ev("(()=>{const e=[...window.dataLayer].reverse().find(e=>e[0]==='event'&&e[1]==='conversion');return e[2]})()");
 assert.deepEqual(google,{send_to:'AW-123456789/fixture',value:134890,currency:'IDR',transaction_id:'FIXTURE'});
 const gtm=await ev("window.dataLayer.find(e=>e.event==='purchase').ecommerce");
 assert.equal(gtm.value,134890);assert.equal(gtm.currency,'IDR');
 assert.equal(gtm.transaction_id,'FIXTURE');assert.equal(gtm.items[0].item_id,'p10001-v10002');
 const pageView=await ev("window.fbq.queue.find(e=>e[0]==='track'&&e[1]==='PageView')[2]");
 assert.equal(pageView.value,undefined);assert.equal(pageView.currency,undefined);
 for(const width of [390,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await nav('/admin/ads/meta');await wait("document.body.textContent.includes('Kurs tetap RM1 = Rp4.100')");await screenshot('meta-'+width);
  await nav('/admin/ads/google');
  assert.ok(await ev("document.body.textContent.includes('Purchase IDR')&&!document.body.textContent.includes('Purchase MYR')"));
  await ev("document.querySelector('#google-tab-inspector').click()");await wait("document.querySelector('#google-inspector').getClientRects().length");
  assert.ok(await ev("document.querySelector('#google-inspector').textContent.includes('134890')"));
  assert.ok(await ev("document.querySelector('#google-inspector').textContent.includes('IDR')"));await screenshot('google-'+width);
  await ev("document.querySelector('#google-inspector pre').scrollIntoView({block:'start'})");await screenshot('google-payload-'+width);
 }
 assert.deepEqual(exceptions,[]);
 console.log(JSON.stringify({result:'PASS',artifacts:output,checks:['Pixel-CAPI-IDR-parity','Google-GTM-IDR','MYR-ingress-price-XML','same-event-and-catalog-IDs','valueless-PageView','admin-390-1280']}));
} finally {
 if(target) await fetch(cdp+'/json/close/'+target.id).catch(()=>{});
 ws?.close();await mf.dispose();
}
