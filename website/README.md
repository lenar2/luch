# LUCH website — human-first source

The website now starts with **one real, traceable founder-environment task**, rather than a diagram of imaginary completed actions. Read [the actual case](../docs/REAL_WORK.md) and [the honest onboarding path](../docs/START_HERE.md).

## Architecture

- `build_experience.py` is the static bilingual site generator.
- `human_pages.py` contains unique page compositions for the real case, connection decision, host directory, capability journeys and capability status.
- `assets/experience.css` preserves the shared visual language.
- `assets/proof.css` contains page-specific responsive layouts; `assets/experience.js` handles accessible mobile navigation.
- **34 public HTML routes:** initial 32 (EN/RU and effective legacy routes) plus `/en/case/` and `/ru/case/`.
- Effective legal documents, public support and detailed technical onboarding remain under `/privacy/`, `/terms/`, `/security/`, `/support/` and `/docs/get-started/`.

## Build

From the repository root:

```bash
python3 website/build_experience.py
cd website && sha256sum -c MANIFEST.sha256
```

The generator is deterministic and preserves already wrapped effective documents. No private credentials, account data or hosted backends belong in this repository.

## Editorial and release boundaries

The case demonstrates **actual authorized work for the founder**. The recorded 32-route 2026 release does not establish a new-user OAuth flow, general availability or finished visual excellence.

The connection page must never send the visitor back to itself as its primary next action. It first distinguishes enabled users from people who need to check availability, then provides host-specific source and setup links.

Do **not** publish an unfinished redesign just because the generator ran. Keep a complete rollback backup; preserve effective legal/support pages and the separately deployed preview ZIP; run desktop/mobile visual checks and post-release HTTP checks. The historical [deployment record](DEPLOYMENT.md) remains distinct from any later release.
