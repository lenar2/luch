# LUCH Browser Companion R19 · Chrome Web Store screenshots

**Prepared:** 21 November 2026 · **Status:** NOT submitted, candidate only.

The previous primary image showed a long **unpaired** form and failed to demonstrate the product's value. The new first frame shows an actually rendered, **read-approved tab UI** with a visible Revoke action. Two further frames show the distinct consent choices before Read and after separate Interaction approval.

The popups were genuinely executed from the precise 0.7.0 extension source in a disposable Chromium profile, with **deterministic, simulated per-tab connection/grant statuses**, not a live customer OAuth session. The safe test URL is `https://example.com/`. No secret codes, OAuth tokens, or customer pages appear. Images explicitly label their fixture nature.

## Images and order

| Locale | Primary | Before approval | Separate interaction |
| --- | --- | --- | --- |
| Russian | [01 Read approved](chrome-01-ru-approved-1280x800.jpg) | [02 Before consent](chrome-02-ru-before-consent-1280x800.jpg) | [03 Interaction separately allowed](chrome-03-ru-interaction-1280x800.jpg) |
| English | [01 Read approved](chrome-01-en-approved-1280x800.jpg) | [02 Before consent](chrome-02-en-before-consent-1280x800.jpg) | [03 Interaction separately allowed](chrome-03-en-interaction-1280x800.jpg) |

Each picture: **1280×800** JPEG, real LUCH site mark and extension state with illustrative editorial callouts. All six were compared byte-for-byte with the last render from the frozen inputs.

**Production store review caveat:** Chrome Web Store may demand screenshots with less editorial framing or directly from the browser window. If requested, supply the raw Chromium popup captures under the R19 test runner, without misrepresenting authenticated state.

## Reproduction and current package

- Real Chromium popup fixture state script: [chrome-ui-states-r19.cjs](../../tests/chrome-ui-states-r19.cjs)
- Renderer with actual popup captures: [render-chrome-r19.cjs](../render-chrome-r19.cjs)
- Reviewed Chrome extension ZIP: [LUCH-Browser-Companion-v0.7.0.zip](../../dist/LUCH-Browser-Companion-v0.7.0.zip)
- ZIP SHA-256: `4f7e4c204a4f1289d3dd44dfe62220c71ef233d28def457c943c7a07b9a31919`
- [Full HEA and engineering audit](../../R19_HEA_ENGINEERING_AUDIT.md)

No GitHub Actions or Claude E2E were used.
