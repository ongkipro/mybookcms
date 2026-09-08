import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeLandingContent, renderLandingContent, LandingContentError} from './landing-content.ts';

test('typed text and image attributes cannot execute markup', () => {
  assert.equal(renderLandingContent('headline', {text:'<script>alert(1)</script>',align:'center',size:'large'}), '<h2 class="lp-headline lp-size-large lp-align-center">&lt;script&gt;alert(1)&lt;/script&gt;</h2>');
  assert.match(renderLandingContent('image',{src:'/media/example.png',alt:'" onerror="alert(1)'}), /alt="&quot; onerror=&quot;alert\(1\)"/);
  for (const src of ['javascript:alert(1)','data:image/svg+xml,<svg/>','//example.com/x','/\\evil.com/x']) assert.throws(() => normalizeLandingContent('image',{src}),LandingContentError);
});
test('bounded sections reject invalid payloads and normalize blank list lines', () => {
  assert.deepEqual(normalizeLandingContent('bullet_list',{items:[' first ','',' second ']}),{items:['first','second']});
  for (const value of [{items:Array(101).fill('x')},{items:[42]},{items:['x'.repeat(1001)]}]) assert.throws(() => normalizeLandingContent('numbered_list',value),LandingContentError);
  assert.throws(() => normalizeLandingContent('headline',{text:'x'.repeat(501)}),LandingContentError);
  assert.throws(() => normalizeLandingContent('headline',{align:'left" onclick="x'}),LandingContentError);
  assert.equal(normalizeLandingContent('html',null),null);
  assert.equal(normalizeLandingContent('form',null),null);
});
