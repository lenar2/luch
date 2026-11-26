# P029 R6 verification - account + GUI onboarding

- Matched the real active, LUCH-authorized primary Mac device identity with the correct existing Companion credential and current official relay heartbeat. Deliberately rejected other local registrations. Credentials remain local.
- Inspected live Bridge SHA256 4486892bbeab0623f82c69516d3570ce1f02c6b53e9913501945461e4712f345; port 9240 Browser Bridge available. Increased its health probe timeout after observing multi-second replies under real user load.
- Verified old unpaired broker on 9248 is a separate unmanaged release and does not support new capabilities; future migration is gated by an exact observed source hash and explicit GUI confirmation.
- Read-only preflight through the real Mac and its authorized account: PASS. No daemon restarted or stopped.
- GUI AppleScript compiled through osacompile on authorized Mac in isolated staging. Not launched.
- Node tests: 17/17 PASS. Broker security checks: 21/21 PASS. Browser archive 0.5.2 checksum unchanged.
- New GUI packaging in macOS CI is an independent preview; Apple Developer signing/notarization and live account-to-browser E2E remain separate gates.
- No changes to production, the live Mac's Browser Bridge, Chrome Web Store or Opera were made during R6 staging.

STATUS = INSTALLER_CANDIDATE; ACCOUNT_BINDING_PREFLIGHT_PASS; LIVE_ACTIVATION_UNKNOWN; STORE_HOLD.
