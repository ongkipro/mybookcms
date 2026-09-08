// Local admin regression: npm run build, then node --experimental-strip-types scripts/verify-expeditions-page.mts
// Written for A-270, after /admin/expeditions rendered as a bare shell. The cause
// was not this page: `wrangler dev` resolved the generated config's relative
// `assets.directory` against the ROOT wrangler.jsonc, so every /_astro/* chunk
// 404'd and no admin island could hydrate. The page assertions below would have
// caught it, and so would the asset assertion this script now makes first.
// Requires an existing local Chrome CDP endpoint. Uses only a fresh fictional Worker/D1/KV;
// closes its own tab and Worker. Never connects to the running store or an external provider.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {ensureSchemaUpgraded,splitMigrationStatements} from '../src/lib/schema-version.ts';
import {signJwt} from '../src/lib/auth.ts';
const repo=new URL('..', import.meta.url).pathname, origin='http://127.0.0.1:8899';
const cdp=process.env.CDP_URL || 'http://127.0.0.1:9396';
const secret='fictional-expeditions-browser-root-secret-2026';
const output=mkdtempSync(join(tmpdir(),'mybookcms-expeditions-'));
const mf=new Miniflare({name:'expeditions-browser-fixture',scriptPath:repo+'/dist/server/entry.mjs',modules:true,modulesRoot:repo+'/dist/server',modulesRules:[{type:'ESModule',include:['**/*.mjs','**/*.js']}],compatibilityDate:'2026-08-01',compatibilityFlags:['nodejs_compat'],bindings:{AUTH_SECRET:secret,PUBLIC_SITE_URL:origin,PUBLIC_SITE_LOCALE:'ms-MY'},assets:{directory:repo+'/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{OMS_DB:'expeditions-browser-fixture'},kvNamespaces:{SESSION:'expeditions-browser-fixture'},r2Buckets:{ASSET_BUCKET:'expeditions-browser-fixture'},host:'127.0.0.1',port:8899,cf:false,telemetry:{enabled:false}});
let ws: WebSocket | undefined, target: {id: string; webSocketDebuggerUrl: string} | undefined;
try {
 await mf.ready; const db=await mf.getD1Database('OMS_DB');
 const migrations=readdirSync(repo+'/src/db/migrations').filter(f=>f.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(repo+'/src/db/migrations/'+name,'utf8')}));
 await ensureSchemaUpgraded(db,{migrations,expected:migrations.length,cache:false});
 await db.batch(splitMigrationStatements(readFileSync(repo+'/scripts/seed-preview-local.sql','utf8')).map(sql=>db.prepare(sql)));
 await db.prepare('UPDATE stores SET site_url=? WHERE id=1').bind(origin).run();
 target=await (await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
 assert.ok(target);const socket=new WebSocket(target.webSocketDebuggerUrl);ws=socket;await new Promise<Event>((r,j)=>{socket.onopen=r;socket.onerror=j});
 let id=0;const pending=new Map();const exceptions: unknown[]=[];const consoleErrors: string[]=[];const responses: {url: string; status: number}[]=[];
 const send=(method: string,params: Record<string, unknown>={})=>new Promise<any>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);return;}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails);
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')consoleErrors.push(m.params.args.map((a: any)=>a.description||a.value).join(' '));
  if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});};
 const ev=async (expression: string)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression: string,label=expression)=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}
  console.log(JSON.stringify({exceptions,consoleErrors,api:responses.filter(r=>r.url.includes('/api/')),text:await ev('document.body.innerText.slice(0,800)')},null,1));throw new Error('Timeout: '+label);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 const kv=await mf.getKVNamespace('SESSION');
 const username='fixture_owner',updatedAt=new Date().toISOString();
 await db.prepare("INSERT INTO admin_credentials(username,password_hash,must_change_password,updated_at,role) VALUES(?,'fixture-disabled-hash',0,?,'owner')").bind(username,updatedAt).run();
 const {token,session}=await signJwt({username,role:'owner'},secret);
 await kv.put('admin-session:'+session.jti,JSON.stringify({username,role:'owner',must_change_password:false,credential_updated_at:updatedAt}),{expirationTtl:3600});
 await send('Network.setCookie',{name:'mybook_session',value:token,url:origin,httpOnly:true});

 // The defect this script was written for: the island's own chunk 404s and the
 // page renders as a shell with no error anywhere. Assert the asset layer first,
 // because a blank page is a confusing way to learn that assets are unmounted.
 const islandChunk=readdirSync(repo+'/dist/client/_astro').find(f=>f.startsWith('ExpeditionSettings')&&f.endsWith('.js'));
 assert.ok(islandChunk,'ExpeditionSettings client chunk missing from dist/client/_astro');
 assert.equal((await fetch(origin+'/_astro/'+islandChunk)).status,200,'the island chunk must be served, or no admin page can hydrate');

 for(const [width,height,label] of [[390,900,'mobile'],[1280,900,'desktop']] as const){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
  await send('Page.navigate',{url:origin+'/admin/expeditions'});
  await wait("location.pathname==='/admin/expeditions'&&document.readyState==='complete'",'page load '+label);
  // The island must actually mount and finish loading, not merely leave a shell.
  await wait("document.querySelectorAll('astro-island').length>0",'island to mount at '+label);
  await wait("!document.body.innerText.includes('Memuat')",'loading to settle at '+label);
  // A marker only this island renders. The page header contains "Zona", so a
  // text match on that is satisfied by the shell and proves nothing.
  await wait("Boolean(document.querySelector('[aria-label=\"Ringkasan shipping Malaysia\"]')||document.querySelector('[aria-label=\"Memuat tarif pengiriman\"]'))",'expeditions island to paint at '+label);
  await wait("!document.querySelector('[aria-label=\"Memuat tarif pengiriman\"]')",'expeditions load to settle at '+label);
  const text=await ev('document.body.innerText');
  assert.ok(text.includes('Zona & tarif pengiriman'),'page header missing at '+label);
  assert.ok(!/Data gagal dimuat|Pengaturan pengiriman gagal dimuat/.test(text),'load error shown at '+label+': '+text.slice(0,300));
  // Blank is the failure this script exists to catch: header present but the
  // island rendered nothing underneath it.
  const islandText=await ev("(document.querySelector('main')||document.body).innerText.replace(/\\s+/g,' ').trim().length");
  assert.ok(islandText>400,'expeditions island rendered almost nothing at '+label+' (len '+islandText+'): '+text.slice(0,400));
  assert.ok(await ev("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"),'page overflow at '+label);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(join(output,'expeditions-'+label+'.png'),Buffer.from(shot.data,'base64'));
 }
 assert.deepEqual(exceptions,[],'runtime exceptions');
 assert.deepEqual(consoleErrors,[],'console errors');
 const failed=responses.filter(r=>r.url.includes('/api/')&&r.status>=400);
 assert.deepEqual(failed,[],'failed API calls');
 console.log('expeditions page OK at 390 and 1280; screenshots in '+output);
} finally {
 if(ws) ws.close();
 if(target) await fetch(cdp+'/json/close/'+target.id).catch(()=>{});
 await mf.dispose();
}
