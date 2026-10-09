# Contributing to 4chan-XZ

NZ continues the abandoned 4chan XT fork of 4chan X. Its goals are to finish
the TypeScript migration and modernize and optimize the script. The current
phase prepares tooling and documentation; application work should be scoped in
a separate issue or request before starting.

## Getting started

Clone your chosen NZ checkout or fork and open the repository root. Use
Node 24 LTS and npm 11+:

```sh
npm ci --ignore-scripts
npm run verify
```

Build commands, options, and output paths are documented in [README.md](README.md).
New output belongs in the ignored `dist/` directory. Do not edit generated
bundles or update historical artifacts in `builds/`.

## Focused contributions

- Prefer TypeScript for new application modules. Keep conversions separate from
  behavior changes and preserve file history with a focused rename.
- Add useful types rather than `any` or broad suppressions. Tighten compiler
  settings incrementally as the affected code becomes ready.
- Follow the existing two-space indentation and LF endings. Avoid unrelated
  formatting or dependency churn.
- Preserve the custom JSX factories (`h` and `hFragment`), asset transforms,
  platform blocks, and initialization order. The project does not use React.
- Keep browser and Node build code in their respective TypeScript environments.
- Measure performance claims and include the method and before/after results.
- Preserve authorship and the MIT license. Keep inherited changelogs as history.

Read [AGENTS.md](AGENTS.md) when working with a coding agent.

## Verification and inherited debt

Run `npm run verify` for build/configuration changes. For application work, run
`npm run check`, build the affected platform, and smoke-test the affected behavior
in the browser. Include browser and userscript-manager versions in the PR.
The legacy `--test` build flag only includes browser test regions; it does not
run a test suite. There is no comprehensive automated runtime suite yet.

Lint uses ESLint flat config with JavaScript and TypeScript recommended rules.
Known findings are recorded by file/rule in `eslint-suppressions.json`.
TypeScript diagnostic counts are recorded by project/file/code in
`tools/typecheck-baseline.json`. New files and increased counts fail the checks;
these count budgets do not replace review or guarantee that every new error is caught.

Do not expand allowances to conceal regressions. To inspect all diagnostics, run
`npm run lint:full` and `npm run typecheck:full` separately. These currently fail
on inherited code. As debt is fixed, run `npm run lint:prune` and review a fresh
`npm run typecheck:baseline` diff. Updating the TypeScript baseline can also
accept new problems, so review every changed allowance before committing.

For a deliberate tooling upgrade, explain any unavoidable baseline changes and
verify all output variants. Never routinely regenerate ESLint suppressions.

## Reporting bugs

Use the issue tracker of the NZ repository you are working in once it is
configured. The old XT project and its releases are historical references;
do not send NZ-specific reports to the former maintainer.

Include:

1. Steps to reproduce, expected behavior, and actual behavior.
2. The commit/build version, browser version, operating system, userscript manager
   version, and whether you used a userscript or an unpacked extension.
3. Relevant console errors, with personal information removed.
4. Whether the problem occurs in a fresh browser profile, with default settings,
   and with other extensions/userscripts disabled.
5. Whether the same issue occurs with only 4chan's native extension enabled.

Back up settings before resetting them. If sharing an export, remove private
personas, post history, credentials, and other personal data.

## Historical references and releases

The original [developer documentation](https://github.com/ccd0/4chan-x/wiki/Developer-Documentation)
can help explain inherited behavior but may be outdated. Archive data originates
from [4chenz/archives.json](https://github.com/4chenz/archives.json); coordinate
archive-data changes with that project when appropriate.

NZ release URLs, extension identity, signing, and publishing are not configured.
Local userscripts disable automatic updates. Review inherited metadata and set
the NZ version/date before the first public release; do not use the old signing
or download-statistics helpers as a NZ release pipeline.
