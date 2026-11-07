# Where LUCH works

[← LUCH](../README.md) · [Русский](COMPATIBILITY.ru.md) · [Connect](START_HERE.md)

You can work with LUCH from the AI chat you already use. Reaching public websites, personal tabs, a computer and a server involves different connections and permissions.

## In your AI client

**Your familiar AI.** LUCH has already been used with **ChatGPT, Claude and Grok** in the founder's own work. In ChatGPT it works in both ordinary chats and **Work mode**, when the account is connected and authorized. Exact tools vary by client and permissions. Cursor and Gemini CLI have additional connection paths.

[ChatGPT integration](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/) · [Claude](https://github.com/lenar2/luch-claude-plugin) · [Cursor](https://github.com/lenar2/luch-cursor) · [Gemini CLI](https://github.com/lenar2/luch-gemini)

## Two ways of working with websites

**A separate browser on a server.** LUCH's Firefox session can explore public sites independently of your computer: navigating, reading, following links, typing, clicking and capturing screenshots when permitted. Your personal signed-in accounts are not automatically available in this session.

**Your browser on a connected computer.** For an already open tab or authenticated personal session, LUCH needs the authorized browser on that exact device.

**Browser history.** The founder has personally confirmed use of Chrome, Opera, Opera Neon, Yandex Browser, Microsoft Edge, Brave, Firefox and Safari with LUCH. Retained technical records include an Opera Neon start and live Edge/Brave tab inventories; the depth of documented checks varies by browser. This is not a claim that every browser has passed the same automated end-to-end suite on every operating system.

## Windows: three distinct questions

1. **You open ordinary ChatGPT or another compatible AI on Windows.** Remote LUCH uses HTTPS/MCP and does not architecturally require macOS on the user's machine. Server tasks are expected to work with a supported client, connected account and appropriate permissions. An independent new-user Windows end-to-end test is still outstanding.
2. **LUCH explores a website in server-side Firefox.** This browser runs on a server, independently of whether your ChatGPT window is open on Windows or macOS.
3. **You want AI to control apps and windows on the Windows PC itself.** That requires a compatible Windows-specific provider, device connection and OS permissions. Demonstrated macOS local control does not establish native Windows desktop control.

The untested third mode should not be mistaken for an inability to access LUCH from a Windows-hosted chat.

## Other devices

**macOS.** Authorized operations on the screen, windows, apps, files, browsers and terminal of a connected Mac have been demonstrated. Access to personal tabs and apps requires permission for that specific device.

**Linux server.** Diagnostics, bounded commands, file operations and a separate Firefox browser have been demonstrated. These remote tasks do not depend on the user's Mac. This does not imply full graphical control of every Linux desktop.

**iPhone and Android.** Certain iPhone-related capabilities exist in the connected environment, but universal control of phone apps is not claimed. Full Android control has not been established either.

## Your first connection

Approved web and server tools do not require a separate LUCH desktop app. Personal tabs, files and applications require pairing the relevant device. Public integration source does not establish that independent registration and OAuth are already available to every new account.

Begin without changing anything: *“Compare these two public pages and show the sources behind your answer.”*

[Choose your AI](START_HERE.md) · [Capabilities](CAPABILITIES.md) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Support](https://luch.lenarsalimov.ru/support/)
