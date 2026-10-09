/** Native, browser-only helpers. No request submission, storage or third-party library. */
export const CURRENCY = 'USD';
export const MAILTO_URI_BUDGET = 1800;
export const GENERAL_PRICE_TEXT = 'Pricing confirmed by email · USD';
export const FALLBACK_TIMEZONES = Object.freeze([
  'UTC', 'Africa/Casablanca', 'Africa/Johannesburg', 'America/Anchorage',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/New_York',
  'America/Phoenix', 'America/Sao_Paulo', 'America/Toronto', 'Asia/Dubai',
  'Asia/Hong_Kong', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Pacific/Auckland'
]);

export const ERROR_KEYS = Object.freeze({
  alias: 'errors.alias', email: 'errors.email', offeringId: 'errors.offeringId',
  preferredDate: 'errors.preferredDate', preferredTime: 'errors.preferredTime',
  timezone: 'errors.timezone', note: 'errors.note', adult: 'errors.adult', policy: 'errors.policy'
});

const value = v => typeof v === 'string' ? v.trim() : '';
const singleLine = v => value(v).replace(/[\r\n\t]+/g, ' ');
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmail(email) {
  const text = value(email);
  return text.length <= 254 && emailPattern.test(text) && !/[\u0000-\u001f\u007f]/.test(text);
}

export function isValidTimezone(timezone) {
  if (!value(timezone)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); return true; }
  catch { return false; }
}

export function timezoneOptions() {
  let detected = '';
  try { detected = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  let zones = [...FALLBACK_TIMEZONES];
  if (typeof Intl.supportedValuesOf === 'function') {
    try { zones = Intl.supportedValuesOf('timeZone'); } catch {}
  }
  return [...new Set(['UTC', ...zones, ...(isValidTimezone(detected) ? [detected] : [])])].sort();
}

export function isValidDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value(text))) return false;
  const [year, month, day] = text.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidTime(text) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value(text));
}

export function nowInTimezone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const pick = type => parts.find(p => p.type === type)?.value;
  return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, time: `${pick('hour')}:${pick('minute')}` };
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
    preferredDate: value(draft.preferredDate), preferredTime: value(draft.preferredTime),
    timezone: value(draft.timezone), note: value(draft.note).replace(/\r\n?/g, '\n'),
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
  if (!isValidTimezone(d.timezone)) errors.timezone = ERROR_KEYS.timezone;
  if (!isValidDate(d.preferredDate)) errors.preferredDate = ERROR_KEYS.preferredDate;
  if (!isValidTime(d.preferredTime)) errors.preferredTime = ERROR_KEYS.preferredTime;
  if (!errors.timezone && !errors.preferredDate) {
    const current = nowInTimezone(d.timezone, now);
    if (d.preferredDate < current.date) errors.preferredDate = ERROR_KEYS.preferredDate;
    if (!errors.preferredTime && d.preferredDate === current.date && d.preferredTime < current.time)
      errors.preferredTime = ERROR_KEYS.preferredTime;
  }
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
    'Hello Aurora,', '', "I'd like to request your time.", '',
    `Name / alias: ${singleLine(d.alias)}`, `Reply email: ${d.email}`,
    `Request: ${singleLine(offer?.title || 'General request')}`,
    `Preferred date: ${d.preferredDate}`, `Preferred time: ${d.preferredTime}`,
    `Timezone: ${d.timezone}`, `Pricing: ${pricingText(offer)}`, '', 'Note:',
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

export function downloadRequestText(text) {
  if (!globalThis.document || !globalThis.URL?.createObjectURL || !globalThis.Blob)
    return { ok: false, code: 'manual-copy' };
  let url;
  let anchor;
  try {
    url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'aurora-booking-request.txt'; anchor.hidden = true;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true }; // File creation initiated, never email or delivery confirmation.
  } catch {
    anchor?.remove();
    if (url) URL.revokeObjectURL(url);
    return { ok: false, code: 'manual-copy' };
  }
}
