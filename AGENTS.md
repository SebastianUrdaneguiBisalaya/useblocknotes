# AGENTS.md

## Project

`useblocknotes` is an open-source (MIT) Notion-style block editor built on Tiptap core, with AI responses streamed live into the editor.

- The library handles rendering and logic only. It **never** calls an AI SDK or API; the host app provides an adapter.
- Goal: as simple as possible, but robust.
- The repository is public. Write everything for external readers.
- Out of scope (v1): real-time collaboration (CRDT), persistence, auth, AI provider calls.
- Ask before making architecture decisions not covered here.

## Free and open source only

- Allowed licenses: MIT, Apache-2.0, BSD. Consumers may be closed-source.
- Forbidden: `@tiptap-pro/*`, Tiptap Pro/Cloud/Platform/AI, `@blocknote/xl-*`, any SaaS or external API, GPL/AGPL/commercial/paid dual licenses, trials, freemium, private registries.
- Paid features elsewhere (PDF export, AI, advanced menus) are implemented here or with free alternatives.
- Before installing any dependency: check its license in its repo and `package.json`, state it, and wait for approval.

## Monorepo

- Bun workspaces; shared versions in the root `catalog`.
- `packages/core` (`@useblocknotes/core`): framework-free logic. Document model, operations, block registry, context functions, stream protocol, i18n. No React.
- `packages/react` (`@useblocknotes/react`): `<BlockNotesEditor />` and `useBlockNotes()` for React 19 on Tiptap core.
- `packages/pdf` (`@useblocknotes/pdf`): optional `exportPdf()` with `@react-pdf/renderer`.
- `storybook/`: offline playground with example blocks and a mock AI adapter.
- Layout leaves room for Vue/Svelte later. Only `core`, `react` and `pdf` for now.
- Each package has its own `README.md`, `CHANGELOG.md` and `LICENSE`. Changes are versioned with Changesets.

## Core concepts

- **Document:** serializable JSON `{ title, blocks }`; each block has a stable `id`, a `type` and typed props.
- **Blocks:** defined with `defineBlock()` (type, props schema, `render`, `toText`/`toMarkdown`, optional `toPdf`, optional slash entry). Inline elements register the same way. Core ships only paragraph and headings.
- **Operations:** `insert` (after id), `update`, `delete`, `move`, `set_title`. `applyOperations()` is pure with typed errors. Manual edits reach `onChange(operations, document)` batched and debounced, with `baseVersion`.
- **AI:** own implementation. Opened via `/ai` or "ask AI" on a selection. Popover or bottom chat bar (by props). Adapter gets `{ instruction, selection, context, signal }` and returns an async iterable of stream events. Live text, highlighted AI blocks, cancel, accept/reject as one undo step. Callbacks `onAiStart`, `onAiFinish`, `onAiError`.
- **Context:** pure `outline()`, `pick()`, `toMarkdown()` in core.
- **PDF:** local only; `toPdf` per block, fallback to `toText` paragraph. Browser and Node.
- **i18n:** all UI strings from `locale` + `messages`. English and Spanish built in, any string overridable.
- **Styles:** none imposed. CSS variables and `className` slots only.
- **Editing engine:** never written from scratch. Selection, IME, undo, clipboard and a11y come from Tiptap/ProseMirror free packages.

## TypeScript

- Strict mode; keep every flag in `tsconfig.base.json`.
- **Never use `any`, `unknown` or `never`.** Forbidden, no exceptions in public types.
- Public types are `readonly`.
- Validate runtime data with Zod; no hand-written validation. Infer types from schemas (`z.infer`).
- `zod` is a `peerDependency` (consumers reuse their own copy).
- Return typed errors (discriminated unions), don't throw untyped ones.
- Use `import type` for type-only imports.
- ESM, tree-shakable, `sideEffects: false`. No default exports.
- JSDoc on every public export.

## React

- React 19, function components and hooks only.
- Keep components small; logic lives in `core` or hooks, not in JSX.
- Derive state instead of duplicating it; avoid `useEffect` for derived data.
- Stable callbacks and memoization only where they prevent real re-renders.
- Accept `className` and expose CSS variables; never hard-code styles or UI strings.
- Accessible by default: semantic elements, keyboard support, ARIA where needed.
- Clean up subscriptions and abort in-flight AI streams on unmount.

## Testing

- `bun test`, local only, no network.
- Test only the most relevant services: `applyOperations`, schema validation, context functions, stream processing, PDF mapping.
- Do not test every file or trivial UI.

## Language

- Everything is in English: code, JSDoc, READMEs, changelogs, commits, issues and PRs.

## GitHub workflow

- **Always use the project's `github` skill** (`.claude/skills/github`) for issues, branches, commits and pull requests.
- No work without an issue. Work issues one at a time, in order.
- One branch per issue: `type/<issue-number>-short-title`, from an updated `main`.
- When an issue is done: open a PR to `main` with the skill's scripts, then stop and wait.
- Never merge, push to `main` or force push. The user merges.
- No agent attribution in commits, issues or PRs.
