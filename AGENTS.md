# Working on 4chan-XZ

## Purpose and scope

4chan-XZ continues 4chan XT, which ported the original 4chan X from CoffeeScript
to JavaScript and TypeScript. The long-term goals are a complete TypeScript
migration, clearer architecture, and measured performance improvements.

The current phase prepares the repository and tooling. Do not start converting
application files, changing features, fixing inherited runtime bugs, or redesigning
the script unless the user explicitly requests that work. A future task that
requests implementation authorizes its stated scope; it does not require another
confirmation merely because this file describes the preparation phase.

## Repository map

- `src/main/Main.js`: application entry point and initialization.
- `src/platform/`: userscript and extension adapters, storage, network access.
- `src/classes/`, feature directories, and `src/site/`: application behavior.
- `src/globals/jsx.ts` and `src/types/jsx.d.ts`: custom HTML JSX implementation.
  This is not React; preserve the `h` and `hFragment` factories.
- `src/types/`: browser globals and custom asset/module declarations.
- `src/meta/metadata.js`, `src/meta/manifestJson.js`: Node build helpers.
- `tools/`: Rollup driver, custom asset/code transforms, and quality checks.
- `dist/`: ignored local build output; never edit or commit generated files.
- `builds/`, changelogs, and `benchmarks/`: inherited historical artifacts.
  Benchmarks are browser snippets, not an automated test suite.

## Environment and commands

Use Node 24 LTS with npm 11 or newer. The Node engine also permits Node 26+.
Run `npm ci --ignore-scripts` from the repository root for a reproducible install.

- `npm run check`: ESLint and TypeScript checks against the inherited baseline.
- `npm run build`: build both userscript and unpacked extension without platform pruning.
- `npm run build:all`: clean and build readable/minified userscripts and extensions.
- `npm run verify`: quality checks followed by all build variants; required after
  tooling changes. Run only additional checks justified by subsequent changes.
- `npm run lint:full` / `npm run typecheck:full`: expose inherited diagnostics.
  A failing full check is expected until the migration debt is resolved.

Runtime work must also be tested manually in the affected browser and userscript
manager or unpacked extension. A successful bundle is not proof that browser
behavior works. Report exactly what was verified and what remains unverified.

## Change discipline

- Inspect the working tree first. Preserve unrelated edits and never reset them.
- Keep changes focused. Do not reformat the application or regenerate `builds/`.
- Prefer TypeScript for new application modules. Keep directly executed Node build
  helpers in ESM JavaScript with JSDoc unless a task includes migrating that tooling.
- When conversion is authorized, separate a `.js` to `.ts` rename from behavioral
  changes to preserve reviewability and history. Add meaningful types; avoid
  blanket `any`, `@ts-nocheck`, or broad rule disables to make checks pass.
- Use two spaces, LF, and existing naming conventions. Do not add React or a
  replacement bundler without a concrete reason and a requested scope that permits it.
- Browser code uses bundler resolution and browser/GM/Chrome types. Node tools use
  NodeNext resolution and Node types. Keep those environments separate.
- The browser target remains ES2020. Changing Node versions does not authorize
  changing browser compatibility, permissions, storage keys, or update behavior.
- Respect custom transforms: asset inlining, Font Awesome aliases, platform
  blocks, and `tests_enabled` regions. Inspect their constraints before editing.
- Circular dependencies are inherited. Build warnings are summarized and written
  to `dist/build-warnings.json`; do not hide new warnings or casually reorder imports.

## Quality baseline policy

`eslint-suppressions.json` records inherited findings by file and rule;
`tools/typecheck-baseline.json` records diagnostic counts by project, file, and TS
code. These checks detect increases in those counts, not every possible replacement
of one error with another. New files have no allowance. Review still matters.

Do not increase either baseline merely to pass CI. Fix regressions introduced by
your change. If a requested tooling upgrade changes inherited diagnostics, explain
the reason and keep the baseline diff reviewable. Shrink allowances as debt is fixed:
use `npm run lint:prune` and, after review, `npm run typecheck:baseline`.
Never run `eslint --suppress-all` as a routine verification step.

## Identity, releases, and history

The local package and generated builds use 4chan-XZ. Historical links in
`package.json` and extension IDs remain inherited pending a release identity
decision. Do not invent a new GitHub owner, store listing, signing key, or release
URL. Development userscripts have `@updateURL none` and `@downloadURL none`.

Before a public release, configure project/support/download URLs and extension
identifiers, review compatibility and permissions, and set the version/date in
`version.json`. Do not publish, sign, upload, push, or contact upstream maintainers
unless requested. `tools/sign.sh` and `tools/stats.js` are historical utilities,
not the XZ release pipeline. Preserve upstream authorship and the MIT license.
