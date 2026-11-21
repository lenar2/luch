# LUCH Browser Companion · 0.7.0 (P029)

**Status: DRAFT / RELEASE HOLD — not publicly distributed.** This is the actively maintained engineering candidate for Chrome and Opera. Historical R2 documents remain available in their versioned files, but are not current installation instructions.

## Product goal

Use **your existing ChatGPT or another independently compatible AI host** to work with the browser tabs you authorize. LUCH supplies browser tools, not another chat or a paid model API. A personal OpenAI or Anthropic API key is not required.

The host's own terms, account plan, approval flow and availability still apply. In particular, the ability to install a free browser extension does **not** guarantee that ChatGPT Free/Plus/Pro can use every custom MCP write/cursor action. See [OpenAI's official host requirements](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).

## Architecture

```
Existing AI chat + user-authorized OAuth
         ↓
https://api.lenarsalimov.ru/luch/browser/mcp
         ↓ account identity + device selection + current tab grant
LUCH Supabase Edge Function / short-lived job relay
         ↓ separate paired device token (not AI host OAuth token)
Chrome / Opera MV3 extension
         ↓ user-approved tab, permission scope, live origin checks
Browser content or interaction
```

### Real permission model

- One-time 8-digit pairing code, valid for 10 minutes, single use and rate limited.
- Each browser device is attached to exactly one authenticated account.
- **Read** permission is per tab and must be explicitly granted through Chrome/Opera's extension UI.
- **Interaction** (clicking, typing, navigation) requires an additional per-tab user choice.
- **Precise pointer** requires a separate per-tab interaction approval and Chrome's powerful **optional** `debugger` permission, requested only when the user clicks to enable this advanced mode. Ordinary installation, pairing and reading do not request debugger.
- Optional **all-open-tabs metadata** requires the optional `tabs` permission and a separate sharing switch; other tabs' contents remain private.
- Closing the tab/session, changing origin, revoking the grant or disconnecting removes the corresponding access.
- The cloud server checks exact account, device, tab, grant ID and permission scope. The extension independently checks live grants before browser actions.
- Browser job payloads and revoked metadata follow the [P029 retention policy](../../docs/browser-companion-privacy.md) (see the root repository `docs/browser-companion-privacy.md`).

### What works, and what is not yet verified

**Verified on a dedicated owner's ChatGPT + Chrome pilot:** OAuth connection, tool discovery, one-time device pairing, an actual approved `https://example.com` tab read, and rejection after tab-grant revocation.

**Engineering checks:** 38/38 Node tests and 21/21 historical local-broker security negatives run on LUCH Server; Edge Function v7 deployed; scheduled P029 data retention tested. These are not a substitute for independently verified fresh-user or multi-account E2E.

**Blocking before public release:** real Opera exact-build extension E2E, first-use flow with a new user and workspace, cloud browser write/pointer operation validation, independent security review, a final immutable package + checksum tied to the reviewed commit, verified screenshots and marketplace approval. Chrome Web Store and Opera Add-ons require their own review processes.

## Current connection instructions (eligible users / engineering testers only)

1. In an AI host that actually supports custom remote MCP, add `https://api.lenarsalimov.ru/luch/browser/mcp` and complete LUCH OAuth in that host. Do **not** supply a personal model API key.
2. Install the **reviewed private test build** in a disposable Chrome profile. No customer download should use GitHub Actions artifacts or old `0.5.x`/`0.6.0` ZIPs; those are historical and not the cloud candidate.
3. Ask your connected AI to call `browser_companion_pairing_create`. Approve that tool call and enter the one-time code directly into the extension popup. Do not paste it in chat or an issue.
4. Open a harmless page. Click the extension icon on that tab to grant **Read**. Confirm using `browser_companion_status`, `browser_list_approved_tabs` and `browser_read_text`.
5. Choose **Interaction** separately only for actions you understand; revoke tab access in the extension when finished.

## Engineering

From this folder:
```bash
node --test tests/*.test.mjs
node security-qa.mjs
deno check --node-modules-dir=auto supabase/functions/p029-browser-companion/index.ts
bash package.sh
```

Run all tests on **LUCH Server**; P029 GitHub Actions workflows are intentionally absent and must not be re-enabled. `package.sh` creates an unpublished local candidate ZIP and SHA-256, **not** a public release.

- [Latest R17 release-gate audit](RELEASE_READINESS_R17.md)
- [ChatGPT pilot and revoke evidence](https://github.com/lenar2/luch/pull/12)
- [Browser Companion privacy disclosure](https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md)
- [Support](https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md)

No changes to the owner's production browser, Apple profile, another AI host or store listing are made by installing this private candidate.
