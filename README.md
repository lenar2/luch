<p><img src="website/assets/luch-ray.svg" alt="" width="40"></p>

# LUCH
### Give your AI a way to work beyond the answer.

I’m building **LUCH to connect AI with real work**, not just conversations. It brings the tools you choose — a browser, authorized files, a paired computer or a server — into the task, so you can see and check what was actually done.

[**See a real LUCH outcome**](docs/REAL_WORK.md) · [**Choose your AI**](docs/START_HERE.md) · [Русский](README.ru.md) · [Website](https://luch.lenarsalimov.ru/en/)

![LUCH connects a human request to selected tools and a result that can be checked](docs/visual/platform-journey-en.svg)

## From a request to work you can inspect

I wanted LUCH’s public experience to make its real capabilities clear. I asked AI working with my connected tools to inspect the website and GitHub source, prepare a bilingual redesign and deliver a result I could verify.

The assistant checked 32 routes at four screen sizes, corrected a mobile layout defect and published the change **after I authorized it**.

<blockquote>
<strong>The result:</strong> a published website and an exact, inspectable source commit — not just advice about what someone else should do.
</blockquote>

[**See the actual work, commit and release record →**](docs/REAL_WORK.md)

## What LUCH brings into the task

| Your AI needs to… | LUCH can connect it to… | What comes back |
| --- | --- | --- |
| Understand a website | An isolated server browser for permitted public pages | Findings, comparisons and source links |
| Work with your material | Files and folders you explicitly authorize | A summary, draft or verified file change |
| Check a real environment | A selected, paired computer or server | Observed status and bounded diagnostic results |
| Carry a task across steps | The tools actually available to your account | A result with the actions and checks that took place |

The computer and server routes are separate capabilities: they appear only when the host, device and current permission support them.

## LUCH meets you where you already work

<details open><summary><strong>ChatGPT</strong> — start with a conversation</summary>

Turn a question into a source-backed brief. Ask for a public-page comparison, a concise research summary or a check of resources your account has authorized.

[ChatGPT integration candidate and package →](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/README.md)

</details>

<details><summary><strong>Claude</strong> — think across sources and documents</summary>

Bring a project brief together with selected files and public sources. Ask Claude to compare, synthesize and prepare a decision note you can review.

[Claude plugin →](https://github.com/lenar2/luch-claude-plugin)

</details>

<details><summary><strong>Cursor</strong> — take a code task beyond the editor</summary>

Investigate a bug using the code you selected and, when connected, the exact test server you authorized. Bring back a diagnosis and a reviewable patch — not an unapproved deployment.

[Cursor plugin →](https://github.com/lenar2/luch-cursor)

</details>

<details><summary><strong>Gemini CLI</strong> — bring operational checks into the terminal</summary>

Inspect a selected server, run bounded diagnostics and turn the observed output into a clear status report and next action.

[Gemini CLI extension →](https://github.com/lenar2/luch-gemini)

</details>

## A simple way to begin

1. **Choose your AI client.** Each integration has its own setup and working style.
2. **Connect the resources you want to use.** The available tools are determined by your account, host and explicit grants.
3. **Start with an inspect-only task.** Ask for a page to be read, a file to be summarized or a selected server to be checked.
4. **Review the result.** Decide separately whether anything should be changed, saved or published.

I already use LUCH for real work in my connected environment. Public client source is available to inspect; service access and host-specific onboarding are separate from downloading a package. [Choose your connection path →](docs/START_HERE.md)

---

[Product website](https://luch.lenarsalimov.ru/) · [Safety](https://luch.lenarsalimov.ru/en/safety/) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Terms](https://luch.lenarsalimov.ru/terms/) · [Support](https://luch.lenarsalimov.ru/support/)

<details><summary>For developers and reviewers</summary>

This repository is the platform-neutral product hub. The public site source lives in [`website/`](website/); host adapters are maintained separately. The repository does not contain private account credentials, the hosted backend or device grants.

- [Technical getting started](https://luch.lenarsalimov.ru/docs/get-started/)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Release readiness and evidence gates](docs/RELEASE_READINESS.md)

Apache-2.0 applies to the public files in this repository, not to the hosted service or other client packages.

</details>
