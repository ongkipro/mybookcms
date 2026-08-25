import assert from 'node:assert/strict';
import test from 'node:test';
import { navigateAfterCheckout } from './checkout-navigation.ts';

test('navigateAfterCheckout strips PII from completion URLs', () => {
  const assigned: string[] = [];
  const windowMock = {
    location: {
      href: 'https://mybook.example/form?ref=home',
      assign(url: string) {
        assigned.push(url);
      },
    },
    parent: null as unknown,
    top: null as unknown,
  };
  windowMock.parent = windowMock;
  windowMock.top = windowMock;

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalSessionStorage = globalThis.sessionStorage;

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: { referrer: '' },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem() {
        return null;
      },
    },
    configurable: true,
  });

  try {
    navigateAfterCheckout('/thanks?order_id=123&status_token=tok&phone=60123456789&address=jalan-ampang&district=kuala-lumpur');
    assert.deepEqual(assigned, ['https://mybook.example/thanks']);
  } finally {
    if (originalWindow === undefined) {
      Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });
    } else {
      Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true });
    }
    if (originalDocument === undefined) {
      Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true, writable: true });
    } else {
      Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true, writable: true });
    }
    if (originalSessionStorage === undefined) {
      Object.defineProperty(globalThis, 'sessionStorage', { value: undefined, configurable: true, writable: true });
    } else {
      Object.defineProperty(globalThis, 'sessionStorage', { value: originalSessionStorage, configurable: true, writable: true });
    }
  }
});
