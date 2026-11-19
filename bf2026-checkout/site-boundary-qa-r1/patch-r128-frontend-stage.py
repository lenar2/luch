#!/usr/bin/env python3
"""R128: copy the approved R109 frontend and annotate its existing 10 CTA buttons.
Never modifies the source checkout or production site.
"""
from pathlib import Path
import hashlib,json,re,shutil,sys

SRC=Path('/srv/factory-scratch/luch-public-site-v01/__white_friday_wf_checkout_r109_20261118_5b7f19')
ROOT=Path('/srv/factory-scratch/bf2026-r128-frontend-isolated-20261119')
DST=ROOT/'www'
EXPECTED_SOURCE_SHA='89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3'
ACTIONS={
 1:('Исцеление раны отвержения',8934973,1686768,2263300143,'single:rejection',3333),
 2:('Исцеление раны обесценивания',8934925,1686753,2263300584,'single:devaluation',3333),
 3:('Исцеление страха быть собой',8934974,1686770,2263300881,'single:self',3333),
 4:('Исцеление чувства вины',8934979,1686767,2263301182,'single:guilt',3333),
 5:('Исцеление отвержения',8933492,1686693,2263299065,'single:rejection_program',6990),
 6:('Школа для девушек на выданье (ДНВ)',8934207,1686740,2263299929,'single:dnv',7200),
 7:('Союз нового времени',8919715,1686738,2263299843,'single:union',6000),
 8:('Тренер по отношениям',8934247,1686781,2263302397,None,28000),
 9:('ИСТОЧНИК',8934262,1686741,2263300014,'single:source:1',6000),
 12:('Личная работа',8934993,1686776,2263298821,'single:personal_zoom',80000)
}
def fail(code):sys.exit(code)
if len(sys.argv)!=2:fail('R128_USAGE: patch-r128-frontend-stage.py R128_PREVIEW_JS_FILE')
script=Path(sys.argv[1]).resolve()
if script.name!='r128-cta-challenge-preview.js' or not script.is_file():
 fail('R128_REFUSE_NON_CANONICAL_PREVIEW_SCRIPT')
if not SRC.is_dir() or DST.exists():fail('R128_REFUSE_SOURCE_OR_EXISTING_PREVIEW')
source=(SRC/'index.html').read_bytes()
source_sha=hashlib.sha256(source).hexdigest()
if source_sha!=EXPECTED_SOURCE_SHA:fail('R128_APPROVED_R109_SOURCE_SHA_MISMATCH')
html=source.decode('utf8')
if b'assets/vf109-cart.js' not in source or b'assets/vf109-checkout-bridge.js' not in source:
 fail('R128_NOT_APPROVED_R109_SOURCE')
if 'r128-cta-challenge-preview.js' in html:fail('R128_ALREADY_INSTALLED')
for lot,(title,offer,widget,guard,route,price) in ACTIONS.items():
 title_rx=r'<h3\b(?=[^>]*id="lot-title-'+str(lot)+r'")[^>]*>'+re.escape(title)+r'</h3>'
 if len(re.findall(title_rx,html))!=1:fail('R128_APPROVED_TITLE_MISMATCH_'+str(lot))
 pat=r'(<button class="buy-lot" type="button" data-add="'+str(lot)+r'")([^>]*)(>)'
 attrs=(f' data-r128-lot="{lot}" data-r128-offer="{offer}" data-r128-widget="{widget}"'
  f' data-r128-guard-block="{guard}" data-r128-price="{price}"')
 if route:
  attrs+=f' data-r128-route="{route}" data-r128-status="INDIVIDUAL_QA_ONLY"'
 elif lot==8:
  attrs+=' data-r128-status="QA_ONLY_NOT_IN_INDIVIDUAL_ALLOWLIST"'
 if lot==9:
  attrs+=(
   ' data-r128-route-1="single:source:1" data-r128-offer-1="8934262"'
   ' data-r128-widget-1="1686741" data-r128-guard-block-1="2263300014"'
   ' data-r128-price-1="6000" data-r128-route-2="single:source:2"'
   ' data-r128-offer-2="8934987" data-r128-widget-2="1686774"'
   ' data-r128-guard-block-2="2263301667" data-r128-price-2="10000"'
  )
 new,count=re.subn(pat,lambda m:m[1]+attrs+m[2]+m[3],html)
 if count!=1:fail('R128_CTA_NOT_UNIQUE_'+str(lot))
 html=new
if html.count('</body></html>')!=1:fail('R128_CLOSING_HTML_NOT_UNIQUE')
html=html.replace('</body></html>',
 '<script src="assets/r128-cta-challenge-preview.js" defer></script></body></html>')
shutil.copytree(SRC,DST,symlinks=False)
(DST/'index.html').write_text(html,encoding='utf8')
(DST/'assets'/'r128-cta-challenge-preview.js').write_bytes(script.read_bytes())
if hashlib.sha256((SRC/'index.html').read_bytes()).hexdigest()!=EXPECTED_SOURCE_SHA:
 fail('R128_SOURCE_HTML_CHANGED_CONCURRENTLY')
report={
 'schema':'bf2026.r128.isolated.frontend-cta-patch.v1',
 'source_index_sha256':source_sha,
 'isolated_index_sha256':hashlib.sha256((DST/'index.html').read_bytes()).hexdigest(),
 'preview_js_sha256':hashlib.sha256((DST/'assets'/'r128-cta-challenge-preview.js').read_bytes()).hexdigest(),
 'existing_cta_buttons_patched':len(ACTIONS),
 'site_lots':list(ACTIONS),
 'individual_route_keys':9,
 'source_variants':2,
 'trainer_qa_only':True,
 'public_payment_enabled':False,
 'getcourse_forms_posted':False,
 'production_written':False
}
(ROOT/'R128_FRONTEND_PATCH_EVIDENCE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('R128_FRONTEND_ISOLATED_PATCHED',json.dumps(report,ensure_ascii=False))
