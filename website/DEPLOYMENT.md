# LUCH static website — release 2026-11-05

**Live URL:** https://luch.lenarsalimov.ru/ (English at / and /en/, Russian at /ru/).

**Deployment source:** reviewed R3.1 site plus explicitly preserved original /docs/get-started/, /downloads/, /privacy/, /security/, /support/ and /terms/. The synthetic review/fixture page is intentionally absent.

**Release evidence:**
- Independent GPT exact-source verdict: `PASS_WITH_SCOPE`, Peer Bus `msg_1d2acb94-6a85-4ca2-8a1a-21192854edc0`.
- Reviewed source ZIP: `e3c7ae19e1120c3c574a30e0da439c9b6b9192191f03411d5c955e28480e449a`.
- Full deployed composite backup tar.gz SHA-256: `2da28fb3adcf2447dc4a433516e8f55def6984230b42a5831a4b2191cc6cc8e3`.
- Composite 44-file SHA-256 manifest SHA-256: `215e6bcbd6450f1e680840b4be3ac6437df16ee396a2a7da62043bea2266b038`.
- Pre-release rollback tar.gz SHA-256: `17ed18df03e74a6dd9ebc31143395d087f7b34f6c60f8b29e2053ce10b76ab04`.
- Public verification: all principal EN/RU routes and preserved documents/download respond HTTP 200; /review/fixture/ responds 404; full deployed composite 44/44 file hashes verified.

**Source provenance:** all 43 deployed public text files appear under `website/` and their hashes are listed in `website/MANIFEST.sha256`. The 20,568-byte preview-client ZIP is served at https://luch.lenarsalimov.ru/downloads/luch-chatgpt-0.1.6-preview.zip and is **not** stored as a Git binary. See `website/downloads/README.md`.

**Operational rollback:** host-side timestamped pre-release snapshot is retained under `/home/lenar/luch-public-release-backups/` on the authorized LUCH server. An atomic-ish rsync deployment used delayed file updates and a scripted rollback on failed checks. Preserve this snapshot before further releases.

**Boundary:** Publishing the static product website does not prove fresh-user signup, OAuth, pairing, or execution by an arbitrary user. Those remain UNKNOWN. Do not misrepresent the independent source QA as full production product E2E.
