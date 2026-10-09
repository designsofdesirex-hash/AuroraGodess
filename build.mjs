import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');
const readJson = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
const [site, copy, manifest, shell] = await Promise.all([
  readJson('config/site.json'), readJson('config/copy.json'), readJson('config/assets.json'),
  readFile(join(root, 'index.html'), 'utf8')
]);

const mode = process.env.AURORA_BUILD_MODE || site.buildMode || 'preview';
if (!['preview', 'production'].includes(mode)) throw new Error('AURORA_BUILD_MODE must be preview or production.');
const required = manifest.assets.filter(asset => asset.requiredForLaunch);
const invalidRequired = required.filter(asset => !asset.ownerApproved || !asset.published || !asset.src || !asset.alt);
if (mode === 'production') {
  const errors = [];
  if (invalidRequired.length) errors.push(`Required approved photo assignments missing: ${invalidRequired.map(a => a.id).join(', ')}`);
  if (!site.booking?.contactEmail) errors.push('Real booking contact email is required.');
  if (!site.siteUrl || !/^https:\/\//.test(site.siteUrl)) errors.push('Final HTTPS siteUrl is required.');
  if (errors.length) throw new Error(`Production build blocked:\n- ${errors.join('\n- ')}`);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'styles.css'), join(out, 'styles.css'));
await cp(join(root, 'app.js'), join(out, 'app.js'));
await mkdir(join(out, 'design'), { recursive: true });
await cp(join(root, 'design', 'tokens.css'), join(out, 'design', 'tokens.css'));
await cp(join(root, 'booking', 'booking-core.mjs'), join(out, 'booking', 'booking-core.mjs'));
await mkdir(join(out, 'assets', 'fonts'), { recursive: true });
await cp(join(root, 'assets', 'fonts', 'Manrope-Variable.woff2'), join(out, 'assets', 'fonts', 'Manrope-Variable.woff2'));
await cp(join(root, 'assets', 'fonts', 'OFL-Manrope.txt'), join(out, 'assets', 'fonts', 'OFL-Manrope.txt'));
await mkdir(join(out, 'assets'), { recursive: true });
await cp(join(root, 'design', 'aurora-wordmark.svg'), join(out, 'assets', 'aurora-wordmark.svg'));
await cp(join(root, 'design', 'aurora-monogram.svg'), join(out, 'assets', 'aurora-monogram.svg'));
await mkdir(join(out, 'assets', 'images'), { recursive: true });
await cp(join(root, 'design', 'aurora-share.png'), join(out, 'assets', 'images', 'aurora-share.png'));

const publicAssets = manifest.assets
  .filter(asset => asset.ownerApproved === true && asset.published === true && asset.src && asset.alt)
  .map(({ id, role, type, category, order, src, mobileSrc, viewerSrc, posterSrc, width, height, variants, mobileVariants, alt, caption,
    frameRatioDesktop, frameRatioMobile, focalPointDesktop, focalPointMobile }) => ({
    id, role, type, category, order, src, mobileSrc, viewerSrc, posterSrc, width, height, variants, mobileVariants, alt, caption,
    frameRatioDesktop, frameRatioMobile, focalPointDesktop, focalPointMobile
  }));
const publicPaths = new Set();
for (const asset of publicAssets) {
  for (const path of [asset.src, asset.mobileSrc, asset.viewerSrc, asset.posterSrc,
    ...(asset.variants || []).map(variant => variant.src), ...(asset.mobileVariants || []).map(variant => variant.src)].filter(Boolean)) publicPaths.add(path);
}
for (const publicPath of publicPaths) {
  if (!publicPath.startsWith('/assets/')) throw new Error(`Public asset path must be local: ${publicPath}`);
  const relative = publicPath.slice(1);
  const source = resolve(root, relative);
  if (!source.startsWith(`${resolve(root, 'assets')}${sep}`)) throw new Error(`Asset escaped assets directory: ${publicPath}`);
  await mkdir(dirname(join(out, relative)), { recursive: true });
  await cp(source, join(out, relative));
}

await mkdir(join(out, 'config'), { recursive: true });
await writeFile(join(out, 'config', 'copy.json'), JSON.stringify(copy), 'utf8');
await writeFile(join(out, 'config', 'site.json'), JSON.stringify({
  siteUrl: site.siteUrl, currency: site.currency, ageEntry: site.ageEntry, routes: site.routes,
  booking: site.booking, gallery: site.gallery, links: site.links
}), 'utf8');
await writeFile(join(out, 'config', 'public-assets.json'), JSON.stringify(publicAssets), 'utf8');

for (const route of site.routes) {
  const target = join(out, route.output);
  await mkdir(dirname(target), { recursive: true });
  const robots = route.noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">';
  const canonical = site.siteUrl ? `<link rel="canonical" href="${site.siteUrl.replace(/\/$/, '')}${route.path}">` : '';
  const html = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${route.description.replaceAll('"', '&quot;')}">`)
    .replace(/<meta name="robots" content="[^"]*">/, robots)
    .replace('</head>', `${canonical}\n</head>`);
  await writeFile(target, html, 'utf8');
}

console.log(`Built ${site.routes.length} static routes into ${out} (${mode} mode).`);
if (invalidRequired.length) console.log(`Preview-only required photo placeholders: ${invalidRequired.map(a => a.id).join(', ')}`);
if (!site.booking.contactEmail) console.log('Booking email is unset; email handoff will be disabled in preview.');
if (!site.siteUrl) console.log('Final domain is unset; canonical URLs are omitted.');
