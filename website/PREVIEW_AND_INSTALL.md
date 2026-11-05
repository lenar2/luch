# Preview, test and deploy

This directory now contains the static **published** EN/RU product-site source. Serve `website/` as a static document root to inspect the pages (32 HTML routes). Run `sha256sum -c website/MANIFEST.sha256` from the repository root to verify all 43 tracked public text files.

The live site is a route-preserving composite: it includes the current substantive `/docs/get-started/` guide and existing policy/support pages, plus a downloadable preview-client ZIP hosted separately. The binary ZIP is intentionally not stored in Git. Its digest is documented in `website/downloads/README.md`.

Publishing source or a static page is **not** evidence of a new user's successful OAuth, device pairing or first authorized action. For the release archive, backup and HTTP checks see `DEPLOYMENT.md`.
