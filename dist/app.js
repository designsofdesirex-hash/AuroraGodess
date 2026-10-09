import {
  downloadRequestText, emailHandoff, prepareRequest, pricingText, publishedOffers, timezoneOptions,
  validateDraft, validateOfferConfig
} from '/booking/booking-core.mjs';

const root = document.querySelector('#app');
const ENTRY_KEY = 'aurora:adult-entry:v1';
const HERO_ROTATION_IDS = ['heroPortrait', 'gallery01', 'gallery03', 'gallery07', 'gallery09', 'gallery15'];
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const routePath = location.pathname.replace(/\/+$/, '') || '/';
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const arrow = '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const externalArrow = '<svg class="external-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

let copy, site, assets, entryAcceptedInMemory = false, currentDialog = null, focusReturn = null;

try {
  const [copyResponse, siteResponse, assetsResponse] = await Promise.all([
    fetch('/config/copy.json'), fetch('/config/site.json'), fetch('/config/public-assets.json')
  ]);
  if (![copyResponse, siteResponse, assetsResponse].every(response => response.ok)) throw new Error('Page data could not be loaded.');
  [copy, site, assets] = await Promise.all([copyResponse.json(), siteResponse.json(), assetsResponse.json()]);
  const configErrors = validateOfferConfig(site);
  if (configErrors.length) console.error('Aurora preview configuration needs correction:', configErrors);
  const route = site.routes.find(item => item.path === routePath) || site.routes[0];
  document.title = route.title;
  renderRoute(route);
} catch (error) {
  root.innerHTML = `<main class="load-error surface-light"><div class="reading-column"><h1>Unable to open this page.</h1><p>${esc(error.message)}</p><a class="action action-primary" href="/">Return home ${arrow}</a></div></main>`;
}

function hasEntry() {
  if (entryAcceptedInMemory) return true;
  try { return sessionStorage.getItem(ENTRY_KEY) === 'accepted'; } catch { return false; }
}

function renderRoute(route) {
  const gated = !['/privacy', '/exit'].includes(route.path);
  if (route.path === '/exit') {
    try { sessionStorage.removeItem(ENTRY_KEY); } catch {}
    entryAcceptedInMemory = false;
  }
  if (gated && !hasEntry()) { renderEntry(); return; }
  if (route.path === '/exit') {
    root.innerHTML = `${skipLink()}<main id="page-main" tabindex="-1">${exitPage()}</main><footer class="exit-footer">© ${new Date().getFullYear()} ${esc(copy.footer.copyrightName)}</footer>`;
    root.querySelector('#reopen-entry')?.addEventListener('click',()=>{try{sessionStorage.removeItem(ENTRY_KEY);}catch{}});
    root.querySelector('#page-title')?.focus({preventScroll:true});
    return;
  }
  const body = route.path === '/' ? homePage() : route.path === '/booking' ? bookingPage() : route.path === '/gallery' ? galleryPage() : route.path === '/links' ? linksPage() : route.path === '/policies' ? readingPage('policies') : readingPage('privacy');
  root.innerHTML = `${skipLink()}${header(route.path)}<main id="page-main" tabindex="-1">${body}</main>${footer()}${route.path === '/' ? stickyAction() : ''}<div id="overlay-root"></div>`;
  bindShared(route.path);
  if (route.path === '/booking') bindBooking();
  if (route.path === '/gallery') bindGalleryPage();
  if (route.path === '/') bindHome();
  const heading = root.querySelector('#page-main h1');
  if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
}

function skipLink() { return `<a class="skip-link" href="#page-main">${esc(copy.shared.skip)}</a>`; }

function wordmark(className = 'wordmark') {
  return `<a class="${className}" href="/" aria-label="${esc(copy.shared.homeLinkName)}"><img src="/assets/aurora-wordmark.svg" alt="" width="168" height="28"></a>`;
}

function header(path) {
  const bookingLabel = path === '/booking' ? copy.nav.bookingActive : copy.nav.booking;
  const navItem = (href, label) => `<a href="${href}"${path === href ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  return `<header class="site-header surface-dark">
    <div class="container header-inner">${wordmark()}
      <nav class="desktop-nav" aria-label="Primary navigation">${navItem('/gallery', copy.nav.gallery)}${navItem('/links', copy.nav.links)}<a class="action action-primary header-action" href="/booking"${path === '/booking' ? ' aria-current="page"' : ''}>${esc(bookingLabel)} ${arrow}</a></nav>
      <button class="menu-toggle icon-action" id="menu-toggle" type="button" aria-label="${esc(copy.shared.openMenu)}" aria-expanded="false" aria-controls="mobile-menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" aria-modal="true" role="dialog" hidden>
        <button class="menu-close icon-action" type="button" aria-label="${esc(copy.shared.closeMenu)}">${closeIcon()}</button>
        ${navItem('/', copy.nav.home)}${navItem('/gallery', copy.nav.gallery)}${navItem('/links', copy.nav.links)}<a class="action action-primary" href="/booking">${esc(copy.nav.booking)} ${arrow}</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  const link = (href, label) => `<a href="${href}">${esc(label)}</a>`;
  const externals = site.links.map(destination => {
    const label = getCopy(destination.labelKey);
    return `<a href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label.accessibleName)}">${esc(label.title)}</a>`;
  }).join('');
  return `<footer class="site-footer surface-dark"><div class="container footer-main">
    <div class="footer-brand">
      <figure class="footer-portrait"><img src="/assets/images/gallery03-400.webp" width="400" height="533" alt="Aurora taking a mirror portrait in a black outfit." loading="lazy" decoding="async"><figcaption>Aurora · Official</figcaption></figure>
      ${wordmark('footer-wordmark')}<p>${esc(copy.footer.body)}</p>
    </div>
    <nav aria-label="${esc(copy.footer.explore)}"><h2>${esc(copy.footer.explore)}</h2>${link('/', copy.nav.home)}${link('/booking', copy.nav.booking)}${link('/gallery', copy.nav.gallery)}${link('/links', copy.nav.links)}${link('/privacy', copy.nav.privacy)}${link('/policies', copy.nav.policies)}</nav>
    <nav aria-label="${esc(copy.footer.destinations)}"><h2>${esc(copy.footer.destinations)}</h2>${externals}</nav>
  </div><div class="container footer-meta"><span>© ${new Date().getFullYear()} ${esc(copy.footer.copyrightName)}</span><span>${esc(copy.footer.adults)}</span></div></footer>`;
}

