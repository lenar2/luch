# Preview and installation

This branch is a review overlay, not a complete website and not a production deployment.

## Canonical source

The complete 33-route static source ZIP is the sole deployable input. It contains all EN/RU routes, root aliases, shared assets, legal/support pages and its complete file manifest. The exact immutable ZIP SHA-256 and its overlay commit are recorded in the PR body and Factory issue #4001.

The branch overlay and full source ZIP are separately versioned artifacts, not byte-for-byte duplicates. Use the full ZIP alone as the canonical deployable input. Do not combine files from different branch commits or source ZIP versions. Merging this PR alone does not deploy the complete website.

## Release gates

1. Independent QA reviews the exact source ZIP and overlay commit.
2. Founder visually accepts the candidate.
3. A separately authorized deployment is reviewed over public HTTP before production changes.

Production website, OAuth, MCP, server infrastructure and customer data remain unchanged.
