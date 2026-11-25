# Security policy

## Supported versions

useblocknotes is in early development (`0.x`). Security fixes are released only for the latest published version of each package:

| Package | Supported |
| --- | --- |
| `@useblocknotes/core` | Latest `0.x` |
| `@useblocknotes/react` | Latest `0.x` |
| `@useblocknotes/pdf` | Latest `0.x` |

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a vulnerability.**

Report it privately through GitHub: open the repository's [Security tab](https://github.com/SebastianUrdaneguiBisalaya/useblocknotes/security) and choose **Report a vulnerability**. Include:

- The affected package and version.
- A description of the issue and its impact.
- Steps or a minimal example to reproduce it.
- A suggested fix, if you have one.

You will get an acknowledgement within 7 days. Once the issue is confirmed, a fix is prepared in a private advisory, released, and the advisory is published with credit to the reporter unless they prefer to stay anonymous.

## Scope

useblocknotes renders and edits documents in the browser. It never calls an AI provider, stores documents or handles authentication: the host app does. Relevant reports include, for example:

- Script execution (XSS) from a document, pasted content, a link mark or an AI stream event.
- AI stream or operation events that bypass validation and produce an invalid document.
- PDF export that reads local files or makes network requests from document content.

Out of scope: vulnerabilities in the host app's AI adapter, server or storage, and issues in dependencies that do not affect useblocknotes (report those upstream).

## Guidance for host apps

- Treat AI output as untrusted. The editor validates every stream event against the block schemas, but your adapter and server should still authenticate users and rate-limit AI requests.
- Validate documents from storage or the network with `validateDocument()` before loading them.
- Keep AI provider keys on your server. Never pass them to the browser through the adapter.
