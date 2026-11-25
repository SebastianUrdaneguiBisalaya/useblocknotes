# Contributing to useblocknotes

Thanks for your interest in useblocknotes. Bug reports, documentation fixes, new examples and code are all welcome. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), never in a public issue.

## Before you start

- **Open an issue first.** Every change starts from an issue that describes the problem or feature, with acceptance criteria. For anything beyond a small fix, wait for the maintainer to agree on the approach before writing code.
- **Keep the scope.** The library renders and edits documents. It never calls an AI SDK or API, and real-time collaboration, persistence and authentication are out of scope for v1.
- **Free and open source only.** Dependencies must be MIT, Apache-2.0 or BSD licensed. GPL/AGPL, commercial or paid dual licenses, trials, SaaS and external APIs are not accepted, nor are `@tiptap-pro/*`, Tiptap Cloud or `@blocknote/xl-*` packages. Propose any new dependency in the issue, with its license, before adding it.

## Setup

Requirements: [Bun](https://bun.sh) 1.4.2 or later.

```sh
git clone https://github.com/SebastianUrdaneguiBisalaya/useblocknotes.git
cd useblocknotes
bun install
bun run storybook # offline playground with a mock AI adapter
```

| Command | Description |
| --- | --- |
| `bun run build` | Builds every package. |
| `bun run typecheck` | Type-checks every package. |
| `bun run lint` / `bun run lint:fix` | Checks or fixes lint and formatting with Biome. |
| `bun run test` | Runs the tests (`bun test`, local, no network). |
| `bun run storybook` | Starts the Storybook playground. |
| `bun run check:package` | Packs each package and checks what it would publish (publint, Are the Types Wrong?). |
| `bun run changeset` | Adds a release note. |

Git hooks (Husky) run Biome on staged files and type-checking before each commit, and the tests and the build before each push.

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/core` | `@useblocknotes/core`: framework-free logic (document model, operations, registry, AI streams, context functions, i18n). No React. |
| `packages/react` | `@useblocknotes/react`: the React 19 editor on Tiptap core. |
| `packages/pdf` | `@useblocknotes/pdf`: optional PDF export with `@react-pdf/renderer`. |
| `storybook` | Offline playground with example blocks and a mock AI adapter. |

Shared dependency versions live in the root `package.json` `catalog`.

## Workflow

1. Create a branch from an up-to-date `main`, one per issue, named `type/<issue-number>-short-title`, for example `fix/12-empty-paste`.
2. Make the change, with tests where they matter (see below).
3. Add a changeset if a package's behavior or public API changes (see [Changesets](#changesets)).
4. Commit with [Conventional Commits](#commits).
5. Open a pull request to `main` that describes what changed and how you tested it, and ends with `Closes #<issue-number>`.

The maintainer reviews and merges. Do not force push to shared branches.

## Commits

Format: `type(scope): subject`, for example `fix(react): keep the cursor after undo`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope is optional and lowercase: `core`, `react`, `pdf`, `storybook`.
- Subject in the imperative, lowercase, without a trailing period. Header at most 72 characters.
- Breaking changes add `!` after the type or scope and a `BREAKING CHANGE:` footer.

## Code guidelines

- **Language.** Everything is in English: code, comments, JSDoc, docs, commits, issues and pull requests.
- **TypeScript.** Strict mode, with every flag in `tsconfig.base.json`. `any`, `unknown` and `never` are not allowed. Public types are `readonly`, and every public export has JSDoc.
- **Validation.** Runtime data is validated with Zod, and types are inferred from schemas (`z.infer`). No hand-written validation.
- **Errors.** Return typed errors (discriminated unions and `Result`) instead of throwing untyped ones.
- **Modules.** ESM only, tree-shakable, no default exports, `import type` for type-only imports.
- **React.** Function components and hooks. Keep components small and put logic in `core` or hooks. Derive state instead of duplicating it. Accept `className`, expose CSS variables, and never hard-code styles or UI strings. Components must be accessible: semantic elements, keyboard support and ARIA where needed.
- **UI strings.** Add every new string to both the English and the Spanish messages in `packages/core/src/i18n.ts`.
- **Editing engine.** Selection, IME, undo, clipboard and accessibility come from Tiptap and ProseMirror. Do not reimplement them.

## Tests

Tests use `bun test`, run locally and never touch the network. Cover the parts that carry the logic: `applyOperations`, schema validation, context functions, stream processing and PDF mapping. Trivial UI does not need tests.

## Changesets

Release notes and versions are managed with [Changesets](https://github.com/changesets/changesets).

- Every pull request that changes a published package's behavior or public API adds a changeset with `bun run changeset`: pick the packages, the bump (`patch`, `minor` or `major`) and write a short note for users. It is saved in `.changeset/`.
- Docs, tests, Storybook and tooling changes do not need one.
- Each package's `CHANGELOG.md` is generated from changesets. Do not edit it by hand.

### Releasing (maintainer)

1. On `main`, run `bun run version-packages`. It turns pending changesets into version bumps and `CHANGELOG.md` entries.
2. Open a pull request with the result, review it and merge it.
3. Publish a GitHub release for the new version. The `Publish to npm` workflow type-checks, lints, tests, builds and checks the packages, then publishes every package whose version is not on npm yet, with provenance, in dependency order (`core`, then `react` and `pdf`).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
