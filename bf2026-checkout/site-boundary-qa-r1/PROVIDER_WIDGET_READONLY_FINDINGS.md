# Read-only GetCourse Widget 1686693 transport inspection

Observed 2026-11-18 UTC using public unauthenticated GETs only; no form submit, order, payment, GetCourse UI or lock. The repeatable inspector and sanitized response are `inspect-widget-1686693.cjs` and `widget-1686693-inspection.json`.

## Public embed and iframe

- Embed script: GET https://study.shkola-dnv.com/pl/lite/widget/script?id=1686693 → HTTP 200, JavaScript, 2,893 bytes. It creates an iframe at /pl/lite/widget/widget and forwards the parent page query string, referrer, page location and optional clrtQueryData.
- Iframe: GET https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693 → HTTP 200, HTML. Response length and generated form DOM id vary per request; the stable block data-id observed is 2263265127.
- Per-visitor cookies, CSRF values and identifiers are deliberately not retained in the evidence file.

## Actual public form structure

The latest returned iframe HTML contains:
- One form in block data-id 2263265127.
- One hidden field named formParams[setted_offer_id], class external-value offer_id, with no value attribute in the returned HTML.
- Hidden formParams[willCreatePaidDeal]=1.
- Zero form-position-input controls and zero selectable offer-position controls.
- One checkbox input. The public page variables show the offer-terms checkbox enabled; the separate mailing checkbox is also enabled and checked by default, with its required flag false. This requires explicit consent/privacy review before customer launch.

## What the inspected JavaScript proves

The public superlite-block JavaScript has a modal helper that fills elements with class external-value plus a key from an explicit values object. Its custom modal form path passes position.offer_id into that helper.

The ordinary embed script path inspected above creates the iframe and forwards the parent query string. No observed code in the inspected embed/iframe path maps a URL query parameter into the hidden offer_id field. Do not invent an offer_id query parameter or claim that the iframe supports dynamic offer selection.

Relevant superlite-block.js SHA256: 21b95db3cdde8bee0c8ec643fd6e684f1b8b5379267e3fa0969716efaacc9169.

## Integration conclusion

This is consistent with the native handler binding in #4073 comment 6988661595: Widget 1686693 is a Lot5-only form, not a proven multi-offer cart and not a verified dynamic selection-transfer endpoint. A separate native multi-offer form or an explicitly supported provider-side selection mechanism still needs to be created/read back by the authorized UI worker and then proven through an actual native order.

No buyer data was entered. No form was submitted. No provider order or payment was created. This inspection does not change the R109 fail-closed registry.

