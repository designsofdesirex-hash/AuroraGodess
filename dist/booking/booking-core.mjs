/** Native, browser-only helpers. No request submission, storage or third-party library. */
export const CURRENCY = 'USD';
export const MAILTO_URI_BUDGET = 1800;
export const GENERAL_PRICE_TEXT = 'Pricing confirmed by email · USD';

export const ERROR_KEYS = Object.freeze({
  alias: 'errors.alias', email: 'errors.email', offeringId: 'errors.offeringId',
  preferredDate: 'errors.preferredDate', note: 'errors.note', adult: 'errors.adult', policy: 'errors.policy'
});

const value = v => typeof v === 'string' ? v.trim() : '';
const singleLine = v => value(v).replace(/[\r\n\t]+/g, ' ');
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmail(email) {
  const text = value(email);
  return text.length <= 254 && emailPattern.test(text) && !/[\u0000-\u001f\u007f]/.test(text);
}

export function isValidDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value(text))) return false;
  const [year, month, day] = text.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function localDate(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function publishedOffers(config) {
  return Array.isArray(config?.booking?.offers) ? config.booking.offers.filter(o => o.published === true) : [];
}

export function validateOfferConfig(config) {
  const errors = [];
  const ids = new Set();
  for (const offer of publishedOffers(config)) {
    if (!value(offer.id) || ids.has(offer.id)) errors.push('Published offer IDs must be nonempty and unique.');
    ids.add(offer.id);
    if (!value(offer.title) || !value(offer.description)) errors.push(`Offer ${offer.id}: title and description required.`);
    if (offer.durationMinutes !== null && (!Number.isInteger(offer.durationMinutes) || offer.durationMinutes <= 0))
      errors.push(`Offer ${offer.id}: duration must be a positive integer or null.`);
    if (offer.pricingMode === 'fixed') {
      if (!Number.isSafeInteger(offer.amountUsdCents) || offer.amountUsdCents < 0)
        errors.push(`Offer ${offer.id}: fixed pricing requires nonnegative integer USD cents.`);
    } else if (offer.pricingMode === 'quote') {
      if (offer.amountUsdCents !== null) errors.push(`Offer ${offer.id}: quote pricing requires a null amount.`);
    } else errors.push(`Offer ${offer.id}: pricingMode must be fixed or quote.`);
  }
  if (config?.currency !== CURRENCY) errors.push('Currency must be USD.');
  if (config?.booking?.mode !== 'static-request') errors.push('Booking mode must remain static-request.');
  return errors;
}

export function normalizeDraft(draft = {}) {
  return {
    alias: value(draft.alias), email: value(draft.email), offeringId: value(draft.offeringId) || null,
    preferredDate: value(draft.preferredDate), note: value(draft.note).replace(/\r\n?/g, '\n'),
    adult: draft.adult === true, policy: draft.policy === true
  };
}

export function validateDraft(draft, config, now = new Date()) {
  const d = normalizeDraft(draft);
  const errors = {};
  if (!d.alias || d.alias.length > 60 || /[\r\n\u0000-\u001f\u007f]/.test(d.alias)) errors.alias = ERROR_KEYS.alias;
  if (!isValidEmail(d.email)) errors.email = ERROR_KEYS.email;
  const offers = publishedOffers(config);
  if (offers.length && !offers.some(o => o.id === d.offeringId)) errors.offeringId = ERROR_KEYS.offeringId;
  if (!isValidDate(d.preferredDate) || d.preferredDate < localDate(now)) errors.preferredDate = ERROR_KEYS.preferredDate;
  if (d.note.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(d.note)) errors.note = ERROR_KEYS.note;
  if (!d.adult) errors.adult = ERROR_KEYS.adult;
  if (!d.policy) errors.policy = ERROR_KEYS.policy;
  return { valid: Object.keys(errors).length === 0, errors, draft: d };
}

export function formatUsd(amountUsdCents) {
  if (!Number.isSafeInteger(amountUsdCents) || amountUsdCents < 0)
    throw new TypeError('An approved nonnegative integer USD cent amount is required. Null is not zero.');
  return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY }).format(amountUsdCents / 100)} USD`;
}

export function pricingText(offer) {
  if (!offer || offer.pricingMode === 'quote') return GENERAL_PRICE_TEXT;
  return formatUsd(offer.amountUsdCents);
}

export function prepareRequest(draft, config, now = new Date()) {
  const configErrors = validateOfferConfig(config);
  if (configErrors.length) return { ok: false, code: 'invalid-config', configErrors };
  const validation = validateDraft(draft, config, now);
  if (!validation.valid) return { ok: false, code: 'invalid-draft', ...validation };
  const d = validation.draft;
  const offer = publishedOffers(config).find(o => o.id === d.offeringId);
  const subject = `Booking request — ${singleLine(d.alias)}`;
  const body = [
    'Hello Aurora,', '', "I'd like to make a booking request.", '',
    `Name / alias: ${singleLine(d.alias)}`, `Reply email: ${d.email}`,
    `Request: ${singleLine(offer?.title || 'General request')}`,
    `Preferred date: ${d.preferredDate}`, `Pricing: ${pricingText(offer)}`, '', 'Note:',
    d.note || 'No additional note.', '', 'I confirm that I am 18 or older.',
    'I understand that this is a request and that no booking is confirmed.',
    'Please reply with the next steps.'
  ].join('\n');
  return { ok: true, draft: d, subject, body, price: pricingText(offer) };
}

export function emailHandoff(contactEmail, subject, body, budget = MAILTO_URI_BUDGET) {
  const email = value(contactEmail);
  if (!isValidEmail(email)) return { ok: false, code: 'missing-email', href: null };
  const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(singleLine(subject))}&body=${encodeURIComponent(body)}`;
  if (href.length > budget) return { ok: false, code: 'too-long', href: null, email };
  return { ok: true, href, email };
}

export async function copyRequestText(text) {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) return { ok: false, code: 'manual-copy' };
    await globalThis.navigator.clipboard.writeText(text);
    return { ok: true };
  } catch { return { ok: false, code: 'manual-copy' }; }
}
