# P029 R6 - Browser Companion desktop onboarding (Mac preview)

Status: draft. Not released, not notarized; do not upload to Chrome/Opera yet.

## Account truth (independently checked on a real paired Mac)
LUCH already has an authenticated Mac Companion linked to its account, with a current server-side heartbeat and verified primary device identifier. The running primary uses a separate user-owned credential from at least two older co-resident identities. The installer cannot silently substitute them: it requires explicit selection and an exact match with a credential owner and a recent official relay poll. No real credential contents or exact private paths are committed.

## Terminal-free GUI
The installer is a native compiled AppleScript .app. It displays authorized local Companion choices, requires confirmation before migrating an old known broker, uses the existing private Browser Bridge credential and the Node runtime installed by the official LUCH Mac Companion, then brings the user to local pairing at 127.0.0.1:9248/setup. It does not create a second LUCH account.

The backend validates device credential file user ownership and mode 0600, canonical relay, fresh Companion heartbeat, exact inspected Browser Bridge source SHA, bridge health/no active execution leases and exclusive localhost port ownership. New broker runs in a per-user LaunchAgent, not a Terminal window or an elevated service. A session code expires after five minutes; tab sharing does not have a 15-minute hard cutoff.

The installer can only update the exact audited Bridge variant. It prepares a source-pinned integration, writes a full rollback copy and attempts a guarded daemon restart. A missing or changed source fails closed. Legacy migration needs an exact known broker hash, verified owner PID/command, no paired browser, and an additional GUI confirmation. Failure attempts to restore the old Bridge and old known broker.

## Real evidence versus gaps
- The correct Mac account was verified by existing LUCH device-list and by a live read-only on-device preflight; status PASS.
- The AppleScript GUI compiled on the connected Mac in an isolated folder; not launched.
- Linux source tests 17/17 PASS; broker security suite 21/21 PASS. 0.5.2 Chrome extension ZIP hash remains 75c3279b4640d6f1b0200754c478903f80b2d6917a1c8acb6d74b78c8836d002.
- An isolated headed Chromium with genuine activeTab grant and page action already passed CI at https://github.com/lenar2/luch/actions/runs/43919209901.
- The account-connected Mac's *live* Browser Bridge has NOT been restarted or replaced. The known old broker on localhost 9248 is still running. Rootless migration, restart rollback and account-scoped real host command on the installed Mac require independent verification.
- The preview .app will be ad-hoc signed, NOT notarized. Fresh account/official Companion installation is a separate prerequisite, and new-user OAuth is not generally self-service.
- Chrome remains public v0.4.0 and Opera's previous submission remains pending.

Release decision: HOLD. Do not claim the GUI preview is a production-ready installer or the LUCH service is fully open to unregistered users.
