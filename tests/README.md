# Filter Checks

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
