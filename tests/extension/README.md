# 4chan-XZ extension QA

Use Node 24 LTS, npm 11+, and Playwright's bundled Chromium. From the repository root:

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run test:extension:types
npm run test:extension
```

`test:extension` builds the actual unpacked MV3 extension in `dist/crx` before running tests. On an image with restricted filesystem writes, add `--cache /workspace/.npm-cache` to npm installation commands and set `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` for both browser installation and test execution. Chromium installation needs access to `cdn.playwright.dev` and its redirect destination `storage.googleapis.com`; Linux system dependencies require the distribution package repositories.

The persistent context loads the unmodified extension with `--load-extension` and `--disable-extensions-except`. A unique temporary profile gives each test a genuine fresh install. The fixture waits for the extension worker, starts tracing, closes the context on completion, and then deletes the profile. Tests await visible controls and poll actual `chrome.storage` values rather than sleeping for a guessed duration. Retries are disabled so failures remain visible.

The synthetic HTML board is served through Playwright routing at `https://boards.4chan.org/g/thread/100`. This retains the real manifest match and browser-injected content script. It contains three deterministic posts and no live site scripts. Requests for board configuration receive fixture JSON; all other page requests are aborted. No real board access or credentials are needed.

## Coverage

| Test | Evidence |
| --- | --- |
| Fresh installation | Actual worker/manifest, first-run settings, version saved to sync storage, worker scripting bridge, subsequent reload |
| UI contract | No manifest popup/options page; all five in-page settings tabs open; panel closes and reopens |
| Settings and DOM | Anonymize saved through UI, observed in real extension sync storage, applied to DOM across tabs and reloads |
| Main-world bridge | Native-extension setting written to page localStorage by the production worker; required permissions present without optional blanket access |
| Core filtering | UI-created comment rule hides the matching reply, leaves a control reply visible, and disabling the rule restores the reply after reload |

4chan-XZ has no toolbar popup and no separate options page. The manifest contract test deliberately asserts their absence. If either is added, replace that contract with real UI interactions and extend the fixture instead of creating a fake popup.

The suite is authored for a compatible Chromium runner. It has **not passed in the onboarding cloud instance**: browser downloads return HTTP 403 `Domain forbidden`, and the installed system Chromium has `ExtensionInstallBlocklist: ["*"]`. These prevent extension loading before assertions run. Use bundled Chromium in CI or approve the download domains in cloud settings. Do not remove enterprise policies or describe a fixture setup timeout as an application defect.

## Browser support

| Target | Validation route |
| --- | --- |
| Chromium | These Playwright extension tests with bundled Chromium and a persistent profile |
| Firefox | Separate Firefox/WebDriver or `web-ext` harness and Firefox-compatible manifest; Playwright Firefox cannot load this unpacked extension through the Chromium flags |
| Safari | macOS Safari Web Extension conversion/build and Safari automation with extension enablement; Playwright WebKit is not Safari extension testing |

The current production manifest declares an MV3 `background.service_worker`. Firefox packaging requires separate investigation of its supported background declaration. Safari needs a native containing application and extension enablement. Neither browser is claimed supported or tested by this suite. The existing userscript/filter fixture can supplement manual testing, but cannot establish extension API compatibility. A release should also validate a real supported-site page and userscript manager, including file handling, notifications and optional origins.

## CI practices and scope

- `.github/workflows/extension-tests.yml` installs the browser, builds the extension, runs browser tests, and uploads reports/traces even after failures. `.github/workflows/ci.yml` builds all variants on Linux and Windows. Lint and TypeScript checks remain available locally but do not gate either CI workflow.
- Use unique profiles rather than a developer's profile. Trace files contain page and storage data: use synthetic fixtures and short artifact retention.
- Keep production permissions unchanged. Assert default permissions, and use a separate explicit test for any user-gesture-driven optional permission grant/denial flow. Playwright `grantPermissions` handles web permissions, not arbitrary extension host grants.
- Page/context routing does not reliably intercept network calls made inside extension service workers. For future background `fetch` tests, use a controlled HTTPS fixture endpoint or a worker-aware protocol harness and assert request/response bodies. Do not claim the current page routes mock background fetches.
- Current tests exercise the real service worker scripting bridge and real extension storage. They do not test browser-account cloud synchronization, service-worker eviction/restart, background AJAX, native context menus, actual uninstall events, or persistent state across browser-process restarts. Closing the context and deleting its profile is test cleanup, not an uninstall assertion.

Inspect failures with `npx playwright show-report` or `npx playwright show-trace <trace.zip>`. On managed machines, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a compatible test binary; enterprise extension restrictions still apply and must not be bypassed.
