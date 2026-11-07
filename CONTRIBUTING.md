# Contributing to LUCH

Thank you for helping make AI-assisted work more useful and more accountable.

## Ways to contribute

- Improve the English product explanation and the separate Russian translation.
- Report inaccurate installation steps or broken links, with the exact client and version.
- Suggest clear, narrowly scoped examples for authorized browsers, files, computers and paired servers.
- Report defects using public-safe synthetic information only.
- Help review whether capability and release-status claims accurately match independent test evidence.

Open an [issue](https://github.com/lenar2/luch/issues/new) before major restructuring. A contribution should describe the user problem, the expected improvement, and how it was verified.

## Repository boundaries

This is the **platform-neutral product hub**. Host-specific packages live in separate repositories:
- [Claude](https://github.com/lenar2/luch-claude-plugin)
- [Cursor](https://github.com/lenar2/luch-cursor)
- [Gemini CLI](https://github.com/lenar2/luch-gemini)
- [ChatGPT public candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt)

Do not copy private server source, secrets, tokens, browser profiles, paired device IDs, customer files, or privileged tool definitions into public materials.

## Language and style

- The **primary README is in English** for global discoverability.
- Russian copy is maintained separately in `README.ru.md`.
- Add new localized files rather than mixing full languages into the English README.
- Use concrete examples, clear install paths, and short explanations.
- Describe a result as verified only when the matching test actually ran. **UNKNOWN ≠ PASS.**

The Apache-2.0 license in this repository applies to its public documentation and source files, **not** to the separately hosted LUCH service, user data, or trademarks.

## Mandatory independent creative release gate

Changes to any public LUCH product experience (site, README, integration entry, onboarding, visuals, demos or marketplace presentation) must satisfy [HEA Creative Release Gate](docs/HEA_CREATIVE_GATE.md) / [русский](docs/HEA_CREATIVE_GATE.ru.md).

**Author self-review is not sufficient.** A verifiable non-author creative critic, real five-person uncoached first-impression test and exact-commit founder authorization are required before public merge or release. Missing evidence means **HOLD**. Technical QA does not override creative NO_GO.

Current GitHub rulesets have not yet been configured. Treat this as an explicit **manual release hold**, not an automated branch-protection guarantee. Do not use GitHub Actions for enforcement.
