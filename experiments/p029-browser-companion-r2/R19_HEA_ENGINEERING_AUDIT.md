# P029 · LUCH Browser Companion 0.7.0 — R19 HEA + engineering audit

**Date:** 21 November 2026  
**Scope:** Chrome-only candidate, existing compatible AI chat, no personal OpenAI API key, no separate LUCH chat, no Claude E2E or GitHub Actions.  
**Decision:** **HEA screens repaired, Chrome candidate tests PASS; PUBLIC RELEASE STILL HOLD pending fresh-account/live-operation gates and Google publisher authorization**.

## What a customer needs to understand

**Promise:** Let my familiar, compatible AI work with the **specific Chrome tab that I approve**. Reading, interacting with the page and precise pointer access are independent choices. Other tabs do not become readable automatically. User data can travel through LUCH Cloud to the chosen AI provider.

**Limit:** The user's AI, tariff and workspace must support custom remote MCP tools. Installation does not automatically add those tools to every ChatGPT account. The application is not a separate LUCH chat.

## HEA audit of every visible popup state

| State | Previous UX problem | R19 correction & verification |
| --- | --- | --- |
| Not paired / first-run | Four decorative feature cards pushed pairing input below the popup fold; title sounded as though a tab was already shared; a raw internal tool name confused novices | Hide marketing tiles, open with “Connect Chrome to your AI”, show three plain-language steps, place 8-digit field + CTA above fold, move the internal command name to docs. Verified RU/EN in real Chromium |
| Paired / tab not approved | Permission CTA visually competed with marketing blocks | Show current tab title and origin immediately, then a strong “Allow reading” button. Advanced features collapsed |
| Tab readable | Separate read/action scopes were present but hidden below repeated hero | Compact “Your tab. Your choice.” state with clear “LUCH can read” indication and always-visible revoke |
| Interaction approved | State text was generic and advanced controls too prominent | Explicit read **and** interaction status; revoke remains available; precise pointer is independent |
| Cloud temporarily offline | Any health fetch error deleted the persisted account pairing and local grants | Preserve local paired session on timeout/5xx, show honest offline status, disable new cloud operations, keep local revoke/disconnect. Confirmed dynamic background tests |
| Revocation while offline | Local revoke could report failure although local access was already removed | Immediate local revoke; show that cloud sync will retry. All queued work rechecks latest live grants |
| Disconnect with remote error | UI falsely implied server-side device token had been revoked | Stop local access first; return `cloudRevoked:false` if cloud revocation fails; display AI-side remote revoke instruction |
| Advanced tab overview | Long list of controls cluttered the primary workflow | Native accessible collapsed `details` block; the separate optional `tabs` permission remains required |
| Advanced precise pointer | Install-time `debugger` generated a powerful early warning before the user needed it | Move `debugger` to `optional_permissions`. Request it **only on a real user click** to enable precise pointer; denial keeps pointer off. Verified actual Chromium optional-permission install and VM denial |
| Error handling / languages | Hidden feedback at bottom; technical error labels; verbose onboarding | Move live alerts beneath connection status, improve expired/reused code wording and keep RU/EN parity |

**Actual UI state render evidence:** 9/9 cases PASS in a clean Chromium loading the exact packaged extension: RU/EN unpaired, paired/no grant, read grant, interaction grant, and RU temporary cloud outage. These are *real extension runtime UI screenshots with deterministic safe fixture response*, **not live authenticated-user pages**.

## Updated Chrome Web Store artwork

The primary screenshot is no longer the long unpaired onboarding view. R19 instead uses three connected/approved/interaction screens per locale, built around the **actual running popup**, with explicit fixture-state captions:

- [RU screenshots](store-assets/r19/): `chrome-01-ru-approved-1280x800.jpg`, `chrome-02-ru-before-consent-1280x800.jpg`, `chrome-03-ru-interaction-1280x800.jpg`.
- EN equivalents: `chrome-01-en-approved-1280x800.jpg`, `chrome-02-en-before-consent-1280x800.jpg`, `chrome-03-en-interaction-1280x800.jpg`.
- The R18 official LUCH-site-brand promotional tile and marquee remain optional; they are illustrations and must not be marketed as user-interface screenshots.

**Customer/AI editorial evaluation, not measured conversion:** Comprehension improves because the selected tab and revoke are now the focus. The main remaining adoption friction is **external MCP configuration and account entitlement**, not the visual layout. The host may hide or restrict tools regardless of extension quality.

## Engineering connection/security audit

