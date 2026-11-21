# ChatGPT × LUCH Browser Companion — use your existing AI conversation

**Updated:** November 21, 2026 · [Русский](CHATGPT_CONNECT.ru.md)

**The idea:** Let your existing, compatible AI understand **the one Chrome tab you approve**. Additional page actions require a separate approval. No second LUCH chat or personal OpenAI API key is required.

**Version status:** The public Chrome Web Store currently lists **0.4.0**, which requires the old localhost broker. The new cloud-connected **0.7.0 is a private test candidate and is not yet published to the store**. The instructions below are for authorized 0.7.0 testers, not customers using 0.4.0.

## Connect 0.7.0 — four steps

1. **Connect LUCH to a supported AI host.** In an eligible ChatGPT web workspace, go to **Plugins → + → Add custom MCP server**, name it “LUCH Browser Companion” and provide:

   `https://api.lenarsalimov.ru/luch/browser/mcp`

   Complete the OAuth authorization and review the permission notice. A workspace admin may need to enable custom MCP connections first.

2. **Request a pairing code.** Open the 0.7.0 extension popup in your test Chrome profile. In your AI chat with LUCH selected, say: **“Create a browser pairing code.”** Approve the tool call.

3. **Pair the browser.** Enter the **eight digits directly in the extension popup**, never in a chat message. The code expires after **10 minutes** and can only be redeemed once. The popup should show “Browser paired”.

4. **Approve a tab.** Open a harmless HTTPS website. Click the LUCH extension on that tab and choose **“Allow reading on this tab.”** Ask your connected AI: **“Read the approved tab and explain it briefly.”** Approve Interaction separately if you later need supported page actions and the AI host permits them.

**To revoke:** Select Revoke for the current tab or Disconnect browser in the extension. No other tab is readable without its own permission.

## Troubleshooting

- **No Add custom MCP server option:** Your plan, role, workspace or client may not support this connection. The extension cannot bypass AI-host restrictions.
- **LUCH tools unavailable:** Select the connected plugin for the current message. Some supported workspaces must refresh the tool catalog after a server update.
- **Pairing failed:** Codes can expire or be used already. Create a new one; never share one-time codes or device tokens in a chat.
- **Browser connected but tab unavailable:** Click the extension icon while on the desired tab and explicitly grant Read.
- **Chrome debugger warning:** The advanced precise-pointer capability needs this powerful install-time permission. Its use still needs a separate in-extension consent.
- **Idle browser:** Chrome's background worker may need time to wake. Do not blindly repeat an important action when execution status is uncertain.

## Availability and data handling

OpenAI currently documents full MCP with write/modify actions for eligible **Business and Enterprise/Edu** web workspaces, and read/fetch access for **Pro**. Support for Free/Go/Plus or every workspace cannot be presumed. A successful isolated Plus pilot does not establish universal entitlement.

Content you ask your AI to read from an approved tab travels through LUCH Cloud to your authorized AI provider. Review our [privacy disclosure](browser-companion-privacy.md) and avoid sensitive websites.

[Official OpenAI connection guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) · [Public Chrome Web Store — still 0.4.0](https://chromewebstore.google.com/detail/lbijjcmjnlcbooadjgjignfmhaiealpd) · [0.7.0 engineering candidate](https://github.com/lenar2/luch/pull/12).
