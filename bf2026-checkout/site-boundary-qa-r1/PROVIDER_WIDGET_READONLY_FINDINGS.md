# Read-only GetCourse Widget 1686693 transport inspection

Observed 2026-11-18 UTC using public unauthenticated GETs only; no form submit, order, payment, GetCourse UI or lock.

## Public embed and iframe

- Embed script: GET https://study.shkola-dnv.com/pl/lite/widget/script?id=1686693 → HTTP 200, JavaScript, 2,893 bytes.
- Embed script SHA256: 2a3c9167d018838598de7371b44cbf7cdf7dc73c5df3217a4d3aa49f306e8924.
- The script creates an iframe at /pl/lite/widget/widget and appends the parent page's current query string, referrer, page location, and optional clrtQueryData. This proves query-string forwarding, not that a particular query parameter controls an offer.
- Iframe: GET https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693 → HTTP 200, HTML, 25,921 bytes. Session cookies and per-visitor identifiers were deliberately not retained in this evidence file.

## Actual public form structure

The returned iframe HTML contains:
- One form, DOM id ltForm5780886, block data-id 2263265127.
- One hidden field named formParams[setted_offer_id], class external-value offer_id, with no value attribute in the returned HTML.
- Hidden formParams[willCreatePaidDeal]=1.
- Zero form-position-input controls and zero selectable offer-position controls in this widget response.
- One checkbox input. The public page variables show the offer-terms checkbox enabled; the separate mailing checkbox is also enabled and checked by default, with its required flag false. This requires explicit consent/privacy review before customer launch.

## What the inspected JavaScript proves

The public superlite-block JavaScript has a modal helper that fills elements with class external-value plus a key from an explicit values object. Its custom modal form path passes position.offer_id into that helper.

The ordinary embed script path inspected above only creates the iframe and forwards the page query string. No observed code in the inspected embed/iframe path maps a URL query parameter into the hidden offer_id field. Do not invent an offer_id query parameter or claim that the iframe supports dynamic offer selection.

Relevant static asset SHA256:
- superlite-block.js: 21b95db3cdde8bee0c8ec643fd6e684f1b8b5379267e3fa0969716efaacc9169
- global-function.js: de3e5c931f1810dc1e1e98e770a108101079055446af133a3bf08956f9c24dcf
- custom-form.js: fd2cac6a4c8350ff12436898e290fea42358ea1eebad5ae59ea56819eea623fa

## Integration conclusion

This is consistent with the already-confirmed native handler binding in #4073 comment 6988661595: Widget 1686693 is a Lot5-only form, not a proven multi-offer cart and not a verified dynamic selection-transfer endpoint. A separate native multi-offer form or an explicitly supported provider-side selection mechanism still needs to be created/read back by the authorized UI worker and then proven through an actual native order.

No buyer data was entered. No form was submitted. No provider order or payment was created. This inspection does not change the R109 fail-closed registry.

