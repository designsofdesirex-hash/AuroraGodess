import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUsd, prepareRequest, validateDraft, validateOfferConfig,
  emailHandoff, isValidDate, copyRequestText
} from './booking-core.mjs';

const config = { currency: 'USD', booking: { mode: 'static-request', offers: [] } };
const now = new Date(2026, 9, 9, 23, 30);
const draft = {
  alias: 'Example visitor', email: 'visitor@example.invalid', offeringId: null,
  preferredDate: '2026-10-11',
  note: 'Please reply with the details.', adult: true, policy: true
};
const fixedOffer = {
  id: 'fixture-offer', title: 'Fixture only', description: 'Test-only configuration, never public data.',
  durationMinutes: null, pricingMode: 'fixed', amountUsdCents: 12345, published: true
};
const withOffer = { currency: 'USD', booking: { mode: 'static-request', offers: [fixedOffer] } };

test('approved integer cents format as USD; null and invalid numbers never become a free rate', () => {
  assert.equal(formatUsd(12345), '$123.45 USD');
  assert.equal(formatUsd(0), '$0.00 USD');
  for (const invalid of [null, undefined, -1, 12.5, NaN, '12345']) assert.throws(() => formatUsd(invalid));
});

test('calendar validity covers leap years, impossible dates and past-date rejection', () => {
  assert.equal(isValidDate('2028-02-29'), true);
  for (const invalid of ['2026-02-29','2026-04-31','2026-13-01','2026-10-00','10/09/2026'])
    assert.equal(isValidDate(invalid), false);
  assert.equal(validateDraft({...draft,preferredDate:'2026-10-08'},config,now).errors.preferredDate,'errors.preferredDate');
  assert.equal(validateDraft({...draft,preferredDate:'2026-10-09'},config,now).valid,true);
});

test('empty catalogue prepares a quote request with no invented dollar rate', () => {
  const result = prepareRequest(draft, config, now);
  assert.equal(result.ok, true);
  assert.equal(result.price, 'Pricing confirmed by email · USD');
  assert.match(result.body, /Request: General request/);
  assert.doesNotMatch(result.body, /\$0\.00|\$25|confirmed booking|request received/i);
  assert.match(result.body, /no booking is confirmed/);
});

test('all required fields fail together and leave valid entered text available for correction', () => {
  const result = validateDraft({ ...draft, alias:'', email:'wrong', preferredDate:'', adult:false, policy:false },config,now);
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['adult','alias','email','policy','preferredDate'].sort());
  assert.equal(result.draft.note, draft.note);
});

test('unknown/unpublished offer IDs do not acquire a price or pass review', () => {
  assert.equal(validateDraft(draft,withOffer,now).errors.offeringId,'errors.offeringId');
  assert.equal(validateDraft({...draft,offeringId:'unknown'},withOffer,now).valid,false);
  const good = prepareRequest({...draft,offeringId:'fixture-offer'},withOffer,now);
  assert.equal(good.ok,true); assert.equal(good.price,'$123.45 USD');
});

test('quote, malformed fixed pricing and non-USD/mode configurations are explicit', () => {
  const quote = {...withOffer,booking:{...withOffer.booking,offers:[{...fixedOffer,pricingMode:'quote',amountUsdCents:null}]}};
  assert.equal(prepareRequest({...draft,offeringId:'fixture-offer'},quote,now).price,'Pricing confirmed by email · USD');
  const bad = {...withOffer,booking:{...withOffer.booking,offers:[{...fixedOffer,amountUsdCents:null}]}};
  assert.equal(prepareRequest({...draft,offeringId:'fixture-offer'},bad,now).code,'invalid-config');
  assert.ok(validateOfferConfig({...config,currency:'EUR'}).length);
  assert.ok(validateOfferConfig({...config,booking:{...config.booking,mode:'live'}}).length);
});

test('multiline notes stay plain text and the request includes the preferred date', () => {
  const result=prepareRequest({...draft,note:'First line\r\nSecond <line> & details.'},config,now);
  assert.match(result.body,/First line\nSecond <line> & details\./);
  assert.match(result.body,/Preferred date: 2026-10-11\nPricing:/);
  assert.doesNotMatch(result.body,/Preferred time|Timezone:/);
  assert.equal(validateDraft({...draft,note:'a'.repeat(1001)},config,now).errors.note,'errors.note');
  assert.equal(validateDraft({...draft,alias:'name\nBcc: unwanted'},config,now).valid,false);
});

test('mailto encodes recipient, subject and text; no cc/bcc; long or missing recipient has no href', () => {
  const subject='Booking request — A & B'; const body='Name: A & B\nNote: café? # details';
  const result=emailHandoff('owner@example.invalid',subject,body);
  assert.equal(result.ok,true);
  const parsed=new URL(result.href);
  assert.equal(decodeURIComponent(parsed.pathname),'owner@example.invalid');
  assert.equal(parsed.searchParams.get('subject'),subject);
  assert.equal(parsed.searchParams.get('body'),body);
  assert.equal(parsed.searchParams.has('cc'),false);assert.equal(parsed.searchParams.has('bcc'),false);
  assert.equal(emailHandoff(null,subject,body).href,null);
  assert.equal(emailHandoff('owner@example.invalid',subject,'é'.repeat(1000)).code,'too-long');
});

test('unsupported clipboard environments produce manual-copy fallback rather than success', async () => {
  assert.equal((await copyRequestText('text')).code,'manual-copy');
});