function getCopy(key) { return key.split('.').reduce((value, keyPart) => value?.[keyPart], copy) || {}; }
function action(href, label, variant = 'primary') { return `<a class="action action-${variant}" href="${href}">${esc(label)} ${arrow}</a>`; }
function textAction(href, label) { return `<a class="text-action" href="${href}">${esc(label)} ${arrow}</a>`; }
function sectionHead(title, description, actionHtml = '') {
  return `<div class="section-heading"><div><h2 class="type-section">${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div>${actionHtml}</div>`;
}

function photoFrame(id, { className = '', priority = false, button = false, ratio = null, label = null, rotator = false } = {}) {
  const asset = assets.find(item => item.id === id && item.type === 'image');
  const assetLabel = label || id.toUpperCase();
  const style = ratio ? ` style="--frame-ratio:${ratio}"` : '';
  const placeholder = `<span class="photo-placeholder" aria-hidden="true"><span>${esc(assetLabel)}</span><small>${esc(copy.media.placeholder)}</small></span>`;
  if (!asset) return `<figure class="photo-frame ${className}" data-asset-id="${esc(id)}"${style}>${placeholder}</figure>`;
  const focal = asset.focalPointDesktop || { x: 50, y: 50 };
  const srcset = list => (list || []).map(variant => `${esc(variant.src)} ${variant.width}w`).join(', ');
  const img = `<picture${rotator ? ' class="hero-slide is-active" data-hero-slot aria-hidden="false"' : ''}>${asset.mobileVariants?.length ? `<source media="(max-width: 699px)" srcset="${srcset(asset.mobileVariants)}" sizes="100vw">` : ''}<img src="${esc(asset.src)}"${asset.variants?.length ? ` srcset="${srcset(asset.variants)}" sizes="(max-width: 699px) 100vw, 50vw"` : ''} alt="${esc(asset.alt)}" width="${asset.width}" height="${asset.height}" loading="${priority ? 'eager' : 'lazy'}" decoding="async" style="object-position:${focal.x}% ${focal.y}%"${priority ? ' fetchpriority="high"' : ''}></picture>`;
  const rotateMarkup = rotator ? `<picture class="hero-slide" data-hero-slot aria-hidden="true"></picture><button class="icon-action hero-rotator-toggle" type="button" aria-label="Pause hero photo rotation" aria-pressed="false">${pauseIcon}</button>` : '';
  const inner = `${placeholder}${img}${rotateMarkup}<span class="photo-error" hidden>${esc(copy.media.error)} <button type="button" class="retry-photo">${esc(copy.shared.retry)}</button></span>`;
  return `<figure class="photo-frame ${className}" data-asset-id="${esc(id)}"${rotator ? ' data-hero-rotator' : ''}${style}>${button ? `<button class="photo-open" type="button" data-open-asset="${esc(id)}">${inner}</button>` : inner}${asset.caption ? `<figcaption>${esc(asset.caption)}</figcaption>` : ''}</figure>`;
}

function homePage() {
  const h = copy.home;
  const heroPhoto = photoFrame('heroPortrait', { className: 'hero-photo', priority: true, ratio: '6 / 7', label: 'HEROPORTRAIT', rotator: true });
  const homeGallery = ['gallery01', 'gallery02', 'gallery03'];
  const panels = ['loyalfans', 'throne'].map(id => destinationPanel(id)).join('');
  return `<section class="home-hero surface-dark"><div class="container hero-grid"><div class="hero-copy">
    <p class="eyebrow desktop-eyebrow">${esc(h.hero.eyebrow)}</p><p class="eyebrow mobile-eyebrow">${h.hero.mobileEyebrowLines.map(esc).join('<br>')}</p>
    <h1 id="page-title" tabindex="-1" class="type-hero">${esc(h.hero.headingLines[0])}<br>${esc(h.hero.headingLines[1])}</h1>
    <p class="hero-body">${esc(h.hero.body)}</p><div class="hero-actions">${action('/booking', h.hero.primary)}${textAction('/gallery', h.hero.secondary)}</div>
  </div>${heroPhoto}</div><span class="hero-photo-label" data-hero-count aria-hidden="true">01 / 06 · AURORA</span></section>
  <section class="home-intro surface-light aurora-section"><div class="container intro-grid"><div class="intro-photo">${photoFrame('introPortrait', { ratio: '4 / 5', label: 'INTROPORTRAIT' })}</div><div class="intro-copy"><p class="eyebrow">${esc(h.intro.eyebrow)}</p><h2 class="type-section">${esc(h.intro.heading)}</h2><p>${esc(h.intro.body)}</p>${textAction('/links', h.intro.action)}</div></div></section>
  <section class="home-frames surface-dark aurora-section"><div class="container">${sectionHead(h.gallery.heading, h.gallery.body, textAction('/gallery', h.gallery.action))}<div class="selected-frames">${homeGallery.map((id, index) => photoFrame(id, { button: true, ratio: index === 1 ? '3 / 4' : '4 / 5', className: `selected-frame selected-frame-${index + 1}`, label: id.toUpperCase() })).join('')}</div></div></section>
  <section class="booking-teaser surface-blush aurora-section"><div class="container booking-teaser-grid"><div class="booking-teaser-copy"><p class="eyebrow"><img class="booking-monogram" src="/assets/aurora-monogram.svg" alt="" width="18" height="24">${esc(h.booking.eyebrow)}</p><h2 class="type-section">${esc(h.booking.heading)}</h2><p>${esc(h.booking.body)}</p>${action('/booking', h.booking.action)}</div><ol class="booking-steps">${h.booking.steps.map((label, i) => `<li><span aria-hidden="true">0${i + 1}</span>${esc(label)}</li>`).join('')}</ol></div></section>
  <section class="home-links surface-light aurora-section"><div class="container">${sectionHead(h.links.heading, h.links.body, textAction('/links', h.links.action))}<div class="destination-panels">${panels}</div></div></section>
  <section class="home-close surface-dark"><div class="container close-inner"><h2 class="type-section">${esc(h.close.heading)}</h2><p>${esc(h.close.body)}</p>${action('/booking', h.close.action)}</div></section>`;
}

function destinationPanel(id) {
  const destination = site.links.find(item => item.id === id); const text = getCopy(destination.labelKey);
  const theme = id === 'throne' ? 'destination-card--blush' : 'destination-card--outline';
  return `<a class="destination-card ${theme}" href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer"><span class="eyebrow">${esc(text.eyebrow)}</span><h3>${esc(text.title)}</h3><p>${esc(text.body)}</p><span class="text-action">${esc(text.action)} ${arrow}</span></a>`;
}

