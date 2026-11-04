# Security policy

LUCH connects AI clients to permission-scoped, user-authorized capabilities. The public repository is a documentation and integration entry point; it does **not** contain the private server code or grant access to any user's devices.

## Reporting vulnerabilities

**Do not post secrets, device identifiers, access tokens, private files or exploitable account details in a public issue.** Contact the maintainer through the [LUCH support page](https://luch.lenarsalimov.ru/support/) with a minimal, redacted description of the issue and ask for a secure disclosure route. If available, use GitHub's [private vulnerability reporting](https://github.com/lenar2/luch/security) rather than a public issue.

Include the affected package/version, a safe reproduction path, impact, and whether authorization or tenant boundaries are involved. Never test another person's account or device without explicit permission.

## Safety boundaries

- An installable client package is not an authorization grant.
- Explicit device identities must fail closed when absent or offline; no automatic cross-device fallback.
- An unauthenticated HTTP 401 is necessary but not evidence of a complete, secure OAuth flow.
- No untested claim of independent multi-tenant isolation, third-party onboarding, or credential revocation.
- Destructive operations require appropriate scope, authorization, and approval.

See [public release gates](docs/RELEASE_READINESS.md) and the [live policy](https://luch.lenarsalimov.ru/privacy/).