**Audited path:** eligible AI host OAuth → `https://api.lenarsalimov.ru/luch/browser/mcp` → `browser_companion_pairing_create` one-time code → extension `/pair` → device-bound token hash → Chrome explicit per-tab activeTab grant → current scope on cloud grant → job queue → live worker consent recheck → page result → revocation.

**Confirmed engineering fixes:**

1. **Transient health check vs. real device revocation:** network outage/timeout no longer wipes pairing; explicit backend `paired:false` or `DEVICE_UNAUTHORIZED` invalidates it.
2. **Stale permissions race:** `performJob` reloads live browser-session grants instead of blindly using a polling snapshot; immediately before DOM action it checks matching grant ID, origin and interaction scope again. Precise-pointer action already rechecks live tab and consent before native input events.
3. **Heartbeat blackout:** edge route now upserts current grants before removing stale tab IDs. Database UNIQUE(`device_id`,`tab_id`) and rollback-only SQL test establish stable identity with no duplicate rows. This removes routine delete/reinsert gaps. Client grant publications are serialized and re-read latest session state before network transmission.
4. **Offline revoke and local-first disconnect:** a revoked tab cannot start new worker operations. If cloud is offline, local revoke is immediate and the state is synchronized later. A disconnected device loses its local credential before remote revocation is attempted. The UI explicitly warns if cloud token revocation was not confirmed.
5. **Least privilege:** default manifest requests `activeTab`, `scripting`, `storage`, `alarms`, scoped LUCH origin. `tabs` and **`debugger`** are optional. Direct real Chrome 157 Chromium smoke loaded the packaged extension with `hasDebuggerPermission:false`; runtime permission request is only triggered from the user-clicked precise-pointer control, and denial is tested.

**Most recent checks:**
- Node: **46/46 PASS**.
- Legacy broker security negatives: **21/21 PASS**.
- Deno type-check: PASS.
- Clean Chromium exact-ZIP permission and service-worker smoke: PASS.
- Popup state render: **9/9 PASS**, no popup JavaScript errors.
- Cloud HTTP smoke: `/health` 200 without device, MCP unauthenticated 401, device jobs unauthenticated 401, OAuth protected-resource metadata 200.
- P029 database retention cron: one active scheduled task; no in-flight jobs in the last check. `anon` and `authenticated` cannot call the privileged pairing-claim function.
- Supabase Edge Function: **v8 ACTIVE**.

**Exact candidate ZIP SHA-256:** `4f7e4c204a4f1289d3dd44dfe62220c71ef233d28def457c943c7a07b9a31919`; update it only if extension/package source changes.

## Important evidence boundaries / unfinished release gates

- The previously successful owner-authorized real ChatGPT + Chrome pilot (Nov 18) proved OAuth, device pairing, approved `example.com` body read, revoked-tab denial. **R19 has not rerun that positive E2E against a new authenticated owner session**, because the existing paired device was reported `online:false` in the current R12 TEST connector.
- The existing connected ChatGPT R12 TEST connector exposes 49 tools but **does not advertise the new `browser_list_approved_tabs`** tool. The cloud server implements it; the ChatGPT host/app catalog requires refresh and new-user verification. Do not request all-tabs metadata as a workaround.
- An independent fresh-user OAuth and multi-account/foreign-device isolation test and browser write/click/pointer E2E are still required before mass public use. Unit, mock VM, DB canary and API-smoke checks alone cannot prove this.
- Google Chrome Web Store developer dashboard currently requires the publisher to reconfirm their Google identity. **No owner credentials or 2FA codes were requested by LUCH**, and no 0.7.0 submission is claimed.
- Store currently publicly serves old **0.4.0**, which uses an obsolete local broker; 0.7.0 is **not public**. Update the existing store item, never create a duplicate. Approval by Google is a separate step.

## Release package references

- [HEA RU/EN customer description](STORE_LISTING_HEA_R18.md)
- [Current Chrome submission pack](STORE_LISTING_DRAFT.md)
- [Nine-state Chromium fixture runner](tests/chrome-ui-states-r19.cjs)
- [R19 screenshot renderer](store-assets/render-chrome-r19.cjs)
- [R19 screenshot images](store-assets/r19/)
- [Privacy disclosure](../../docs/browser-companion-privacy.md)
- [Detailed R18 prior release gate](R18_CHROME_HEA_PUBLICATION_GATE.md)

**R19 conclusion:** Chrome UX and offline/consent safety are materially improved and tested; final public Chrome publication remains blocked until owner Google reauthentication and remaining real multi-user/tool-catalog security gates pass. Opera is not required for a **Chrome-only** release.
