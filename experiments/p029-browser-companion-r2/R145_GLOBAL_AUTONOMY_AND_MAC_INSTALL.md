# P029 R14.5 — Unified Chrome permissions and autonomous browser actions

Version 0.8.7. After Chrome installs required host, tabs, downloads and debugger permissions and the device is paired, LUCH automatically grants reading, interaction, native pointer and keyboard capabilities to all ordinary HTTP(S) tabs in the same profile, including new tabs. No separate LUCH permission requests for a tab, action or pointer. Pause, Resume and Disconnect remain direct controls. Required Chrome install permission, account/device pairing and host-level rules are external, not bypassed.

Proof: 63/63 Node tests and 21/21 negative-security checks pass. Deterministic ZIP SHA256: 21c1d657c9bee17a61d63facd055c386bf4c121d0e846a49aecfc5f2f47fd77e.

Real user Mac Chrome app: /Users/lenarsalimov/Applications/Google Chrome.app. Native chrome://extensions displayed LUCH Browser Companion 0.8.7 after choosing unpacked folder /Users/lenarsalimov/Downloads/LUCH-Browser-Companion-0.8.7. Chrome Default/Secure Preferences shows ID mhkmbhcjjmphcinooemafikjfheppkoj, approved tabs, downloads, debugger and HTTP(S) hosts.

Not confirmed: authenticated AI-host action-to-Chrome live E2E and independent QA/Critic. Existing Chrome Web Store published 0.7.0; submitted 0.8.6 is under Google review, not this 0.8.7. No public 0.8.7 release claimed.