function stickyAction() { return `<div class="sticky-booking" id="sticky-booking" hidden>${action('/booking', copy.nav.booking)}</div>`; }

function bookingPage() {
  const b = copy.booking; const offers = publishedOffers(site);
  const asideFacts = b.aside.lines.map(line => `<li>${esc(line)}</li>`).join('');
  const faq = b.faq.map(item => `<article class="faq-row"><h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p></article>`).join('');
  return `<section class="page-heading-band surface-light"><div class="container reading-column"><p class="eyebrow">${esc(b.eyebrow)}</p><h1 id="page-title" tabindex="-1" class="type-page">${esc(b.heading)}</h1><p>${esc(b.body)}</p><p class="preference-notice">${esc(b.preferenceNotice)}</p></div></section>
  <section class="booking-layout surface-light"><div class="container booking-columns"><div class="booking-main"><nav class="booking-stepper" aria-label="Booking steps">${b.steps.map((label,i)=>`<span class="step-item" data-step="${i+1}"${i===0?' aria-current="step"':''}><span class="step-number">${i+1}</span><span>${esc(label)}</span></span>`).join('')}</nav>
      <div id="booking-state" class="booking-state"></div></div>
    <aside class="booking-aside surface-dark"><h2>${esc(b.aside.heading)}</h2><p>${esc(b.aside.body)}</p><ul>${asideFacts}</ul>${textAction('/policies',b.aside.action)}</aside></div>
    <div class="container faq-wrap"><div class="faq-list">${faq}</div></div></section>`;
}

function galleryPage() {
  const g = copy.gallery;
  const lead = assets.find(asset => asset.id === 'galleryLead' && asset.type === 'image');
  const items = galleryItems();
  const leadSrcset=(lead?.variants||[]).map(variant=>`${esc(variant.src)} ${variant.width}w`).join(', ');
  const leadMobileSrcset=(lead?.mobileVariants||[]).map(variant=>`${esc(variant.src)} ${variant.width}w`).join(', ');
  const galleryBody = items.length ? `<div class="gallery-content">${lead ? `<button type="button" class="gallery-lead" data-open-asset="${esc(lead.id)}" aria-label="${esc(g.openImage)}: ${esc(lead.alt)}"><picture>${leadMobileSrcset?`<source media="(max-width: 699px)" srcset="${leadMobileSrcset}" sizes="100vw">`:''}<img src="${esc(lead.src)}"${leadSrcset?` srcset="${leadSrcset}" sizes="100vw"`:''} alt="${esc(lead.alt)}" width="${lead.width}" height="${lead.height}" loading="eager" decoding="async"></picture></button>` : ''}<div class="gallery-filters" id="gallery-filters" hidden></div><div class="gallery-grid" id="gallery-grid"></div><div class="gallery-more-wrap" id="gallery-more-wrap" hidden><button class="action action-secondary" id="gallery-more" type="button">${esc(g.showMore)} ${arrow}</button></div></div>` : `<div class="empty-state"><h2>${esc(g.emptyHeading)}</h2><p>${esc(g.empty)}</p>${action('/links', g.emptyAction)}</div>`;
  return `<section class="page-heading-band surface-dark"><div class="container"><p class="eyebrow">${esc(g.eyebrow)}</p><h1 id="page-title" tabindex="-1" class="type-page">${esc(g.heading)}</h1><p>${esc(g.body)}</p></div></section><section class="gallery-page surface-dark"><div class="container">${galleryBody}<div class="gallery-close"><h2 class="type-section">${esc(g.close)}</h2><div>${action('/booking',g.bookingAction)}${textAction(site.links.find(l=>l.id==='loyalfans').url, g.creatorAction)}</div></div></div></section>`;
}

function galleryItems() { return assets.filter(asset => asset.role === 'gallery-grid' && asset.type === 'image' && asset.src).sort((a,b)=>a.order-b.order || a.id.localeCompare(b.id)); }

function linksPage() {
  const links = copy.links;
  const featured = ['loyalfans', 'throne'].map(id => {
    const destination = site.links.find(item => item.id === id); const text = getCopy(destination.labelKey);
    const cls = id === 'loyalfans' ? 'official-feature official-feature--dark' : 'official-feature official-feature--blush';
    return `<a class="${cls}" href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(text.accessibleName)}"><span class="eyebrow">${esc(text.eyebrow)}</span><h2>${esc(text.title)}</h2><p>${esc(text.body)}</p><span class="text-action">${esc(text.action)} ${arrow}</span></a>`;
  }).join('');
  const rows = ['x','youpay','cashapp'].map(id => {
    const destination = site.links.find(item => item.id === id); const text = getCopy(destination.labelKey);
    return `<a class="official-row" href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(text.accessibleName)}"><strong>${esc(text.title)}</strong><span>${esc(text.body)}</span><span class="row-arrow" aria-hidden="true">${externalArrow}</span></a>`;
  }).join('');
  return `<section class="page-heading-band surface-light"><div class="container"><p class="eyebrow">${esc(links.eyebrow)}</p><h1 id="page-title" tabindex="-1" class="type-page">${esc(links.heading)}</h1><p>${esc(links.body)}</p></div></section><section class="official-links surface-light"><div class="container"><p class="outbound-notice">${esc(links.outboundNotice)}</p><div class="official-features">${featured}</div><div class="official-rows">${rows}</div><p class="booking-separation">${esc(links.bookingSeparation)}</p></div></section>`;
}

function readingPage(key) {
  const page = copy[key]; const route = key === 'privacy' ? '/privacy' : '/policies';
  return `<section class="page-heading-band surface-light"><div class="container reading-column"><p class="eyebrow">${esc(page.eyebrow)}</p><h1 id="page-title" tabindex="-1" class="type-page">${esc(page.heading)}</h1><p>${esc(page.intro)}</p></div></section><section class="reading-content surface-light"><div class="container reading-column">${page.sections.map(section => `<section><h2>${esc(section.heading)}</h2><p>${esc(section.body)}</p></section>`).join('')}${action(key==='privacy'?'/':'/booking',page.action)}</div></section>`;
}

