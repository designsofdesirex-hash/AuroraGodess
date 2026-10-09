import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'config' / 'assets.json'
OUT = ROOT / 'assets' / 'images'
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(MANIFEST.read_text(encoding='utf-8-sig'))

def fit(image, width, ratio, focal=(.5, .5)):
    height = round(width / ratio)
    return ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS,
                        centering=(focal[0] / 100, focal[1] / 100))

def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', quality=84, method=6)
    return {'src': '/' + path.relative_to(ROOT).as_posix(), 'width': image.width, 'height': image.height, 'type': 'image/webp'}

for asset in data['assets']:
    if not asset.get('published') or not asset.get('src') or asset.get('type') != 'image':
        continue
    source_path = ROOT / asset['src'].lstrip('/')
    with Image.open(source_path) as opened:
        source = ImageOps.exif_transpose(opened).convert('RGB')
    desktop_ratio = {'6:7': 6/7, '4:5': 4/5, '16:9': 16/9, '3:4': 3/4}.get(asset.get('frameRatioDesktop'), 3/4)
    mobile_ratio = {'4:5': 4/5, '3:4': 3/4}.get(asset.get('frameRatioMobile'), desktop_ratio)
    fp = asset.get('focalPointDesktop') or {'x': 50, 'y': 50}
    focal = (fp['x'], fp['y'])
    variants = []
    mobile_variants = []
    if asset['role'] == 'hero':
        widths = [480, 768, 1200, 1600]
        mobile_widths = [480, 768]
    elif asset['role'] == 'gallery-lead':
        widths = [768, 1200, 1600]
        mobile_widths = [480, 768]
    else:
        widths = [400, 800, 1200]
        mobile_widths = []
    for width in widths:
        path = OUT / f"{asset['id']}-{width}.webp"
        variants.append(save(fit(source, width, desktop_ratio, focal), path))
    for width in mobile_widths:
        mfp = asset.get('focalPointMobile') or fp
        path = OUT / f"{asset['id']}-mobile-{width}.webp"
        mobile_variants.append(save(fit(source, width, mobile_ratio, (mfp['x'], mfp['y'])), path))
    viewer = ImageOps.contain(source, (2200, 2200), method=Image.Resampling.LANCZOS)
    viewer_path = OUT / f"{asset['id']}-viewer.webp"
    save(viewer, viewer_path)
    asset['src'] = variants[-2]['src'] if len(variants) >= 2 else variants[-1]['src']
    asset['width'] = next(v['width'] for v in variants if v['src'] == asset['src'])
    asset['height'] = next(v['height'] for v in variants if v['src'] == asset['src'])
    asset['variants'] = variants
    asset['mobileVariants'] = mobile_variants
    asset['mobileSrc'] = mobile_variants[-1]['src'] if mobile_variants else None
    asset['viewerSrc'] = '/' + viewer_path.relative_to(ROOT).as_posix()

MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Prepared responsive WebP crops for {sum(1 for a in data['assets'] if a.get('published') and a.get('type') == 'image')} approved images.")
