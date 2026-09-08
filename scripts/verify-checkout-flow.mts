// Local checkout regression: npm run build, then node --experimental-strip-types scripts/verify-checkout-flow.mts
// Requires an existing local Chrome CDP endpoint. Uses only a fresh fictional Worker/D1/KV;
// closes its own tab and Worker. Never connects to the running store or an external provider.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {ensureSchemaUpgraded,splitMigrationStatements} from '../src/lib/schema-version.ts';
const repo=new URL('..', import.meta.url).pathname, origin='http://127.0.0.1:8897';
const cdp=process.env.CDP_URL || 'http://127.0.0.1:9396';
const output=mkdtempSync(join(tmpdir(),'mybookcms-a252-browser-'));
const mf=new Miniflare({name:'checkout-browser-fixture',scriptPath:repo+'/dist/server/entry.mjs',modules:true,modulesRoot:repo+'/dist/server',modulesRules:[{type:'ESModule',include:['**/*.mjs','**/*.js']}],compatibilityDate:'2026-08-01',compatibilityFlags:['nodejs_compat'],bindings:{AUTH_SECRET:'fictional-a250-browser-root-secret-2026',PUBLIC_SITE_URL:origin,PUBLIC_SITE_LOCALE:'ms-MY'},assets:{directory:repo+'/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{OMS_DB:'checkout-browser-fixture'},kvNamespaces:{SESSION:'checkout-browser-fixture'},r2Buckets:{ASSET_BUCKET:'checkout-browser-fixture'},host:'127.0.0.1',port:8897,cf:false,telemetry:{enabled:false}});
let ws: WebSocket | undefined, target: {id: string; webSocketDebuggerUrl: string} | undefined;
try {
 await mf.ready; const db=await mf.getD1Database('OMS_DB');
 const migrations=readdirSync(repo+'/src/db/migrations').filter(f=>f.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(repo+'/src/db/migrations/'+name,'utf8')}));
 await ensureSchemaUpgraded(db,{migrations,expected:migrations.length,cache:false});
 await db.batch(splitMigrationStatements(readFileSync(repo+'/scripts/seed-preview-local.sql','utf8')).map(sql=>db.prepare(sql)));
 await db.prepare('UPDATE stores SET site_url=? WHERE id=1').bind(origin).run();
 target=await (await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
 assert.ok(target);const socket=new WebSocket(target.webSocketDebuggerUrl);ws=socket;await new Promise<Event>((r,j)=>{socket.onopen=r;socket.onerror=j});
 let id=0;const pending=new Map();const exceptions: unknown[]=[];const responses: {url: string; status: number}[]=[]; let quoteMode='normal', paymentMode='normal', paymentRequests=0;
 const send=(method: string,params: Record<string, unknown>={})=>new Promise<any>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening'){send('Page.handleJavaScriptDialog',{accept:true});return;}if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});if(m.method==='Fetch.requestPaused'){const local=new URL(m.params.request.url).origin===origin;const proceed=()=>send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'BlockedByClient'})});const url=new URL(m.params.request.url);
     if(local&&url.pathname==='/api/payment-methods') {
      paymentRequests++;
      const methods=[{payment_method:'cod',name:'COD (Bayar di Tempat)',description:'Bayar tunai apabila bungkusan tiba',is_active:true},{payment_method:'manual_transfer',name:'Pindahan Bank Maybank',description:'a.n. Fixture Store',seller_bank_account_id:1,is_active:true},{payment_method:'doku',name:'DOKU',is_active:true,hosted_redirect:true,channels:[{code:'INTERNET_BANKING_FPX',label:'FPX'},{code:'EWALLET_TNG',label:"Touch 'n Go"},{code:'EWALLET_GRABPAY',label:'GrabPay'},{code:'EWALLET_SHOPEEPAY',label:'ShopeePay'},{code:'CREDIT_CARD',label:'Kad kredit/debit'}]}];
      send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:paymentMode==='fail'?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(paymentMode==='fail'?{success:false,error:'Fixture failure'}:{success:true,data:methods})).toString('base64')});
     } else if(local&&url.pathname==='/api/shipping-rates'&&quoteMode==='fail') {
      send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:'Fixture failure'})).toString('base64')});
     } else if(local&&url.pathname==='/api/shipping-rates'&&quoteMode==='slow')setTimeout(() => { void proceed().catch(error => { if (!/Invalid InterceptionId|Invalid interception|Invalid requestId/.test(error.message || '')) exceptions.push(error); }); },1000);else proceed();}};
 const ev=async (expression: string)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async(expression: string,label=expression)=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}console.log(JSON.stringify({exceptions,responses:responses.filter(r=>r.url.includes('/api/')),diagnostic:await ev("JSON.stringify({inputs:[...document.querySelectorAll('input')].map(e=>({name:e.name,value:e.value})),text:document.body.innerText.slice(-1000)})")}));throw new Error('Timeout: '+label);};
 const nav=async (path: string)=>{await send('Page.navigate',{url:origin+path});await wait(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);};
 const fill=async(selector: string,value: string)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field');e.focus();const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype: e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const clickText=async(text: string,selector='button')=>{await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length)`);await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute("title")===${JSON.stringify(text)})&&!e.disabled&&e.getClientRects().length);e.scrollIntoView({block:"center"});e.click();})()`);};
 const screenshot=async (name: string)=>{await new Promise(r=>setTimeout(r,200));assert.ok(await ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),'page overflow');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(s.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});

 const slug=(await db.prepare('SELECT slug FROM products WHERE id=(SELECT product_id FROM product_variants WHERE id=10001)').first<any>()).slug;
 const checkout='/full-form?product_id='+encodeURIComponent(slug)+'&variant_id=10001';
 const hidden="document.querySelector('[data-payment-content]').hidden&&document.querySelector('[data-payment-content]').disabled";
 const sectionHidden="document.querySelector('.checkout-payment').hidden&&getComputedStyle(document.querySelector('.checkout-payment')).display==='none'";
 const visible="!document.querySelector('[data-payment-content]').hidden&&document.querySelectorAll('[name=payment_method]').length===7";
 const pick=async(keyboard=false)=>{
  await fill('[data-location-search]','50450');await wait("document.querySelector('[role=listbox] [role=option]')");
  assert.ok(await ev(hidden),'typing a postcode is not a selected location');assert.ok(await ev(sectionHidden));
  if(keyboard){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}else await ev("document.querySelector('[role=listbox] [role=option]').click()");
 };
 for(const width of [390,1280]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await nav(checkout);await wait("document.querySelector('[data-payment-content]')");
  assert.ok(await ev(hidden));assert.ok(await ev(sectionHidden));assert.equal(await ev("Boolean(document.querySelector('[data-privacy-notice]'))"),false);
  assert.ok(await ev("(()=>{const s=getComputedStyle(document.querySelector('[data-summary-compare]'));return s.textDecorationLine.includes('line-through')&&s.fontWeight==='400';})()"),'summary comparison is muted and struck through');
  const requests=paymentRequests;await new Promise(r=>setTimeout(r,200));assert.equal(paymentRequests,requests,'no payment request before location');
  await ev("document.querySelector('[name=customer_name]').scrollIntoView({block:'start'})");await screenshot('contact-'+width);
  await fill('[name=customer_name]','Fixture Checkout Buyer');await fill('[name=customer_phone]','60123456789');await fill('[name=address]','12 Fixture Road Kuala Lumpur');
  quoteMode='slow';await pick(true);await wait("document.querySelector('[data-payment-stage-status]').textContent.includes('Sedang')");assert.ok(await ev(hidden));assert.equal(await ev(sectionHidden),false);await wait(visible);quoteMode='normal';
  assert.equal(paymentRequests,requests+1);assert.equal(await ev("document.querySelector('[data-total-title]').textContent"),'Jumlah bayaran');
  await ev("document.querySelector('[data-payment-content]').scrollIntoView({block:'start'})");await screenshot('payments-'+width);
  assert.equal(await ev("document.querySelectorAll('[name=payment_method][value=doku]').length"),5);
  await ev("document.querySelector('[data-doku-channel=EWALLET_TNG]').click()");await wait("!document.querySelector('[data-doku-details]').hidden");await fill('[name=customer_email]','fixture@example.test');
  assert.ok(await ev("document.querySelector('[name=customer_email]').required&&!document.querySelector('[name=customer_email]').disabled"));
  await fill('[name=customer_email]','invalid-email');await ev("document.querySelector('[data-location-change]').focus()");await wait("document.querySelector('[name=customer_email]').classList.contains('field-invalid')");await fill('[name=customer_name]','Fixture Checkout Buyer Updated');assert.ok(await ev("document.querySelector('[name=customer_email]').classList.contains('field-invalid')"),'unrelated field update preserves visible email error');await fill('[name=customer_email]','fixture@example.test');

  assert.ok(await ev("(()=>{const d=document.querySelector('[data-doku-details]');return d.parentElement.classList.contains('submit-panel')&&d.nextElementSibling.classList.contains('cta-row')&&!d.closest('[data-payment-content]');})()"),'receipt details immediately precede CTA');
  assert.ok(await ev("(()=>{const inputs=[...document.querySelectorAll('[data-malaysia-checkout] .form-field input,[data-malaysia-checkout] textarea,[data-malaysia-checkout] select')].filter(e=>e.getClientRects().length);return inputs.length>0&&inputs.every(e=>parseFloat(getComputedStyle(e).fontSize)>=16);})()"),'editable controls avoid sub-16px text');
  assert.ok(await ev("(()=>{const v=document.querySelector('meta[name=viewport]').content;return !v.includes('user-scalable=no')&&!v.includes('maximum-scale');})()"),'manual zoom remains available');
  assert.ok(await ev("(()=>{const d=document.querySelector('[data-doku-details]'),s=getComputedStyle(d),e=d.querySelector('input');return s.padding==='0px'&&s.borderWidth==='0px'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&Math.abs(e.getBoundingClientRect().width-d.getBoundingClientRect().width)<1&&d.querySelector('.doku-disclosure').nextElementSibling.matches('.doku-privacy-link');})()"),'clean receipt uses full-width input and disclosure before privacy without a decorated wrapper');
  await ev("document.querySelector('[name=customer_email]').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.ok(await ev("document.activeElement===document.querySelector('.doku-privacy-link')"),'email tab reaches privacy');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.ok(await ev("document.activeElement===document.querySelector('button[type=submit]')"),'privacy tab reaches submit');
  await ev("document.querySelector('[data-doku-details]').scrollIntoView({block:'center'})");await screenshot('doku-'+width);
  await clickText('Ubah');assert.ok(await ev(hidden));assert.ok(await ev(sectionHidden));assert.ok(await ev("document.querySelector('[name=customer_email]').disabled&&!document.querySelector('[name=customer_email]').required"));
  assert.equal(await ev("document.querySelector('[data-total-title]').textContent"),'Subtotal');
  quoteMode='slow';await pick();await wait("document.querySelector('[data-payment-stage-status]').textContent.includes('Sedang')");await clickText('Ubah');await new Promise(r=>setTimeout(r,1200));assert.ok(await ev(hidden),'stale shipping response cannot reopen payment');assert.equal(paymentRequests,requests+1);
  quoteMode='fail';await pick();await wait("!document.querySelector('[data-quote-retry]').hidden");assert.ok(await ev(hidden));await ev("document.querySelector('[data-payment-stage-status]').scrollIntoView({block:'center'})");await screenshot('shipping-error-'+width);
  quoteMode='normal';await ev("document.querySelector('[data-quote-retry]').click()");await wait(visible);
  assert.equal(await ev("document.querySelector('[name=payment_method]:checked').dataset.dokuChannel"),'EWALLET_TNG');assert.equal(await ev("document.querySelector('[name=customer_email]').value"),'fixture@example.test');assert.equal(paymentRequests,requests+1);
  // A changed variant immediately closes payment until its own quote completes.
  const radios=await ev("document.querySelectorAll('[name=variant_id]').length");
  assert.ok(radios>1,'fixture has a second variant');
  await fill('[name=customer_email]','invalid-email');await ev("document.querySelector('[data-location-change]').focus()");await wait("document.querySelector('[name=customer_email]').classList.contains('field-invalid')");await ev("document.querySelector('[name=customer_email]').focus()");
  quoteMode='slow';await ev("document.querySelector('[name=variant_id]:not(:checked)').click()");await wait(hidden);
  assert.ok(await ev("document.activeElement===document.querySelector('[data-location-change]')"),'hidden payment returns focus to visible location action');
  assert.ok(await ev("(()=>{const e=document.querySelector('[name=customer_email]');return !e.classList.contains('field-invalid')&&e.disabled&&!e.required&&!e.willValidate&&e.checkValidity();})()"),'hidden email clears feedback and does not block native validation');
  await wait(visible);assert.ok(await ev("(()=>{const v=document.querySelector('[name=variant_id]:checked'),c=document.querySelector('[data-summary-compare]');return c.textContent===new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(Number(v.dataset.compare)/100)&&getComputedStyle(c).textDecorationLine.includes('line-through');})()"),'comparison updates with selected variant');quoteMode='normal';assert.ok(await ev("document.querySelector('button[type=submit]').disabled"),'invalid retained email prevents submission after reopening');await fill('[name=customer_email]','fixture@example.test');

  await ev("document.querySelector('[name=customer_email]').focus()");
  await ev("document.querySelector('[name=payment_method][value=manual_transfer]').click()");assert.ok(await ev("document.querySelector('[data-doku-details]').hidden&&!document.querySelector('[name=customer_email]').required"));
  assert.ok(await ev("document.activeElement===document.querySelector('[name=payment_method]:checked')"),'hiding focused receipt returns focus to selected method');
  assert.ok(await ev("getComputedStyle(document.querySelector('[data-doku-details]')).display==='none'"),'non-DOKU details occupy no layout space');
 }
 paymentMode='fail';await nav(checkout);await wait("document.querySelector('[data-payment-content]')");await pick();await wait("!document.querySelector('[data-payment-retry]').hidden");await ev("document.querySelector('[data-payment-content]').scrollIntoView({block:'center'})");await screenshot('payment-error');paymentMode='normal';await ev("document.querySelector('[data-payment-retry]').click()");await wait(visible);
 // Shared PDP and embed entry points have the same initial payment gate.
 for(const path of ['/produk/'+slug,'/embed/form?product_id='+encodeURIComponent(slug)+'&variant_id=10001']){await nav(path);await wait("document.querySelector('[data-payment-content]')");assert.ok(await ev(hidden));}
 assert.deepEqual(exceptions,[]);
 const scripts=[...new Set(responses.filter(r=>r.url.includes('/_astro/')&&new URL(r.url).pathname.endsWith('.js')).map(r=>new URL(r.url).pathname))];const scriptGzip=scripts.reduce((total,path)=>total+gzipSync(readFileSync(repo+'/dist/client'+path)).length,0);
 console.log(JSON.stringify({result:'PASS',artifacts:output,widths:[390,1280],scriptGzip,paymentRequests,checks:['initial-hidden','selected-location-current-quote','keyboard-selection','shipping-retry','payment-retry','retained-channel-email','variant-invalidation','five-doku-channels','manual-transfer','pdp-embed-shared']}));
} finally {ws?.close();if(target)await fetch(cdp+'/json/close/'+target.id).catch(()=>{});await mf.dispose();}