function exitPage() {
  return `<section class="exit-page surface-light"><div class="exit-inner">${wordmark('exit-wordmark')}<h1 id="page-title" tabindex="-1">${esc(copy.exit.heading)}</h1><p>${esc(copy.exit.body)}</p><a class="text-action" href="/" id="reopen-entry">${esc(copy.exit.action)} ${arrow}</a></div></section>`;
}

function renderEntry() {
  const template = document.querySelector('#entry-shell');
  if (!template) return;
  template.hidden = false;
  root.innerHTML = template.outerHTML;
  const choice = root.querySelector('#adult-entry-choice');
  const enter = root.querySelector('#enter-aurora');
  choice.addEventListener('change', () => { enter.disabled = !choice.checked; });
  enter.addEventListener('click', () => {
    if (!choice.checked) return;
    try { sessionStorage.setItem(ENTRY_KEY, 'accepted'); } catch { entryAcceptedInMemory = true; }
    entryAcceptedInMemory = true;
    renderRoute(site.routes.find(item => item.path === routePath) || site.routes[0]);
  });
  choice.focus({ preventScroll: true });
}

function bindShared(path) {
  root.querySelectorAll('.photo-frame:not([data-hero-rotator]) img').forEach(img => {
    img.addEventListener('error', () => { const frame = img.closest('.photo-frame'); img.hidden = true; frame.querySelector('.photo-error').hidden = false; }, { once: true });
  });
  root.querySelectorAll('.retry-photo').forEach(button => button.addEventListener('click', () => {
    const frame = button.closest('.photo-frame'); const img = frame.querySelector('img');
    img.hidden = false; frame.querySelector('.photo-error').hidden = true;
    img.addEventListener('error', () => { img.hidden = true; frame.querySelector('.photo-error').hidden = false; }, { once: true });
    const url = new URL(img.src); url.searchParams.set('retry', '1'); img.src = url;
    button.disabled = true;
  }));
  const toggle = root.querySelector('#menu-toggle'); const menu = root.querySelector('#mobile-menu');
  if (toggle && menu) {
    const close = root.querySelector('.menu-close');
    const links = [...menu.querySelectorAll('a,button')];
    const closeMenu = () => {
      menu.hidden = true; toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label',copy.shared.openMenu);
      root.querySelector('#page-main')?.removeAttribute('inert'); root.querySelector('.site-footer')?.removeAttribute('inert');
      root.querySelector('#sticky-booking')?.removeAttribute('inert');
      document.body.classList.remove('menu-open'); toggle.focus({preventScroll:true});
      document.dispatchEvent(new CustomEvent('aurora:overlay',{detail:false}));
    };
    toggle.addEventListener('click', () => {
      menu.hidden = false; toggle.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-label',copy.shared.closeMenu);
      root.querySelector('#page-main')?.setAttribute('inert',''); root.querySelector('.site-footer')?.setAttribute('inert','');
      root.querySelector('#sticky-booking')?.setAttribute('inert','');
      document.body.classList.add('menu-open'); close.focus();
      document.dispatchEvent(new CustomEvent('aurora:overlay',{detail:true}));
    });
    close.addEventListener('click',closeMenu);
    menu.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();closeMenu();}
      if(event.key==='Tab'){
        const first=links[0],last=links.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
  }
  if(path==='/exit') root.querySelector('#reopen-entry')?.addEventListener('click',()=>{try{sessionStorage.removeItem(ENTRY_KEY);}catch{}});
}

