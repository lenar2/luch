# LUCH Browser Companion — Help & Support

**Status:** Early-access release candidate; requires a compatible local LUCH Companion broker. Installing the Chrome extension alone is not enough.

LUCH Browser Companion lets you share **specific tabs you choose** with your locally paired LUCH connection. It does **not** automatically read all tabs.

## Basic workflow

1. Install LUCH Browser Companion from the Chrome Web Store.
2. On your own computer, ensure a compatible LUCH Companion broker is installed and running on `127.0.0.1:9248`. This capability is currently available only in supported LUCH setups; a general-purpose installer has not yet been released.
3. Open the extension popup. Enter the **eight-digit one-time pairing code** displayed by the local broker. Never enter website passwords in the extension.
4. Open the site you wish to share, click the extension icon, and select **Share this tab**.
5. Access is limited to that tab and expires automatically after **15 minutes**, or sooner if you click **Revoke access**, close the tab or navigate to a different website origin.
6. Select **Disconnect browser** to remove the pairing and all grants.

Only a user-authorized LUCH tool can ask for the approved tab's visible text. Chrome extensions cannot control or read unapproved tabs through this companion.

## Troubleshooting

**Cannot connect:** Verify the LUCH Companion broker is installed, running and reachable on the same computer. The 8-digit code expires five minutes after startup and is single-use. A standalone Chrome Web Store install does not launch the local broker automatically.

**The tab is not visible:** Check that you granted that specific tab and that 15 minutes have not passed. Select an ordinary HTTP(S) webpage; browser internal pages are not eligible.

**Read denied:** The page grant may have expired, been revoked, changed origin or belonged to a different profile. Reopen the popup and approve the tab again if appropriate.

**Reconnect required:** If the local broker restarts or you disconnect, pair again. Browser permissions do not silently transfer across browsers, devices or profiles.

## Data & privacy

Please read the [Browser Companion Privacy Policy](https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md). The extension handles approved page URLs, titles and visible text only as described there. Text requested through connected LUCH tools may be disclosed to the AI host that the user authorizes for the task.

## Support and bug reports

Use [GitHub Issues](https://github.com/lenar2/luch/issues) and label your report `Browser Companion` in the title. Include browser version, extension version, operating system and a description of the failure, **without** sharing pairing codes, tokens, cookies, passwords, screenshot content from private pages or personally identifiable information.

**Current availability notice:** The extension's pairing workflow depends on an independently installed compatible LUCH broker. The public self-service desktop installer, Windows end-to-end verification and general-release support are not yet confirmed.
