# P029 R18 — Chrome-only HEA and store submission gate

**Date:** 21 November 2026  
**Chrome-only scope:** This audit does NOT require Opera E2E for a Chrome-only product, but all Chrome security and customer onboarding gates still apply. No GitHub Actions or Claude were invoked.

## Verified product and existing public listing

**Existing Google Chrome Web Store product:** `https://chromewebstore.google.com/detail/lbijjcmjnlcbooadjgjignfmhaiealpd`  
Public listing verified at version **0.4.0**, with old localhost broker and 15-minute grant copy. It is **not** the new cloud 0.7.0 and must not be described as such.

**Candidate source and artifact:** Chrome 0.7.0 in PR #12, exact deterministic ZIP `dist/LUCH-Browser-Companion-v0.7.0.zip`. SHA-256 `128447d4b2d9f80731bf20ed31e0d240a40487c9a55e464a9cb0369854e1e9d8`. ZIP and hash are staged in the PR branch, **not** on a public GitHub Release.

**Current Chrome build checks:** 41/41 Node tests PASS, 21/21 legacy local broker negatives PASS, package manifest contains RU/EN `_locales` and valid resources, exact 0.7.0 ZIP smoke installed as unpacked in a clean Chromium profile, service worker started, real first-use popup loaded with no JavaScript exceptions, harmless `example.com` loaded. The previously completed owner-signed-in ChatGPT + Chrome pilot demonstrated cloud OAuth, pairing, approved read, revoke and denied repeat read.

**Security and cloud:** Supabase P029 v7 protected MCP, per-account device grants, atomic pairing and scheduled job retention. Cloud interaction/pointer, independent two-tenant new-user onboarding and exact store-published CRX operation are **not** fully verified.

## HEA creative work actually committed

- Full RU/EN value-first buyer descriptions and explicit consent, onboarding and host-plan boundaries: [`STORE_LISTING_HEA_R18.md`](STORE_LISTING_HEA_R18.md).
- Product popup microcopy updated to remove redundant reinstall step, make pairing speakable as a plain natural-language request to the user's AI, and show technical tool name only in optional hint.
- Manifest RU and EN localization metadata added; packaging and two locales verified.
- Real test screenshot + site-brand-backed promo art and exact current icon: [`store-assets/r18/`](store-assets/r18/). All asset hashes independently verified on GitHub. Genuine 1280×800 onboarding UI screenshot is distinct from abstract or illustrative promo assets.
- Main-branch English/Russian setup documents now describe the real cloud URL and clearly distinguish public **0.4.0** from the **0.7.0** pilot.

## Customer viewpoint (HEA heuristic, not research or A/B test)

**Clarity 8/10:** First impression explains the promise in one line — an already familiar AI can understand *an individually selected tab*. Core read example and straightforward three-step flow eliminate much jargon.

**Desire to install 7/10:** Premium visuals, concrete page-summary use cases and revocation improve appeal. It remains a specialist product because its AI host must support custom MCP, and broad Chrome debugger install-time permission may alarm users.

**Ease of activation 5/10:** The user needs an eligible AI, a separate MCP OAuth connection, a one-time pairing code and a tab-level consent. Clean Chrome UI works, but no independently validated one-click first-user process exists. No marketing copy should pretend installation alone is sufficient.

**Trust 7/10:** Strong per-tab permission boundaries and explicit data-handling disclosures. Required debugger installation permission and cloud page-content transfer warrant heightened independent review and in-product explanations.

These scores are a structured editorial judgment, **not measured customer conversion**.

## AI/agent viewpoint

**Discovery 6/10 in the existing pilot connection:** The installed historical ChatGPT R12 TEST tool catalog currently contains 49 tools but **does not expose the newer `browser_list_approved_tabs`** despite the server implementing it. That means an AI may be unable to discover the exact approved target ID without a host-level tool refresh, and must not ask for all-tabs metadata simply to work around that restriction.

**Action safeguards:** Actual browser tools require online device, per-tab grant and scope. Host write permissions depend on workspace/plan. A read-only agent must not present click/pointer results as successful or hallucinate more permissions.

**Fix before public:** Refresh/republish the app's tool catalog for supported hosts and verify that a new user can discover `browser_list_approved_tabs` and run `browser_read_text` without granting all-tabs metadata. Separately test cloud write/pointer and cross-account denial.

## Chrome Web Store submission blocker

Reached the **existing publisher's developer dashboard** via authorized Chrome and it redirected to Google **'Confirm your identity / sign in again'**. The authenticated browser session cannot proceed until **the account owner personally completes Google's reauthentication challenge**. No credentials, passwords or second-factor codes were requested from or transmitted to ChatGPT.

Chrome Web Store API documentation also requires first upload/listing/privacy setup through the dashboard and developer two-step verification. Existing item must be **updated in place**, not duplicated.

After authentication and completion of remaining security/AI-host tests: use the staged exact ZIP, the HEA RU/EN description, the four GitHub `store-assets/r18/` files, update Privacy Practices to reflect actual cloud page content and required debugger permission, and submit for review. Google's acceptance is a separate stage, not guaranteed.

**Decision: New Chrome 0.7.0 NOT SUBMITTED, NOT PUBLIC. Public 0.4.0 remains live.**