function bindHeroRotator() {
  const frame = root.querySelector('[data-hero-rotator]');
  const toggle = frame?.querySelector('.hero-rotator-toggle');
  const slots = frame ? [...frame.querySelectorAll('[data-hero-slot]')] : [];
  const rotationAssets = HERO_ROTATION_IDS.map(id => assets.find(asset => asset.id === id && asset.type === 'image')).filter(Boolean);
  if (!frame || !toggle || slots.length < 2 || rotationAssets.length < 2) return;

  let currentIndex = Math.max(0, rotationAssets.findIndex(asset => asset.id === frame.dataset.assetId));
  let activeSlot = slots.find(slot => slot.classList.contains('is-active')) || slots[0];
  let prepared = null;
  let timer = null;
  let paused = false;
  const count = root.querySelector('[data-hero-count]');
  const initialImage = activeSlot.querySelector('img');

  const updateCount = () => {
    if (count) count.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(rotationAssets.length).padStart(2, '0')} · AURORA`;
  };
  const clearTimer = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };
  const schedule = () => {
    if (!timer && prepared && !paused && !document.hidden) timer = window.setInterval(advance, 6000);
  };
  const setToggleState = () => {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume hero photo rotation' : 'Pause hero photo rotation');
    toggle.innerHTML = paused ? playIcon() : pauseIcon;
  };

  async function prepareNext(attempt = 0) {
    if (prepared || attempt >= rotationAssets.length - 1) return;
    const nextIndex = (currentIndex + 1 + attempt) % rotationAssets.length;
    const asset = rotationAssets[nextIndex];
    const slot = slots.find(item => item !== activeSlot);
    if (!slot) return;
    slot.replaceChildren();
    slot.setAttribute('aria-hidden', 'true');
    slot.dataset.assetId = asset.id;

    if (asset.mobileVariants?.length) {
      const source = document.createElement('source');
      source.media = '(max-width: 699px)';
      source.srcset = asset.mobileVariants.map(variant => `${variant.src} ${variant.width}w`).join(', ');
      source.sizes = '100vw';
      slot.append(source);
    }
    const image = document.createElement('img');
    image.alt = '';
    image.width = asset.width;
    image.height = asset.height;
    image.loading = 'eager';
    image.decoding = 'async';
    image.sizes = '(max-width: 699px) 100vw, 50vw';
    image.srcset = (asset.variants || []).map(variant => `${variant.src} ${variant.width}w`).join(', ');
    const focal = asset.focalPointDesktop || { x: 50, y: 50 };
    image.style.objectPosition = `${focal.x}% ${focal.y}%`;
    image.src = asset.src;
    slot.append(image);

    try {
      await image.decode();
      prepared = { slot, asset, index: nextIndex };
      schedule();
    } catch {
      slot.replaceChildren();
      prepareNext(attempt + 1);
    }
  }

  function advance() {
    if (!prepared) return;
    const previous = activeSlot;
    const next = prepared;
    prepared = null;
    activeSlot = next.slot;
    currentIndex = next.index;
    activeSlot.classList.add('is-active');
    activeSlot.setAttribute('aria-hidden', 'false');
    activeSlot.querySelector('img').alt = next.asset.alt;
    previous.classList.remove('is-active');
    previous.setAttribute('aria-hidden', 'true');
    const previousImage = previous.querySelector('img');
    if (previousImage) previousImage.alt = '';
    frame.dataset.assetId = next.asset.id;
    updateCount();
    window.setTimeout(() => {
      previous.replaceChildren();
      prepareNext();
    }, 640);
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    if (paused) clearTimer();
    else schedule();
    setToggleState();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimer();
    else schedule();
  });
  initialImage?.addEventListener('error', () => {
    initialImage.hidden = true;
    frame.querySelector('.photo-error').hidden = false;
  }, { once: true });
  updateCount();
  setToggleState();
  prepareNext();
}

function bindHome() {
  root.querySelectorAll('[data-open-asset]').forEach(button => button.addEventListener('click',()=>openViewer(button.dataset.openAsset, galleryItems())));
  bindHeroRotator();
  const sticky = root.querySelector('#sticky-booking');
  if (!sticky || matchMedia('(max-height: 479px)').matches) return;
  const heroAction = root.querySelector('.hero-actions .action-primary');
  const quietActions = [...root.querySelectorAll('.booking-teaser .action-primary,.home-close .action-primary')];
  const footer = root.querySelector('.site-footer');
  let heroHidden = false, quietVisible = false, footerVisible = false, overlayOpen = false;
  document.addEventListener('aurora:overlay',event=>{overlayOpen=event.detail;update();});
  const update = () => {
    sticky.hidden = !heroHidden || quietVisible || footerVisible || overlayOpen || matchMedia('(min-width: 700px), (max-height: 479px)').matches;
    root.querySelector('#page-main')?.classList.toggle('has-sticky-booking',!sticky.hidden);
  };
  if ('IntersectionObserver' in window) {
    const firstObserver=new IntersectionObserver(entries=>{heroHidden=!entries[0].isIntersecting;update();},{threshold:.01}); firstObserver.observe(heroAction);
    const quietObserver=new IntersectionObserver(entries=>{quietVisible=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.5);update();},{threshold:[0,.5,1]}); quietActions.forEach(node=>quietObserver.observe(node));
    const footerObserver=new IntersectionObserver(entries=>{footerVisible=entries[0].isIntersecting;update();},{threshold:0}); footerObserver.observe(footer);
  }
  update();
}

function bindGalleryPage() {
  const allItems = galleryItems(); const lead=assets.find(asset=>asset.id==='galleryLead'&&asset.type==='image');
  const grid=root.querySelector('#gallery-grid'), filters=root.querySelector('#gallery-filters'), more=root.querySelector('#gallery-more-wrap');
  if(!grid) return;
  let category='all', visibleCount=site.gallery.initialGridCount;
  const categories=[...new Set(allItems.map(item=>item.category).filter(Boolean))];
  const counts=new Map(categories.map(value=>[value,allItems.filter(item=>item.category===value).length]));
  const showFilters=allItems.length>=site.gallery.filterMinimumGridAssets && categories.filter(item=>counts.get(item)>0).length>=2;
  if(showFilters){
    filters.hidden=false;
    filters.innerHTML=[['all',copy.gallery.all],...categories.map(value=>[value,copy.gallery[value]||value])].map(([value,label])=>`<button type="button" class="filter-button" data-filter="${esc(value)}" aria-pressed="${value==='all'}">${esc(label)}</button>`).join('');
    filters.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;category=button.dataset.filter;visibleCount=site.gallery.initialGridCount;filters.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));paint();});
  }
  root.querySelector('.gallery-lead')?.addEventListener('click',()=>openViewer(lead.id,category==='all'?[lead,...allItems]:currentItems()));
  function currentItems(){return category==='all'?allItems:allItems.filter(item=>item.category===category);}
  function paint(){
    const current=currentItems();
    const items=current.slice(0,visibleCount);
    grid.innerHTML=items.map(asset=>galleryTile(asset)).join('');
    more.hidden=current.length<=visibleCount;
    grid.querySelectorAll('[data-open-asset]').forEach(button=>button.addEventListener('click',()=>openViewer(button.dataset.openAsset,category==='all'?[...(lead?[lead]:[]),...allItems]:currentItems())));
    grid.querySelectorAll('[data-gallery-image]').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.closest('.tile-media').querySelector('.tile-error').hidden=false;},{once:true}));
    grid.querySelectorAll('.retry-tile').forEach(button=>button.addEventListener('click',()=>{const frame=button.closest('.tile-media'),img=frame.querySelector('img');button.disabled=true;img.hidden=false;frame.querySelector('.tile-error').hidden=true;img.addEventListener('error',()=>{img.hidden=true;frame.querySelector('.tile-error').hidden=false;},{once:true});const url=new URL(img.src);url.searchParams.set('retry','1');img.src=url;}));
    if(!items.length){grid.innerHTML=`<div class="empty-filter"><p>${esc(copy.gallery.emptyFilter)}</p>${category!=='all'?`<button type="button" class="text-action" data-reset-filter>${esc(copy.gallery.resetFilter)} ${arrow}</button>`:''}</div>`;grid.querySelector('[data-reset-filter]')?.addEventListener('click',()=>filters.querySelector('[data-filter="all"]')?.click());}
  }
  root.querySelector('#gallery-more')?.addEventListener('click',()=>{visibleCount+=site.gallery.revealCount;paint();});
  paint();
}

function galleryTile(asset) {
  const isVideo=asset.type==='video';
  const label=`${isVideo?copy.gallery.playVideo:copy.gallery.openImage}: ${asset.alt}`;
  const sources=!isVideo&&asset.variants?.length?` srcset="${asset.variants.map(variant=>`${esc(variant.src)} ${variant.width}w`).join(', ')}" sizes="(max-width:699px) 50vw, 33vw"`:'';
  return `<figure class="gallery-tile" data-category="${esc(asset.category||'')}"><div class="tile-media"><button class="gallery-thumb" type="button" data-open-asset="${esc(asset.id)}" aria-label="${esc(label)}"><span class="tile-frame${isVideo?' tile-frame--video':''}"><img data-gallery-image src="${esc(isVideo?asset.posterSrc:asset.src)}"${sources} alt="" width="${asset.width}" height="${asset.height}" loading="lazy" decoding="async">${isVideo?`<span class="motion-tag">${esc(copy.gallery.motion)}</span><span class="play-mark" aria-hidden="true">${playIcon()}</span>`:''}</span></button><span class="tile-error" hidden>${esc(isVideo?copy.media.videoError:copy.media.error)} <button class="retry-tile" type="button">${esc(copy.shared.retry)}</button></span></div>${asset.caption?`<figcaption>${esc(asset.caption)}</figcaption>`:''}</figure>`;
}

function bindBooking() {
  const state=root.querySelector('#booking-state'); const stepItems=[...root.querySelectorAll('.step-item')];
  const offers=publishedOffers(site); let draft={alias:'',email:'',offeringId:null,preferredDate:'',preferredTime:'',timezone:'',note:'',adult:false,policy:false};
  let step='details',prepared=null,lastErrors={};
  const setStepIndicator=current=>stepItems.forEach((item,index)=>{const n=index+1;item.classList.toggle('is-complete',n<(current==='details'?1:current==='review'?2:3));item.classList.toggle('is-current',n===(current==='details'?1:current==='review'?2:3));item.removeAttribute('aria-current');if(n===(current==='details'?1:current==='review'?2:3))item.setAttribute('aria-current','step');});
  const timezoneValues=timezoneOptions(); let detected='';try{detected=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch{}
  const timezoneOptionsHtml=`<option value="">${esc(copy.booking.fields.timezone.placeholder)}</option>${timezoneValues.map(zone=>`<option value="${esc(zone)}"${zone===detected?' selected':''}>${esc(zone.replaceAll('_',' '))}</option>`).join('')}`;
  if(detected && timezoneValues.includes(detected)) draft.timezone=detected;

  function showDetails(focusFirst=false){
    step='details';prepared=null;setStepIndicator(step);
    const f=copy.booking.fields; const errors=lastErrors;
    state.innerHTML=`${Object.keys(errors).length?errorSummary(errors):''}<form id="booking-form" class="booking-form" novalidate>
      <h2>${esc(copy.booking.detailsHeading)}</h2>${offers.length?offerField():''}
      <div class="form-grid form-grid-two"><div class="field-group"><label for="alias">${esc(f.alias.label)}</label><input class="form-control" id="alias" name="alias" type="text" autocomplete="nickname" maxlength="60" required value="${esc(draft.alias)}" placeholder="${esc(f.alias.placeholder)}" aria-invalid="${Boolean(errors.alias)}" aria-describedby="${errors.alias?'error-alias':''}"><span class="field-error" id="error-alias"${errors.alias?'':' hidden'}>${errors.alias?esc(copy.errors.alias):''}</span></div>
      <div class="field-group"><label for="email">${esc(f.email.label)}</label><input class="form-control" id="email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required value="${esc(draft.email)}" placeholder="${esc(f.email.placeholder)}" aria-invalid="${Boolean(errors.email)}" aria-describedby="${errors.email?'error-email':''}"><span class="field-error" id="error-email"${errors.email?'':' hidden'}>${errors.email?esc(copy.errors.email):''}</span></div></div>
      ${offers.length?offerMarkupForBooking():''}
      <div class="form-grid form-grid-two"><div class="field-group"><label for="preferredDate">${esc(f.preferredDate.label)}</label><input class="form-control" id="preferredDate" name="preferredDate" type="date" required value="${esc(draft.preferredDate)}" aria-invalid="${Boolean(errors.preferredDate)}" aria-describedby="date-helper error-preferredDate"><span class="field-helper" id="date-helper">${esc(f.preferredDate.helper)}</span><span class="field-error" id="error-preferredDate"${errors.preferredDate?'':' hidden'}>${errors.preferredDate?esc(copy.errors.preferredDate):''}</span></div>
      <div class="field-group"><label for="preferredTime">${esc(f.preferredTime.label)}</label><input class="form-control" id="preferredTime" name="preferredTime" type="time" step="60" required value="${esc(draft.preferredTime)}" aria-invalid="${Boolean(errors.preferredTime)}" aria-describedby="time-helper error-preferredTime"><span class="field-helper" id="time-helper">${esc(f.preferredTime.helper)}</span><span class="field-error" id="error-preferredTime"${errors.preferredTime?'':' hidden'}>${errors.preferredTime?esc(copy.errors.preferredTime):''}</span></div></div>
      <div class="field-group"><label for="timezone">${esc(f.timezone.label)}</label><select class="form-control" id="timezone" name="timezone" required aria-invalid="${Boolean(errors.timezone)}" aria-describedby="error-timezone">${timezoneOptionsHtml}</select><span class="field-error" id="error-timezone"${errors.timezone?'':' hidden'}>${errors.timezone?esc(copy.errors.timezone):''}</span></div>
      <div class="field-group"><label for="note">${esc(f.note.label)}</label><textarea class="form-control" id="note" name="note" maxlength="1000" aria-describedby="note-helper note-count error-note" placeholder="${esc(f.note.placeholder)}">${esc(draft.note)}</textarea><span class="field-helper" id="note-helper">${esc(f.note.helper)}</span><span class="note-count" id="note-count">${draft.note.length}/1000</span><span class="field-error" id="error-note"${errors.note?'':' hidden'}>${errors.note?esc(copy.errors.note):''}</span></div>
      <div class="declaration-list"><div class="field-check"><input id="adult" name="adult" type="checkbox" required${draft.adult?' checked':''} aria-invalid="${Boolean(errors.adult)}" aria-describedby="error-adult"><label for="adult">${esc(f.adult.label)}</label><span class="field-error" id="error-adult"${errors.adult?'':' hidden'}>${errors.adult?esc(copy.errors.adult):''}</span></div>
      <div class="field-check"><input id="policy" name="policy" type="checkbox" required${draft.policy?' checked':''} aria-invalid="${Boolean(errors.policy)}" aria-describedby="error-policy"><label for="policy">${esc(f.policy.label)} <a href="/policies">${esc(f.policy.linkText)}</a></label><span class="field-error" id="error-policy"${errors.policy?'':' hidden'}>${errors.policy?esc(copy.errors.policy):''}</span></div></div>
      <button class="action action-primary action-mobile-full" type="submit">${esc(copy.booking.continue)} ${arrow}</button></form>`;
    const form=state.querySelector('#booking-form'); bindDraftFields(form);
    form.addEventListener('submit',event=>{event.preventDefault();collectDraft(form);const result=validateDraft(draft,site);lastErrors=result.errors;if(!result.valid){showDetails();state.querySelector('.error-summary')?.focus();return;}draft=result.draft;lastErrors={};showReview();});
    state.querySelectorAll('.error-summary a').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();state.querySelector(link.getAttribute('href'))?.focus();}));
    if(draft.timezone) form.elements.timezone.value=draft.timezone;
    updateDateMinimum(form);
    if(focusFirst) state.querySelector('#alias')?.focus({preventScroll:true});
  }
  function bindDraftFields(form){
    form.addEventListener('input',event=>{const el=event.target;if(el.name&&el.name in draft){draft[el.name]=el.type==='checkbox'?el.checked:el.value;}if(el.name==='note'){const count=state.querySelector('#note-count');count.textContent=`${el.value.length}/1000`;count.classList.toggle('is-near-limit',el.value.length>=800);}if(el.name==='timezone')updateDateMinimum(form);});
    form.addEventListener('change',event=>{const el=event.target;if(el.name&&el.name in draft)draft[el.name]=el.type==='checkbox'?el.checked:el.value;if(el.name==='timezone')updateDateMinimum(form);});
    form.addEventListener('focusout',event=>{const el=event.target;if(!lastErrors[el.name])return;collectDraft(form);const result=validateDraft(draft,site);if(result.errors[el.name])return;delete lastErrors[el.name];el.setAttribute('aria-invalid','false');const error=state.querySelector(`#error-${CSS.escape(el.name)}`);if(error){error.hidden=true;error.textContent='';}const summary=state.querySelector('.error-summary');if(!Object.keys(lastErrors).length)summary?.remove();else if(summary)summary.outerHTML=errorSummary(lastErrors);});
  }
  function collectDraft(form){for(const field of ['alias','email','offeringId','preferredDate','preferredTime','timezone','note','adult','policy']){const element=field==='offeringId'?form.querySelector('[name="offeringId"]:checked'):form.elements[field];if(element)draft[field]=element.type==='checkbox'?element.checked:element.value;}}
  function updateDateMinimum(form){const zone=form.elements.timezone.value;if(!zone)return;const now=new Date();try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const val=t=>parts.find(p=>p.type===t)?.value;form.elements.preferredDate.min=`${val('year')}-${val('month')}-${val('day')}`;}catch{}}
  function offerField(){return `<fieldset class="field-group offer-fieldset" id="offeringId"><legend>${esc(copy.booking.fields.offeringId.label)}</legend><div class="offer-grid">${offers.map(offer=>`<label class="offer-option"><input type="radio" name="offeringId" required value="${esc(offer.id)}"${draft.offeringId===offer.id?' checked':''}><span><strong>${esc(offer.title)}</strong><span>${esc(offer.description)}</span><span>${offer.durationMinutes?`${offer.durationMinutes} minutes · `:''}${esc(pricingText(offer))}</span></span></label>`).join('')}</div><span class="field-error" id="error-offeringId"${lastErrors.offeringId?'':' hidden'}>${lastErrors.offeringId?esc(copy.errors.offeringId):''}</span></fieldset>`;}
  function offerMarkupForBooking(){return '';}
  function errorSummary(errors){return `<div class="error-summary" tabindex="-1" role="alert"><h3>${esc(copy.errors.summary)}</h3><ul>${Object.keys(errors).map(key=>`<li><a href="#${key==='offeringId'?'offeringId':key}">${esc(copy.errors[key])}</a></li>`).join('')}</ul></div>`;}
  function showReview(){step='review';setStepIndicator(step);const offer=offers.find(item=>item.id===draft.offeringId);const rows=[[copy.booking.review.alias,draft.alias],[copy.booking.review.email,draft.email],[copy.booking.review.offering,offer?.title||copy.booking.review.generalRequest],[copy.booking.review.date,draft.preferredDate],[copy.booking.review.time,draft.preferredTime],[copy.booking.review.timezone,draft.timezone.replaceAll('_',' ')],[copy.booking.review.price,pricingText(offer)]];
    state.innerHTML=`<section class="review-state"><h2 id="booking-review-title" tabindex="-1">${esc(copy.booking.review.heading)}</h2><p>${esc(copy.booking.review.body)}</p><dl class="review-list">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}<div><dt>${esc(copy.booking.review.note)}</dt><dd class="review-note">${draft.note?esc(draft.note):esc(copy.booking.review.noNote)}</dd></div><div><dt>${esc(copy.booking.review.adult)}</dt><dd>${esc(copy.booking.review.declarationValue)}</dd></div><div><dt>${esc(copy.booking.review.policy)}</dt><dd>${esc(copy.booking.review.declarationValue)}</dd></div></dl><p class="review-notice">${esc(copy.booking.review.notice)}</p><div class="form-actions"><button class="action action-secondary" id="edit-details" type="button">${esc(copy.booking.edit)}</button><button class="action action-primary" id="prepare-request" type="button">${esc(copy.booking.prepare)} ${arrow}</button></div></section>`;
    state.querySelector('#booking-review-title').focus({preventScroll:true});state.querySelector('#edit-details').addEventListener('click',()=>showDetails());state.querySelector('#prepare-request').addEventListener('click',()=>{const result=prepareRequest(draft,site);if(!result.ok){if(result.code==='invalid-draft'){lastErrors=result.errors;showDetails();state.querySelector('.error-summary')?.focus();}else state.insertAdjacentHTML('afterbegin',`<p class="field-error">${esc(result.configErrors?.join(' ')||'The booking configuration needs attention.')}</p>`);return;}prepared=result;showReady();});
  }
  function showReady(){step='ready';setStepIndicator(step);const handoff=emailHandoff(site.booking.contactEmail,prepared.subject,prepared.body,site.booking.mailtoUriBudget);const emailControl=handoff.ok?`<a class="action action-primary" href="${esc(handoff.href)}">${esc(copy.booking.ready.email)} ${arrow}</a>`:`<div><button class="action action-primary" type="button" disabled>${esc(copy.booking.ready.email)}</button><p class="field-helper">${esc(handoff.code==='too-long'?copy.booking.ready.longEmail:copy.booking.ready.noEmail)}${handoff.code==='too-long'&&handoff.email?` <span class="contact-email">${esc(handoff.email)}</span>`:''}</p></div>`;
    state.innerHTML=`<section class="ready-state"><h2 id="booking-ready-title" tabindex="-1">${esc(copy.booking.ready.heading)}</h2><p>${esc(copy.booking.ready.body)}</p><label for="request-text">${esc(copy.booking.ready.requestTextLabel)}</label><textarea id="request-text" class="form-control request-text" readonly spellcheck="false">${esc(prepared.body)}</textarea><p class="ready-message" id="ready-message" aria-live="polite">${esc(copy.booking.ready.leavingNotice)}</p><div class="ready-actions">${emailControl}<button class="action action-secondary" id="copy-request" type="button">${esc(copy.booking.ready.copy)}</button><button class="action action-secondary" id="download-request" type="button">${esc(copy.booking.ready.download)}</button><button class="text-action" id="start-again" type="button">${esc(copy.booking.ready.startAgain)}</button></div></section>`;
    state.querySelector('#booking-ready-title').focus({preventScroll:true});
    state.querySelector('#copy-request').addEventListener('click',async()=>{const result=await (await import('/booking/booking-core.mjs')).copyRequestText(prepared.body);const message=state.querySelector('#ready-message');if(result.ok)message.textContent=copy.booking.ready.copied;else{const textarea=state.querySelector('#request-text');textarea.focus();textarea.select();message.textContent=copy.booking.ready.copyFallback;}});
    state.querySelector('#download-request').addEventListener('click',()=>{const result=downloadRequestText(prepared.body);if(!result.ok){const textarea=state.querySelector('#request-text');textarea.focus();textarea.select();state.querySelector('#ready-message').textContent=copy.booking.ready.copyFallback;}});
    state.querySelector('#start-again').addEventListener('click',()=>{draft={alias:'',email:'',offeringId:null,preferredDate:'',preferredTime:'',timezone:'',note:'',adult:false,policy:false};lastErrors={};showDetails(true);});
  }
  showDetails(true);
}

