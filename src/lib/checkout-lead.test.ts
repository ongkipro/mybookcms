import assert from 'node:assert/strict';
import test, {before, after} from 'node:test';
import {mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getPlatformProxy, type PlatformProxy} from 'wrangler';
import {splitMigrationStatements} from './schema-version.ts';
import {captureCheckoutLead, captureLeadSchema, convertCheckoutLead, convertLeadSchema} from './checkout-lead.ts';
import {POST as capture, ALL as captureMethod} from '../pages/api/checkout-lead.ts';
import {GET, POST, PATCH} from '../pages/api/admin/orders/leads.ts';
import {persistOrder} from './order-persistence.ts';
import {canAccessAdminRoute} from './auth.ts';

let platform: PlatformProxy<{OMS_DB: D1Database; SESSION: KVNamespace}>;
let db: D1Database; let directory: string;
before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'mybook-leads-'));
  const configPath = join(directory, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify({name:'leads-fixture', compatibility_date:'2026-08-01', kv_namespaces:[{binding:'SESSION', id:'fixture'}], d1_databases:[{binding:'OMS_DB', database_name:'fixture', database_id:'00000000-0000-4000-8000-000000000250'}]}));
  platform = await getPlatformProxy({configPath, envFiles:[], persist:false, remoteBindings:false}); db = platform.env.OMS_DB;
  const path = new URL('../db/migrations/', import.meta.url);
  for (const name of readdirSync(path).filter(f => f.endsWith('.sql')).sort()) await db.batch(splitMigrationStatements(readFileSync(new URL(name, path), 'utf8')).map(sql => db.prepare(sql)));
  await db.batch(splitMigrationStatements(readFileSync(new URL('../../scripts/seed-preview-local.sql', import.meta.url), 'utf8')).map(sql => db.prepare(sql)));
});
after(async () => {await platform?.dispose(); if(directory) rmSync(directory, {recursive:true, force:true});});
const token = () => crypto.randomUUID().replaceAll('-', '').repeat(2);
const identity = {customer_name:'Fixture Buyer', customer_phone:'60123456789', variant_id:10001};
const locals = (role='owner') => ({runtimeEnv:platform.env, admin:{username:'fixture_operator', role}} as unknown as App.Locals);
const row = (submitToken: string) => db.prepare('SELECT * FROM checkout_leads WHERE capture_token = ?').bind(submitToken).first<{id:number; converted_at:string|null; converted_order_id:number|null; customer_name:string; follow_up_note:string}>();
const conversion = (id: number) => ({...identity, id, address:'12 Fixture Street, Kuala Lumpur', location_id:1398, shipping_cost:800});
const context = (body: unknown, role='owner') => ({locals:locals(role), url:new URL('https://fixture.invalid/api/admin/orders/leads'), request:new Request('https://fixture.invalid/api/admin/orders/leads', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})} as Parameters<typeof POST>[0]);
const captureContext = (body: unknown, headers = {}) => ({locals:locals(), request:new Request('https://fixture.invalid/api/checkout-lead', {method:'POST', headers:{'Content-Type':'application/json', ...headers}, body:JSON.stringify(body)})} as Parameters<typeof capture>[0]);
async function counts() {return db.prepare('SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT stock FROM product_variants WHERE id=10001) AS stock, (SELECT COUNT(*) FROM capi_event_outbox) AS events, (SELECT COUNT(*) FROM payment_attempts) AS attempts, (SELECT COUNT(*) FROM order_items) AS items, (SELECT COALESCE(SUM(total_amount),0) FROM orders) AS revenue').first<{orders:number; stock:number; events:number; attempts:number; items:number; revenue:number}>();}

test('capture validates identity, bounds public requests, and never returns personal data', async () => {
  for (const change of [{customer_name:'1'}, {customer_phone:'628123456789'}, {variant_id:0}, {submit_token:'guess'}, {website:'bot'}]) {
    assert.equal((await capture(captureContext({...identity, submit_token:token(), ...change}))).status, 422);
  }
  assert.equal((await capture(captureContext({...identity, submit_token:token()}, {origin:'https://foreign.invalid'}))).status,403);
  assert.equal((await capture(captureContext({oversized:'x'.repeat(5000)}))).status,413);
  assert.equal((await captureMethod({} as never)).status,405);
  const response = await capture(captureContext({...identity, submit_token:token()}));
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(), {success:true});
  assert.equal(convertLeadSchema.safeParse({...conversion(1), address:'short'}).success,false);
  assert.equal(captureLeadSchema.safeParse({...identity, submit_token:token(), customer_name:'x'.repeat(101)}).success,false);
});

test('capture upserts one lead without orders, stock reservation, or Purchase', async () => {
  const submit_token=token(), before=await counts();
  await Promise.all([captureCheckoutLead(db,{...identity,submit_token}), captureCheckoutLead(db,{...identity,submit_token})]);
  await captureCheckoutLead(db,{...identity,submit_token,customer_name:'Fixture Updated'});
  assert.equal((await row(submit_token))?.customer_name,'Fixture Updated');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM checkout_leads WHERE capture_token=?').bind(submit_token).first<{n:number}>())?.n,1);
  assert.deepEqual(await counts(),before);
});

