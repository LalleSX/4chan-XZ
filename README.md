# 4chan-NZ

**A new chapter for 4chan X: finish the TypeScript migration, then optimize and modernize the script.**

4chan-NZ is a continuation of [4chan XT](https://github.com/TuxedoTako/4chan-xt),
the now-abandoned fork of [4chan X](https://github.com/ccd0/4chan-x). XT moved the
CoffeeScript codebase into JavaScript and TypeScript. NZ builds on that work
with the goal of completing the conversion to TypeScript and improving the
script's performance, maintainability, and compatibility with modern browsers.

The script enhances anonymous imageboards with features such as filtering,
thread monitoring, quote navigation, media handling, and quick reply. It was
originally developed for 4chan and has no affiliation with it.

## Project status

NZ is in its **repository preparation phase**. The build and development
tooling are being renewed; the inherited application remains a mixture of
JavaScript, TypeScript, and custom JSX. Feature development, source conversion,
and runtime optimization have not started as part of this setup.

There is no NZ release channel configured yet. Files in `builds/` are historical
XT artifacts, not NZ releases. New local builds go into `dist/` and have
userscript automatic updates disabled. The inherited release version in
`version.json` is retained until the first NZ release is planned.

## Direction

- **Complete TypeScript:** convert remaining application JavaScript, replace
  implicit shapes with useful types, and progressively enable stricter checking.
- **Modernize architecture:** clarify module boundaries, reduce circular
  dependencies, and simplify platform adapters and build transforms.
- **Optimize with evidence:** measure startup, DOM work, memory use, and bundle
  size before making performance changes.
- **Improve reliability:** develop focused tests and document browser and
  userscript-manager compatibility as implementation resumes.

These are project goals, not features already delivered.

## Development setup

Use **Node.js 24 LTS** and **npm 11+**. `.nvmrc` and `.node-version` select Node 24;
the package engine also permits Node 26 and later. Browser output remains targeted
at ES2020 independently of the Node version used to build it.

From your local checkout:

```sh
npm ci --ignore-scripts
npm run verify
```

The lockfile is committed for reproducible installs. No dependency lifecycle
scripts are needed. After deliberately changing dependencies, use
`npm install --ignore-scripts` and include the lockfile change.

TypeScript is pinned to 6.0 to remain within
[typescript-eslint's supported range](https://typescript-eslint.io/users/dependency-versions/).
Font Awesome stays on version 6 because the inherited icon transform depends on
its module format.

On Windows, if PowerShell's `npm` launcher reports a missing `npm-cli.js`, use
`npm.cmd` for these commands. That is a local npm installation issue rather than
a project build failure.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build readable userscript and unpacked extension together |
| `npm run build:userscript` | Build only the userscript, pruning extension-only code |
| `npm run build:userscript:min` | Build minified userscript with a source map |
| `npm run build:crx` | Build readable unpacked extension |
| `npm run build:crx:min` | Build minified unpacked extension with source maps |
| `npm run build:all` | Clean and build all four platform variants |
| `npm run check` | Run lint and TypeScript baseline checks |
| `npm run verify` | Run checks, then build all variants |
| `npm run clean` | Remove only the generated `dist/` directory |

Build options can also be passed directly:

```sh
npm run build -- --platform=userscript --minify
npm run build -- --no-format
npm run build -- --test
npm run build -- --help
```

`--no-format` skips inherited output formatting. `--test` keeps the legacy
in-browser test regions in the bundle; it does not run an automated test suite.
The old `-min`, `-platform=...`, `-no-format`, and `-test` flags remain accepted.

## Local build output

- `dist/4chan-NZ.user.js` and `dist/4chan-NZ.min.user.js`: development userscripts.
- Corresponding `.meta.js` files contain userscript metadata; the minified script
  also has a `.map` file.
- `dist/crx/` and `dist/crx-min/`: readable and minified unpacked extensions.
  `manifest.json` defaults to Manifest V3. `manifestV3.json` and the historical
  `manifestV2.json` are also generated; MV2 output is retained for reference.
- `dist/build-warnings.json`: inherited circular dependency warnings from the
  most recent build invocation.

For browser smoke testing, install the generated `.user.js` in your preferred
userscript manager, or load `dist/crx/` as an unpacked extension in Chromium's
extension developer mode. Use a separate browser profile and export settings
before experimenting. These builds are for development and have not been
validated as public releases. The `crx` command name does not imply a signed
`.crx` package or a browser-store upload.

## Checks during the migration

The inherited application already has lint findings and TypeScript diagnostics.
Instead of changing application code during setup, the repository records them in
`eslint-suppressions.json` and `tools/typecheck-baseline.json`.

`npm run check` fails when diagnostic counts grow for a file/rule or file/TS code.
New files have no allowance. Count baselines cannot detect every replacement of
one existing error with another, so code review remains necessary.

To inspect the complete debt, run `npm run lint:full` and `npm run typecheck:full`
separately. These commands are expected to fail until the inherited problems are
resolved. Browser and Node TypeScript environments are configured separately;
the build config only transpiles, while the check command performs type analysis.
Strict mode is a future migration milestone, not silently enabled over legacy code.

CI runs checks and all build variants on Windows and Linux with Node 24 and saves
temporary development artifacts. A passing build does not verify live browser behavior.

## Before publishing NZ

Choose the NZ repository and release URLs, configure support links and extension
identifiers, review permissions and browser compatibility, and assign a release
version/date. `package.json` still contains inherited XT/upstream links and
extension IDs as historical placeholders; they must be reviewed before release.
The current Git remotes have not been changed. Neither automatic update hosting
nor a signing/publishing workflow is configured.

## Inherited behavior to know about

The script disables 4chan's native extension. After uninstalling it, re-enable the
native extension in 4chan's Settings by clearing “Disable the native extension”
and saving.

By default, the inherited script remembers last-read posts and your posts even
in private browsing. Disable “Remember Last Read Post” and “Remember Your Posts”
to change that behavior. Resetting script settings clears its stored browsing
history. Some optional features contact third-party sites; the original
[privacy documentation](https://github.com/ccd0/4chan-x/wiki/Privacy) provides
historical context and will need review as NZ evolves.

## Contributing and credits

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and bug-report guidance and
[AGENTS.md](AGENTS.md) for repository-specific instructions for coding agents.
[CHANGELOG.md](CHANGELOG.md) preserves XT history; the
[original 4chan X changelog](original%204chan%20X%20CHANGELOG.md) preserves upstream history.

NZ builds on the work of Tuxedo Takodachi and the 4chan X authors, including
James Campos, Nicolas Stepien, ihavenoface, Zixaphir, Seaweed, Spittie, ccd0, and
many other contributors. Original authorship and history remain intact.

Licensed under the [MIT license](LICENSE).
