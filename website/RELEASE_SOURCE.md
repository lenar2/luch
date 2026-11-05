# Canonical full-site release source

The complete 33-route static site is released only from the immutable full-source ZIP in the Founder Library. This GitHub PR is the reviewable homepage/README overlay plus shared navigation runtime; merging this PR alone is **not** a complete website deployment.

The full ZIP is the sole deployable input. It contains all EN/RU routes, root aliases, shared assets, legal/support pages and a complete file manifest. The exact ZIP SHA-256 and the GitHub overlay commit used to synchronize shared files are pinned in the PR body and Factory issue #4001.

The homepage and shared navigation files in this branch are mirrored byte-for-byte into the full-source ZIP at corresponding site/ paths. The full-site manifest and overlay manifest are checked separately.

**Current release state:** DRAFT / NOT MERGED / NOT DEPLOYED. Production remains unchanged. Public HTTP deployment and new-customer OAuth E2E are not established.
