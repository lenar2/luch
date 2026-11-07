# Three real jobs I have used LUCH for

[← LUCH](../README.md) · [Русский](REAL_JOBS.ru.md) · [Capabilities](CAPABILITIES.md)

I want to show how LUCH makes a difference when the work involves more than one app. These are **three outcomes from my connected environment**, with the evidence boundaries stated plainly.

## 01 · A paid service did not deliver access

**The human problem.** Two customers of a live audio-to-text service had completed payments, but their purchased service minutes were absent from their wallets.

**What the connected workflow did.** On an authorized Linux cloud server, the work compared original local orders against authenticated merchant results, identified the two eligible accounts and four canceled payments, applied a bounded restoration and independently read back the live database. Two customers received **240 minutes each**, combining purchased service time and a goodwill restoration. Two separate Telegram messages were accepted by the provider; acceptance is not evidence the messages were read.

**What was checked.** Production wallets, new ledger entries, original order statuses and preservation of unrelated balances. No new charges or refunds were initiated.

**Evidence boundary.** The primary payment and customer records are private. I do not publish identifiers, credentials, full receipts or the internal issue archive. This is a sanitized record of the completed founder-authorized workflow, not a claim of publicly reproducible payment access or a guarantee that all future payment flows are fixed.

**A reader's related task:** “A customer says they paid but cannot use my service. Check the order and the provider, find the exact failure and propose the safest repair before changing anything.”

## 02 · A computer lost a reliable connection

**The human problem.** After an operating-system and network recovery, a previous relay configuration caused serious connection failures. I needed direct internet access while preserving the remote recovery paths.

**What the connected workflow did.** Using permitted computer/terminal access, the recovery inspected the device's network routes, proxy configuration, processes and tool connections. At the recorded checkpoint, direct Wi-Fi was working without the phone's USB network connection, system web proxies were off, and external HTTPS responded.

**What was checked.** The actual network interface, proxy state and HTTPS response; not merely a successful diagnostic command. The longer reliability check and some unrelated device features remained open.

**Evidence boundary.** The recovery records are private and contain details about the owner's device and infrastructure; I have deliberately excluded them. This story is not a claim of universal remote computer access or a claim that every device issue was resolved.

**A reader's related task:** “My computer lost internet access after a change. Find what changed, keep a recovery path intact and show me what actually works.”

## 03 · A website required a verified change

**The human problem.** I wanted to redesign a bilingual website around the visitor's needs, then publish only a verified change.

**What the connected workflow did.** The assistant inspected the live site and GitHub sources, prepared a bilingual redesign, checked **32 page routes at four screen widths**, found and corrected a mobile layout issue and published the approved update.

**What was checked.** Page coverage, mobile layout and published source. The exact change is publicly inspectable.

**Public evidence:** [Website](https://luch.lenarsalimov.ru/en/) · [Exact commit](https://github.com/lenar2/luch/commit/06daa8d6b89a3dfd65e74628b895879e79a0c931) · [Detailed case](REAL_WORK.md).

**A reader's related task:** “Check my website as a real visitor, fix the broken mobile experience and show the tested change before publishing.”

---

## What these stories share

They start from **a real human problem**, move through the specific authorized resources the task requires, and come back with an outcome that can be examined. The human decides what the AI may access and when consequential changes may happen.

These are not three demonstrations that every host, new account or app-store package has passed onboarding. The [current connection paths](START_HERE.md) describe what depends on the host and the available account permissions. The stories' descriptions are paraphrased rather than verbatim user prompts.