function openViewer(assetId, list) {
  if (!list?.length) return;
  const index=list.findIndex(asset=>asset.id===assetId);if(index<0)return;
  const trigger=document.activeElement;const dialog=document.createElement('dialog');dialog.className='gallery-viewer';dialog.setAttribute('aria-label',copy.gallery.viewerLabel);
  let position=index;let touchStart=null;
  const close=()=>{dialog.close();dialog.remove();document.body.classList.remove('viewer-open');if(document.fullscreenElement)document.exitFullscreen?.();if(trigger?.isConnected)trigger.focus({preventScroll:true});else document.querySelector('#page-title')?.focus({preventScroll:true});};
  const render=()=>{
    const asset=list[position],isVideo=asset.type==='video';
    const media=isVideo?`<video class="viewer-video" controls playsinline preload="none" poster="${esc(asset.posterSrc)}" aria-label="${esc(asset.alt)}"><source src="${esc(asset.src)}" type="video/mp4"></video>`:`<img class="viewer-image" src="${esc(asset.viewerSrc||asset.src)}" alt="${esc(asset.alt)}" width="${asset.width}" height="${asset.height}" decoding="async">`;
    dialog.innerHTML=`<div class="viewer-top"><span class="viewer-count">${position+1} / ${list.length}</span><button class="icon-action viewer-close" type="button" aria-label="${esc(copy.shared.close)}">${closeIcon()}</button></div><div class="viewer-body"><button class="icon-action viewer-prev" type="button" aria-label="${esc(copy.shared.previous)}"${position===0?' disabled':''}>${chevronIcon('left')}</button><div class="viewer-media">${media}<p class="viewer-error" hidden>${esc(copy.media.error)} <button type="button" class="retry-viewer">${esc(copy.shared.retry)}</button></p></div><button class="icon-action viewer-next" type="button" aria-label="${esc(copy.shared.next)}"${position===list.length-1?' disabled':''}>${chevronIcon('right')}</button></div><div class="viewer-bottom"><p>${asset.caption?esc(asset.caption):''}</p><div class="viewer-mobile-controls"><button class="icon-action viewer-prev" type="button" aria-label="${esc(copy.shared.previous)}"${position===0?' disabled':''}>${chevronIcon('left')}</button><span>${position+1} / ${list.length}</span><button class="icon-action viewer-next" type="button" aria-label="${esc(copy.shared.next)}"${position===list.length-1?' disabled':''}>${chevronIcon('right')}</button></div></div>`;
    dialog.querySelectorAll('.viewer-close').forEach(button=>button.addEventListener('click',close));
    dialog.querySelectorAll('.viewer-prev').forEach(button=>button.addEventListener('click',()=>move(-1)));
    dialog.querySelectorAll('.viewer-next').forEach(button=>button.addEventListener('click',()=>move(1)));
    const mediaEl=dialog.querySelector('img,video');mediaEl?.addEventListener('error',()=>{mediaEl.hidden=true;dialog.querySelector('.viewer-error').hidden=false;},{once:true});
    dialog.querySelector('.retry-viewer')?.addEventListener('click',()=>{mediaEl.hidden=false;dialog.querySelector('.viewer-error').hidden=true;mediaEl.addEventListener('error',()=>{mediaEl.hidden=true;dialog.querySelector('.viewer-error').hidden=false;},{once:true});mediaEl.src=mediaEl.currentSrc||mediaEl.src;});
    dialog.querySelector('.viewer-close').focus({preventScroll:true});
  };
  const move=delta=>{const next=position+delta;if(next<0||next>=list.length)return;const old=dialog.querySelector('video');if(old){old.pause();old.removeAttribute('src');old.querySelector('source')?.removeAttribute('src');old.load();}position=next;render();};
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();move(-1);}if(event.key==='ArrowRight'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();move(1);}});
  dialog.addEventListener('touchstart',event=>{touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  dialog.addEventListener('touchend',event=>{if(!touchStart)return;const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1);touchStart=null;},{passive:true});
  root.querySelector('#page-main')?.setAttribute('inert','');root.querySelector('.site-header')?.setAttribute('inert','');root.querySelector('.site-footer')?.setAttribute('inert','');
  root.querySelector('#sticky-booking')?.setAttribute('inert','');
  document.body.append(dialog);document.body.classList.add('viewer-open');document.dispatchEvent(new CustomEvent('aurora:overlay',{detail:true}));dialog.showModal();render();
  dialog.addEventListener('close',()=>{root.querySelectorAll('[inert]').forEach(node=>node.removeAttribute('inert'));document.body.classList.remove('viewer-open');document.dispatchEvent(new CustomEvent('aurora:overlay',{detail:false}));});
}

function closeIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';}
function playIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>';}
function chevronIcon(direction){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction==='left'?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}"/></svg>`;}
