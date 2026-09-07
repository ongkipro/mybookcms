import assert from 'node:assert/strict';
import test from 'node:test';
import { orderSubmitSchema } from './order-schema.ts';
import { buildWaUrl, renderCrmMessage } from './crm-template.ts';

const validOrder = {
  customer_name: 'Aisyah Rahman',
  customer_phone: '60123456789',
  address: '12 Jalan Tun Razak, Kuala Lumpur',
  district: 'Kuala Lumpur',
  province: 'Wilayah Persekutuan Kuala Lumpur',
  postal_code: '50400',
  payment_method: 'cod',
  variant_id: 'AUS-500ML',
  quantity: 1,
  submit_token: 'submit-token-at-least-sixteen',
};

test('order schema normalizes a valid Malaysia mobile number', () => {
  const result = orderSubmitSchema.parse(validOrder);
  assert.equal(result.customer_phone, '60123456789');
});

test('order schema rejects alphabetic or truncated phone input after normalization', () => {
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, customer_phone: 'abcdefghijk' }).success, false);
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, customer_phone: '0123' }).success, false);
});

test('order schema rejects receiver names with digits and addresses without meaningful letters', () => {
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, customer_name: 'Aisyah 2' }).success, false);
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, address: '1234567890' }).success, false);
});

test('order schema requires a stable submit token and bounded integer quantity', () => {
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, submit_token: '' }).success, false);
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, quantity: 1.5 }).success, false);
  assert.equal(orderSubmitSchema.safeParse({ ...validOrder, quantity: 101 }).success, false);
});

test('checkout accepts only the three Malaysia payment families', () => {
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'doku',
    customer_email: 'aisyah@example.com',
    doku_channel: 'INTERNET_BANKING_FPX',
  }).success, true);
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'card',
  }).success, false);
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'crypto',
  }).success, false);
});

test('DOKU requires a valid customer email', () => {
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'doku',
    doku_channel: 'INTERNET_BANKING_FPX',
  }).success, false);
});

test('DOKU requires a known channel and non-DOKU methods reject one', () => {
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'doku',
    customer_email: 'aisyah@example.com',
  }).success, false);
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'doku',
    customer_email: 'aisyah@example.com',
    doku_channel: 'EWALLET_UNKNOWN',
  }).success, false);
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    doku_channel: 'INTERNET_BANKING_FPX',
  }).success, false);
});

test('manual transfer requires a selected seller bank account', () => {
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'manual_transfer',
    seller_bank_account_id: 7,
  }).success, true);
  assert.equal(orderSubmitSchema.safeParse({
    ...validOrder,
    payment_method: 'manual_transfer',
  }).success, false);
});

test('CRM rendering replaces order variables and produces an encoded WhatsApp URL', () => {
  const message = renderCrmMessage('Hai {{name}}, pesanan {{order_number}} berjumlah {{total}}.', {
    customerName: 'Aisyah',
    customerPhone: '60123456789',
    district: 'Kuala Lumpur',
    province: 'Wilayah Persekutuan Kuala Lumpur',
    orderNumber: 'INV-1',
    productName: 'Alpha',
    totalAmount: 18300,
  });
  assert.equal(message, 'Hai Aisyah, pesanan INV-1 berjumlah RM\u00a0183.00.');
  assert.equal(buildWaUrl('60123456789', message).startsWith('https://wa.me/60123456789?text='), true);
});
