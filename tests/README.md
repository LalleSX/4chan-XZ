# Filter Checks

For automated checks of the production userscript bundles, see [Userscript QA](userscript/README.md).

For Chromium tests of the actual unpacked extension, see [Extension QA](extension/README.md).

Run `node --test tests/dollar.test.ts` for the platform helper regressions: task
ordering and errors, debounce timing, request caching, form data, entity decoding,
event listeners, and property copying. These execute `src/platform/$.ts` with
isolated platform dependencies; they do not replace the browser suites or manual
userscript-manager testing. Restricted runners can use `--test-isolation=none`.

Run `node --test tests/filter.test.ts` after `npm ci --ignore-scripts`.
The suite covers the shared parser, literal rule generation, legacy examples,
and the production filter initialization/matching paths with browser services
replaced by fixtures.

Run `node tests/filter-browser.ts` and open the printed loopback URL for the
editor fixture. It uses the production editor, icons, and stylesheet with local
fixture storage. Stop the server with Ctrl+C. It does not install the userscript
or exercise browser-manager storage, post hiding, or desktop notifications.

Browser checks:

- Add a literal rule containing regex punctuation; test matching and nonmatching text.
- Configure board exclusions, post/file restrictions, actions, and regex flags.
- Disable, re-enable, remove, and undo a rule; reload to check persistence.
- Edit raw rules, save, and check line-specific errors for invalid expressions.
- Switch to MD5/Unique ID and verify exact, case-sensitive values containing slashes.
- Check the editor at desktop and narrow mobile widths.

Before release, also test the generated userscript in a userscript manager and
the unpacked extension on supported sites, including thread/index/catalog
filtering, same-poster and recursive actions, and desktop notifications.
