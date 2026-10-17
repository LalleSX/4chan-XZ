# Userscript QA

Use Node 24 LTS (or 26+) and npm 11+. From the repository root:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:userscript
```

On Linux CI, install the browser and its system dependencies with
`npx playwright install --with-deps chromium`.

The command checks the test types, builds the readable and minified production
userscripts, and runs 32 checks in Chromium: eight checks for each combination of
bundle and GM API style. It uses the existing Playwright dependency. It does not
enable the build's historical `--test` regions. The extension suite and its
configuration remain separate.

To store browser downloads in this repository's ignored cache on PowerShell, set
this variable before both installation and execution:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/ms-playwright'
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing compatible
test binary. No developer browser profile or installed userscript is changed.

## Checks

- Installation metadata: name, version, namespace, grants, site inclusion and
  exclusion patterns, document-start timing, disabled development updates,
  matching `.meta.js` header, and parseable JavaScript.
- Fresh installation: complete initialization, first-run settings, version saved
  through GM storage, page-context version exposure, and reload without reopening
  first-run settings.
- Settings UI: all five sections, close/reopen, and native-extension disabling
  through the production page-context bridge.
- Persistence: Anonymize on/off through the UI, stored through GM APIs and applied
  to the page across reloads and a second tab.
- Filtering: add a comment rule through the editor, hide its matching reply,
  preserve control posts, disable that exact rule, and restore the reply.
- Duplicate injection: one initialization event and one settings control after
  executing the same bundle twice.
- Post menus: switching between posts, copying the selected comment, report URLs
  and pass-dependent popup sizes, archive links, and keyboard closing.
- Post deletion: selected post form data, server error notices, and retry followed
  by success. Deletion requests receive local mock responses.

All browser tests fail on uncaught exceptions or application `console.error`
calls, including errors caught by production feature initialization. They use
observable initialization events and Playwright assertions instead of sleeps.
Every test gets an isolated browser context and empty storage. Retries are off.

## Harness boundaries

The production bundles run unmodified. A small test adapter supplies either
legacy synchronous `GM_*` APIs with value listeners, or asynchronous `GM.*` storage
APIs with no legacy aliases. This specifically exercises both production storage
branches and detects accidental reliance on the legacy globals.

GM values are backed by a separate, prefixed localStorage area in the synthetic
origin. Assertions inspect those values, not the application's localStorage
fallback. This models persistence within a context; it does **not** validate a
manager's real storage, cross-origin synchronization, sandbox, grant enforcement,
or browser-process restart behavior. The request adapter uses XHR and therefore
does not reproduce privileged manager CORS semantics.

A single [Playwright init script](https://playwright.dev/docs/api/class-browsercontext#browser-context-add-init-script)
installs the adapter before the bundle. Injection waits for the document element
if Playwright runs before `<html>` exists; it does not wait for DOMContentLoaded.
This tests startup on a synthetic document, not the exact scheduling guarantees
of a particular userscript manager.

The fixture URL is `https://boards.4chan.org/g/thread/100`. Board HTML, its minimal
theme stylesheet, and board-configuration JSON are fulfilled locally. All other
page/XHR requests are aborted, and service workers are blocked. No live board,
credentials, posting, or upstream requests are required. Blocked URLs are recorded
for diagnosis; blocking an unmodeled endpoint is not itself an assertion that its
feature works.

Before release, manually install each generated `.user.js` in the intended
browser/manager and verify installation, first-run UI, reload/persistence,
filtering, image/file handling, and cross-origin requests on a supported page.
These automated checks do not establish Tampermonkey, Violentmonkey,
Greasemonkey, Firefox, or Safari compatibility by themselves.

## Debugging and CI

```sh
# Rebuild and run just one combination:
npm run test:userscript -- --project=readable-modern
# Run existing bundles without rebuilding:
npx playwright test --config=playwright.userscript.config.ts
# Check harness types alone:
npm run test:userscript:types
# Open the most recent report:
npx playwright show-report playwright-report/userscript
```

Failure screenshots/traces and per-test error/blocked-request diagnostics appear
under `test-results/userscript`; the HTML report is in
`playwright-report/userscript`. Use `npx playwright show-trace <trace.zip>` to
inspect a trace. Both directories are ignored by Git.

`.github/workflows/userscript-tests.yml` runs the same command and uploads reports
even when tests fail. Repository-wide quality checks remain separate:
`npm run verify` checks their inherited baseline and builds every platform.