test('CS conversion is replay-safe and concurrent attempts reserve one item once', async () => {
  const submit_token=token(); await captureCheckoutLead(db,{...identity,submit_token}); const lead=await row(submit_token); assert.ok(lead);
  const before=await counts(); assert.ok(before);
  const [a,b]=await Promise.all([convertCheckoutLead(db,conversion(lead.id)),convertCheckoutLead(db,conversion(lead.id))]);
  assert.equal(a.order_number,b.order_number);
  assert.deepEqual(await counts(),{...before, orders:before.orders+1, stock:before.stock-1, items:before.items+1, revenue:before.revenue+3290});
  assert.ok((await row(submit_token))?.converted_at);
  await captureCheckoutLead(db,{...identity,submit_token,customer_name:'Must Not Reopen'});
  assert.equal((await row(submit_token))?.customer_name,identity.customer_name);
  assert.equal((await convertCheckoutLead(db,conversion(lead.id))).already_converted,true);
});

test('failed stock write rolls back order and lead conversion; disabled COD and stale quote leave lead intact', async () => {
  const submit_token=token(); await captureCheckoutLead(db,{...identity,submit_token}); const lead=await row(submit_token); assert.ok(lead);
  const before=await counts();
  await db.prepare("CREATE TRIGGER fixture_reject_stock BEFORE UPDATE OF stock ON product_variants BEGIN SELECT RAISE(ABORT,'INSUFFICIENT_STOCK'); END;").run();
  try {await assert.rejects(convertCheckoutLead(db,conversion(lead.id)),/Stok/);} finally {await db.prepare('DROP TRIGGER fixture_reject_stock').run();}
  assert.equal((await row(submit_token))?.converted_at,null); assert.deepEqual(await counts(),before);
  await db.prepare('UPDATE stores SET is_cod_enabled=0 WHERE id=1').run();
  try {await assert.rejects(convertCheckoutLead(db,conversion(lead.id)),/COD/);} finally {await db.prepare('UPDATE stores SET is_cod_enabled=1 WHERE id=1').run();}
  await assert.rejects(convertCheckoutLead(db,{...conversion(lead.id),shipping_cost:0}),/Tarif berubah/);
  assert.equal((await row(submit_token))?.converted_at,null); assert.deepEqual(await counts(),before);
});

test('buyer checkout atomically resolves a captured lead and late capture cannot recreate it', async () => {
  const submit_token=token(); await captureCheckoutLead(db,{...identity,submit_token});
  const order=await persistOrder(db,{submitToken:submit_token, customerName:identity.customer_name,customerPhone:identity.customer_phone,variantKey:'10001',quantity:1, address:'12 Fixture Street',district:'Kuala Lumpur',city:'Kuala Lumpur',province:'W.P. Kuala Lumpur',shippingCost:800,paymentMethod:'cod'});
  assert.equal((await row(submit_token))?.converted_order_id,order.id);
  const late=token(); await persistOrder(db,{submitToken:late, customerName:identity.customer_name,customerPhone:identity.customer_phone,variantKey:'10001',quantity:1, address:'12 Fixture Street',district:'Kuala Lumpur',city:'Kuala Lumpur',province:'W.P. Kuala Lumpur',shippingCost:800,paymentMethod:'cod'});
  await captureCheckoutLead(db,{...identity,submit_token:late}); assert.equal(await row(late),null);
});

test('admin lead routes allow operational roles, deny advertiser, and never expose capture tokens', async () => {
  for (const role of ['owner','admin','customer_service']) {
    assert.equal(canAccessAdminRoute(role as 'owner','/admin/orders/abandoned'),true);
    assert.equal(canAccessAdminRoute(role as 'owner','/api/admin/orders/leads'),true);
    const response=await GET(context({},role)); assert.equal(response.status,200);
    const body=await response.json() as {data:Record<string,unknown>[]};
    assert.ok(body.data.every(r=>!('capture_token' in r)&&!('converted_order_id' in r)));
  }
  for (const handler of [GET,POST,PATCH]) assert.equal((await handler(context({},'advertiser'))).status,403);
  const submit_token=token(); await captureCheckoutLead(db,{...identity,submit_token}); const lead=await row(submit_token);assert.ok(lead);
  const updated=await PATCH(context({id:lead.id,follow_up_status:'contacted',follow_up_note:'Fixture note'},'customer_service'));
  assert.equal(updated.status,200);assert.equal((await row(submit_token))?.follow_up_note,'Fixture note');
  await db.prepare('UPDATE checkout_leads SET follow_up_note = ? WHERE id = ?').bind('Newer server note',lead.id).run();
  assert.equal((await PATCH(context({id:lead.id,follow_up_status:'contacted'},'customer_service'))).status,200);
  assert.equal((await row(submit_token))?.follow_up_note,'Newer server note','status-only updates preserve the current server note');
  assert.equal((await PATCH(context({id:lead.id,follow_up_status:'bogus',follow_up_note:''}))).status,422);
  const converted=await POST(context(conversion(lead.id),'customer_service'));assert.equal(converted.status,200);
  const list=await (await GET(context({}))).json() as {data:{id:number}[]}; assert.ok(list.data.every(r=>r.id!==lead.id));
  assert.equal((await PATCH(context({id:lead.id,follow_up_status:'new',follow_up_note:''}))).status,409);
});

test('public capture enforces the 30 per minute IP limit with retry headers', async () => {
  const input={...identity,submit_token:token()}, headers={'CF-Connecting-IP':'192.0.2.250'};
  for(let i=0;i<30;i++) assert.equal((await capture(captureContext(input,headers))).status,200);
  const before=await counts();
  const denied=await capture(captureContext({...input,submit_token:token()},headers));
  assert.equal(denied.status,429);assert.equal(denied.headers.get('cache-control'),'no-store');
  assert.equal(denied.headers.get('X-RateLimit-Remaining'),'0');
  assert.ok(Number(denied.headers.get('Retry-After'))>0);
  assert.deepEqual(await counts(),before);
});
