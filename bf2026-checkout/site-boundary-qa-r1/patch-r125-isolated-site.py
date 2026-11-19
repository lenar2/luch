#!/usr/bin/env python3
"""BF2026 R125. Real R109 site -> isolated R125 preview, never production.
Adds mapping attributes to EXISTING 10 card CTA buttons, keeping all artwork,
approved headings and R109 basket code. Appends one stage-only script.
"""
from pathlib import Path
import hashlib,shutil,re,sys,json
SRC=Path('/srv/factory-scratch/luch-public-site-v01/__white_friday_wf_checkout_r109_20261118_5b7f19')
ROOT=Path('/srv/factory-scratch/bf2026-r125-frontend-isolated-20261119')
DST=ROOT/'www'
ACTIONS={
 1:('Исцеление раны отвержения',8934973,1686768),
 2:('Исцеление раны обесценивания',8934925,1686753),
 3:('Исцеление страха быть собой',8934974,1686770),
 4:('Исцеление чувства вины',8934979,1686767),
 5:('Исцеление отвержения',8933492,1686693),
 6:('Школа для девушек на выданье (ДНВ)',8934207,1686740),
 7:('Союз нового времени',8919715,1686738),
 8:('Тренер по отношениям',8934247,1686781),
 9:('ИСТОЧНИК',8934262,1686741),
 12:('Личная работа',8934993,1686776)
}
def fail(code):sys.exit(code)
if len(sys.argv)!=2 or not Path(sys.argv[1]).resolve().is_file():
 fail('R125_USAGE: patch-r125-isolated-site.py R125_JS_FILE')
script=Path(sys.argv[1]).resolve()
if script.name!='r125-single-cta-preview.js':
 fail('R125_REFUSE_NON_CANONICAL_SCRIPT')
if not SRC.is_dir() or DST.exists() or not ROOT.parent.is_dir():
 fail('R125_REFUSE_SOURCE_OR_EXISTING_PREVIEW')
raw=(SRC/'index.html').read_bytes()
if b'assets/vf109-cart.js' not in raw or b'assets/vf109-checkout-bridge.js' not in raw:
 fail('R125_NOT_APPROVED_R109_SOURCE')
html=raw.decode('utf8')
if 'r125-single-cta-preview.js' in html:fail('R125_ALREADY_INSTALLED')
for lot,(title,offer,widget) in ACTIONS.items():
 title_rx=r'<h3\\b(?=[^>]*id="lot-title-'+str(lot)+r'")[^>]*>'+re.escape(title)+r'</h3>'
 if len(re.findall(title_rx,html))!=1:
  fail('R125_APPROVED_TITLE_MISMATCH_'+str(lot))
 pat=r'(<button class="buy-lot" type="button" data-add="'+str(lot)+r'")([^>]*)(>)'
 attrs=' data-r125-lot="'+str(lot)+'" data-r125-offer="'+str(offer)+'" data-r125-widget="'+str(widget)+'"'
 if lot==9:
  attrs+=' data-r125-offer-2="8934987" data-r125-widget-2="1686774"'
 new,count=re.subn(pat,lambda m:m[1]+attrs+m[2]+m[3],html)
 if count!=1:fail('R125_CTA_NOT_UNIQUE_'+str(lot))
 html=new
if html.count('</body></html>')!=1:fail('R125_CLOSING_HTML_NOT_UNIQUE')
html=html.replace('</body></html>',
 '<script src="assets/r125-single-cta-preview.js" defer></script></body></html>')
source_sha=hashlib.sha256(raw).hexdigest()
shutil.copytree(SRC,DST,symlinks=False)
(DST/'index.html').write_text(html,encoding='utf8')
(DST/'assets'/'r125-single-cta-preview.js').write_bytes(script.read_bytes())
if hashlib.sha256((SRC/'index.html').read_bytes()).hexdigest()!=source_sha:
 fail('R125_SOURCE_HTML_CHANGED_CONCURRENTLY')
report={
 'schema':'bf2026.r125.isolated.frontend.patch.v1',
 'source_index_sha256':source_sha,
 'isolated_index_sha256':hashlib.sha256((DST/'index.html').read_bytes()).hexdigest(),
 'isolated_js_sha256':hashlib.sha256((DST/'assets'/'r125-single-cta-preview.js').read_bytes()).hexdigest(),
 'card_cta_count':len(ACTIONS),
 'card_lots':list(ACTIONS),
 'trainer_qa_only':True,
 'source_dual_native_variants':True,
 'production_written':False,
 'payment_route_enabled':False
}
(ROOT/'R125_PATCH_EVIDENCE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('R125_ISOLATED_PREVIEW_PATCHED',json.dumps(report))
