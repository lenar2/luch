# Live site source and publication provenance

The canonical publicly deployed site is the **route-preserving composite** created from the independently reviewed R3.1 static source plus the already-live onboarding guide, download binary and substantive legal/support pages. It is **not** identical byte-for-byte to the original R3.1 ZIP. The 43 public text files are synchronized into this repository under `website/`; the downloadable preview client binary is available at the live site and is not duplicated in Git history.

R3.1 reviewed source ZIP SHA-256: `e3c7ae19e1120c3c574a30e0da439c9b6b9192191f03411d5c955e28480e449a`.
Deployed composite archive SHA-256: `2da28fb3adcf2447dc4a433516e8f55def6984230b42a5831a4b2191cc6cc8e3`.
Deployed composite file manifest SHA-256: `215e6bcbd6450f1e680840b4be3ac6437df16ee396a2a7da62043bea2266b038`.
Rollback snapshot SHA-256: `17ed18df03e74a6dd9ebc31143395d087f7b34f6c60f8b29e2053ce10b76ab04`.

The source ZIP had 32 HTML routes and was independently reviewed `PASS_WITH_SCOPE`. The production composite was separately staged, route-tested, and verified over public HTTP. No backend, OAuth or MCP behavior was modified as part of this static-site release. Fresh-customer E2E and complete WCAG audit remain unverified.
