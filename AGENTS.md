# AGENTS.md

`opencode-attribution` is an OpenCode 2 plugin: one `commit` tool that adds
attribution trailers to commits made by agents. See `README.md` for the rule
and the install.

## The nature of this repo

- **ESM only**, Node ≥ 26, no CommonJS anywhere.
- **Type-stripped TypeScript**: `src/*.ts` and `test/*.ts` are executed
  directly by node — there is no build step and no emitted JavaScript. Only
  erasable syntax is allowed (no enums, no parameter properties); type-only
  imports must use `import type` (`verbatimModuleSyntax` +
  `erasableSyntaxOnly` in `tsconfig.json` enforce both).
- The published entry is the raw source (`exports` → `./src/index.ts`), so
  the type-strip constraints hold forever, not just in development.
- Tests are `node:test` (`npm test`): the decision logic is tested as pure
  functions, the tool itself is called directly with a fake OpenCode context
  against real throwaway git repos. Do not add a test framework or a mock of
  git.
- Formatting and lint are Biome with stock defaults (`biome.json`) — tabs,
  double quotes. Let `biome check --write` decide; do not rehand-format.

## Definition of done

Every time you think you are done — before committing, before reporting
success — run:

```sh
npm run agentic:verify
```

It runs Biome (with fixes), the strict typecheck, and the full test suite. If
it fails, fix the cause and run it again; never declare done on a red verify.
