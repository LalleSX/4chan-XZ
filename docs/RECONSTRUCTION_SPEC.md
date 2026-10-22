# 4chan-XZ: behavior and reconstruction specification

## 1. Purpose, scope, and how to use this document

This is a descriptive specification of **4chan-XZ**, an imageboard enhancement application distributed as a userscript and an unpacked browser extension. It is intended as the input to an advanced programming model rebuilding the application without the original application source. Implement the described observable behavior, state transitions, configuration, interfaces, and failure handling. Internal implementation choices may differ when they preserve those contracts.

The reference is repository commit `a0becac634e96123c03c4217b6e5b49b3da1a4c4`, inspected on 2026-10-22. The embedded application version is `2.24.2`, with version date `2025-12-23T20:20:20Z`. These are inherited identifiers, not a claim of a new public XZ release. The working tree was clean before this document was added.

This document describes the implementation found in the checkout, rather than treating its README or historical release notes as a complete specification. The project continues 4chan X through 4chan XT. Finishing TypeScript conversion, redesigning architecture, and performance optimization are project directions, not additional user-facing capabilities to invent.

Read sections 2–19 as the behavioral specification. The appendices supply exact settings, installation metadata, archive registry, initialization order, UI templates, styles, and binary resources. They are embedded so that reconstruction does not depend on access to repository paths or linked documentation. File paths in the prose identify responsibility in the reference implementation; they are not required external reading. Preserve original attribution and resource licenses.

**Fidelity boundary:** this is a functional reconstruction specification, not a proof of byte-for-byte equivalence or exhaustive documentation of every inherited browser quirk. CSS, markup templates, and asset bytes are supplied to make visual fidelity practical. Remote imageboards, CAPTCHA providers, archives, and embedding services are external dependencies; their continued availability and current protocols cannot be established by inspecting local source. Do not claim that a reconstructed integration works merely because it recognizes a URL.

## 2. Product and execution model

The application runs inside supported imageboard pages. It adds a persistent navigation header, settings, post menus, filtering, richer quotes, media controls, a thread watcher, live updates, and a floating posting form. It enhances or selectively replaces parts of the site's page. It is not a standalone imageboard server or a new social account system.

The browser extension has **no toolbar popup and no separate options page**. Its controls and settings are in the page. The userscript and extension share the feature layer, data model, markup, and styling. Platform adapters provide storage, privileged HTTP, tab opening, and execution in the page's JavaScript world.

Deliver two runnable targets:

- A document-start userscript with legacy synchronous `GM_*` and modern asynchronous `GM.*` support, matching metadata and a metadata-only companion file.
- A Chromium-style Manifest V3 extension with `script.js` as the content script and `eventPage.js` as its service worker. Keep generated Manifest V2 output as a historical alternate, not an assertion that current browsers accept it.

Inject on matched HTTPS imageboard hosts, image hosts, and auxiliary posting/report/pass pages. The exact include, match, exclusion, and grant lists are in the installation appendix. Some legacy routing also understands 4channel.org even though the default generated match list does not independently list that domain. Do not silently broaden the manifest because an adapter recognizes a hostname.

Manifest V3 content scripts run at `document_start` in all frames. Default permissions are `storage`, `scripting`, and `webRequest`; host permissions are the configured primary and additional site matches. Optional host permissions are `*://*/`. Cross-origin permission requests are feature-driven. MV2 uses a nonpersistent background script, storage and configured hosts in permissions, and optional `*://*/` access. Icons are supplied at 16, 48, and 128 pixels. Preserve the inherited Gecko identifier and other identity placeholders unless making a deliberate release change.

Local development builds disable both userscript `@updateURL` and `@downloadURL` by setting them to `none`. The metadata helper alone contains an inherited download URL, but the build driver rewrites it; reproduce the final build behavior. No public release hosting, signing, or publication workflow is configured.

## 3. Startup, routing, and lifecycle

Startup must tolerate early injection, absent DOM nodes, multiple injections, unavailable storage, pages that loaded incompletely, and independent feature failures.

1. Avoid irrelevant blank/ad frames. Detect the root `fourchan-x` class and return on duplicate injection. Add `fourchan-xt`, `fourchan-x`, `seaweedchan`, engine identification, and board work-safety classes as appropriate.
2. Expose an immutable page-world `window.fourchanXT` object with `version` and a `buildDate` getter that returns a fresh Date. Initialize page-world `FCX` and the `js-enabled` root marker.
3. Flatten the settings tree into a flat configuration map. An array setting uses a clone of its first item as the default; scalar values use themselves. The remaining array items are help text and optional visual indentation. Populate database defaults, archive defaults, board/site caches, sorting records, cooldown records, and compatibility keys.
4. Read persisted values and `previousversion`. Missing version means first run: save the version and open Settings on a legitimate page. A version change runs migration and optionally shows a 15-second update notice linking to the changelog. Saved non-nullish values override defaults.
5. Resolve the site adapter and parse the URL. Classify index, thread, native catalog, archive listing, direct file, or auxiliary page. Recognize both `/thread/ID` and `/res/ID`, optional extensions, repeated slashes, and Tinyboard `/archive/res/ID.html`.
6. On direct media pages, apply configured video looping, controls, volume and mute behavior; redirect missing media to an archive if enabled. Auxiliary pages run only their relevant pass, CAPTCHA, report, or posting-success integration.
7. On board pages initialize feature modules in the exact order listed in the appendix. Skip names disabled by the adapter. Isolate each initialization failure, display a useful notice, and continue initializing other features.
8. Install CSS after a body is available. Parse existing HTML unless the JSON index is generating the page. Parse native catalog objects separately. Thread callbacks precede post callbacks. Process large post batches in chunks of 250 with event-loop yields.
9. Emit `4chanXInitFinished` after initial processing. Track whether the event is expected, so another copy's initialization can produce a conflict notice. Dynamically inserted threads and posts must receive the same processing as initial content.

Use MutationObservers on the board and thread roots. Recognize newly added post containers, including wrapped containers, but do not parse an already registered DOM original twice. After processing, emit insertion/removal events. Existing quote clones are not new original posts. Incomplete pages display a reload warning. Invalid/offline/error documents must not be treated as normal board HTML. Detect competing native extensions and duplicate application copies when reporting failures.

On 4chan, the native extension is disabled by default by setting `disableAll: true` in page-origin `4chan-settings` localStorage, with a page-world Config fallback when storage fails. This persists beyond uninstall; re-enabling the native extension is a separate site setting. Preserve optional native Flash hooks as historical integrations.

## 4. Site adapters and external data shapes

Use a site interface for URL construction, selectors, parsing, post building, theme lookup, feature exclusions, board metadata, and auxiliary page handling. Resolve configured host suffixes and canonical aliases. `4channel.org` and `4cdn.org` canonicalize to `4chan.org`; `notso.smuglo.li`, `smugloli.net`, and `smug.nepu.moe` canonicalize to `smuglo.li`. Strip an initial `www.` when detecting Tinyboard sites. Persist discovered software/root properties.

### 4.1 Yotsuba / 4chan

Primary URLs, using the page protocol unless otherwise stated:

| Purpose | Form |
| --- | --- |
| Board | `https://boards.4chan.org/{board}/` (domain selected by board configuration) |
| Thread | `https://boards.4chan.org/{board}/thread/{thread}` |
| Post anchor | `#p{post}` |
| Native catalog | `/{board}/catalog`, unavailable on `/f/` |
| Native archive | `/{board}/archive`, only for archive-enabled boards |
| Board metadata | `https://a.4cdn.org/boards.json` |
| Thread JSON | `https://a.4cdn.org/{board}/thread/{thread}.json` |
| Thread list | `https://a.4cdn.org/{board}/threads.json` |
| Catalog JSON | `https://a.4cdn.org/{board}/catalog.json` |
| Archive list | `https://a.4cdn.org/{board}/archive.json` |
| Media | selected image host + `/{board}/{filename}` |
| Posting | `https://sys.{4chan-or-4channel}.org/{board}/post` |

A thread response is `{posts: [...]}`. Its first post is the OP. Catalog data is an array of pages containing `threads`; each thread is an OP-shaped object with counts and optional `last_replies`. Thread-list data similarly contains per-page thread records. Archive lists are numeric thread IDs.

Parse API post fields including `no`, `resto`, `time`, `now`, `name`, `trip`, `id`, `capcode`, `sub`, `com`, `email`, country/board flags, `tim`, `filename`, `ext`, `fsize`, `w`, `h`, `tn_w`, `tn_h`, `md5`, `spoiler`, `filedeleted`, and OP metadata `sticky`, `closed`, `archived`, `bumplimit`, `imagelimit`, `unique_ips`, `replies`, `images`, `omitted_posts`, `omitted_images`, `custom_spoiler`, `last_modified`. Missing fields are normal. Maintain decoded text separately from site-provided comment markup.

Native selectors include `.board`, `.thread`, `.postContainer`, `.post`, `.postInfo`, `.postMessage`, `.subject`, `.name`, `.useremail`, `.postertrip`, `.posteruid > .hand`, `.capcode.hand`, `.n-pu`, `.flag, .bfl`, `.dateTime`, `.nameBlock`, and `a.fileThumb`. A quote is `.quotelink` outside preformatted code. A native catalog has `#threads` and `.thread` tiles. Rebuilt posts must provide equivalent semantic nodes so every feature sees the same model for HTML, API, and archive posts.

Cache board metadata for two hours, use cached metadata with a warning on fetch failure, and release waiting feature callbacks after metadata selection. When archive capability is unknown, assume an archive exists to avoid prematurely clearing archived-thread history. The current board-domain chooser returns boards.4chan.org for all boards.

Treat `/f/` specially: no JSON index replacement, one-page board, age-based pruning, deferred MD5 information, Flash-specific filenames/host and file tags. Respect board-specific anonymity, subject, file, spoiler, flag, cooldown, duration, and dimension constraints.

### 4.2 Tinyboard / vichan-family sites

Detect an inline `var configRoot="..."` value and resolve a root-relative root against the current origin. Thread URLs are `{root}{board}/res/{thread}.html`, archive threads add `archive/`, anchors are `#{post}`, catalog is `catalog.html`, and JSON is `res/{thread}.json`, `threads.json`, `catalog.json`, or `archive/archive.json`. Missing JSON support is possible.

The thread container is also the OP container. Typical selectors: `form[name="postcontrols"]`, `div[id^="thread_"]`, `div[id^="reply_"]:not(.hidden)`, `.intro`, `.body`, `.fileinfo`, `.post-image`, `.files > .file`, `.poster_id`, `time`, `.spoiler`; native catalog uses `#Grid`, `.mix`, `.thread-image`. Support multiple files. A Kissu React UI uses `.page-container` and a `mounted` event before parsing.

Disable these feature initialization names for this adapter: Resurrect Quotes; Quick Reply Personas; Quick Reply; Cooldown; Report Link; Delete Link; Edit Link; Quote Inlining; Quote Previewing; Quote Backlinks; File Info Formatting; Image Expansion; Image Expansion (Menu); Comment Expansion; Thread Expansion; Favicon; Quote Threading; Thread Updater; Banner; Flash Features; Reply Pruning. Other features still perform their own capability/configuration checks. Observe the site's native successful-post mechanism to update own-post/watcher state where available.

## 5. Runtime model and extension interfaces

Maintain ordered registries rather than relying on numeric object-key enumeration:

- **Board:** site/board identity, board metadata, threads and posts belonging to the board.
- **Thread:** numeric ID, board, `fullID = boardID + '.' + ID`, OP, ordered posts, DOM root, catalog representations, page number, sticky/closed/archived/dead/hidden status, limits, reply/file/IP counts, and last post information.
- **Post:** site/board/thread IDs, numeric ID, board-local `fullID`, original context, reply-versus-OP flag, parsed info, normalized quoted IDs, files, DOM nodes, clones, fetched-quote state, dead/hidden flags, and filter results. The first file is also exposed as `file` for inherited consumers; multifile-aware consumers use `files`.
- **File:** original name, URL, thumbnail URL, type, MD5 when available, dimensions, byte and display sizes, spoiler/deletion state, DOM links/thumbnail, expansion/loading state, and optional video/audio playback state.
- **Post clone:** a separate DOM representation referencing an original and a quoting context, with its own clone index and preview/inline state. Removing a clone must leave remaining clone indices correct and must not delete the original.
- **CatalogThread / CatalogThreadNative:** views attached to a Thread, with separate lifecycle callbacks for generated and native catalogs.

Use ordered callback registries for Thread, Post, CatalogThread and CatalogThreadNative. Feature callbacks execute with their model as context. Catch and report callback failures without preventing unrelated callbacks. Do not count clones as new posts, new unread content, or additional unique posters.

The shared utility layer supplies DOM creation/querying, event subscription/removal, custom events, readiness polling, queued tasks, debouncing, object cloning with safe dictionaries, text escaping, form serialization, HTTP requests, request caching, and conditional requests. Custom JSX uses `h` and `hFragment` and represents escaped HTML; it is not React. Ordinary interpolated user text is escaped; only intentionally trusted/normalized markup is inserted as HTML.

Document events coordinate modules. Preserve at least `4chanXInitFinished`, `PostsInserted`, `PostsRemoved`, `ThreadUpdate`, `IndexRefresh`, `IndexRefreshInternal`, `SortIndex`, `QRPostSuccessful`, `OpenSettings`, `AddSettingsSection`, and `CloseMenu`. `QRPostSuccessful` carries board/thread/post IDs. `ThreadUpdate` identifies the thread and new/deleted posts/files; terminal updates can carry `404: true`. `IndexRefreshInternal` carries thread full IDs and whether the view is catalog. CAPTCHA coordination includes `LoadCaptcha`, `RequestCaptcha`, `AbortCaptcha`, `SaveCaptcha`, and `NoCaptcha`. These are integration hooks, not telemetry.

## 6. Header, navigation, settings, and presentation

Add a fixed header by default, with full/custom board navigation, current board links, configurable shortcuts, a menu, Settings access, and feature controls. Allow top/bottom placement, centered links, auto-hide, auto-hide-on-scroll, a bottom board list, and catalog link preference. Floating dialogs have draggable headers and saved positions; defaults are in the settings appendix. Quote/image hover placement must stay within the viewport and optionally follow the pointer.

Custom board navigation is a small text language supporting bracketed groups, `toggle-all`, current-board index/catalog/expired/archive destinations, board entries, external links, and text overrides such as `current-index-text:"Index"`. The default string is supplied verbatim. Board titles/subtitles are editable by Ctrl/Command-click; persistent override optionally wins when the site's original title changes.

The Settings dialog is `#fourchanx-settings`. Provide five sections: **Main, Filter, Sauce, Advanced, Keybinds**. Main groups settings by feature category and displays defaults/help/dependency indentation from the configuration appendix. Save changes through the platform adapter. Features that initialize once require reload; the filter editor explicitly says so. Provide live CSS application and relevant media/favicon/beep previews where implemented.

Export settings as JSON `{version, date, Conf}`; date is epoch milliseconds. Before export, refresh values from storage without replacing the active runtime configuration object. Omit cached board configuration. When history exclusion is selected, omit hiddenThreads, hiddenPosts, hiddenPosterIds, lastReadPosts, yourPosts, watchedThreads, cooldowns, and Index Sort. Ask whether to include history by default and allow remembering that choice. Cancellation must not export. Import overwrites settings only after confirmation, migrates old values, reports errors, and offers reload. Reset confirms, clears settings/history, and offers reload. Use a downloadable JSON Blob, not a remote service.

Advanced settings include timestamp locale/format, relative dates, file-info/backlink formats, custom CSS, navigation, personas, archive source/selection, updater interval, image host, favicon, sound source/volume, pruning, and embedding preferences. Keybinds can be edited and reset with confirmation. Use the exact defaults in the appendix. Prevent shortcuts that would conflict with ordinary typing in input/textarea/editable contexts, except intentional form editing/submission shortcuts. Reused shortcuts are resolved by context, e.g. gallery navigation versus index pagination.

Visually inherit the board's familiar compact layout. Support the bundled Yotsuba, Yotsuba B, Futaba, Burichan, Photon, Tomorrow and Spooky theme adjustments. Use the embedded CSS and `--xt-*` custom properties as the precise styling reference. Settings, QR, menus and watcher adapt to narrow screens; the filter editor must remain usable on mobile widths. Icons have labels/titles and interactive controls remain keyboard-operable. A Notice has info/warning/error style, close action, optional timeout, and optional HTML/link content.


### 6.1 Formatting contracts

Timestamp substitutions: `%a`/`%A` localized short/long weekday, `%b`/`%B` short/long month, `%d`/`%e` padded/unpadded day, `%H`/`%k` padded/unpadded 24-hour, `%I`/`%l` padded/unpadded 12-hour with midnight/noon as 12, `%m`/`%n` padded/unpadded month, `%M` minute, `%S` second, `%p` localized day period, `%P` lowercase day period, `%y` two-digit year, `%Y` full year, `%%` literal percent. Unknown substitutions remain literal. Empty timeLocale uses the browser locale; numeric values use local Date getters. Preserve surrounding whitespace on native date nodes and avoid reformatting clones independently.

File-info substitutions: `%t` URL basename, `%T` linked URL basename, `%n` abbreviated original name with hover/full-name switch, `%N` full original name, `%l` linked abbreviated name, `%L` linked full name, `%d` download control, `%f` quick MD5 filter control, `%p` “Spoiler, ” or empty, `%s` native formatted size, `%B` rounded bytes, `%K` rounded KiB displayed as KB, `%M` MiB rounded to two decimals displayed as MB, `%r` dimensions or PDF, `%g` comma-prefixed file tag, `%%` percent. Escape ordinary format text and data; rebind download/filter handlers on clones. Backlink formatting substitutes `%id` in the configured backlink label.

## 7. Index generation, searching, hiding and sorting

When JSON Index is enabled on a Yotsuba board other than `/f/`, replace the native index with one generated from catalog JSON. Provide refresh status/time, search and clear controls, hidden-thread count/toggle, sort direction, sort type, thumbnail size and mode. Preserve History API navigation, back/forward state, page, search, sort, and mode. Recognize index/catalog mode hash commands. Reuse model objects and existing DOM where possible; newly built posts still receive normal callbacks.

Modes are `paged`, `infinite`, `all pages`, and `catalog`. Infinite scrolling loads the next page when within 300 px of the bottom and avoids overlapping loads. End-of-list feedback is not repeated continually. All-pages and catalog modes normalize the selected page to one. Catalog tile image maximum dimension is 150 px for small and 250 px for large; preserve aspect ratio. Catalog can reveal more comment/replies on hover and optionally toggle that expansion with a click. Hidden replies do not appear in these previews. Build large catalogs in scheduled batches rather than blocking the page.

Sort modes:

| Mode | Ordering |
| --- | --- |
| Bump | API thread order |
| Creation date | Descending thread ID |
| Reply count | Descending replies |
| File count | Descending images |
| Posts per minute | Ascending `(nowSeconds - time)/(replies + 1)` |
| Last reply | Most recent visible last-reply ID; use last_modified when reply data is unavailable |
| Last long reply | As above, but count alphabetic letters after parsing comment markup and apply separate thresholds for posts with/without files |

For last-long selection, inspect recent replies backwards, skip hidden replies, fall back to the first supplied reply if earlier posts are omitted, otherwise the OP. Reverse the base order when selected. Then apply stable partitions in this sequence: sticky first; highlighted-on-top or optionally watched first; visible first when hidden anchoring is enabled. Later partitions have higher priority across groups. Sort and threshold settings can be global or per-board.

Plain search is case-insensitive AND across whitespace-separated keywords in comment, subject, name, tripcode and original filename. Also accept `field+field:/pattern/flags` against filter field values joined by newlines. Invalid search regex yields no results. Search updates history without one entry per keystroke, and clearing restores navigation state. Native catalog and generated catalog remain distinct paths; native filtering is separately configurable.

On ordinary HTML indexes, Comment Expansion fetches/expands truncated comments, and Thread Expansion fetches omitted replies with controls to contract again. Thread links can open in new tabs. Optional navigation controls move between threads, top/bottom, replies, or matching unique IDs/capcodes. URL normalization removes slugs/excess slashes and normalizes `/res/` to `/thread/` where applicable.

## 8. Filtering, rule editor, and local hiding

Filtering is local presentation control. It does not report or delete server posts. Maintain independent thread hiding, post hiding, poster-ID hiding and rule matching. A hidden item either disappears or is replaced by a compact stub according to settings/rule overrides. Stubs allow revealing content, show a reason when enabled, and expose the reason on hover otherwise. Hiding an OP hides its thread in relevant views. Support recursive replies to hidden posts, with visited tracking to avoid cycles. Hidden quote links/backlinks are struck through or omitted according to settings. Anonymize replaces displayed identity with Anonymous without destroying original data needed by other features.

### 8.1 Grammar

Each category stores newline-separated rules. Blank lines and lines whose trimmed value starts with `#` are ignored. Active form is `/pattern/flags;option;option:value`. Find the closing slash by scanning: for regex fields honor escapes and character classes, and accept a candidate only when followed by alphabetic flags and then whitespace plus `;` or end-of-line. This preserves URL patterns and slashes in legacy MD5 values.

Fields: `postID`, `name`, `uniqueID`, `tripcode`, `capcode`, `pass`, `email`, `subject`, `comment`, `flag`, `filename`, `dimensions`, `filesize`, `MD5`. General defaults to subject, name, filename, comment; `type:` changes its targets. Commas mean alternatives; plus signs concatenate fields with newline separators. **MD5 and uniqueID category rules compare exact case-sensitive strings, not regexes.** Reset a RegExp's lastIndex before every filter test, including previews, so global/sticky flags do not alternate results.

| Option | Behavior |
| --- | --- |
| `boards:` | Comma-separated board selection; supports site prefixes, site `*`, `sfw` and `nsfw` |
| `exclude:` | Board exclusions using the same syntax |
| `op:only` / `op:no` / `op:yes` | OP-only / replies-only / unrestricted |
| `file:only` / `file:no` / `file:yes` | With-file / without-file / unrestricted |
| `stub:yes` / `stub:no` | Override global stubs |
| `highlight[:class]` | Apply supplied class or `filter-highlight`; class limited to letters, digits, underscore, hyphen |
| `top:no` | Disable default promotion of highlighted threads; `top:yes` explicitly enables it |
| `notify` | Desktop notification instead of default hiding |
| `hide` | Explicitly hide even alongside highlighting/notification |
| `reason:` | Custom stub explanation |
| `poster` | Extend hiding to the poster |
| `replies` | Recursively hide replies |
| `type:` | General-rule fields, including joined groups |

Absent highlight/notify, matching hides by default. Highlighting or notifying alone does not hide. Bare option presence matters for hide, notify, poster and replies. Duplicate options preserve the first value and report a warning. Unknown options/fields and invalid enumerated values produce diagnostics. Bad syntax/regex or invalid highlight class is an error. Do not allow one invalid rule to suppress unrelated valid rules. A bitmask may implement post/file restrictions: replies-only=1, OP-only=2, without-file=4, with-file=8.

Board selectors can look like `boards:a,jp`, `boards:4:a,jp,sama:a,z`, `boards:4:*`, `exclude:vg,v`; compare against canonical site IDs. Strip `www.` and treat 4chan family domains as one identity. Extract filename/dimensions/filesize/MD5 from file data; missing properties must not crash matching. Board site prefixes remain active for subsequent comma-separated boards until another prefix appears. Protect remembered own posts from filter hiding. In the post callback, fetched quotes and the OP of an open thread are not hideable, though other matching actions can still apply. Accumulate unique highlight classes, notification/top/poster/replies flags and reasons across matches; a matching no-stub rule makes the combined hidden result omit its stub. Cache computed results per original post.

### 8.2 Editor

Provide field selector, literal/regex builder, preview, sample tester, active-rule list and raw editor. Literal modes are contains, equals, starts, ends. Escape regex metacharacters and literal slash in literal inputs. Equals/ends terminate with `$(?![\s\S])` so a trailing newline is not accidentally accepted. Nonregex modes ignore extra regex flags; regex mode accepts extra `g,m,s,u,y`, with `i` controlled by case sensitivity. Reject empty or multiline builder values. Exact fields force equals and case-sensitive controls and reject values whose delimiters would parse ambiguously.

Expose board includes/excludes, OP/file restrictions, stub policy, reason, action (hide/highlight/both/notify), highlight class, top priority, notifications, poster and replies. General-field checkboxes default to subject/name/filename/comment and exclude the two exact-only fields. Require at least one field. Normalize `/g/` board input to `g`. Disallow semicolons/newlines inside builder option values.

Preview updates while editing. Invalid input disables Add and displays a specific error. Adding an identical trimmed rule is rejected. The sample tester tests the pattern itself, not an imaginary whole post or board context. Rows allow enable/disable by commenting, edit by selecting the corresponding raw line, remove, and undo removal in reverse order at the original position. Preserve user comments and untouched raw text. Raw edits show unsaved status; change/save persists them. Diagnostics include line numbers, active count, aria-invalid, and automatically open the raw details when errors exist. Display “Saved. Changes apply after reloading the page.”

Provide quick MD5 filtering from post menus, keyboard, shift-click thumbnails in threads, and shift-click generated catalog thumbnails. Catalog fallback hides the thread if MD5 quick filtering is disabled. Optional notices identify newly quick-filtered images. Do not mutate the site or send moderation requests for a local filter action.

## 9. Quotes, clones, identity and read context

Create backlinks from a referenced post to quoting posts, optionally including OP backlinks and positioning them at the bottom. Quote labels can identify `(OP)`, `(You)` and `(Cross-thread)`. Record successful own posts when enabled; highlight own posts and replies quoting them. Scrollbar markers represent these posts and track their positions as layout changes.

Hovering a quote shows a bounded floating preview and optionally highlights the target original. Clicking a quote can insert a clone inline; a second toggle removes it. Inline cross-thread-only mode leaves visible same-thread quotes available for normal navigation. Optional extra hash links scroll to the original. Forward hiding suppresses the original when displaying its backlink inline and restores it when appropriate. Preserve modifier-click navigation and avoid accidental recursion/duplicate bookkeeping for nested previews and clones.

Fetch a missing quote in this order: registered original; available catalog reply data; live thread JSON when a thread ID is known; supported archive post API. Show a loading label and then content or a clear connection/404/server error. Deduplicate requests and original construction. If the target preview container has been removed before the request completes, do not insert content into a stale container. Convert fetched posts to normal models and apply callbacks to their clones. Fetch flag CSS when a cross-board preview needs it.

Resurrect dead textual references into archive-capable links. Mark dead posts/files and quote links without throwing away the information required for previews. Archive text conversion recognizes newlines, bold, spoiler, code, moot/banned/fortune blocks, italic, and colored text tags while escaping ordinary text. Quote Threading can arrange conversations by reply relationships when toggled; retain sensible original order for unthreaded material and cooperate with newly inserted/updater/archive posts.

Color user IDs deterministically, allow same-ID/capcode highlighting/navigation, and display post count for an ID on hover. Relative dates support the configured display/hover modes and keep updating; absolute dates use the user's locale/timezone and configurable format. Text spoiler removal and spoiler revelation are independent options.

## 10. Thread monitoring

### 10.1 Updater

On a supported thread, show status/countdown and an Update action, either in the header or a movable dialog. Auto Update is on by default with a five-second interval; accept a minimum interval of one second. Use conditional JSON requests and cancel/ignore stale requests. A 304 means unchanged, not dead. A 200 parses new posts, detects deleted posts/files from the updater's own previous live-ID lists, updates OP sticky/closed/archived/limit/IP data, executes callbacks and inserts genuinely new posts. Maintain ordering and quote-threading integration.

A thread API 404 is not sufficient proof of deletion: fetch the board catalog and mark dead only if a successful catalog response confirms absence. Other errors show connection or HTTP status and continue scheduling. Dead/archived threads stop countdown and show their terminal state.

After own-post success, check for that post up to five times at delays of 1, 2, 3, 4 and 5 seconds. Optional increasing interval uses `j=min(outdateCount, hidden?10:5)` and `clamp((floor(baseInterval*0.1)||1)*j*j, baseInterval, 300)`. Focusing resets the inactivity counter. Scroll only according to Auto Scroll, Bottom Scroll and Scroll BG; default auto-scroll is off and normal auto-scroll requires the user already be at the bottom. Do not steal the reader's position while they are reading earlier content.

Optional beeps distinguish a new post in a completely read thread and a post quoting the user. Use the bundled beep or configured source and clamp playback volume to 0.01–1. Handle audio errors and browser autoplay restrictions. Beep defaults are off.

### 10.2 Read state and watcher

Track unread posts on originals: skip fetched quotes, clones, hidden posts, own posts and posts at or below the last-read ID when adding unread entries. Show an unread boundary, tab-title count, optional quoted-title state, and favicon state for unread/dead/work-safe/replies-to-you combinations. Remember last read by default and optionally scroll to it when reopening. Support marking read and optional unread boundaries on indexes. A hidden tab must not be treated as proof the reader consumed newly arriving content.

The Thread Watcher bookmarks threads with excerpt, site/board/thread identity, last known counts, read/reply-to-you status, page, and dead/archive state. Add/remove from threads, catalog, menus and shortcuts. Automatically watch threads created and replied to by default. Options restrict display to current board, show site prefixes, show page/unread counts, auto-prune dead threads, keep watcher visible, and require an explicit OP quote for OP-reply highlighting. Default position is upper left and fixed positioning is enabled.

Watcher refresh uses board lists and per-thread JSON when deeper information is needed. Cross-site requests use the privileged adapter. Coalesce/check timestamps across tabs to avoid each tab doing the same work. Automatic checks are every five minutes when page or unread counts are required, otherwise two hours; only initiate automatic refresh when visible and focused. A deeper pass uses a two-hour age threshold. Manual refresh is available; outstanding requests can be aborted. Keep current statuses until new results justify changing them.

Thread Stats displays replies/images, optional unique IP and current board page, and optional purge-position information. Mark New IPs labels new participants with the running IP count when enabled. Reply Pruning hides older replies above `Max Replies` (default 1000), enabled by default for stickies and optionally all threads. Pruning is a view optimization and must not destroy the underlying quote/read model. Move pruned nodes into a retained DocumentFragment and show a summary rather than discarding them. Pruning and quote threading are mutually exclusive. A hash pointing into replies that would be pruned disables pruning for that navigation; revealing a pruned post likewise turns it off.

## 11. Images, video, audio, gallery and file tools

Use a shared media policy across inline expansion, hover, gallery and standalone file tabs. Recognize images, video, PDFs and Flash where relevant. Keep original filename, media URL, thumbnail URL, MIME/type hints, dimensions, size and MD5 separate. Rewrite image hosts using the configured host and site-specific exceptions.

Image Expansion toggles full media in place with fit-width/height, scroll-into-view, expand-all, spoiler/video inclusion, expand-from-here, current-thread-only and advance-on-contract options. Image Hover shows full media in a floating preview; generated catalog hover has its own enable flag. Handle loading, failed media and archive fallback without leaving permanent spinners. Keep spoiler thumbnails unless configured otherwise. Optional Replace GIF/JPG/PNG/WEBM swaps thumbnails with actual media, while prefetching is exposed by a header toggle. “Fappe Tyme” hides posts without images while active; “Werk Tyme” hides all post images while active. Their availability settings do not mean those modes start active.

Video defaults: autoplay on opening, controls on, sound allowed, stored volume 1.0. Restart-on-open is optional. Click passthrough delegates video clicks to the browser; provide another way to contract. Mouse wheel adjusts volume over supported media targets. Standalone video tabs optionally loop and apply stored volume. Closing/removing a preview stops obsolete media and releases temporary object URLs/listeners.

The Gallery is an overlay with thumbnail strip, previous/next, play/pause, slideshow, fit-width/height, stretch, fullscreen, download, rotation, and a link/scroll to the original post. It preserves media order, handles dynamic posts, and optionally includes PDFs. Default slide delay is six seconds. Keyboard controls are in the exact settings appendix. Enter advances or plays a stopped video when autoplay is off. Keep gallery controls separate from the index shortcuts that use the same arrows.

Recognize `[sound=...]` filename audio when enabled; it loads third-party audio. Coordinate video time with audio modulo video duration, synchronize play/pause/seek/rate/waiting, and reset near initial playback. WEBM metadata adds a title affordance that fetches on first mouseover/focus using `Range: bytes=0-9999`. Parse EBML variable-length element IDs/sizes, descend through Segment and Info, and decode the Title bytes as UTF-8. Show not-found or error state; an error allows click-to-retry. Do not infer the metadata from the filename. File-info formatting uses the configurable template; original-name download is optional in post menus.

### Sauce templates

Sauce adds configurable source/reverse-search/tool links beside media. Parse noncomment lines as URL templates with recognized `;text:`, `;boards:`, `;types:`, `;regexp:` and `;sandbox:` options. Filename regex captures substitute `%$1`, etc. Support `%URL` (file), `%TURL` (thumbnail), `%IMG` (image file for gif/jpg/jpeg/png, thumbnail otherwise), `%MD5` (base64), `%sMD5` (URL-safe base64 without padding), `%hMD5` (hex), `%board`, `%name`, `%%`, and `%semi`. Encode substitutions according to URL versus JavaScript-template context; omit unusable links when required metadata is missing. Invalid regex gives a warning without breaking all links. Board restrictions share filtering's scope semantics. Preserve historical JavaScript sauce templates as explicitly user-configured behavior. The exact default template list is supplied in the settings appendix.

## 12. Linkification and embedding

Convert eligible plain-text URLs in comments into anchors without double-linking existing anchors or corrupting code/preformatted text. Preserve readable labels and punctuation. Supported-service links can receive fetched titles, service icons, hover cover previews, and an expand/collapse embed action. Link-title work in catalogs is off by default to reduce expensive requests. Auto-embed and floating embeds are independently disabled by default; normal user-triggered embedding is enabled.

Recognized handlers include direct audio/image/video, PeerTube, BitChute, Clyp, Dailymotion, Gfycat, GitHub Gist, InstallGentoo, LiveLeak, Loopvid, Openings.moe, Pastebin, SoundCloud, StrawPoll, Streamable, TwitchTV, Twitter/X, VidLii, Vimeo, Vine, Vocaroo and YouTube. Some are legacy handlers for defunct services. Preserve URL recognition and fallback links, but do not represent those services as verified live.

Service adapters extract stable media IDs/options, construct a native media element or iframe/card, and optionally fetch title/cover data. Use request caching to avoid repeated metadata fetches for the same URL. Keep links usable when a lookup fails. Embeds can be contracted; floating embeds live in a movable frame with stored position. Respect HTTPS/mixed-content limitations and permissions. External iframe behavior and playback remain subject to browser/service restrictions.

Twitter/X supports the configured embedder; the default is FxTwitter (`fxt`), API base `https://api.fxtwitter.com`, optional translation language, and maximum five replies. Render cards with author/post/media information and retain the original outbound link. Treat returned text as data, not trusted executable markup.

## 13. Quick Reply, files, CAPTCHA, and posting

Quick Reply is a movable, optionally persistent panel on supported Yotsuba pages. It offers new-thread/reply target, name/options/subject, comment, character count, flags when supported, CAPTCHA, file picker, editable filename, spoiler, upload status and submit. Quoting opens/populates it with a quote reference and selected text as appropriate. Preserve cursor/focus semantics. Board restrictions can hide identity fields, require subjects/files, limit comments or prohibit audio. Allow a new/different thread from inside a thread by default.

Support a queue of post drafts (“dump list”), adding/removing/selecting/reordering drafts and multiple-file input. Each draft owns target, persona, subject/comment, spoiler, flag, file and filename state. Lock the submitted draft; prevent edits/reordering of locked items. Save changes when switching drafts. Cancelling/removing one draft must not discard others. Closing/persisting/auto-hiding follows the configured options. Do not post merely because a draft exists.

Files can come from local selection, drag/drop, clipboard, or an explicitly requested URL fetched by the cross-origin adapter. Handle pasted text separately. Validate MIME, file size, dimensions, video duration and board limits. Support image conversion/JPEG compression, preview, name reset/randomization and Tegaki drawing/editing where site integration is available. On 4chan.org, convert unsupported image MIME types to PNG but reject unsupported nonimage types. Shrink oversized image dimensions proportionally, retaining JPEG for JPEG input and using PNG otherwise. If still too large in bytes, attempt JPEG compression to the limit. Warn that conversion/resizing may lose animation or transparency. Oversized nonimages are rejected. OffscreenCanvas can be avoided by preference. Generate and revoke object URLs, show per-file errors, allow removing one/all errored drafts. Randomized filenames use a timestamp-like value from the past year while retaining a valid extension; disabled on `/f/`. Sanitize slash/backslash in uploaded names. Support Mona/SJIS and TeX previews and long-comment splitting where offered.

Personas provide board-scoped defaults/suggestions for name, options/email and subject, with an always-apply mode. Preserve the site's deletion password. Cooldowns track threads, replies, images and sage/site rules with persisted timing, plus custom cooldown. Display countdown and pending automatic submission state. Editing the first draft during the final five seconds cancels its automatic submission to avoid posting unexpectedly edited text.

### 13.1 Submit protocol and transitions

Model the path as editable → waiting for cooldown/CAPTCHA → locked/uploading → waiting for server → success or unlocked error. An active request can be aborted; its late response must be ignored.

Validate thread openness, image limit, empty comment/file, required OP file, and `/r9k/` original-comment constraints. Obtain an unexpired CAPTCHA response when needed; some reply flows use a `_ct` cookie. Missing CAPTCHA sets up its UI and stops ordinary submission. Queued drafts can enable subsequent automatic posting only through the posting flow.

Submit credentialed multipart form data to the site's `/post` endpoint. Fields are `MAX_FILE_SIZE`, `mode=regist`, `pwd`, `resto`, `name`, `email`, `sub`, `com`, `upfile`, `filetag`, `spoiler`, `flag`, plus CAPTCHA fields. Forced anonymity suppresses name and subject; subject is not sent for a reply. Serialize meaningful values using native FormData and the selected upload filename. Legacy CAPTCHA uses `recaptcha_challenge_field` and `recaptcha_response_field`; token flow uses `g-recaptcha-response`; site-specific CAPTCHA contributes its own named fields.

When enabled, submit-button status reports percentage during upload and `...` while waiting for server response. Parse HTML response: `#errmsg` indicates server error; successful document title is `Post successful!` with IDs obtained from the site's success response. A missing/unrecognized response is a connection error, not success. Unlock and retain the draft on failure. CAPTCHA errors stop auto-posting and get readable messages; repeated connection errors stop automatic retries after five errors. Respect server cooldown feedback.

On success, save own-post history, emit `QRPostSuccessful`, update cooldown, trigger updater checks, update watcher, remove/reset the completed draft, show configured success notification and continue the queue only when eligible. Open a new thread in a new tab by default; replies may open a new tab when not already viewing their destination. Auto-hide/persistent settings determine panel visibility. Restore file/spoiler/persona defaults according to preferences.

### 13.2 CAPTCHA integration

Support existing reCAPTCHA paths and the site's CAPTCHA implementation with replacement/noscript behavior, optional language, demand-driven loading, cached token expiry, queue demand, aborting pending verification and explicit completion callbacks. Auto-load is off by default; Post on Captcha Completion is off by default. CAPTCHA caching exchanges events with integrations and handles a reply cookie without incorrectly applying it to new threads. Do not implement an invented CAPTCHA bypass or automatic solver: this application coordinates the supported challenge UI and tokens.

## 14. Post menus and auxiliary pages

Every enabled post menu is bound to the selected post, including clones. Opening another menu changes that context. Close via outside interaction, appropriate keyboard action or Escape. Nested entries are positioned within the viewport.

Menu actions include report; copy normalized comment text; hide thread/reply with options; filter by relevant fields; delete post or file; archive links/searches; edit file in Tegaki; and optional original-filename download. Each action honors its own feature setting and capability gate. Copy must use the currently selected post, not the previously opened menu's post.

Reporting opens the site's report page for the selected board/post, with pass-dependent popup sizing. Archive reporting is available only for archives declaring compatible secure report APIs. Deletion sends the selected ID, stored deletion password and file-only choice to the site's deletion form endpoint. Display server failure, allow retry, and update the post/file's dead state only after success. Native post-success/redirect pages communicate IDs back to features; a delayed redirect avoids losing successful-post bookkeeping.

Pass pages and optional pass links support the site's pass flow and informational messages. Announcement hiding stores dismissed announcements; banners and announcement notices preserve the configured seen/known state. Include moderator contact links where the site exposes them. Optional anti-autoplay prevents unwanted page sounds. Legacy Flash/oekaki hooks depend on site-provided code and browser support.

## 15. Archives and restoration

Use the embedded registry as initial data. Each archive has name, domain, software, HTTP/HTTPS capability, boards, media boards, optional stable UID and report capability. Support `fuuka` and `foolfuuka`. First compatible entry is the default per board and destination; user selections override it only when still compatible. Separate selections for thread pages, thread JSON, individual post API and files. Only FoolFuuka supplies the JSON/post destinations here.

Archive sources are newline-separated URLs or inline JSON, with comment lines ignored. Update automatically after two days or a future/invalid cached timestamp when enabled; settings also offer manual refresh. On failure keep useful existing information and show a warning. The default source is `https://4chenz.github.io/archives.json/archives.json`.

| Destination | URL path |
| --- | --- |
| Thread | `/{board}/thread/{thread}`; FoolFuuka adds trailing slash |
| Post page | `/{board}/post/{post}`; FoolFuuka adds trailing slash |
| Post hash in thread | FoolFuuka `#{post}`, Fuuka `#p{post}` |
| Thread API | `/_/api/chan/thread/?board={board}&num={thread}` |
| Post API | `/_/api/chan/post/?board={board}&num={post}` |
| File | `/{board}/full_image/{filename}` |
| FoolFuuka search | `/{board}/search/{type}/{encodedValue}/` |
| Fuuka image search | `/{board}/image/{encodedValue}` |
| Fuuka other search | `/{board}/?task=search2&search_{type}={encodedValue}` |
| Offsite report | `https://{domain}/_/api/chan/offsite_report/` |

Search maps name to username and MD5 to image; image values become URL-safe base64 without padding. Capcodes normalize to archive values, including Developer→dev and Verified→ver. Image redirects do not mistake `s.jpg`/`m.jpg` thumbnails for full files. `/f/` filenames require decoding/re-encoding. Some archive names require truncating overlong timestamp filenames by three digits.

Choose the current protocol when supported, otherwise the archive's available alternative. Loading/redirecting from HTTPS to HTTP is subject to the Exempt Archives from Encryption option, which defaults false. Preserve warning/guard behavior rather than silently weakening it.

Dead-thread/media redirect uses these destinations when enabled. Quote resurrection fetches archive posts when live data is unavailable. A thread header command, **Restore from archive**, fetches thread JSON, skips already registered posts and posts from other threads for insertion, normalizes archived content, marks restored posts, reinserts in numeric/conversation order, and rewrites relevant quote links to local anchors. Display restored count, no removed posts, no archive, or a fetch error with the archive origin and advice to try another archive/browser challenge. Do not claim restored content exists on the live server.

## 16. Persistence and platform bridge

### 16.1 Configuration and histories

Settings are flat keys, with exact names and case preserved. `Fit width` and `Fit Width` intentionally differ between expansion and gallery. The appendices define every default and help text. Userscript keys are prefixed directly by `4chan-XZ` (no additional separator) and values are JSON strings. Extension settings use unprefixed Chrome storage keys.

Per-site DataBoard shape:

```json
{
  "version": 1,
  "4chan.org": {
    "boards": {"g": {"100": {"101": true}}},
    "lastChecked": 0
  }
}
```

The nested example is an own-post record. Thread-level records omit the innermost post mapping. Database keys and values:

| Key | Value at thread/post level |
| --- | --- |
| hiddenThreads | `true` or `{makeStub}` per thread |
| hiddenPosts | per-post `{thisPost?,makeStub,hideRecursively,byId?}` |
| hiddenPosterIds | analogous poster-ID hide options per thread |
| lastReadPosts | last-read numeric post ID per thread |
| yourPosts | true per own post |
| watchedThreads | excerpt, isDead, isArchived, page, lastPage, unread, quotingYou, dismiss, last, modified, replies as available |
| watcherLastModified | conditional request metadata |
| customTitles | `{title,orig}` at board title/subtitle keys |

Migrate old top-level `{boards,lastChecked}` into `4chan.org`. Before saving, apply changes locally and retain replayable operations; reread persisted data, merge/replay if its version is newer, increment version and save. Sync callbacks start after initial application initialization. This is inherited conflict reduction, not a transactional cross-device database. Delete empty containers. Clean obsolete records at most every two hours per site using successful live-thread and archive-list responses; do not clear history on a failed network response.

Additional state includes previousversion, boardConfig, archives, selectedArchives, cooldowns, Index Sort, last-long thresholds, siteProperties, QR size/persona and dialog positions. Remember Last Read Post and Remember Your Posts default on, including private browsing where the manager/browser makes storage available. Reset removes stored history. There is no separate application account or server database.

### 16.2 Extension storage and messaging

Read local and sync storage, with local winning while writes await synchronization. Write local first; eligible values move to sync after a one-second debounce. Keep values exceeding per-item sync quota local. After successful sync, remove a stale local copy only if no newer local write is pending. Storage failures retain pending writes and retry after one minute. Listen for effective changes across local/sync, compare serialized values, and notify interested modules only on meaningful changes. Detect extension context invalidation and ask the page to reload.

Content script sends typed worker requests and gets an immediate monotonically increasing request ID. The worker later sends `{id,data}` to the sender's tab. Types:

- `permission`: contains/request the requested origins, default `*://*/`; resolve false on runtime error/denial.
- `ajax`: fetch supplied URL with headers; decode text, JSON or arraybuffer; return status/statusText/response/CRLF response headers, or `{error:true}` on unsuccessful HTTP/network outcome.
- `runInPageContext`: invoke a named predefined function through `chrome.scripting.executeScript`, `world: 'MAIN'`, target sender tab; return the first result.

The reference worker does not implement a full arbitrary-method HTTP proxy, genuine request cancellation, or timeout handling even though wrappers may accept a timeout. Binary ArrayBuffer transfer and iframe targeting need actual browser verification. Do not assume an MV2 manifest makes the MV3 scripting bridge automatically compatible.

### 16.3 Userscript storage and HTTP

Modern GM storage uses promises and a BroadcastChannel when legacy change listeners are absent. Legacy GM uses synchronous access and remote-value listeners; where unavailable, localStorage storage events/forced refresh provide fallback synchronization. If no storage is usable, show limitations instead of crashing or repeatedly opening first-run panels. BroadcastChannel is origin-scoped; it is not proof of cross-origin synchronization.

Ordinary site requests use XMLHttpRequest with appropriate method, credentials, responseType, body, progress, timeout and callbacks. Cache identical fetches and fan out completion; conditional requests preserve modified response information. Cross-origin reads prefer GM privileged requests (anonymous GET) or the worker; fall back to ordinary XHR where implemented. Adapt response headers case-insensitively and expose status/statusText/response/abort/getResponseHeader. Cross-origin file fetches construct a File using response headers, Content-Disposition filename, MIME and URL fallback. Preserve `/adv/` URL workaround and historical MIME fallback behavior as compatibility details.

Page-world functions are predefined, including version exposure, native-extension control, site globals, pretty-print/MathJax, native posting observation and Flash/oekaki hooks. Userscript injection and extension scripting have different implementations but equivalent named operations. Arbitrary feature closures cannot simply be serialized with their surrounding lexical scope.


### 16.4 Defaults added outside the configuration tree

Initialize DataBoard keys to empty dictionaries, except customTitles begins with `{"4chan.org":{"boards":{"qa":{"boardTitle":{"orig":"/qa/ - Question & Answer","title":"/qa/ - 2D/Random"}}}}}`. Initialize boardConfig to `{boards:{}}`, archives to the embedded registry, selectedArchives/cooldowns/Index Sort/siteProperties to empty objects, and both `Last Long Reply Thresholds 0` and `Last Long Reply Thresholds 1` to empty objects. Runtime initialization overrides the configuration grouping named archives with the actual archive registry.

Read compatibility keys with defaults even when no current Main checkbox exposes them: `Except Archives from Encryption=false`, `JSON Navigation=true`, `Oekaki Links=true`, `Show Name and Subject=false`, `QR Shortcut=true`, `Bottom QR Link=true`, `Toggleable Thread Watcher=true`, `siteSoftware=""`, `Use Faster Image Host="true"` (string), `Captcha Fixes=true`, `captchaServiceDomain=""`, `captchaServiceKey={}`. These support old settings migration; they are not a second set of newly advertised features.

The default custom title and `/qa/` friend announcement are inherited site-specific behaviors. A stored Samachan site entry can trigger a once-only migration/community notice recorded in PSAseen. With a nonempty jsWhitelist, strip comment lines and normalize whitespace/semicolons, then add the configured script-src CSP on eligible 4chan-family pages, excluding pass/CAPTCHA and the implementation's native-script exception. The default whitelist is empty.

## 17. Build and source responsibilities

Use Node 24 LTS and npm 11+ (engine also permits Node 26+). Browser output target is ES2020. A faithful modern implementation may be TypeScript throughout, but preserve behavior rather than mistaking completion of migration for a product feature.

The reference uses Rollup, TypeScript, custom JSX factories, asset inlining, base64 transforms, Font Awesome aliases, conditional platform blocks, removal of test regions and inherited generated-output formatting. Output is IIFE-style browser code. Build the background separately. Keep Node tooling modules separate from browser code/types. Minified variants include maps. Bundle templates/styles/assets so runtime does not depend on the repository filesystem.

Commands and outputs:

| Command | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Install lockfile dependencies without lifecycle scripts |
| `npm run check` | ESLint and TypeScript baseline checks |
| `npm run build` | Readable userscript and unpacked extension, without platform pruning |
| `npm run build:userscript` / `build:userscript:min` | Pruned readable/minified userscript |
| `npm run build:crx` / `build:crx:min` | Pruned readable/minified unpacked extension |
| `npm run build:all` | Clean and build all four variants |
| `npm run verify` | Checks then all builds |
| `npm run clean` | Remove generated dist only |

Output paths: `dist/4chan-XZ.user.js`, `dist/4chan-XZ.min.user.js`, corresponding `.meta.js`, minified map, `dist/crx/`, `dist/crx-min/`, and `dist/build-warnings.json`. Each extension directory includes generated manifests and icons. CLI flags include `--platform=userscript|crx`, `--minify`, `--no-format`, `--test`; historical single-dash aliases remain accepted. Test mode keeps legacy in-browser test code, but does not run a test suite.

The inherited lint/typecheck baselines record counts by file/rule or diagnostic. Full checks may fail on existing debt. Do not inflate baselines to hide new issues. Circular dependency warnings are summarized and recorded. `builds/`, old changelogs and benchmark snippets are historical, not the modern build output. `crx` does not mean a signed package. Preserve MIT attribution; do not invent new release ownership/IDs.

Functional module groups cover all runtime areas: Main and globals; Site/SW adapters; platform utilities/CrossOrigin; Board/Thread/Post/catalog/Fetcher/DataBoard/Callbacks/Connection/Notice/ordered collections; Header/Settings/Index/BoardConfig/Get/UI; Filtering; Quotelinks; Monitoring; Posting/CAPTCHA; Images; Linkification/Embedding; Menu; Archive; Miscellaneous; PageContext; CSS/Icons; and manifest/metadata/worker. The full text-module inventory is supplied below to make omissions visible.

## 18. Acceptance scenarios for a reconstruction

Test the production bundles, not only isolated replacement stubs. The following behaviors are observable contracts:

1. A fresh supported thread initializes once, opens Settings, saves previousversion, exposes the page-world version and disables the native extension. Reload preserves configuration without reopening first-run Settings. Reinjecting the bundle creates no second header/settings control or initialization event.
2. All five Settings sections open/close; Anonymize toggles persist across reload and a second tab under legacy GM, modern GM and extension storage. Export/import round-trips exact keys; excluding history excludes the stated records; reset clears data only after confirmation.
3. A builder-created comment filter hides a matching reply while leaving a control reply visible. Disable/reload restores it. Cover exact MD5/unique IDs with slash characters, global/sticky regex repeatability, escaped punctuation, trailing newline equality, invalid regexes, duplicates, board scope/exclusion, OP/file restrictions, highlights, notices, same-poster and recursive effects, and raw edit/remove/undo persistence.
4. JSON index modes, per-board sorting, priority partitions, search, back/forward, infinite end handling, hidden toggles and catalog size/hover agree with the model. Native catalog uses its separate processing path. `/f/` does not incorrectly enter JSON index mode.
5. New DOM/API posts receive callbacks once. Malformed posts and a failing feature callback do not block valid posts. Clones do not inflate original counts; removing a clone keeps other clones usable.
6. Quote hover/inline works for local, cross-thread and archived posts. Close a preview before a fetch completes and verify no stale insertion. Backlinks, own-post marks, dead marks, forward hiding and nested quotes remain consistent.
7. Updater handles 200/304, temporary network failure, false 404 with a still-present catalog thread, confirmed deletion, archive transition, own-post retry schedule and removed files. Reading position and hidden-tab unread state are preserved.
8. Watcher add/remove, own-thread/reply auto-watch, cross-tab changes, focus-gated automatic refresh, unread/page/reply-to-you display and dead pruning work with deterministic fixtures.
9. Media expand/contract/hover/gallery preserve order and volume, pause removed playback, handle unavailable media, spoilers and video controls, and never leak unlimited object URLs. Sauce placeholders encode correctly and missing MD5 does not crash.
10. QR validates a new thread/reply, queues/reorders drafts, preserves input on error, handles CAPTCHA wait/cancel/expiry, cooldown, progress, retry limits and a mocked success. Validate submitted field names and file names. Never send real posts or deletes as an automated test side effect.
11. Opening menus on different posts changes copy/report/delete/archive targets. Test deletion failure followed by retry/success, and keyboard closing. Reporting honors pass-dependent behavior.
12. Test optional origin grant/denial, modern/legacy GM missing APIs, local-only quota fallback, extension invalidation, worker restart and direct media/auxiliary routes separately. Browser tests of mocked page XHR do not validate service-worker fetch.
13. Test Tinyboard selectors, multifile posts, disabled-feature list and delayed mount separately from Yotsuba.
14. Compare settings/QR/header/watcher/gallery/filter UI at desktop and narrow widths using supplied styles/assets. Verify labels, focus and keyboard operation, not only screenshots.

The checkout contains `node --test tests/filter.test.ts`, `tests/classes.test.ts`, and `tests/dollar.test.ts` for parser/model/platform regressions; `npm run test:userscript` checks types, builds readable/minified bundles and runs Playwright for legacy/modern GM; `npm run test:extension:types` and `npm run test:extension` cover the real unpacked Chromium extension. The userscript harness models manager APIs and origin storage rather than proving manager sandbox/CORS compatibility. The extension harness uses a real worker/storage but synthetic board pages. Neither establishes Firefox/Safari extension support or live posting/CAPTCHA/service availability.

For this specification, verification consisted of source inspection and document consistency checks. No live-site posting, deletion, release, or browser-runtime validation was performed. Existing test descriptions are coverage descriptions, not claims that those suites were executed for this documentation change.

## 19. Reconstruction priorities and unresolved external behavior

Implement in dependency order: platform/storage and safe DOM utilities; adapters and models; startup/callbacks; settings/header; filtering; index and quote fetch/clone behavior; monitoring; media; QR/CAPTCHA; archives/embeds/auxiliary integrations; packaging and acceptance tests. The user-visible result should operate as one integrated extension, with feature flags and shared state, rather than a collection of disconnected demos.

Preserve defaults, identifiers, scoped histories, event contracts and UI semantics even if internals are redesigned. Error paths are part of the product. Use deterministic fixture servers for integration testing. Test current external schemas deliberately before claiming live parity. Historical endpoints, browser minimum declarations, MV2 output and old service handlers are compatibility evidence, not guarantees of present support.

The appendices contain declarative reconstruction material. CSS/templates are exact reference resources rather than a substitute for the behavior above. Binary resources are base64 so a reconstruction can recover them locally without downloading originals. Font Awesome icons remain a dependency with their own license; dependency metadata identifies the reference package versions. Preserve the beep's source attribution (pierrecartoons1979, freesound sound 90112, CC BY-NC 3.0) separately from the application's MIT license.

## Appendix A. Complete default configuration

This is the evaluated configuration, including descriptions and indentation. Arrays have `[default, helpText?, indentation?]`; nested objects organize the settings UI and are flattened at startup. Preserve exact key spelling/case. Multiline strings include default rules, templates and CSS. A setting enabling a menu feature is distinct from activating that mode.

```json
{
  "main": {
    "Miscellaneous": {
      "JSON Index": [
        true,
        "Replace the original board index with one supporting searching, sorting, infinite scrolling, and a catalog mode."
      ],
      "Use 4chan-XZ Catalog": [
        true,
        "Link to 4chan-XZ's catalog instead of the native 4chan one.",
        1
      ],
      "Index Refresh Notifications": [
        false,
        "Show a notice at the top of the page when the index is refreshed.",
        1
      ],
      "Follow Cursor": [
        true,
        "Image Hover and Quote Preview move with the mouse cursor."
      ],
      "Open Threads in New Tab": [
        false,
        "Make links to threads in the index / 4chan-XZ catalog open in a new tab."
      ],
      "External Catalog": [
        false,
        "Link to external catalog instead of the internal one."
      ],
      "Catalog Links": [
        false,
        "Add toggle link in header menu to turn Navigation links into links to each board's catalog."
      ],
      "Announcement Hiding": [
        true,
        "Add button to hide 4chan announcements."
      ],
      "Desktop Notifications": [
        true,
        "Enables desktop notifications across various 4chan-XZ features."
      ],
      "404 Redirect": [
        true,
        "Redirect dead threads and images to the archives."
      ],
      "Archive Report": [
        true,
        "Enable reporting posts to supported archives."
      ],
      "Exempt Archives from Encryption": [
        false,
        "Permit loading content from, and warningless redirects to, HTTP-only archives from HTTPS pages."
      ],
      "Keybinds": [
        true,
        "Bind actions to keyboard shortcuts."
      ],
      "Time Formatting": [
        true,
        "Localize and format timestamps. Has more options on the \"Advanced\" tab."
      ],
      "Comment Expansion": [
        true,
        "Expand comments that are too long to display on the index. Not applicable with JSON Index."
      ],
      "File Info Formatting": [
        true,
        "Reformat the file information."
      ],
      "Thread Expansion": [
        true,
        "Add buttons to expand threads."
      ],
      "Index Navigation": [
        false,
        "Add buttons to navigate between threads."
      ],
      "Reply Navigation": [
        false,
        "Add buttons to navigate to top / bottom of thread."
      ],
      "Unique ID and Capcode Navigation": [
        false,
        "Add buttons to navigate to posts having the same unique ID or capcode."
      ],
      "Custom Board Titles": [
        true,
        "Allow editing of the board title and subtitle by ctrl/⌘+clicking them."
      ],
      "Persistent Custom Board Titles": [
        false,
        "Force custom board titles to be persistent, even if the board titles are updated.",
        1
      ],
      "Show Updated Notifications": [
        true,
        "Show notifications when 4chan-XZ is successfully updated."
      ],
      "Color User IDs": [
        true,
        "Assign unique colors to user IDs on boards that use them"
      ],
      "Count Posts by ID": [
        true,
        "Display number of posts in the thread when hovering over an ID."
      ],
      "Remove Spoilers": [
        false,
        "Remove all spoilers in text."
      ],
      "Reveal Spoilers": [
        false,
        "Indicate spoilers if Remove Spoilers is enabled, or make the text appear hovered if Remove Spoiler is disabled."
      ],
      "Normalize URL": [
        true,
        "Rewrite the URL of the current page, removing slugs and excess slashes, and changing /res/ to /thread/."
      ],
      "Disable Autoplaying Sounds": [
        false,
        "Prevent sounds on the page from autoplaying."
      ],
      "Disable Native Extension": [
        true,
        "4chan-XZ is NOT designed to work with the native extension."
      ],
      "Enable Native Flash Embedding": [
        true,
        "Activate the native extension's Flash embedding if the native extension is disabled."
      ],
      "Export History": [
        true,
        "Export last read, your posts, etc. when exporting the setting"
      ],
      "Ask to Export History": [
        true,
        "Ask if history should be exported when settings are exported."
      ],
      "Scroll Markers": [
        true,
        "Mark your posts and replies to them on the scroll bar. Relies on the \"Highlight Posts Quoting You\" and \"Highlight Own Posts\" settings"
      ]
    },
    "Linkification": {
      "Linkify": [
        true,
        "Convert text into links where applicable."
      ],
      "Link Title": [
        true,
        "Replace the link of a supported site with its actual title.",
        1
      ],
      "Link Title in the catalog": [
        false,
        "Replace the link of a supported site with its actual title in the catalog too. Speed up performance for boards that have many embeds (e.g /vt/) if turned off",
        2
      ],
      "Cover Preview": [
        true,
        "Show preview of supported links on hover.",
        1
      ],
      "Embedding": [
        true,
        "Embed supported services. Note: Some services don't work on HTTPS.",
        1
      ],
      "Auto-embed": [
        false,
        "Auto-embed Linkify Embeds.",
        2
      ],
      "Floating Embeds": [
        false,
        "Embed content in a frame that remains in place when the page is scrolled.",
        2
      ]
    },
    "Filtering": {
      "Anonymize": [
        false,
        "Make everyone Anonymous."
      ],
      "Filter": [
        true,
        "Self-moderation placebo."
      ],
      "Filtered Backlinks": [
        false,
        "When enabled, shows backlinks to filtered posts with a line-through decoration. Otherwise, hides the backlinks.",
        1
      ],
      "Filter in Native Catalog": [
        true,
        "Apply 4chan X filters in native catalog.",
        1
      ],
      "MD5 Quick Filter Notifications": [
        true,
        "Show notification when quick filtering MD5s using the button or keybind.",
        1
      ],
      "MD5 Quick Filter in the Catalog": [
        true,
        "Quick filter by MD5 when clicking a thumbnail in the catalog and holding Shift. Disabling falls back on just hiding the thread.",
        1
      ],
      "MD5 Quick Filter in Threads": [
        true,
        "Quick filter by MD5 when clicking a thumbnail in a thread while holding shift.",
        1
      ],
      "Recursive Hiding": [
        true,
        "Hide replies of hidden posts, recursively."
      ],
      "Thread Hiding Buttons": [
        true,
        "Add buttons to hide entire threads."
      ],
      "Reply Hiding Buttons": [
        true,
        "Add buttons to hide single replies."
      ],
      "Stubs": [
        true,
        "Show stubs of hidden threads / replies."
      ],
      "Filter Reason": [
        true,
        "Show the reason the post was hidden in the stub. If disabled, you can hover over the stub to see the reason."
      ]
    },
    "Images and Videos": {
      "Image Expansion": [
        true,
        "Expand images / videos."
      ],
      "Image Hover": [
        true,
        "Show full image / video on mouseover."
      ],
      "Image Hover in Catalog": [
        true,
        "Show full image / video on mouseover in 4chan-XZ catalog."
      ],
      "Gallery": [
        true,
        "Adds a simple and cute image gallery. Has more options in the gallery menu."
      ],
      "Fullscreen Gallery": [
        false,
        "Open gallery in fullscreen mode.",
        1
      ],
      "PDF in Gallery": [
        false,
        "Show PDF files in gallery.",
        1
      ],
      "Sauce": [
        true,
        "Add sauce links to images."
      ],
      "WEBM Metadata": [
        true,
        "Add link to fetch title metadata from webm videos."
      ],
      "Reveal Spoiler Thumbnails": [
        false,
        "Replace spoiler thumbnails with the original image."
      ],
      "Replace GIF": [
        false,
        "Replace gif thumbnails with the actual image."
      ],
      "Replace JPG": [
        false,
        "Replace jpg thumbnails with the actual image."
      ],
      "Replace PNG": [
        false,
        "Replace png thumbnails with the actual image."
      ],
      "Replace WEBM": [
        false,
        "Replace webm, mp4, and ogv thumbnails with the actual video. Probably will degrade browser performance ;)"
      ],
      "Image Prefetching": [
        true,
        "Add a shortcut icon to the header to turn on image preloading."
      ],
      "Fappe Tyme": [
        true,
        "Hide posts without images when header menu item is checked. *hint* *hint*"
      ],
      "Werk Tyme": [
        true,
        "Hide all post images when header menu item is checked."
      ],
      "Autoplay": [
        true,
        "Videos begin playing immediately when opened."
      ],
      "Restart when Opened": [
        false,
        "Restart GIFs and WebMs when you hover over or expand them."
      ],
      "Show Controls": [
        true,
        "Show controls on videos expanded inline."
      ],
      "Click Passthrough": [
        false,
        "Clicks on videos trigger your browser's default behavior. Videos can be contracted with button / dragging to the left.",
        1
      ],
      "Allow Sound": [
        true,
        "Open videos with the sound unmuted."
      ],
      "Mouse Wheel Volume": [
        true,
        "Adjust volume of videos with the mouse wheel over the thumbnail/filename/gallery."
      ],
      "Loop in New Tab": [
        true,
        "Loop videos opened in their own tabs."
      ],
      "Volume in New Tab": [
        true,
        "Apply 4chan-XZ mute and volume settings to videos opened in their own tabs."
      ],
      "Enable sound posts": [
        true,
        "Enable loading audio from [sound=] file names. This audio is fetched from third parties."
      ]
    },
    "Menu": {
      "Menu": [
        true,
        "Add a drop-down menu to posts."
      ],
      "Report Link": [
        true,
        "Add a report link to the menu.",
        1
      ],
      "Copy Text Link": [
        true,
        "Add a link to copy the post's text.",
        1
      ],
      "Thread Hiding Link": [
        true,
        "Add a link to hide entire threads.",
        1
      ],
      "Reply Hiding Link": [
        true,
        "Add a link to hide single replies.",
        1
      ],
      "Delete Link": [
        true,
        "Add post and image deletion links to the menu.",
        1
      ],
      "Archive Link": [
        true,
        "Add an archive link to the menu.",
        1
      ],
      "Edit Link": [
        true,
        "Add a link to edit the image in Tegaki, /i/'s painting program. Requires Quick Reply.",
        1
      ],
      "Download Link": [
        false,
        "Add a download with original filename link to the menu.",
        1
      ]
    },
    "Monitoring": {
      "Thread Updater": [
        true,
        "Fetch and insert new replies. Has more options in the header menu and the \"Advanced\" tab."
      ],
      "Unread Count": [
        true,
        "Show the unread posts count in the tab title."
      ],
      "Quoted Title": [
        false,
        "Change the page title to reflect you've been quoted.",
        1
      ],
      "Hide Unread Count at (0)": [
        false,
        "Hide the unread posts count in the tab title when it reaches 0.",
        1
      ],
      "Unread Favicon": [
        true,
        "Show a different favicon when there are unread posts."
      ],
      "Unread Line": [
        true,
        "Show a line to distinguish read posts from unread ones."
      ],
      "Remember Last Read Post": [
        true,
        "Remember how far you've read after you close the thread."
      ],
      "Scroll to Last Read Post": [
        true,
        "Scroll back to the last read post when reopening a thread.",
        1
      ],
      "Unread Line in Index": [
        false,
        "Show a line between read and unread posts in threads in the index.",
        1
      ],
      "Remove Thread Excerpt": [
        false,
        "Replace the excerpt of the thread in the tab title with the board title."
      ],
      "Thread Stats": [
        true,
        "Display reply and image count."
      ],
      "IP Count in Stats": [
        true,
        "Display the unique IP count in the thread stats.",
        1
      ],
      "Page Count in Stats": [
        true,
        "Display the page count in the thread stats.",
        1
      ],
      "Purge Position": [
        false,
        "Update stats more often and add purge position when a thread is close to getting purged, for anons who manage general threads.",
        2
      ],
      "Updater and Stats in Header": [
        true,
        "Places the thread updater and thread stats in the header instead of floating them."
      ],
      "Thread Watcher": [
        true,
        "Bookmark threads. Has more options in the thread watcher menu."
      ],
      "Fixed Thread Watcher": [
        true,
        "Makes the thread watcher scroll with the page.",
        1
      ],
      "Persistent Thread Watcher": [
        false,
        "The thread watcher will be visible when the page is loaded.",
        1
      ],
      "Mark New IPs": [
        false,
        "Label each post from a new IP with the thread's current IP count."
      ],
      "Reply Pruning": [
        true,
        "Add option in header menu to hide old replies in long threads. Activated by default in stickies."
      ],
      "Prune All Threads": [
        false,
        "Activate Reply Pruning by default in all threads.",
        1
      ]
    },
    "Posting and Captchas": {
      "Quick Reply": [
        true,
        "All-in-one form to reply, create threads, automate dumping and more."
      ],
      "Persistent QR": [
        false,
        "The Quick reply won't disappear after posting.",
        1
      ],
      "Auto Hide QR": [
        true,
        "Automatically hide the quick reply when posting.",
        2
      ],
      "Open Post in New Tab": [
        true,
        "Open new threads in a new tab, and open replies in a new tab if you're not already in the thread.",
        1
      ],
      "Remember QR Size": [
        false,
        "Remember the size of the Quick reply.",
        1
      ],
      "Remember Spoiler": [
        false,
        "Remember the spoiler state, instead of resetting after posting.",
        1
      ],
      "Randomize Filename": [
        false,
        "Set the filename to a random timestamp within the past year. Disabled on /f/.",
        1
      ],
      "Show New Thread Option in Threads": [
        true,
        "Show the option to post a new / different thread from inside a thread.",
        1
      ],
      "Show Upload Progress": [
        true,
        "Track progress of file uploads as percentage in submit button.",
        1
      ],
      "Cooldown": [
        true,
        "Indicate the remaining time before posting again.",
        1
      ],
      "Posting Success Notifications": [
        true,
        "Show notifications on successful post creation or file uploading.",
        1
      ],
      "Auto-load captcha": [
        false,
        "Automatically load the captcha in the QR even if your post is empty.",
        1
      ],
      "Post on Captcha Completion": [
        false,
        "Submit the post immediately when the captcha is completed.",
        1
      ],
      "Avoid OffscreenCanvas": [
        false,
        "Do not use OffscreenCanvas when converting images, workaround for <a href=\"https://github.com/TuxedoTako/4chan-xt/issues/132\">this LibreWolf bug</a>",
        1
      ],
      "Force Noscript Captcha": [
        false,
        "Use the non-Javascript fallback captcha even if Javascript is enabled."
      ],
      "Pass Link": [
        false,
        "Add a 4chan Pass login link to the bottom of the page."
      ]
    },
    "Quote Links": {
      "Quote Backlinks": [
        true,
        "Add quote backlinks."
      ],
      "OP Backlinks": [
        true,
        "Add backlinks to the OP.",
        1
      ],
      "Bottom Backlinks": [
        false,
        "Place backlinks at the bottom of posts.",
        1
      ],
      "Quote Inlining": [
        true,
        "Inline quoted post on click."
      ],
      "Inline Cross-thread Quotes Only": [
        false,
        "Don't inline quote links when the posts are visible in the thread.",
        1
      ],
      "Quote Hash Navigation": [
        false,
        "Include an extra link after quotes for autoscrolling to quoted posts.",
        1
      ],
      "Forward Hiding": [
        true,
        "Hide original posts of inlined backlinks.",
        1
      ],
      "Quote Previewing": [
        true,
        "Show quoted post on hover."
      ],
      "Quote Highlighting": [
        true,
        "Highlight the previewed post.",
        1
      ],
      "Resurrect Quotes": [
        true,
        "Link dead quotes to the archives, and support inlining/previewing of archive links like quote links."
      ],
      "Remember Your Posts": [
        true,
        "Remember your posting history."
      ],
      "Mark Quotes of You": [
        true,
        "Add '(You)' to quotes linking to your posts.",
        1
      ],
      "Highlight Posts Quoting You": [
        true,
        "Highlights any posts that contain a quote to your post.",
        1
      ],
      "Highlight Own Posts": [
        true,
        "Highlights own posts.",
        1
      ],
      "Mark OP Quotes": [
        true,
        "Add '(OP)' to OP quotes."
      ],
      "Mark Cross-thread Quotes": [
        true,
        "Add '(Cross-thread)' to cross-threads quotes."
      ],
      "Quote Threading": [
        true,
        "Add option in header menu to thread conversations."
      ]
    }
  },
  "imageExpansion": {
    "Fit width": [
      true,
      ""
    ],
    "Fit height": [
      false,
      ""
    ],
    "Scroll into view": [
      true,
      "Scroll down when expanding images to bring the full image into view."
    ],
    "Expand spoilers": [
      true,
      "Expand all images along with spoilers."
    ],
    "Expand videos": [
      true,
      "Expand all images also expands videos."
    ],
    "Expand from here": [
      false,
      "Expand all images only from current position to thread end."
    ],
    "Expand thread only": [
      false,
      "In index, expand all images only within the current thread."
    ],
    "Advance on contract": [
      false,
      "Advance to next post when contracting an expanded image."
    ]
  },
  "gallery": {
    "Hide Thumbnails": [
      false
    ],
    "Fit Width": [
      true
    ],
    "Fit Height": [
      true
    ],
    "Stretch to Fit": [
      false
    ],
    "Scroll to Post": [
      true
    ],
    "Slide Delay": [
      6
    ]
  },
  "Default Volume": 1,
  "threadWatcher": {
    "Current Board": [
      false,
      "Only show watched threads from the current board."
    ],
    "Auto Update Thread Watcher": [
      true,
      "Periodically check status of watched threads."
    ],
    "Auto Watch": [
      true,
      "Automatically watch threads you start."
    ],
    "Auto Watch Reply": [
      true,
      "Automatically watch threads you reply to."
    ],
    "Auto Prune": [
      false,
      "Automatically remove dead threads."
    ],
    "Show Page": [
      true,
      "Show what page watched threads are on."
    ],
    "Show Unread Count": [
      true,
      "Show number of unread posts in watched threads."
    ],
    "Show Site Prefix": [
      true,
      "When multiple sites are shown in the thread watcher, add a prefix to board names to distinguish them."
    ],
    "Require OP Quote Link": [
      false,
      "For purposes of thread watcher highlighting, only consider posts with a quote link to the OP as replies to the OP."
    ]
  },
  "filter": {
    "general": "",
    "postID": "# Highlight dubs on [s4s]:\n#/(\\d)\\1$/;highlight;top:no;boards:s4s",
    "name": "# Filter any namefags:\n#/^(?!Anonymous$)/",
    "uniqueID": "# Filter a specific ID:\n#/Txhvk1Tl/",
    "tripcode": "# Filter any tripfag\n#/^!/",
    "capcode": "# Set a custom class for mods:\n#/Mod$/;highlight:mod;op:yes\n# Set a custom class for admins:\n#/Admin$/;highlight:admin;op:yes",
    "pass": "# Filter anyone using since4pass:\n#/./",
    "email": "",
    "subject": "# Filter Generals on /v/:\n#/general/i;boards:v;op:only",
    "comment": "# Filter Stallman copypasta on /g/:\n#/what you're refer+ing to as linux/i;boards:g\n# Filter posts with 20 or more quote links:\n#/(?:>>\\d(?:(?!>>\\d)[^])*){20}/\n# Filter posts like T H I S / H / I / S:\n#/^>?\\s?\\w\\s?(\\w)\\s?(\\w)\\s?(\\w).*$[\\s>]+\\1[\\s>]+\\2[\\s>]+\\3/im",
    "flag": "",
    "filename": "",
    "dimensions": "# Highlight potential wallpapers:\n#/1920x1080/;op:yes;highlight;top:no;boards:w,wg",
    "filesize": "",
    "MD5": ""
  },
  "sauces": "# Known filename formats:\nhttps://www.pixiv.net/member_illust.php?mode=medium&illust_id=%$1;regexp:/^(\\d+)_p\\d+/\njavascript:void(open(\"https://www.deviantart.com/\"+%$1.replace(/_/g,\"-\")+\"/art/\"+parseInt(%$2,36)));regexp:/^\\w+_by_(\\w+)[_-]d([\\da-z]{6})\\b/\nhttps://imgur.com/%$1;regexp:/^(?![a-zA-Z][a-z]{6})(?![A-Z]{7})(?!\\d{7})([\\da-zA-Z]{7})(?: \\(\\d+\\))?\\.\\w+$/\nhttps://flickr.com/photo.gne?id=%$1;regexp:/^(\\d+)_[\\da-f]{10}(?:_\\w)*\\b/\nhttps://www.facebook.com/photo.php?fbid=%$1;regexp:/^\\d+_(\\d+)_\\d+_[no]\\b/\n\n# Reverse image search:\nhttps://www.google.com/searchbyimage?sbisrc=4chanx&image_url=%IMG&safe=off\nhttps://yandex.com/images/search?rpt=imageview&url=%IMG\n#//tineye.com/search?url=%IMG\n#//www.bing.com/images/search?q=imgurl:%IMG&view=detailv2&iss=sbi#enterInsights\n#https://lens.google.com/uploadbyurl?url=%IMG;text:lens\n\n# Specialized reverse image search:\n//iqdb.org/?url=%IMG\nhttps://trace.moe/?auto&url=%IMG;text:wait\n#//3d.iqdb.org/?url=%IMG\n#//saucenao.com/search.php?url=%IMG\n\n# \"View Same\" in archives:\nhttp://eye.swfchan.com/search/?q=%name;types:swf\n#https://desuarchive.org/_/search/image/%sMD5/\n#https://archive.4plebs.org/_/search/image/%sMD5/\n#https://boards.fireden.net/_/search/image/%sMD5/\n#https://foolz.fireden.net/_/search/image/%sMD5/\n\n# Other tools:\n#http://exif.regex.info/exif.cgi?imgurl=%URL\n#//imgops.com/start?url=%URL;types:gif,jpg,png\n#//www.gif-explode.com/%URL;types:gif",
  "FappeT": {
    "werk": false
  },
  "Custom CSS": true,
  "Index": {
    "Index Mode": "paged",
    "Previous Index Mode": "paged",
    "Index Size": "small",
    "Show Replies": [
      true,
      "Show replies in the index, and also in the catalog if \"Catalog hover expand\" is checked."
    ],
    "Catalog Hover Expand": [
      false,
      "Expand the comment and show more details when you hover over a thread in the catalog."
    ],
    "Catalog Hover Toggle": [
      true,
      "Turn \"Catalog hover expand\" on and off by clicking in the catalog."
    ],
    "Pin Watched Threads": [
      false,
      "Move watched threads to the start of the index."
    ],
    "Anchor Hidden Threads": [
      true,
      "Move hidden threads to the end of the index."
    ],
    "Refreshed Navigation": [
      false,
      "Refresh index when navigating through pages."
    ]
  },
  "Header": {
    "Fixed Header": true,
    "Header auto-hide": false,
    "Header auto-hide on scroll": false,
    "Bottom Header": false,
    "Centered links": false,
    "Header catalog links": false,
    "Bottom Board List": true,
    "Shortcut Icons": true,
    "Custom Board Navigation": true
  },
  "archives": {
    "archiveLists": "https://4chenz.github.io/archives.json/archives.json",
    "lastarchivecheck": 0,
    "archiveAutoUpdate": true
  },
  "externalCatalogURLs": "//catalog.neet.tv/%board/;boards:4chan.org:3,a,adv,an,asp,biz,c,cgl,ck,cm,co,diy,f,fa,fit,g,gd,his,i,int,jp,k,lgbt,lit,m,mlp,mu,n,news,o,out,p,po,pol,s4s,sci,sp,tg,toy,trv,tv,v,vg,vip,vp,vr,w,wg,wsg,wsr,x",
  "boardnav": "[ toggle-all ]\n[current-index-text:\"Index\"\ncurrent-catalog-text:\"Catalog\"\ncurrent-expired-text:\"Expired\"\ncurrent-archive-text:\"Archive\"]\n[external-text:\"FAQ\",\"undefined\"]",
  "QR": {
    "QR.personas": "#options:\"sage\";boards:jp;always",
    "sjisPreview": false
  },
  "jsWhitelist": "",
  "captchaLanguage": "",
  "time": "%m/%d/%y(%a)%H:%M:%S",
  "timeLocale": "",
  "RelativeTime": "Hover",
  "backlink": ">>%id",
  "pastedname": "file",
  "fileInfo": "%l %d (%p%s, %r%g)",
  "favicon": "ferongr",
  "usercss": "/* Board title rice */\ndiv.boardTitle {\n  font-weight: 400 !important;\n}\n:root.yotsuba div.boardTitle {\n  font-family: sans-serif !important;\n  text-shadow: 1px 1px 1px rgba(100,0,0,0.6);\n}\n:root.yotsuba-b div.boardTitle {\n  font-family: sans-serif !important;\n  text-shadow: 1px 1px 1px rgba(105,10,15,0.6);\n}\n:root.photon div.boardTitle {\n  font-family: sans-serif !important;\n  text-shadow: 1px 1px 1px rgba(0,74,153,0.6);\n}\n:root.tomorrow div.boardTitle {\n  font-family: sans-serif !important;\n  text-shadow: 1px 1px 1px rgba(167,170,168,0.6);\n}\n",
  "hotkeys": {
    "Toggle board list": [
      "Ctrl+b",
      "Toggle the full board list."
    ],
    "Toggle header": [
      "Shift+h",
      "Toggle the auto-hide option of the header."
    ],
    "Open empty QR": [
      "q",
      "Open QR without post number inserted."
    ],
    "Open QR": [
      "Shift+q",
      "Open QR with post number inserted."
    ],
    "Open settings": [
      "Alt+o",
      "Open Settings."
    ],
    "Close": [
      "Esc",
      "Close dialogs or notifications."
    ],
    "Spoiler tags": [
      "Ctrl+s",
      "Insert spoiler tags."
    ],
    "Code tags": [
      "Alt+c",
      "Insert code tags."
    ],
    "Eqn tags": [
      "Alt+e",
      "Insert eqn tags."
    ],
    "Math tags": [
      "Alt+m",
      "Insert math tags."
    ],
    "SJIS tags": [
      "Alt+a",
      "Insert SJIS tags."
    ],
    "Toggle sage": [
      "Alt+s",
      "Toggle sage in options field."
    ],
    "Toggle Cooldown": [
      "Alt+Comma",
      "Toggle custom cooldown timer."
    ],
    "Post from URL": [
      "Alt+l",
      "Post from URL."
    ],
    "Add new post": [
      "Alt+n",
      "Add new post to the QR dump list."
    ],
    "Submit QR": [
      "Ctrl+Enter",
      "Submit post."
    ],
    "Watch": [
      "w",
      "Watch thread."
    ],
    "Update": [
      "r",
      "Update the thread / refresh the index."
    ],
    "Update thread watcher": [
      "Shift+r",
      "Manually refresh thread watcher."
    ],
    "Toggle thread watcher": [
      "t",
      "Toggle visibility of thread watcher."
    ],
    "Toggle threading": [
      "Shift+t",
      "Toggle threading."
    ],
    "Mark thread read": [
      "Ctrl+0",
      "Mark thread read from index (requires \"Unread Line in Index\")."
    ],
    "Expand image": [
      "Shift+e",
      "Expand selected image."
    ],
    "Expand images": [
      "e",
      "Expand all images."
    ],
    "Open Gallery": [
      "g",
      "Opens the gallery."
    ],
    "Next Gallery Image": [
      "Right",
      "Go to the next image in gallery mode."
    ],
    "Previous Gallery Image": [
      "Left",
      "Go to the previous image in gallery mode."
    ],
    "Advance Gallery": [
      "Enter",
      "Go to next image or, if Autoplay is off, play video."
    ],
    "Pause": [
      "p",
      "Pause/play videos in the gallery."
    ],
    "Slideshow": [
      "Ctrl+Right",
      "Toggle the gallery slideshow mode."
    ],
    "Rotate image clockwise": [
      "Shift+Right",
      "Rotate image clockwise in gallery."
    ],
    "Rotate image anticlockwise": [
      "Shift+Left",
      "Rotate image anticlockwise in gallery."
    ],
    "Download Gallery Image": [
      "Shift+j",
      "Download current image in gallery."
    ],
    "fappeTyme": [
      "f",
      "Toggle Fappe Tyme."
    ],
    "werkTyme": [
      "Shift+w",
      "Toggle Werk Tyme."
    ],
    "Front page": [
      "1",
      "Jump to front page."
    ],
    "Open front page": [
      "Shift+1",
      "Open front page in a new tab."
    ],
    "Next page": [
      "Ctrl+Right",
      "Jump to the next page."
    ],
    "Previous page": [
      "Ctrl+Left",
      "Jump to the previous page."
    ],
    "Paged mode": [
      "Alt+1",
      "Open the index in paged mode."
    ],
    "Infinite scrolling mode": [
      "Alt+2",
      "Open the index in infinite scrolling mode."
    ],
    "All pages mode": [
      "Alt+3",
      "Open the index in all threads mode."
    ],
    "Open catalog": [
      "Shift+c",
      "Open the catalog of the current board."
    ],
    "Search form": [
      "Ctrl+Alt+s",
      "Focus the search field on the board index."
    ],
    "Cycle sort type": [
      "Alt+x",
      "Cycle through index sort types."
    ],
    "Next thread": [
      "Ctrl+Down",
      "See next thread."
    ],
    "Previous thread": [
      "Ctrl+Up",
      "See previous thread."
    ],
    "Expand thread": [
      "Ctrl+e",
      "Expand thread."
    ],
    "Open thread": [
      "o",
      "Open thread in current tab."
    ],
    "Open thread tab": [
      "Shift+o",
      "Open thread in new tab."
    ],
    "Next reply": [
      "j",
      "Select next reply."
    ],
    "Previous reply": [
      "k",
      "Select previous reply."
    ],
    "Deselect reply": [
      "Shift+d",
      "Deselect reply."
    ],
    "Hide": [
      "x",
      "Hide thread."
    ],
    "Quick Filter MD5": [
      "5",
      "Add the MD5 of the selected image to the filter list."
    ],
    "Previous Post Quoting You": [
      "Alt+Up",
      "Scroll to the previous post that quotes you."
    ],
    "Next Post Quoting You": [
      "Alt+Down",
      "Scroll to the next post that quotes you."
    ]
  },
  "updater": {
    "checkbox": {
      "Beep": [
        false,
        "Beep on new post to completely read thread."
      ],
      "Beep Quoting You": [
        false,
        "Beep on new post quoting you."
      ],
      "Auto Scroll": [
        false,
        "Scroll updated posts into view. Only enabled at bottom of page."
      ],
      "Bottom Scroll": [
        false,
        "Always scroll to the bottom, not the first new post. Useful for event threads."
      ],
      "Scroll BG": [
        false,
        "Auto-scroll background tabs."
      ],
      "Auto Update": [
        true,
        "Automatically fetch new posts."
      ],
      "Optional Increase": [
        false,
        "Increase the intervals between updates on threads without new posts."
      ]
    },
    "Interval": 5
  },
  "customCooldown": 0,
  "customCooldownEnabled": true,
  "Thread Quotes": false,
  "Max Replies": 1000,
  "Autohiding Scrollbar": false,
  "position": {
    "embedding.position": "top: 50px; right: 0px;",
    "thread-stats.position": "bottom: 0px; right: 0px;",
    "updater.position": "bottom: 0px; left: 0px;",
    "thread-watcher.position": "top: 50px; left: 0px;",
    "qr.position": "top: 50px; right: 0px;"
  },
  "fourchanImageHost": "i.4cdn.org",
  "hiddenPSAList": [
    {}
  ],
  "knownBanners": "0.jpg,1.jpg,2.jpg,4.jpg,6.jpg,7.jpg,8.jpg,9.jpg,10.jpg,11.jpg,12.jpg,13.jpg,14.jpg,16.jpg,17.jpg,18.jpg,19.jpg,20.jpg,21.jpg,22.jpg,24.jpg,25.jpg,26.jpg,28.jpg,29.jpg,33.jpg,38.jpg,39.jpg,43.jpg,44.jpg,45.jpg,46.jpg,47.jpg,52.jpg,54.jpg,57.jpg,59.jpg,60.jpg,61.jpg,64.jpg,66.jpg,67.jpg,69.jpg,71.jpg,72.jpg,76.jpg,77.jpg,81.jpg,82.jpg,83.jpg,84.jpg,88.jpg,90.jpg,91.jpg,96.jpg,98.jpg,99.jpg,100.jpg,104.jpg,106.jpg,116.jpg,119.jpg,137.jpg,140.jpg,148.jpg,149.jpg,150.jpg,154.jpg,156.jpg,157.jpg,158.jpg,159.jpg,161.jpg,162.jpg,164.jpg,165.jpg,166.jpg,167.jpg,168.jpg,169.jpg,170.jpg,171.jpg,172.jpg,173.jpg,174.jpg,175.jpg,176.jpg,178.jpg,179.jpg,180.jpg,181.jpg,182.jpg,183.jpg,186.jpg,189.jpg,190.jpg,192.jpg,193.jpg,194.jpg,197.jpg,198.jpg,200.jpg,201.jpg,202.jpg,203.jpg,205.jpg,206.jpg,207.jpg,208.jpg,210.jpg,213.jpg,214.jpg,215.jpg,216.jpg,218.jpg,219.jpg,220.jpg,221.jpg,222.jpg,223.jpg,224.jpg,227.jpg,0.png,1.png,2.png,3.png,5.png,6.png,9.png,10.png,11.png,12.png,14.png,16.png,19.png,20.png,21.png,22.png,23.png,24.png,26.png,27.png,28.png,29.png,30.png,31.png,32.png,33.png,34.png,37.png,39.png,40.png,41.png,42.png,43.png,44.png,45.png,48.png,49.png,50.png,51.png,52.png,53.png,57.png,58.png,59.png,64.png,66.png,67.png,68.png,69.png,70.png,71.png,72.png,76.png,78.png,79.png,81.png,82.png,85.png,86.png,87.png,89.png,95.png,98.png,100.png,101.png,102.png,105.png,106.png,107.png,109.png,110.png,111.png,112.png,113.png,114.png,115.png,116.png,118.png,119.png,120.png,121.png,122.png,123.png,126.png,128.png,130.png,134.png,136.png,138.png,139.png,140.png,142.png,145.png,146.png,149.png,150.png,151.png,152.png,153.png,154.png,155.png,156.png,157.png,158.png,159.png,160.png,163.png,164.png,165.png,166.png,167.png,168.png,169.png,170.png,171.png,172.png,173.png,174.png,178.png,179.png,180.png,181.png,182.png,184.png,186.png,188.png,190.png,192.png,193.png,194.png,195.png,196.png,197.png,198.png,200.png,202.png,203.png,205.png,206.png,207.png,209.png,212.png,213.png,214.png,216.png,217.png,218.png,219.png,220.png,221.png,222.png,223.png,224.png,225.png,226.png,229.png,231.png,232.png,233.png,234.png,235.png,237.png,238.png,239.png,240.png,241.png,242.png,244.png,245.png,246.png,247.png,248.png,249.png,250.png,253.png,254.png,255.png,256.png,257.png,258.png,259.png,260.png,262.png,268.png,0.gif,1.gif,2.gif,3.gif,4.gif,5.gif,6.gif,7.gif,8.gif,9.gif,10.gif,12.gif,13.gif,14.gif,15.gif,16.gif,18.gif,19.gif,20.gif,21.gif,22.gif,23.gif,24.gif,28.gif,29.gif,30.gif,33.gif,34.gif,35.gif,36.gif,37.gif,39.gif,40.gif,42.gif,44.gif,45.gif,46.gif,48.gif,50.gif,52.gif,54.gif,55.gif,57.gif,58.gif,59.gif,60.gif,61.gif,63.gif,64.gif,66.gif,67.gif,68.gif,69.gif,70.gif,72.gif,73.gif,75.gif,76.gif,77.gif,78.gif,80.gif,81.gif,82.gif,83.gif,86.gif,87.gif,88.gif,92.gif,93.gif,94.gif,95.gif,96.gif,97.gif,98.gif,99.gif,100.gif,101.gif,102.gif,103.gif,104.gif,105.gif,106.gif,108.gif,109.gif,110.gif,111.gif,112.gif,113.gif,115.gif,116.gif,117.gif,118.gif,119.gif,120.gif,122.gif,123.gif,124.gif,127.gif,129.gif,130.gif,131.gif,134.gif,135.gif,136.gif,138.gif,139.gif,141.gif,144.gif,146.gif,148.gif,149.gif,153.gif,154.gif,155.gif,157.gif,158.gif,159.gif,160.gif,161.gif,162.gif,164.gif,166.gif,167.gif,168.gif,169.gif,170.gif,171.gif,172.gif,173.gif,174.gif,175.gif,176.gif,177.gif,178.gif,181.gif,182.gif,183.gif,185.gif,186.gif,187.gif,188.gif,189.gif,190.gif,191.gif,192.gif,193.gif,195.gif,196.gif,197.gif,200.gif,201.gif,202.gif,203.gif,204.gif,205.gif,206.gif,207.gif,208.gif,209.gif,210.gif,211.gif,212.gif,213.gif,214.gif,215.gif,216.gif,217.gif,219.gif,220.gif,221.gif,222.gif,224.gif,225.gif,226.gif,227.gif,228.gif,230.gif,232.gif,233.gif,234.gif,235.gif,238.gif,240.gif,241.gif,243.gif,244.gif,245.gif,246.gif,247.gif,249.gif,250.gif,251.gif,253.gif",
  "passMessageClosed": false,
  "PSAseen": [
    []
  ],
  "XEmbedder": "fxt",
  "fxtLang": "",
  "fxtUrl": "https://api.fxtwitter.com",
  "fxtMaxReplies": 5,
  "beepSource": "",
  "beepVolume": 1
}
```

## Appendix B. Installation identity, hosts, grants and dependencies

These are the reference package metadata and build dependencies. Historical project/support URLs and IDs are intentionally retained. Use the final-build update disabling described above. Dependency ranges alone do not guarantee an identical dependency graph; the reference used a lockfile.

```json
{
  "name": "4chan-XZ",
  "description": "4chan-XZ continues 4chan X while completing its TypeScript migration and improving the imageboard enhancement script.",
  "meta": {
    "name": "4chan-XZ",
    "path": "4chan-XZ",
    "fork": "NZ",
    "page": "https://github.com/TuxedoTako/4chan-xt",
    "downloads": "https://github.com/TuxedoTako/4chan-xt/releases",
    "oldVersions": "https://raw.githubusercontent.com/ccd0/4chan-x/",
    "faq": "https://github.com/TuxedoTako/4chan-xt/wiki/Frequently-Asked-Questions",
    "upstreamFaq": "https://github.com/ccd0/4chan-x/wiki/Frequently-Asked-Questions",
    "captchaFAQ": "https://github.com/ccd0/4chan-x/wiki/Captcha-FAQ",
    "cssGuide": "https://github.com/ccd0/4chan-x/wiki/Styling-Guide",
    "license": "https://github.com/TuxedoTako/4chan-xt/blob/project-XT/LICENSE",
    "changelog": "https://github.com/TuxedoTako/4chan-xt/blob/project-XT/CHANGELOG.md",
    "issues": "https://github.com/TuxedoTako/4chan-xt/issues",
    "newIssue": "https://github.com/TuxedoTako/4chan-xt/issues",
    "newIssueMaxLength": 8181,
    "alternatives": "https://www.4chan-x.net/4chan_alternatives.html",
    "appid": "lacclbnghgdicfifcamcmcnilckjamag",
    "appidGecko": "4chan-x@4chan-x.net",
    "recaptchaKey": "6Ldp2bsSAAAAAAJ5uyx_lx34lJeEpTLVkP5k04qc",
    "includes_only": [
      "https://boards.4chan.org/*",
      "https://sys.4chan.org/*",
      "https://www.4chan.org/*",
      "https://i.4cdn.org/*",
      "https://is.4chan.org/*",
      "https://is2.4chan.org/*"
    ],
    "matches_only": [
      "https://*.4chan.org/*",
      "https://*.4cdn.org/*"
    ],
    "matches": [
      "https://erischan.org/*",
      "https://www.erischan.org/*",
      "https://fufufu.moe/*",
      "https://kakashinenpo.com/*",
      "https://www.kakashinenpo.com/*",
      "https://kissu.moe/*",
      "https://www.kissu.moe/*",
      "https://original.kissu.moe/*",
      "https://lainchan.org/*",
      "https://www.lainchan.org/*",
      "https://merorin.com/*",
      "https://ota-ch.com/*",
      "https://www.ota-ch.com/*",
      "https://ponyville.us/*",
      "https://www.ponyville.us/*",
      "https://smuglo.li/*",
      "https://notso.smuglo.li/*",
      "https://smugloli.net/*",
      "https://smug.nepu.moe/*",
      "https://sportschan.org/*",
      "https://www.sportschan.org/*",
      "https://sushigirl.us/*",
      "https://www.sushigirl.us/*",
      "https://tvch.moe/*"
    ],
    "matches_extra": [],
    "exclude_matches": [
      "https://www.4chan.org/advertise",
      "https://www.4chan.org/advertise?*",
      "https://www.4chan.org/donate",
      "https://www.4chan.org/donate?*",
      "https://www.4chan.org/"
    ],
    "grants": [
      "GM_getValue",
      "GM_setValue",
      "GM_deleteValue",
      "GM_listValues",
      "GM_addValueChangeListener",
      "GM_openInTab",
      "GM_xmlhttpRequest",
      "GM.getValue",
      "GM.setValue",
      "GM.deleteValue",
      "GM.listValues",
      "GM.openInTab",
      "GM.xmlHttpRequest"
    ],
    "min": {
      "chrome": "90",
      "firefox": "78",
      "greasemonkey": "1.14"
    }
  },
  "engines": {
    "node": "^24.0.0 || >=26.0.0",
    "npm": ">=11.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@fortawesome/free-regular-svg-icons": "^6.7.2",
    "@fortawesome/free-solid-svg-icons": "^6.7.2",
    "@playwright/test": "^1.64.0",
    "@rollup/plugin-alias": "^6.0.0",
    "@rollup/plugin-terser": "^1.0.0",
    "@rollup/plugin-typescript": "^12.3.0",
    "@rollup/pluginutils": "^5.4.0",
    "@types/chrome": "^0.3.4",
    "@types/node": "^24.19.2",
    "@violentmonkey/types": "^0.3.4",
    "eslint": "^10.12.0",
    "globals": "^17.0.0",
    "magic-string": "^0.30.21",
    "rollup": "^4.64.3",
    "rollup-plugin-cleanup": "^3.2.1",
    "tslib": "^2.8.1",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.1"
  }
}
```

## Appendix C. Initial archive registry

Treat these as seed records with capabilities, not verified current service availability. User overrides and refreshed registry data take precedence.

```json
[{
  "uid": 3,
  "name": "4plebs",
  "domain": "archive.4plebs.org",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["adv", "f", "hr", "mlpol", "mo", "o", "pol", "s4s", "sp", "tg", "trv", "tv", "x"],
  "files": ["adv", "f", "hr", "mlpol", "mo", "o", "pol", "s4s", "sp", "tg", "trv", "tv", "x"],
  "reports": true
}, {
  "uid": 10,
  "name": "warosu",
  "domain": "warosu.org",
  "http": false,
  "https": true,
  "software": "fuuka",
  "boards": ["3", "biz", "cgl", "ck", "diy", "fa", "ic", "jp", "lit", "sci", "vr", "vt"],
  "files": ["3", "biz", "cgl", "ck", "diy", "fa", "ic", "jp", "lit", "sci", "vr", "vt"],
  "search": ["biz", "cgl", "ck", "diy", "fa", "ic", "jp", "lit", "sci", "vr", "vt"]
}, {
  "uid": 23,
  "name": "Desuarchive",
  "domain": "desuarchive.org",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["a", "aco", "an", "c", "cgl", "co", "d", "fit", "g", "his", "int", "k", "m", "mlp", "mu", "q", "qa", "r9k", "tg", "trash", "vr", "wsg"],
  "files": ["a", "aco", "an", "c", "cgl", "co", "d", "fit", "g", "his", "int", "k", "m", "mlp", "mu", "q", "qa", "r9k", "tg", "trash", "vr"],
  "reports": true
}, {
  "uid": 24,
  "name": "fireden.net",
  "domain": "boards.fireden.net",
  "http": false,
  "https": true,
  "software": "foolfuuka",
  "boards": ["cm", "co", "ic", "sci", "vip", "y"],
  "files": ["cm", "co", "ic", "sci", "vip", "y"],
  "search": ["cm", "co", "ic", "sci", "y"]
}, {
  "uid": 25,
  "name": "not arch.b4k.co",
  "domain": "arch.b4k.dev",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["g", "mlp", "qb", "v", "vg", "vm", "vmg", "vp", "vrpg", "vst"],
  "files": ["qb", "v", "vg", "vm", "vmg", "vp", "vrpg", "vst"],
  "search": ["qb", "v", "vg", "vm", "vmg", "vp", "vrpg", "vst"]
}, {
  "uid": 29,
  "name": "Archived.Moe",
  "domain": "archived.moe",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["3", "a", "aco", "adv", "an", "asp", "b", "bant", "biz", "c", "can", "cgl", "ck", "cm", "co", "cock", "con", "d", "diy", "e", "f", "fa", "fap", "fit", "fitlit", "g", "gd", "gif", "h", "hc", "his", "hm", "hr", "i", "ic", "int", "jp", "k", "lgbt", "lit", "m", "mlp", "mlpol", "mo", "mtv", "mu", "n", "news", "o", "out", "outsoc", "p", "po", "pol", "pw", "q", "qa", "qb", "qst", "r", "r9k", "s", "s4s", "sci", "soc", "sp", "spa", "t", "tg", "toy", "trash", "trv", "tv", "u", "v", "vg", "vint", "vip", "vm", "vmg", "vp", "vr", "vrpg", "vst", "vt", "w", "wg", "wsg", "wsr", "x", "xs", "y"],
  "files": ["can", "cock", "con", "fap", "fitlit", "gd", "mlpol", "mo", "mtv", "outsoc", "po", "q", "qb", "qst", "spa", "vint", "vip"],
  "search": ["aco", "adv", "an", "asp", "b", "bant", "biz", "c", "can", "cgl", "ck", "cm", "cock", "con", "d", "diy", "e", "f", "fap", "fitlit", "gd", "gif", "h", "hc", "his", "hm", "hr", "i", "ic", "lgbt", "lit", "mlpol", "mo", "mtv", "n", "news", "o", "out", "outsoc", "p", "po", "pw", "q", "qa", "qst", "r", "s", "soc", "spa", "trv", "u", "vint", "vip", "vrpg", "w", "wg", "wsg", "wsr", "x", "y"],
  "reports": true
}, {
  "uid": 30,
  "name": "TheBArchive.com",
  "domain": "thebarchive.com",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["b", "bant"],
  "files": ["b", "bant"],
  "reports": true
}, {
  "uid": 31,
  "name": "Archive Of Sins",
  "domain": "archiveofsins.com",
  "http": true,
  "https": true,
  "software": "foolfuuka",
  "boards": ["h", "hc", "hm", "i", "lgbt", "r", "s", "soc", "t", "u"],
  "files": ["h", "hc", "hm", "i", "lgbt", "r", "s", "soc", "t", "u"],
  "reports": true
}, {
  "uid": 36,
  "name": "palanq.win",
  "domain": "archive.palanq.win",
  "http": false,
  "https": true,
  "software": "foolfuuka",
  "boards": ["bant", "c", "con", "e", "i", "n", "news", "out", "p", "pw", "qst", "toy", "vip", "vp", "vt", "w", "wg", "wsr"],
  "files": ["bant", "c", "e", "i", "n", "news", "out", "p", "pw", "qst", "toy", "vip", "vp", "vt", "w", "wg", "wsr"],
  "reports": true
}, {
  "uid": 37,
  "name": "Eientei",
  "domain": "eientei.xyz",
  "http": false,
  "https": true,
  "software": "Eientei",
  "boards": ["3", "i", "sci", "xs"],
  "files": ["3", "i", "sci", "xs"],
  "reports": true
}]
```

## Appendix D. Feature initialization order

Order is significant for callback registration and dependencies. The adapter can disable an entry by its display name.

| Order | Feature name | Reference module/object |
| --- | --- | --- |
| 1 | Board Configuration | `BoardConfig` |
| 2 | Normalize URL | `NormalizeURL` |
| 3 | Delay Redirect on Post | `PostRedirect` |
| 4 | Captcha Configuration | `CaptchaReplace` |
| 5 | Image Host Rewriting | `ImageHost` |
| 6 | Redirect | `Redirect` |
| 7 | Header | `Header` |
| 8 | Catalog Links | `CatalogLinks` |
| 9 | Settings | `Settings` |
| 10 | Index Generator | `Index` |
| 11 | Disable Autoplay | `AntiAutoplay` |
| 12 | Announcement Hiding | `PSAHiding` |
| 13 | Fourchan thingies | `Fourchan` |
| 14 | Tinyboard Glue | `Tinyboard` |
| 15 | Color User IDs | `IDColor` |
| 16 | Highlight by User ID | `IDHighlight` |
| 17 | Count Posts by ID | `IDPostCount` |
| 18 | Custom CSS | `CustomCSS` |
| 19 | Thread Links | `ThreadLinks` |
| 20 | Linkify | `Linkify` |
| 21 | Reveal Spoilers | `RemoveSpoilers` |
| 22 | Resurrect Quotes | `Quotify` |
| 23 | Filter | `Filter` |
| 24 | Thread Hiding Buttons | `ThreadHiding` |
| 25 | Reply Hiding Buttons | `PostHiding` |
| 26 | Recursive | `Recursive` |
| 27 | Strike-through Quotes | `QuoteStrikeThrough` |
| 28 | Quick Reply Personas | `QR.persona` |
| 29 | Quick Reply | `QR` |
| 30 | Cooldown | `QR.cooldown` |
| 31 | Post Jumper | `PostJumper` |
| 32 | Pass Link | `PassLink` |
| 33 | Menu | `Menu` |
| 34 | Index Generator (Menu) | `Index.menu` |
| 35 | Report Link | `ReportLink` |
| 36 | Copy Text Link | `CopyTextLink` |
| 37 | Thread Hiding (Menu) | `ThreadHiding.menu` |
| 38 | Reply Hiding (Menu) | `PostHiding.menu` |
| 39 | Delete Link | `DeleteLink` |
| 40 | Filter (Menu) | `Filter.menu` |
| 41 | Edit Link | `QR.oekaki.menu` |
| 42 | Download Link | `DownloadLink` |
| 43 | Archive Link | `ArchiveLink` |
| 44 | Quote Inlining | `QuoteInline` |
| 45 | Quote Previewing | `QuotePreview` |
| 46 | Quote Backlinks | `QuoteBacklink` |
| 47 | Mark Quotes of You | `QuoteYou` |
| 48 | Mark OP Quotes | `QuoteOP` |
| 49 | Mark Cross-thread Quotes | `QuoteCT` |
| 50 | Anonymize | `Anonymize` |
| 51 | Time Formatting | `Time` |
| 52 | Relative Post Dates | `RelativeDates` |
| 53 | File Info Formatting | `FileInfo` |
| 54 | Fappe Tyme | `FappeTyme` |
| 55 | Gallery | `Gallery` |
| 56 | Gallery (menu) | `Gallery.menu` |
| 57 | Sauce | `Sauce` |
| 58 | Image Expansion | `ImageExpand` |
| 59 | Image Expansion (Menu) | `ImageExpand.menu` |
| 60 | Reveal Spoiler Thumbnails | `RevealSpoilers` |
| 61 | Image Loading | `ImageLoader` |
| 62 | Image Hover | `ImageHover` |
| 63 | Volume Control | `Volume` |
| 64 | WEBM Metadata | `Metadata` |
| 65 | Comment Expansion | `ExpandComment` |
| 66 | Thread Expansion | `ExpandThread` |
| 67 | Favicon | `Favicon` |
| 68 | Unread | `Unread` |
| 69 | Unread Line in Index | `UnreadIndex` |
| 70 | Quote Threading | `QuoteThreading` |
| 71 | Thread Stats | `ThreadStats` |
| 72 | Thread Updater | `ThreadUpdater` |
| 73 | Thread Watcher | `ThreadWatcher` |
| 74 | Thread Watcher (Menu) | `ThreadWatcher.menu` |
| 75 | Mark New IPs | `MarkNewIPs` |
| 76 | Index Navigation | `Nav` |
| 77 | Keybinds | `Keybinds` |
| 78 | Banner | `Banner` |
| 79 | Announcements | `PSA` |
| 80 | Flash Features | `Flash` |
| 81 | Reply Pruning | `ReplyPruning` |
| 82 | Mod Contact Links | `ModContact` |
| 83 | Restore deleted posts from archive | `RestoreDeletedFromArchive` |
| 84 | Mark posts on scroll bar | `ScrollMarkers` |
| 85 | Build Test | `Test` |

## Appendix E. Runtime text-module inventory

Paths identify reference responsibilities. All runtime feature families are covered in the prose. Templates/styles/resources are supplied in later appendices; this inventory is a coverage aid, not a requirement to retrieve the original files.

```text
src/Archive/Parse.ts
src/Archive/Redirect.ts
src/Archive/RestoreDeletedFromArchive.ts
src/Filtering/Anonymize.ts
src/Filtering/Filter.ts
src/Filtering/FilterRule.ts
src/Filtering/PostHiding.ts
src/Filtering/Recursive.ts
src/Filtering/ThreadHiding.ts
src/General/BoardConfig.ts
src/General/Get.ts
src/General/Header.ts
src/General/Index.ts
src/General/Settings.tsx
src/General/Settings/FilterEditor.ts
src/General/Settings/SettingsHtml.tsx
src/General/Test.ts
src/General/UI.ts
src/Icons/icon.ts
src/Images/Audio.ts
src/Images/FappeTyme.ts
src/Images/Gallery.ts
src/Images/ImageCommon.ts
src/Images/ImageExpand.ts
src/Images/ImageHost.ts
src/Images/ImageHover.ts
src/Images/ImageLoader.ts
src/Images/Metadata.ts
src/Images/RevealSpoilers.ts
src/Images/Sauce.ts
src/Images/Volume.ts
src/Linkification/Embedding.tsx
src/Linkification/Embedding/FxTwitter.tsx
src/Linkification/Linkify.ts
src/Menu/ArchiveLink.ts
src/Menu/CopyTextLink.ts
src/Menu/DeleteLink.ts
src/Menu/DownloadLink.ts
src/Menu/Menu.ts
src/Menu/ReportLink.ts
src/Miscellaneous/AntiAutoplay.ts
src/Miscellaneous/Banner.ts
src/Miscellaneous/CatalogLinks.ts
src/Miscellaneous/CustomCSS.ts
src/Miscellaneous/ExpandComment.ts
src/Miscellaneous/ExpandThread.ts
src/Miscellaneous/FileInfo.tsx
src/Miscellaneous/Flash.ts
src/Miscellaneous/Fourchan.ts
src/Miscellaneous/IDColor.ts
src/Miscellaneous/IDHighlight.ts
src/Miscellaneous/IDPostCount.ts
src/Miscellaneous/Keybinds.ts
src/Miscellaneous/ModContact.ts
src/Miscellaneous/Nav.ts
src/Miscellaneous/NormalizeURL.ts
src/Miscellaneous/PSA.ts
src/Miscellaneous/PSAHiding.ts
src/Miscellaneous/PassMessage.ts
src/Miscellaneous/PassMessage/PassMessageHtml.tsx
src/Miscellaneous/PostJumper.ts
src/Miscellaneous/RelativeDates.ts
src/Miscellaneous/RemoveSpoilers.ts
src/Miscellaneous/Report.ts
src/Miscellaneous/ScrollMarkers.ts
src/Miscellaneous/ThreadLinks.ts
src/Miscellaneous/Time.ts
src/Miscellaneous/Tinyboard.ts
src/Monitoring/Favicon.ts
src/Monitoring/MarkNewIPs.ts
src/Monitoring/ReplyPruning.ts
src/Monitoring/ThreadStats.ts
src/Monitoring/ThreadUpdater.ts
src/Monitoring/ThreadWatcher.ts
src/Monitoring/Unread.ts
src/Monitoring/UnreadIndex.ts
src/PageContext/pageContext.ts
src/Posting/Captcha.replace.ts
src/Posting/Captcha.t.ts
src/Posting/Captcha.ts
src/Posting/PassLink.ts
src/Posting/PostRedirect.ts
src/Posting/PostSuccessful.ts
src/Posting/QR.ts
src/Quotelinks/QuoteBacklink.ts
src/Quotelinks/QuoteCT.ts
src/Quotelinks/QuoteInline.ts
src/Quotelinks/QuoteOP.ts
src/Quotelinks/QuotePreview.ts
src/Quotelinks/QuoteStrikeThrough.ts
src/Quotelinks/QuoteThreading.ts
src/Quotelinks/QuoteYou.ts
src/Quotelinks/Quotify.ts
src/classes/Board.ts
src/classes/Callbacks.ts
src/classes/CatalogThread.ts
src/classes/CatalogThreadNative.ts
src/classes/Connection.ts
src/classes/DataBoard.ts
src/classes/Fetcher.ts
src/classes/Notice.ts
src/classes/Post.ts
src/classes/RandomAccessList.ts
src/classes/SimpleDict.ts
src/classes/Thread.ts
src/config/Config.ts
src/css/CSS.ts
src/css/style.ts
src/globals/globals.ts
src/globals/jsx.ts
src/main/Main.ts
src/meta/eventPage.ts
src/meta/manifestJson.js
src/meta/metadata.js
src/platform/$$.ts
src/platform/$.ts
src/platform/CrossOrigin.ts
src/platform/helpers.ts
src/site/SW.tinyboard.ts
src/site/SW.ts
src/site/SW.yotsuba.Build/CatalogThreadHtml.tsx
src/site/SW.yotsuba.Build/FileHtml.tsx
src/site/SW.yotsuba.Build/PostInfoHtml.tsx
src/site/SW.yotsuba.tsx
src/site/Site.ts
src/types/customImports.d.ts
src/types/globals.d.ts
src/types/jsx.d.ts
```

## Appendix F. Exact UI templates

Use these as DOM/label/layout contracts, binding behavior as described above. Asset imports and generated JSX components must be converted to equivalent DOM. The static templates below contain no missing local includes. Native posts are generated to match the selectors in section 4.

### src/General/Index/NavLinks.html

```html
<span class="brackets-wrap indexlink"><a href="#index">Index</a></span> 
<span class="brackets-wrap cataloglink"><a href="#catalog">Catalog</a></span> 
<span class="brackets-wrap archlistlink"><a href="./archive">Archive</a></span> 
<span class="brackets-wrap bottomlink"><a href="#bottom">Bottom</a></span> 
<span class="brackets-wrap" id="index-last-refresh"><a href="javascript:;"><time title="Last index refresh">...</time></a></span> 
<input type="search" id="index-search" class="field" placeholder="Search">
<a id="index-search-clear" href="javascript:;" title="Clear search">×</a>
<span id="hidden-label" hidden> &mdash; <span id="hidden-count"></span> <span id="hidden-toggle">[<a href="javascript:;">Show</a>]</span></span>
<span id="index-options">
  <input type="checkbox" id="index-rev" name="Reverse Sort" title="Reverse sort order">
  <span id="lastlong-options" hidden>
    <input type="text" title="Minimum letter count (without image)">
    <input type="text" title="Minimum letter count (with image)">
  </span>
  <select id="index-sort" name="Index Sort">
    <option disabled>Index Sort</option>
    <option value="bump">Bump order</option>
    <option value="lastreply">Last reply</option>
    <option value="lastlong">Last long reply</option>
    <option value="birth">Creation date</option>
    <option value="replycount">Reply count</option>
    <option value="filecount">File count</option>
    <option value="activity">Posts per minute</option>
  </select>
  <select id="index-size" name="Index Size">
    <option disabled>Image Size</option>
    <option value="small">Small</option>
    <option value="large">Large</option>
  </select>
  <select id="index-mode" name="Index Mode">
    <option disabled>Index Mode</option>
    <option value="paged">Paged</option>
    <option value="infinite">Infinite scrolling</option>
    <option value="all pages">All threads</option>
    <option value="catalog">Catalog</option>
  </select>
</span>
```

### src/General/Index/PageList.html

```html
<div class="prev">
  <a>
    <button disabled>Previous</button>
  </a>
</div>
<div class="pages"></div>
<div class="next">
  <a>
    <button disabled>Next</button>
  </a>
</div>
<div class="pages cataloglink">
  <a href="./catalog">Catalog</a>
</div>
```

### src/General/Settings/Advanced.html

```html
<fieldset>
  <legend>Archives</legend>
  <div class="warning" data-feature="404 Redirect"><code>404 Redirect</code> is disabled.</div>
  <select id="archive-board-select"></select>
  <table id="archive-table">
    <thead>
      <th>Thread redirection</th>
      <th>Thread fetching</th>
      <th>Post fetching</th>
      <th>File redirection</th>
    </thead>
    <tbody></tbody>
  </table>
  <br>
  <div>
    <b>Archive Lists</b>: Each line below should be an archive list in <a href="https://github.com/4chenz/archives.json/blob/gh-pages/CONTRIBUTING.md" target="_blank">this format</a> or a URL to load an archive list from.<br>
    Archive properties can be overriden by another item with the same <code>uid</code> (or if absent, its <code>name</code>).
  </div>
  <textarea hidden name="archiveLists" class="field" spellcheck="false"></textarea>
  <button id="update-archives">Update now</button> Last updated: <time id="lastarchivecheck"></time> <label><input type="checkbox" name="archiveAutoUpdate"> Auto-update</label>
</fieldset>

<fieldset>
  <legend>External Catalog</legend>
  <div class="warning" data-feature="External Catalog"><code>External Catalog</code> is disabled. This will be used only as a fallback.</div>
  <div>
    URLs of external catalog sites, where <code>%board</code> is to be replaced by the board name.<br>
    Each URL should be followed by <code>;boards:</code> and optionally <code>;exclude:</code> and a list of supported/excluded boards in the format explained in the Filter guide.
  </div>
  <textarea hidden name="externalCatalogURLs" class="field" spellcheck="false"></textarea>
</fieldset>

<fieldset>
  <legend>Override 4chan Image Host</legend>
  <div>Change 4chan image links to this domain. Leave blank for no change.</div>
  <div><input name="fourchanImageHost" class="field" spellcheck="false" list="list-fourchanImageHost"></div>
  <datalist id="list-fourchanImageHost"></datalist>
</fieldset>

<fieldset>
  <legend>Captcha Language</legend>
  <div>Choose from <a href="https://developers.google.com/recaptcha/docs/language" target="_blank">list of language codes</a>. Leave blank to autoselect.</div>
  <div><input name="captchaLanguage" class="field" spellcheck="false"></div>
</fieldset>

<fieldset>
  <legend>Custom Board Navigation</legend>
  <div><textarea hidden name="boardnav" class="field" spellcheck="false"></textarea></div>
  <span class="note">New lines will be converted into spaces.</span><br><br>
  <div class="note">In the following examples for /g/, <code>g</code> can be changed to a different board ID (<code>a</code>, <code>b</code>, etc...), the current board (<code>current</code>), or the Twitter link (<code>@</code>).</div>
  <div>Board link: <code>g</code></div>
  <div>Archive link: <code>g-archive</code></div>
  <div>Internal archive link: <code>g-expired</code></div>
  <div>Title link: <code>g-title</code></div>
  <div>Board link (Replace with title when on that board): <code>g-replace</code></div>
  <div>Full text link: <code>g-full</code></div>
  <div>Custom text link: <code>g-text:&quot;Install Gentoo&quot;</code></div>
  <div>Index-only link: <code>g-index</code></div>
  <div>Catalog-only link: <code>g-catalog</code></div>
  <div>Index mode: <code>g-mode:&quot;infinite scrolling&quot;</code></div>
  <div>Index sort: <code>g-sort:&quot;creation date rev&quot;</code></div>
  <div>External link: <code>external-text:&quot;Google&quot;,&quot;http://www.google.com&quot;</code></div>
  <div>Open in new tab: <code>g-nt</code></div>
  <div>Combinations are possible: <code>g-index-text:&quot;Technology Index&quot;</code></div>
  <div>Full board list toggle: <code>toggle-all</code></div>
  <br>
  <div class="note">
    <code>[ toggle-all ] [current-title] [g-title / a-title / jp-title] [x / wsg / h] [t-text:&quot;Piracy&quot;]</code><br>
    will give you<br>
    <code>[ + ] [Technology] [Technology / Anime & Manga / Otaku Culture] [x / wsg / h] [Piracy]</code><br>
    if you are on /g/.
  </div>
  <div class="note">
    For custom styling, you can wrap groups or individual links in <code>{{</code> and <code>}}</code>, to wrap them in
    a span. You can also add classes in double quotes right after the {{. For example: <br />
    <code>[g-title] {{"favorites"[a-title / jp-title]}}</code><br />
    Results in:<br />
    <code>[&lt;a [...] &gt;Technology&lt;/a&gt;] &lt;span class="favorites"&gt;[&lt;a [...] &gt;Anime &amp;amp;
      Manga&lt;/a&gt; / &lt;a [...] &gt;Otaku Culture&lt;/a&gt;]&lt;/span&gt;</code>
  </div>
</fieldset>

<fieldset>
  <legend>
    Time Formatting
    <span class="warning" data-feature="Time Formatting">is disabled, relative time setting still applies.</span>
  </legend>
  <div><input name="time" class="field" spellcheck="false">: <span class="time-preview"></span></div>
  <div>Supported <a href="http://man7.org/linux/man-pages/man1/date.1.html" target="_blank">format specifiers</a>:</div>
  <div>Day: <code>%a</code>, <code>%A</code>, <code>%d</code>, <code>%e</code></div>
  <div>Month: <code>%m</code>, <code>%b</code>, <code>%B</code>, <code>%n</code> (Not zero padded)</div>
  <div>Year: <code>%y</code>, <code>%Y</code></div>
  <div>Hour: <code>%k</code>, <code>%H</code>, <code>%l</code>, <code>%I</code>, <code>%p</code>, <code>%P</code></div>
  <div>Minute: <code>%M</code></div>
  <div>Second: <code>%S</code></div>
  <div>Literal <code>%</code>: <code>%%</code></div>
  <div><a href="https://www.w3.org/International/articles/language-tags/" target="_blank">Language tag</a>: <input name="timeLocale" class="field" spellcheck="false"></div>
  <div>Relative time, like "3 minutes ago":
    <select name="RelativeTime">
      <option value="No">Disabled</option>
      <option value="Hover">Show when hovering on the date</option>
      <option value="Show">Show relative time, and time and date on hover</option>
      <option value="Both">Show both timestamp and relative date</option>
      <option value="BothRelativeFirst">Show both relative date and timestamp</option>
    </select>
  </div>
</fieldset>

<fieldset>
  <legend>Quote Backlinks formatting <span class="warning" data-feature="Quote Backlinks">is disabled.</span></legend>
  <div><input name="backlink" class="field" spellcheck="false">: <span class="backlink-preview"></span></div>
</fieldset>

<fieldset>
  <legend>Default pasted content filename</legend>
  <div><input name="pastedname" class="field" spellcheck="false">.png</div>
</fieldset>

<fieldset>
  <legend>File Info Formatting <span class="warning" data-feature="File Info Formatting">is disabled.</span></legend>
  <div><input name="fileInfo" class="field" spellcheck="false">: <span class="file-info file-info-preview"></span></div>
  <div>Link: <code>%l</code> (truncated), <code>%L</code> (untruncated), <code>%T</code> (4chan filename)</div>
  <div>Filename: <code>%n</code> (truncated), <code>%N</code> (untruncated), <code>%t</code> (4chan filename)</div>
  <div>Download button: <code>%d</code></div>
  <div>Quick filter MD5: <code>%f</code></div>
  <div>Spoiler indicator: <code>%p</code></div>
  <div>Size: <code>%B</code> (Bytes), <code>%K</code> (KB), <code>%M</code> (MB), <code>%s</code> (4chan default)</div>
  <div>Resolution: <code>%r</code> (Displays &#039;PDF&#039; for PDF files)</div>
  <div>Tag: <code>%g</code>
  <div>Literal <code>%</code>: <code>%%</code></div>
</fieldset>

<fieldset>
  <legend>Quick Reply Personas</legend>
  <textarea hidden class="personafield field" name="QR.personas" spellcheck="false"></textarea>
  <p>
    One item per line.<br>
    Items will be added in the relevant input&#039;s auto-completion list.<br>
    Password items will always be used, since there is no password input.<br>
    Lines starting with a <code>#</code> will be ignored.
  </p>
  <ul>You can use these settings with each item, separate them with semicolons:
    <li>Possible items are: <code>name</code>, <code>options</code> (or equivalently <code>email</code>), <code>subject</code> and <code>password</code>.</li>
    <li>Wrap values of items with quotes, like this: <code>options:&quot;sage&quot;</code>.</li>
    <li>Force values as defaults with the <code>always</code> keyword, for example: <code>options:&quot;sage&quot;;always</code>.</li>
    <li>Select specific boards for an item, separated with commas, for example: <code>options:&quot;sage&quot;;boards:jp;always</code>.</li>
  </ul>
</fieldset>

<fieldset>
  <legend>Unread Favicon <span class="warning" data-feature="Unread Favicon">is disabled.</span></legend>
  <select name="favicon">
    <option value="ferongr">ferongr</option>
    <option value="xat-">xat-</option>
    <option value="4chanJS">4chanJS</option>
    <option value="Mayhem">Mayhem</option>
    <option value="Original">Original</option>
    <option value="Metro">Metro</option>
  </select>
  <span class="favicon-preview"></span>
</fieldset>

<fieldset>
  <legend>Thread Updater <span class="warning" data-feature="Thread Updater">is disabled.</span></legend>
  <div>
    Interval: <input type="number" name="Interval" class="field" min="1"> seconds
  </div>
</fieldset>

<fieldset>
    <legend>Custom Cooldown Time</legend>
    <div>
        Seconds: <input type="number" name="customCooldown" class="field" min="0">
    </div>
</fieldset>

<fieldset>
  <legend>
    <label><input type="checkbox" name="Custom CSS"> Custom CSS</label>
  </legend>
  <div>For more information about customizing 4chan X&#039;s CSS, see the <a href="<%= meta.cssGuide %>" target="_blank">styling guide</a>.</div>
  <button id="apply-css">Apply CSS</button>
  <textarea hidden name="usercss" class="field" spellcheck="false"></textarea>
</fieldset>

<fieldset>
  <legend>Javascript Whitelist</legend>
  <div>
    Sources from which Javascript is allowed to be loaded by <a href="http://content-security-policy.com/#source_list" target="_blank">Content Security Policy</a>.<br>
    Lines starting with a <code>#</code> will be ignored. Remove or comment out all lines to allow everything.
  </div>
  <textarea hidden name="jsWhitelist" class="field" spellcheck="false"></textarea>
</fieldset>

<fieldset>
  <legend>Known Banners</legend>
  <div>List of known banners, used for click-to-change feature.</div>
  <textarea hidden name="knownBanners" class="field" spellcheck="false"></textarea>
</fieldset>

<fieldset>
  <legend>X (formerly Twitter) embeds</legend>
  <div>Only applies if embeds are enabled in the main settings</div>
  <label>Service to use for embeds
    <select name="XEmbedder">
      <option value="fxt">FxTwitter</option>
      <option value="tf">Twitframe</option>
    </select>
  </label><br />
  <label>
    Language to translate FxTwitter embeds to, as a two character ISO code, like <code>en</code>.
    Leave empty for no translation.
    <input name="fxtLang" maxlength="2" class="field" />
  </label><br />
  <label>FxTwitter endpoint <input name="fxtUrl" type="url" class="field" /></label><br />
  <label>FxTwitter maximum amount of replies include
    <input name="fxtMaxReplies" type="number" min="0" step="1" max="100" class="field" />
  </label>
</fieldset>

<fieldset>
  <legend>Thread updater sound</legend>
  <label>
    Sound volume, between 0 and 1:
    <input name="beepVolume" type="number" min=".01" max="1" step=".01" class="field" />
  </label><br />
  <label>
    Sound url. Can be a base64 one starting with <code>data:</code>. Leave empty for the default beep.
    <input type="string" name="beepSource" class="field wide" />
  </label>
</fieldset>
```

### src/General/Settings/Export.html

```html
<form id="export-form">
  <div class="move">Export settings</div>
  <label><input name="history" type="checkbox" />Export history (last read, your posts, etc)</label><br />
  <label><input name="ask" type="checkbox" checked />Ask every time.</label><br />
  <button type="submit">Export</button>
  <button type="button" id="cancel-export">Cancel</button>
</form>
```

### src/General/Settings/Filter-editor.html

```html
<form class="filter-builder">
  <div class="filter-grid">
    <label>Match<select data-field="mode">
      <option value="contains">Contains text</option><option value="equals">Equals text</option>
      <option value="starts">Starts with text</option><option value="ends">Ends with text</option>
      <option value="regex">Regular expression</option>
    </select></label>
    <label>Value<input data-field="value" type="text" autocomplete="off" required></label>
    <label class="filter-check"><input data-field="case" type="checkbox">Case sensitive</label>
    <label>Action<select data-field="action">
      <option value="hide">Hide</option><option value="highlight">Highlight</option>
      <option value="notify">Notify</option><option value="both">Hide and highlight</option>
    </select></label>
    <label>Boards<input data-field="boards" type="text" placeholder="All boards" title="Comma-separated board names, for example g, v or 4chan.org:g"></label>
    <label>Excluded boards<input data-field="exclude" type="text" placeholder="None"></label>
  </div>
  <details class="filter-options">
    <summary>Advanced options</summary>
    <div class="filter-grid">
      <label>Extra regex flags<input data-field="flags" type="text" placeholder="m, s, u, g, y (no separators)" title="m: multiline, s: dot matches newlines, u: Unicode, g: global, y: sticky"></label>
      <label>Posts<select data-field="op"><option value="">All posts</option><option value="only">Threads only</option><option value="no">Replies only</option></select></label>
      <label>Attachments<select data-field="file"><option value="">Any</option><option value="only">With files</option><option value="no">Without files</option></select></label>
      <label>Stub<select data-field="stub"><option value="">Use global setting</option><option value="yes">Show</option><option value="no">Hide</option></select></label>
      <label>Reason<input data-field="reason" type="text"></label>
      <label>Highlight class<input data-field="highlight" type="text" placeholder="filter-highlight"></label>
      <label class="filter-check"><input data-field="top" type="checkbox" checked>Move highlighted threads to top</label>
      <label class="filter-check"><input data-field="notify" type="checkbox">Also notify</label>
      <label class="filter-check"><input data-field="poster" type="checkbox">Include same poster</label>
      <label class="filter-check"><input data-field="replies" type="checkbox">Include replies recursively</label>
    </div>
    <fieldset class="filter-types"><legend>Match any selected field</legend></fieldset>
  </details>
  <output class="filter-preview"></output>
  <div class="filter-actions"><button type="submit">Add rule</button><span class="filter-builder-error" role="status"></span></div>
  <details class="filter-test">
    <summary>Test match</summary>
    <label>Sample field value<textarea data-field="sample" spellcheck="false"></textarea></label>
    <button type="button" data-command="test">Test pattern</button>
    <output class="filter-test-result" aria-live="polite"></output>
  </details>
</form>
<details class="filter-saved" open>
  <summary>Saved rules <span class="filter-count"></span></summary>
  <div class="filter-rule-list"></div>
  <button type="button" data-command="undo" disabled>Undo removal</button>
</details>
<details class="filter-raw">
  <summary>Raw rules</summary>
  <textarea class="field" spellcheck="false" aria-label="Raw filter rules"></textarea>
  <button type="button" data-command="save">Save rules</button>
  <div class="filter-diagnostics" role="status"></div>
</details>
<div class="filter-save-status" role="status"></div>
```

### src/General/Settings/Filter-guide.html

```html
<div class="warning"><code>Filter</code> is disabled.</div>
<p>
  Use <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions" target="_blank">regular expressions</a>, one per line.<br>
  Lines starting with a <code>#</code> will be ignored.<br>
  For example, <code>/weeaboo/i</code> will filter posts containing the string `<code>weeaboo</code>`, case-insensitive.<br>
  MD5 and Unique ID filtering use exact string matching, not regular expressions.
</p>
<ul>You can use these settings with each regular expression, separate them with semicolons:
  <li>
    Per boards, separate them with commas. It is global if not specified. Use <code>sfw</code> and <code>nsfw</code> to reference all worksafe or not-worksafe boards.<br>
    For example: <code>boards:a,jp;</code>.<br>
    To specify boards on a particular site, put the beginning of the domain and a colon before the list.<br>
    Any initial <code>www.</code> should not be included, and all 4chan domains are considered <code>4chan.org</code>.<br>
    For example: <code>boards:4:a,jp,sama:a,z;</code>.<br>
    An asterisk can be used to specify all boards on a site.<br>
    For example: <code>boards:4:*;</code>.<br>
  </li>
  <li>
    Show a custom reason in the stub. If not given, the type and regex will be shown.<br>
    For example: <code>reason:This is bait;</code>
  </li>
  <li>
    Select boards to be excluded from the filter. The syntax is the same as for the <code>boards:</code> option above.<br>
    For example: <code>exclude:vg,v;</code>.
  </li>
  <li>
    Filter OPs only along with their threads (`only`) or replies only (`no`).<br>
    For example: <code>op:only;</code> or <code>op:no;</code>.
  </li>
  <li>
    Filter only posts with files (`only`) or only posts without files (`no`).<br>
    For example: <code>file:only;</code> or <code>file:no;</code>.
  </li>
  <li>
    Overrule the `Show Stubs` setting if specified: create a stub (`yes`) or not (`no`).<br>
    For example: <code>stub:yes;</code> or <code>stub:no;</code>.
  </li>
  <li>
    Highlight instead of hiding. You can specify a class name to use with a userstyle.<br>
    For example: <code>highlight;</code> or <code>highlight:wallpaper;</code>.
  </li>
  <li>
    Highlighted OPs will have their threads put on top of the board index by default.<br>
    For example: <code>top:yes;</code> or <code>top:no;</code>.
  </li>
  <li>Show a desktop notification instead of hiding: <code>notify;</code>.</li>
  <li>Hide all posts from this poster: <code>poster;</code>.</li>
  <li>Recursively hide replies: <code>replies;</code>.</li>
  <li>Hide anyway even if highlighting. The highlight class will be applied to the stub: <code>hide;</code>.</li>
  <li>
    Filters in the "General" section apply to multiple fields, by default <code>subject,name,filename,comment</code>.<br>
    The fields can be specified with the <code>type</code> option, separated by commas.<br>
    For example: <code id="filterTypes"></code>.<br>
    Types can also be combined with a <code>+</code> sign; this indicates the filter applies to the given fields joined by newlines.<br>
    For example: <code>type:filename+filesize+dimensions;</code>.<br>
  </li>
</ul>
```

### src/General/Settings/Filter-select.html

```html
<label class="filter-enabled"><input type="checkbox" name="Filter"> Enable filtering (reload required)</label>
<select name="filter" aria-label="Filter field">
  <option value="guide">Guide</option>
  <option value="general" selected>General</option>
  <option value="postID">Post number</option>
  <option value="name">Name</option>
  <option value="uniqueID">Unique ID</option>
  <option value="tripcode">Tripcode</option>
  <option value="capcode">Capcode</option>
  <option value="pass">Pass Date</option>
  <option value="email">Email</option>
  <option value="subject">Subject</option>
  <option value="comment">Comment</option>
  <option value="flag">Flag</option>
  <option value="filename">Filename</option>
  <option value="dimensions">Image dimensions</option>
  <option value="filesize">Filesize</option>
  <option value="MD5">Image MD5</option>
  </select>
<div></div>
```

### src/General/Settings/Keybinds.html

```html
<div class="warning"><code>Keybinds</code> are disabled.</div>
<div>Allowed keys: <kbd>a-z</kbd>, <kbd>0-9</kbd>, <kbd>Ctrl</kbd>, <kbd>Shift</kbd>, <kbd>Alt</kbd>, <kbd>Meta</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>, <kbd>Up</kbd>, <kbd>Down</kbd>, <kbd>Right</kbd>, <kbd>Left</kbd>.</div>
<div>Press <kbd>Backspace</kbd> to disable a keybind.</div>
<table><tbody>
  <tr><th>Actions</th><th>Keybinds</th></tr>
</tbody></table>
<button type="button" id="reset-keys">Reset keybinds</button>
```

### src/General/Settings/Sauce.html

```html
<div class="warning"><code>Sauce</code> is disabled.</div>
<input id="sauce-doc-expand" type="checkbox" hidden>
<div id="sauce-doc">
  <label for="sauce-doc-expand">[expand]</label>
  <div>These parameters will be replaced by their corresponding values in the URL and displayed text:</div>
  <ul>
    <li><code>%IMG</code>: Full image URL for GIF, JPG, and PNG; thumbnail URL for other types.</li>
    <li><code>%URL</code>: Full image URL.</li>
    <li><code>%TURL</code>: Thumbnail URL.</li>
    <li><code>%name</code>: Original file name.</li>
    <li><code>%board</code>: Current board.</li>
    <li><code>%MD5</code>: MD5 hash in base64.</li>
    <li><code>%sMD5</code>: MD5 hash in base64 using <code>-</code> and <code>_</code>.</li>
    <li><code>%hMD5</code>: MD5 hash in hexadecimal.</li>
    <li><code>%$0</code>: Matched regular expression within the filename.</li>
    <li><code>%$1</code>, <code>%$2</code>, <code>%$3</code>, ... : Subexpressions within the matched regular expression.</li>
    <li><code>%%</code>, <code>%semi</code>: Literal <code>%</code> and <code>;</code>.</li>
  </ul>
  <div>Lines starting with a <code>#</code> will be ignored.</div>
  <div>You can specify a display text by appending <code>;text:[text]</code> to the URL.</div>
  <div>You can specify the applicable boards/sites by appending <code>;boards:[board1],[board2]</code>. See the Filter guide for details.</div>
  <div>You can specify the applicable file types by appending <code>;types:[extension1],[extension2]</code>.</div>
  <div>You can specify a regular expression the filename must match by appending <code>;regexp:[regular expression]</code>.</div>
</div>
<textarea hidden name="sauces" class="field" spellcheck="false"></textarea>
```

### src/Images/Gallery/Gallery.html

```html
<div class="gal-viewport">
  <span class="gal-buttons">
    <a href="javascript:;" class="gal-start" title="Start slideshow"><i></i></a>
    <a href="javascript:;" class="gal-stop" title="Stop slideshow"><i></i></a>
    <a href="javascript:;" class="menu-button"><i></i></a>
    <a href="javascript:;" class="gal-close">×</a>
  </span>
  <div class="gal-labels">
    <span class="gal-count">
      <span class="count"></span> / <span class="total"></span>
    </span>
    <a class="gal-name" target="_blank"></a>
    <span class="gal-sauce"></span>
  </div>
  <div class="gal-prev"></div>
  <div class="gal-image">
    <a href="javascript:;"><img></a>
  </div>
  <div class="gal-next"></div>
</div>
<div class="gal-thumbnails"></div>
```

### src/Linkification/Embedding/Embed.html

```html
<div class="move">
  <a href="javascript:;" class="jump" title="Jump to post">→</a>
  <a href="javascript:;" class="close" title="Close">×</a>
</div>
<div id="media-embed"><div></div></div>
```

### src/Miscellaneous/Report/ArchiveReport.html

```html
<legend><label><input id="archive-report-enabled" type="checkbox">Report illegal content to archives</label></legend>
<label for="archive-report-reason">Details</label>
<textarea id="archive-report-reason" disabled>Illegal content</textarea>
<button id="archive-report-submit" hidden>Submit</button>
```

### src/Monitoring/ThreadWatcher/ThreadWatcher.html

```html
<div class="move">
  Thread Watcher <a class="refresh" title="Check threads" href="javascript:;" title="refresh"></a>
  <span id="watcher-status"></span>
  <a class="menu-button" href="javascript:;"></a>
  <a class="close" href="javascript:;">×</a>
</div>
<div id="watched-threads"></div>
```

### src/Posting/QR/QuickReply.html

```html
<div class="move">
  <label>
    <input type="checkbox" id="autohide" title="Auto-hide">
    Quick Reply
  </label>
  <a href="javascript:;" class="close" title="Close">✕</a>
  <select data-name="thread" title="Create a new thread / Reply">
    <option value="new">New thread</option>
  </select>
</div>
<form>
  <div class="persona">
    <button type="button" id="sjis-toggle" class="qr-button" title="Toggle Mona font">∀</button>
    <button type="button" id="tex-preview-button" class="qr-button" title="Preview TeX">T<sub>E</sub>X</button>
    <input name="name" data-name="name" list="list-name" placeholder="Name" class="field" size="1">
    <input name="email" data-name="email" list="list-email" placeholder="Options" class="field" size="1">
    <input name="sub" data-name="sub" list="list-sub" placeholder="Subject" class="field" size="1" maxlength="100">
  </div>
  <div class="textarea">
    <textarea data-name="com" placeholder="Comment" class="field"></textarea>
    <span id="char-count"></span>
    <div id="tex-preview"></div>
  </div>
  <div id="dump-list-container">
    <div id="dump-list"></div>
    <a id="add-post" href="javascript:;" title="Add a post">+</a>
  </div>
  <div class="oekaki" hidden>
    <input type="button" id="qr-draw-button" class="qr-button" value="Draw">
    <label><span>Width:</span><input name="oekaki-width" value="400" type="number" class="field" size="1"></label>
    <label><span>Height:</span><input name="oekaki-height" value="400" type="number" class="field" size="1"></label>
    <span class="oekaki-bg" title="Background Color"><input name="oekaki-bg" type="checkbox" checked><input name="oekaki-bgcolor" type="color" value="#ffffff"></span>
  </div>
  <div id="file-n-submit">
    <span id="qr-file" class="row">
      <input type="button" id="qr-file-button" class="qr-button" value="Files">
      <span id="qr-filename-container" class="field">
        <span id="qr-no-file">No selected file</span>
        <input id="qr-filename" data-name="filename" spellcheck="false">
        <label id="qr-spoiler-label">
          <input type="checkbox" id="qr-file-spoiler" title="Spoiler image">
          <a class="checkbox-letter">S</a>
        </label>
      </span>
    </span>
    <span id="qr-actions-container" class="row space">
      <span id="qr-actions" class="row">
        <a href="javascript:;" id="qr-oekaki-button" class="qr-action-button" title="Edit in Tegaki">✎︎</a>
        <a href="javascript:;" id="qr-jpg" class="qr-action-button" title="Compress to jpg">C</a>
        <a href="javascript:;" id="qr-view" class="qr-action-button" title="Preview">V</a>
        <a href="javascript:;" id="qr-randomize" class="qr-action-button" title="Randomize filename">R</a>
        <a href="javascript:;" id="qr-restore-name" class="qr-action-button" title="Reset filename">U</a>
        <a href="javascript:;" id="qr-filerm" class="qr-action-button" title="Remove file">✕</a>
        <a href="javascript:;" id="url-button" class="qr-action-button" title="Post from URL">🔗︎</a>
        <a href="javascript:;" hidden id="paste-area" class="qr-action-button" title="Select to paste images" tabindex="-1" contentEditable="true">📋︎</a>
        <a href="javascript:;" id="custom-cooldown-button" class="qr-action-button" title="Toggle custom cooldown" class="disabled">🕒︎</a>
        <a href="javascript:;" id="split-post" class="qr-action-button" title="Split into multiple posts" hidden>✂️</a>
        <a href="javascript:;" id="dump-button" class="qr-action-button" title="Dump list">➕︎</a>
      </span>
      <input class="qr-button" type="submit">
    </span>
  </div>
  <select data-default="4" name="filetag">
    <option value="0">Hentai</option>
    <option value="6">Porn</option>
    <option value="1">Japanese</option>
    <option value="2">Anime</option>
    <option value="3">Game</option>
    <option value="5">Loop</option>
    <option value="4" selected>Other</option>
  </select>
  <input type="file" multiple>
</form>
<datalist id="list-name"></datalist>
<datalist id="list-email"></datalist>
<datalist id="list-sub"></datalist>
```

## Appendix G. Exact stylesheet resources

Apply the shared style and variable base together with the matching site theme and appropriate auxiliary-page styles. Inline relative image URLs using the binary resource table. Apply user CSS after defaults so user overrides win. These resources preserve detailed sizing, colors, states, responsive rules and selector contracts that a visual summary cannot capture.

### src/Icons/icons.css

```css
/* Icons */
svg.icon {
  height: 1em;
  width: 1em;
  display: inline-flex;
  vertical-align: -.125em;
}
/* Override catalog.css */
:root.catalog svg.icon {
  position: static;
}
:root.shortcut-icons #shortcuts .icon--alt-text,
:root:not(.shortcut-icons) .shortcut .icon {
  display: none;
}
:root.shortcut-icons .shortcut.brackets-wrap::before,
:root.shortcut-icons .shortcut.brackets-wrap::after {
  display: none;
}
@keyframes spin {
  100% {transform:rotate(1turn)}
}
```

### src/Linkification/Embedding/FxTwitter.css

```css
:root {
  --xt-fxt-bg: var(--xt-background);
  --xt-fxt-border: var(--xt-border);
}

.fxt-card {
  color: var(--xt-fxt-fg, #000);
  background-color: var(--xt-fxt-bg, #D6DAF0);
  padding: 16px;
  border: 1px solid var(--xt-fxt-border, #B7C5D9);
  border-radius: 12px;
  gap: 8px;
  width: 550px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  grid-template-rows: max-content max-content max-content;
  grid-template-areas:
    "meta meta"
    "content content"
    "stats stats"
}
.fxt-meta {
  display: flex;
  flex-direction: row;
  gap: 8px;
  grid-area: meta;
}
.fxt-meta_profile {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.fxt-meta_avatar {
  display: flex;
  align-items: center;
}
.fxt-meta_profile img {
  height: 48px;
  width: 48px;
  aspect-ratio: 1;
  border-radius: 100%;
  background-color: var(--xt-fxt-border, #B7C5D9);
}
.fxt-meta_author {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
}
.fxt-meta_author_username {
  font-weight: bold;
}
.fxt-stats_meta {
  padding-top: 8px;
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  gap: 8px;
}
.fxt-stats_meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fxt-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  grid-area: content;
}
.fxt-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.fxt-poll {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fxt-choice {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 75%;
  height: 24px;
}
.fxt-choice.highlight {
  font-weight: bold;
}

.fxt-choice_label {
  margin-left: 6px;
  z-index: 1;
}
.fxt-choice_percentage {
  margin-right: 6px;
  z-index: 1;
}
.fxt-choice .fxt-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 24px;
  border-radius: 4px;
  background-color: currentColor;
  opacity: .3;
  z-index: 0;
}

.fxt-total-votes {
  font-size: 75%;
  opacity: .5;
}
.fxt-media {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  overflow: hidden;
}
.fxt-media_container {
  --maxHeightMedia: 300px;
}
.fxt-media_container :is(img, video) {
  display: block;
  width: 100%;
  height: 100%;
  max-height: var(--maxHeightMedia);
  max-width: none;
  object-fit: contain;
  object-position: center;
}
.fxt-media_container {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: auto;
  grid-auto-flow: dense;
  aspect-ratio: 16 / 9;
}
.fxt-media_container .fxt-media:only-child {
  grid-column: span 2 / auto;
  grid-row: span 2 / auto;
}
.fxt-media_contains_3 .fxt-media:first-child {
  grid-row: span 2 / auto;
}
.fxt-media_contains_3 .fxt-media :is(img, video) {
  max-height: calc(var(--maxHeightMedia) / 2);
}
.fxt-media_contains_3 .fxt-media:first-child :is(img, video) {
  max-height: calc(var(--maxHeightMedia) + 4px);
  /* weird spacing even though img/video has block... */
}
.fxt-media_video {
  background-color: #000;
}
.fxt-tweet-quote {
  width: fit-content;
  padding: 8px;
}
.fxt-tweet-quote .fxt-meta_profile img {
  height: 24px;
  width: 24px;
}
.fxt-tweet-quote .fxt-meta_author {
  font-size: 80%;
}
.fxt-tweet-quote .fxt-meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 4px;
}
.fxt-community_note {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--xt-fxt-border, #B7C5D9);
  border-radius: .25rem;
}
.fxt-community_note-header {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .25rem .5rem;
  background-color: var(--xt-fxt-border, #B7C5D9);
}
.fxt-community_note-text {
  padding: .5rem;
  white-space: pre-wrap;
}
.fxt-tweet-reply {
  grid-template-areas:
    "meta meta"
    "line content"
    "line stats"
}
.fxt-tweet-reply::before {
  grid-area: line;
  content: '';
  display: block;
  background-color: var(--xt-fxt-border, #B7C5D9);
  height: calc(100% + 18px);
  width: 5px;
  margin: auto;
  position: relative;
  top: -5px;
}
.fxt-stats {
  grid-area: stats;
}
.fxt-reply_container>.fxt-tweet-reply,
.fxt-reply_container+.fxt-tweet-original {
  border: 0;
  border-radius: 0;
  padding-top: 8px;
  padding-bottom: 8px;
}
.fxt-reply_container>.fxt-tweet-reply:first-child {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  border: 1px solid var(--xt-fxt-border, #B7C5D9);
  border-bottom: 0;
}
.fxt-reply_container>.fxt-tweet-reply:not(:first-child) {
  border: 1px solid var(--xt-fxt-border, #B7C5D9);
  border-top: 0;
  border-bottom: 0;
}
.fxt-reply_container+.fxt-tweet-original {
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  border: 1px solid var(--xt-fxt-border, #B7C5D9);
  border-top: 0;
}
.fxt-text_translated-label,
.fxt-stats {
  color: var(--xt-dead-link);
}
.fxt-card:is(.warning, .loading) {
  display: flex;
}
.fxt-card_container {
  max-block-size: 90dvh;
  overflow: hidden auto;
  scrollbar-width: thin;
  width: fit-content;
}
```

### src/config/user.css

```css
/* Board title rice */
div.boardTitle {
  font-weight: 400 !important;
}
:root.yotsuba div.boardTitle {
  font-family: sans-serif !important;
  text-shadow: 1px 1px 1px rgba(100,0,0,0.6);
}
:root.yotsuba-b div.boardTitle {
  font-family: sans-serif !important;
  text-shadow: 1px 1px 1px rgba(105,10,15,0.6);
}
:root.photon div.boardTitle {
  font-family: sans-serif !important;
  text-shadow: 1px 1px 1px rgba(0,74,153,0.6);
}
:root.tomorrow div.boardTitle {
  font-family: sans-serif !important;
  text-shadow: 1px 1px 1px rgba(167,170,168,0.6);
}
```

### src/css/burichan.css

```css
:root.burichan {
  --xt-background: #D6DAF0;
  --xt-border: #B7C5D9;
  --xt-border-field-focus: #98E;
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-header-dialog-bg: rgba(214, 218, 240, 0.98);
  --xt-notification-size: 11pt;
  --xt-header-dialog-fg: #89A;
  --xt-header-link: #34345C;
  --xt-dead-link: #34345C;
  --xt-qr-link-border: rgb(199, 203, 225) rgb(199, 203, 225) rgb(184, 188, 210);
  --xt-qr-bg: linear-gradient(#E5E9FF, #D6DAF0) repeat scroll 0% 0% transparent;
  --xt-menu-fg: #000;
  --xt-entry-size: 12pt;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-link-hover-bg: #D9DDF3;
  --xt-unread: rgba(214, 218, 240, 0.5);
}

/* Anonymize */
:root.burichan.anonymize $site$info$name::before {
  font-size: 12pt;
}
```

### src/css/futaba.css

```css
:root.futaba {
  --xt-background: #F0E0D6;
  --xt-border: #D9BFB7;
  --xt-border-field-focus: #EA8;
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-notification-size: 11pt;
  --xt-header-dialog-fg: #B86;
  --xt-dead-link: #00E;
  --xt-header-dialog-bg: rgba(240,224,214,0.98);
  --xt-header-link: #800000;
  --xt-qr-link-border: rgb(225, 209, 199) rgb(225, 209, 199) rgb(210, 194, 184);
  --xt-qr-bg: linear-gradient(#FFEFE5, #F0E0D6) repeat scroll 0% 0% transparent;
  --xt-entry-size: 12pt;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-unread: rgba(240, 224, 214, 0.5);
  --xt-watcher: #800000;

  --xt-fxt-fg: #800000;
}

/* Anonymize */
:root.futaba.anonymize $site$info$name::before {
  font-size: 12pt;
}
```

### src/css/photon.css

```css
:root.photon {
  --xt-background: #DDD;
  --xt-border: #CCC;
  --xt-border-field-focus: #EA8;
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-header-dialog-bg: rgba(221, 221, 221, 0.98);
  --xt-header-dialog-fg: #333;
  --xt-dead-link: #F60;
  --xt-qr-link-border: rgb(206, 206, 206) rgb(206, 206, 206) rgb(191, 191, 191);
  --xt-qr-bg: linear-gradient(#ECECEC, #DDD) repeat scroll 0% 0% transparent;
  --xt-menu-fg: #333;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-unread: rgba(221, 221, 221, 0.5);
  --xt-watcher-quoting-you: #00F;
  --xt-watcher: #333;

  --xt-fxt-fg: #333;
}

/* 4chan style fixes */
:root.photon #arc-list tr:nth-of-type(odd) span.quote {
  color: #C0E17A;
}
```

### src/css/report.css

```css
#g-recaptcha,
:root:not(.js-enabled) #captchaContainerAlt {
  height: auto;
}
#captchaContainerAlt td:nth-child(2) {
  display: table-cell !important;
}

/* Archive reports */
#archive-report {
  padding: 3px;
}
#archive-report-enabled {
  vertical-align: middle;
}
#archive-report > label {
  display: block;
}
#archive-report-reason {
  display: block;
  width: 98%;
}
.archive-report-success {
  color: green;
}
.archive-report-error {
  color: red;
}
```

### src/css/spooky.css

```css
:root.spooky {
  --xt-background: #171526;
  --xt-link-hover-bg: #1A1829;
  --xt-border: #707070;
  --xt-border-field-focus: #98E;
  --xt-border-highlight: rgba(145, 182, 214, .8);
  --xt-header-dialog-bg: rgba(23, 21, 38, 0.98);
  --xt-header-dialog-fg: #C49756;
  --xt-header-link: #FE9600;
  --xt-dead-link: #FE9600;
  --xt-qr-link-border: rgb(8, 6, 23) rgb(8, 6, 23) rgb(0, 0, 8);
  --xt-qr-bg: linear-gradient(#262435, #171526) repeat scroll 0% 0% transparent;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-unread: rgba(23, 21, 38, 0.5);
  --xt-watcher: #fe9600;

  --xt-unread-line: rgb(197, 200, 198);
  --xt-filter-highlight: rgba(145, 182, 214, .5);
  --xt-qphl: rgba(145, 182, 214, .8);
  --xt-highlight-side-arrow: rgb(155, 185, 210);

  --xt-fxt-fg: #f0f8ffd1;
}

/* 4chan style fixes */
:root.spooky #arc-list span.quote {
  color: #634C2C;
}

:root.spooky.shortcut-icons .native-settings {
  background-image: url('//s.4cdn.org/image/favicon-ws.ico');
}

:root.spooky #qr .field {
  background-color: rgb(26, 27, 29);
  color: rgb(197,200,198);
  border-color: rgb(40, 41, 42);
}
:root.spooky #qr .field:focus,
:root.spooky #qr .field.focus {
  border-color: rgb(254, 150, 0) !important;
  background-color: rgb(30,32,36);
}
:root.spooky #qr select {
  border-color: rgb(40, 41, 42);
  background: unset;
}
:root.spooky #qr-filename {
  color: rgb(197,200,198);
}

/* Unread */
:root.spooky .unread-line {
  visibility: visible;
  opacity: 1;
}
```

### src/css/style.css

```css
/* General */
.dialog {
  border: 1px solid;
  display: block;
  background-color: inherit;
}
.dialog:not(#qr):not(#thread-watcher):not(#header-bar) {
  box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
}
#qr,
#thread-watcher {
  box-shadow: -1px 2px 2px rgba(0, 0, 0, 0.25);
}
.field {
  background-color: #FFF;
  padding: 2px 4px 3px;
  border: 1px solid #CCC;
  box-sizing: border-box;
  color: #333;
  font: 13px sans-serif;
  outline: none;
  margin: 0px;
  transition: color .25s, border-color .25s;
}
.field::placeholder {
  color: #AAA;
  opacity: 1;
}
.field:hover {
  border-color: #999;
}
.field:hover, .field:focus, .field.focus {
  color: #000;
}
.field[disabled] {
  background-color: #F2F2F2;
  color: #888;
}
.move {
  cursor: move;
  overflow: hidden;
}
label {
  cursor: pointer;
}
a[href="javascript:;"] {
  text-decoration: none;
}
.warning {
  color: red;
}
:root.sw-yotsuba #boardNavDesktop, :root.sw-yotsuba #boardNavMobile {
  display: none !important;
}
:root.hide-bottom-board-list $site$boardListBottom {
  display: none;
}
body.hasDropDownNav{
  margin-top: 5px;
}
.painted {
  border-radius: 3px;
  padding: 0px 2px;
}
[hidden] {
  display: none !important;
}

/* 4chan style fixes */
/* overrides 4chan CSS on div.opContainer, div.op */
:root.sw-yotsuba .opContainer, :root.sw-yotsuba .op {
  display: block;
  overflow: visible;
}
:root.sw-yotsuba .reply > .file > .fileText {
  margin: 0 20px;
}
:root.sw-yotsuba #arc-list span.quote {
  color: #789922;
}
:root.sw-yotsuba .fileText a {
  unicode-bidi: isolate;
}
:root.sw-yotsuba #g-recaptcha {
  min-height: 78px;
  height: auto;
}
:root.sw-yotsuba:not(.js-enabled) #postForm {
  display: table;
}
:root.sw-yotsuba #captchaContainerAlt td:nth-child(2) {
  display: table-cell !important;
}
:root.sw-yotsuba canvas#tegaki-canvas {
  background: none;
}
/* Disable obnoxious captcha fade-in. */
:root.sw-yotsuba > body > div:last-of-type {
  transition: none !important;
}
/* Fix captcha scrolling to top of page. */
:root.sw-yotsuba > body > div[style*=" top: -10000px;"] {
  visibility: hidden !important;
}
/* Make long filenames wrap properly: https://github.com/ccd0/4chan-x/issues/1082 */
:root.sw-yotsuba .post > .file {
  word-break: break-word;
}
:root.sw-yotsuba:not(.ua-webkit):not(.ua-blink) .fileText {
  word-wrap: break-word;
  max-width: calc(100vw - 90px);
}
:root.sw-yotsuba > body.is_catalog .thread > a > img {
  display: inline-block;
}
/* Links to NSFW boards */
:root.sw-yotsuba .nwsb {
  display: inline;
}
:root.sw-yotsuba .fileText {
  max-width: auto;
  white-space: normal;
}

/* Ads */
:root.sw-yotsuba .ad-cnt > *, :root.sw-yotsuba .adg-rects > *, :root.sw-yotsuba .bsa-cnt {
  height: auto !important;
}
:root.sw-yotsuba:not(.ads-loaded) hr.abovePostForm,
:root.sw-yotsuba:not(.ads-loaded) .adg-rects > hr,
:root.sw-yotsuba #adg-ol + hr,
:root.sw-yotsuba .danbo-slot:empty {
  display: none;
}
:root.sw-yotsuba .adg-rects {
  margin: 0;
  font-size: 0;
}
:root.sw-yotsuba div.center[style] {
  display: none !important;
}

/* Tinyboard / vichan conflicts */
#menu > .hide-thread-link {
  width: auto;
  height: auto;
  overflow: visible;
  background-image: none;
}
#menu label.entry {
  display: block;
}
#fourchanx-settings label {
  display: inline;
}
.intro a[href="javascript:;"],
#menu a {
  margin: 0;
}
.gal-buttons.gal-buttons a {
  font-size: inherit;
}
:root.sw-tinyboard.fixed.top-header:not(.autohide) .boardlist,
:root.sw-tinyboard.fixed.top-header:not(.autohide) .bar.top {
  position: static;
}
:root.sw-tinyboard.fixed.top-header:not(.autohide) div.pages.top {
  top: auto;
  bottom: 0;
}
:root.sw-tinyboard.fixed.top-header.autohide .boardlist,
:root.sw-tinyboard.fixed.top-header.autohide .bar.top {
  z-index: 3;
}

/* Tinyboard site style conflicts */
:root[data-host="fufufu.moe"].fixed.top-header:not(.autohide) div.pages.top {
  top: 26px;
  bottom: auto;
}
:root[data-host="merorin.com"].fixed.top-header:not(.autohide) span.settings {
  top: 26px;
}
:root[data-host="fufufu.moe"]:not(.fixed) #header-bar {
  margin-top: 38px;
}
:root[data-host="lainchan.org"]:not(.fixed) #header-bar {
  margin-top: 17px;
}
:root[data-host="smuglo.li"]:not(.fixed) #header-bar {
  margin-top: 8px;
}

/* Anti-autoplay */
audio.controls-added {
  display: block;
  margin: auto;
  white-space: normal;
}
:root.anti-autoplay div.embed {
  position: static;
  width: auto;
  height: auto;
  text-align: center;
}
:root.anti-autoplay .autoplay-removed {
  visibility: visible !important;
  min-width: 640px;
  min-height: 360px;
}

/* fixed, z-index */
#overlay,
#qp, #ihover,
#navlinks, .fixed #header-bar,
:root.float #updater,
:root.float #thread-stats,
#qr,
#export-dialog {
  position: fixed;
}
#overlay {
  z-index: 999;
}
#qp, #ihover {
  z-index: 60;
}
#menu, .gal-buttons {
  z-index: 50;
}
#updater, #thread-stats {
  z-index: 40;
}
:root.fixed #header-bar, #notifications {
  z-index: 35;
}
#a-gallery {
  z-index: 30;
}
#navlinks {
  z-index: 25;
}
#qr {
  z-index: 20;
}
#embedding {
  z-index: 11;
}
#export-dialog {
  z-index: 1001;
}
:root.fixed-watcher #thread-watcher {
  z-index: 10;
}
:root.fixed:not(.gallery-open) #header-bar:not(:hover) {
  z-index: 8;
}
#thread-watcher {
  z-index: 5;
}

/* Header */
.fixed.top-header body {
  padding-top: 2em;
}
.fixed.bottom-header body {
  padding-bottom: 2em;
}
.fixed #header-bar {
  right: 0;
  left: 0;
  padding: 4px;
  font-size: 13px;
}
.fixed.top-header #header-bar {
  top: 0;
}
.fixed.bottom-header #header-bar {
  bottom: 0;
}
#header-bar {
  border-width: 0;
  transition: all .1s .05s ease-in-out;
}
:root.fixed #header-bar {
  box-shadow: -5px 1px 10px rgba(0, 0, 0, 0.20);
}
:root.centered-links #shortcuts {
  width: 300px;
  text-align: right;
  justify-content: right;
}
:root.centered-links #header-bar {
  text-align: center;
}
:root.centered-links #custom-board-list {
  position: relative;
  left: 150px;
}
.fixed.top-header #header-bar {
  border-bottom-width: 1px;
}
.fixed.bottom-header #header-bar {
  box-shadow: 0 -1px 2px rgba(0, 0, 0, .15);
  border-top-width: 1px;
}
.fixed.bottom-header #header-bar .menu-button .icon {
  transform: rotate(180deg) translateY(-.125em);
}
.fixed #header-bar.autohide:not(:hover) {
  box-shadow: none;
  transition: all .8s .6s cubic-bezier(.55, .055, .675, .19);
}
.fixed.top-header #header-bar.autohide:not(:hover) {
  margin-bottom: -1em;
  transform: translateY(-100%);
}
.fixed.bottom-header #header-bar.autohide:not(:hover) {
  transform: translateY(100%);
}
#scroll-marker {
  left: 0;
  right: 0;
  height: 10px;
  position: absolute;
}
#header-bar:not(.autohide) #scroll-marker {
  pointer-events: none;
}
#header-bar #scroll-marker {
  display: none;
}
.fixed #header-bar #scroll-marker {
  display: block;
}
.fixed.top-header #header-bar #scroll-marker {
  top: 100%;
}
.fixed.bottom-header #header-bar #scroll-marker {
  bottom: 100%;
}
#board-list a {
  text-decoration: none;
  padding: 1px;
}
#shortcuts:empty {
  display: none;
}
.dead-thread,
.disabled:not(.replies-quoting-you) {
  opacity: .45;
}
#shortcuts {
  float: right;
  display: flex;
  gap: 4px;
}
#shortcuts .icon {
  font-size: 14px;
}
:root.autohiding-scrollbar #shortcuts {
  margin-right: 12px;
}
:root.shortcut-icons .native-settings {
  font-size: 0;
  color: transparent;
  display: inline-block;
  vertical-align: top;
  height: 14px;
  width: 14px;
  background: url('//s.4cdn.org/image/favicon.ico') -1px -1px no-repeat;
}
#navbotright,
#navtopright {
  display: none;
}
#toggleMsgBtn {
  display: none !important;
}
.current,
:root.sw-yotsuba div#boardNavDesktopFoot a.current {
  font-weight: bold;
}
/* 4chan X link brackets */
.brackets-wrap::before {
  content: "[";
}
.brackets-wrap::after {
  content: "]";
}
/* Notifications */
#notifications {
  position: fixed;
  top: 0;
  height: 0;
  text-align: center;
  right: 0;
  left: 0;
  visibility: visible;
}
#notifications:empty {
  display: none;
}
:root.fixed.top-header:not(.gallery-open) #header-bar #notifications,
:root.fixed.top-header #header-bar.autohide #notifications {
  position: absolute;
  top: 100%;
}
.notification {
  color: #FFF;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .5);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
  border-radius: 2px;
  margin: 1px auto;
  width: 550px;
  max-width: 100%;
  position: relative;
  transition: all .25s ease-in-out;
  padding: 6px 5px 6px 20px;
  display: flex;
  gap: 5px;
  align-items: center;
}
.notification.error {
  background-color: hsla(0, 100%, 38%, .9);
}
.notification.warning {
  background-color: hsla(36, 100%, 38%, .9);
}
.notification.info {
  background-color: hsla(200, 100%, 38%, .9);
}
.notification.success {
  background-color: hsla(104, 100%, 38%, .9);
}
.notification a {
  color: white;
}
.notification > .close {
  order: 1;
}
.message {
  overflow-wrap: break-word;
  box-sizing: border-box;
  padding: 0 5px;
  max-height: 200px;
  width: 100%;
  overflow: auto;
  white-space: pre-line;
}
.message a {
  text-decoration: underline;
}
:root.tainted .report-error {
  display: none;
}

/* Settings */
:root.fourchan-x body {
  box-sizing: border-box;
}
#overlay {
  background-color: rgba(0, 0, 0, .5);
  display: flex;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
}
#fourchanx-settings {
  box-sizing: border-box;
  box-shadow: 0 0 15px rgba(0, 0, 0, .15);
  height: 600px;
  max-height: 100%;
  width: 900px;
  max-width: 100%;
  margin: auto;
  padding: 5px;
  display: flex;
  flex-direction: column;
}
#fourchanx-settings > nav {
  padding: 2px 2px 8px;
  display: flex;
}
#fourchanx-settings > nav a {
  text-decoration: underline;
}
#fourchanx-settings > nav a.close {
  text-decoration: none;
  padding: 0 2px;
  margin: 0;
}
.section-container {
  flex: 1;
  position: relative;
  overflow: auto;
  padding-right: 5px;
  overscroll-behavior: contain;
}
.sections-list {
  flex: 1;
}
.export, .import, .reset {
  cursor: pointer;
  text-decoration: none !important;
}
.tab-selected {
  font-weight: 700;
}
.section-sauce ul,
.section-advanced ul {
  list-style: none;
  margin: 0;
}
.section-sauce ul {
  padding: 8px;
}
.section-advanced ul {
  padding: 0px;
}
.section-sauce li,
.section-advanced li {
  padding-left: 4px;
}
.section-main ul {
  margin: 0;
  padding: 0 0 0 16px;
}
.section-main li {
  white-space: pre-line;
  list-style: disc;
}
.section-main li:not(:first-of-type) {
  margin-top: 4px;
}
.section-main label {
  text-decoration: underline;
}
div[data-checked="false"] > .suboption-list {
  display: none;
}
.suboption-list {
  position: relative;
}
.suboption-list::before {
  content: "";
  display: inline-block;
  position: absolute;
  left: .7em;
  width: 0;
  height: 100%;
  border-left: 1px solid;
}
.suboption-list > div {
  position: relative;
  padding-left: 1.4em;
}
.suboption-list > div::before {
  content: "";
  display: inline-block;
  position: absolute;
  left: .7em;
  width: .7em;
  height: .6em;
  border-left: 1px solid;
  border-bottom: 1px solid;
}
#fourchanx-settings .section-main p {
  margin: .5em 0 0;
}
.section-filter ul {
  padding: 0;
}
.section-filter li {
  margin: 10px 40px;
  list-style: disc;
}
.section-filter textarea {
  height: 500px;
}
.filter-builder, .filter-saved, .filter-raw {
  margin: 10px 0;
}
.filter-enabled {
  display: block;
  margin-bottom: 8px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  gap: 8px 12px;
  margin: 8px 0;
}
.filter-grid label, .filter-test > label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.filter-grid input:not([type="checkbox"]), .filter-grid select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.filter-grid .filter-check {
  flex-direction: row;
  align-items: center;
}
.filter-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 8px 0;
}
.filter-types[hidden] {
  display: none;
}
.filter-preview {
  display: block;
  font-family: monospace;
  overflow-wrap: anywhere;
  margin: 8px 0;
}
.filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-builder-error, .filter-diagnostics {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.filter-test {
  margin-top: 8px;
}
.section-filter .filter-test textarea {
  width: 100%;
  box-sizing: border-box;
  height: 80px;
}
.filter-rule-list {
  max-height: 240px;
  overflow: auto;
  margin: 6px 0;
}
.filter-rule-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 28px 28px;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(128, 128, 128, .3);
}
.filter-rule-row code {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.filter-rule-row button {
  width: 28px;
  height: 28px;
  padding: 3px;
}
.section-filter .filter-raw textarea {
  width: 100%;
  box-sizing: border-box;
  height: 220px;
  margin-top: 6px;
}
.filter-save-status {
  margin: 8px 0;
}
.section-main a, .section-filter a, .section-advanced a {
  text-decoration: underline;
}
#sauce-doc-expand:not(:checked) ~ #sauce-doc {
  max-height: 130px;
  overflow: auto;
}
#sauce-doc > label {
  float: right;
  margin: 0 5px;
}
/* XXX for OneeChan */
#sauce-doc-expand + .riceCheck {
  display: none;
}
.section-sauce textarea {
  height: 430px;
}
.section-advanced .field.wide {
  width: 100%;
}
.section-advanced textarea {
  height: 150px;
}
.section-advanced textarea[name="archiveLists"],
.section-advanced textarea[name="externalCatalogURLs"],
.section-advanced textarea[name="knownBanners"] {
  height: 75px;
}
.section-advanced .archive-cell {
  min-width: 160px;
  text-align: center;
}
.section-advanced #archive-board-select {
  position: absolute;
}
.section-advanced .note {
  font-size: 0.8em;
  font-style: italic;
  margin-left: 10px;
}
.section-advanced .note code {
  font-style: normal;
  font-size: 11px;
}
.favicon-preview > img {
    vertical-align: middle;
}
.favicon-preview > img:nth-of-type(3n+1) {
    margin-left: 4px;
}
.section-keybinds .field {
  font-family: monospace;
}
#fourchanx-settings fieldset {
  border: 1px solid;
  border-radius: 3px;
  padding: 0.35em 0.625em 0.75em;
  margin: 0px 2px;
}
#fourchanx-settings legend {
  font-weight: 700;
  color: inherit;
}
#fourchanx-settings textarea {
  font-family: monospace;
  width: 100%;
  resize: vertical;
}
#fourchanx-settings code {
  color: #000;
  background-color: #FFF;
  padding: 0 2px;
}
#fourchanx-settings th {
  text-align: center;
  font-weight: bold;
}
#fourchanx-settings p {
  margin: 1em 0px;
}
#fourchanx-settings table {
  margin: auto;
}

/* Index */
:root.index-loading .navLinks:not(.json-index),
:root.index-loading .board:not(.json-index),
:root.index-loading .pagelist:not(.json-index),
:root.infinite-mode .pagelist,
:root.all-pages-mode .pagelist,
:root.catalog-mode .pagelist,
:root:not(.catalog-mode) .indexlink,
:root.catalog-mode .cataloglink,
:root:not(.catalog-mode) #hidden-label,
:root:not(.catalog-mode) #index-size {
  display: none;
}
#index-search {
  padding-right: 1.5em;
  width: 100px;
  transition: color .25s, border-color .25s, width .25s;
}
#index-search:focus,
#index-search[data-searching] {
  width: 200px;
}
#index-search-clear {
  color: gray;
  position: relative;
  left: -1.5em;
}
#index-search::-webkit-search-cancel-button {
  display: none;
}
#index-search:not([data-searching]) + #index-search-clear {
  display: none;
}
#index-options {
  float: right;
}
#lastlong-options {
  display: inline-block;
  vertical-align: middle;
  height: 28px;
  margin: -14px 0;
}
#lastlong-options > input {
  padding: 0;
  border: 0 !important;
  text-align: center;
  background: transparent;
  display: block;
  font-size: 12px;
  height: 12px;
  width: 30px;
  margin: 1px 0;
}
.summary {
  text-decoration: none;
}

/* Catalog */
:root.catalog-mode .board {
  text-align: center;
}
.catalog-thread {
  display: inline-block;
  box-sizing: border-box;
  border: 1px solid transparent;
  word-wrap: break-word;
  vertical-align: top;
  position: relative;
}
/* overrides 4chan CSS on div.thread */
.catalog-thread.catalog-thread {
  margin: 2px;
}
.catalog-small > .catalog-thread {
  width: 165px;
  height: 320px;
}
.catalog-large > .catalog-thread {
  width: 270px;
  height: 410px;
}
:root.catalog-hover-expand .catalog-thread:hover {
  z-index: 1;
}
.catalog-container {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  bottom: 0;
}
.catalog-container:not(:hover),
:root:not(.catalog-hover-expand) .catalog-container {
  overflow: hidden;
}
.catalog-post {
  position: absolute;
  top: 4px;
  left: 0;
  right: 0;
  border: 1px solid transparent;
  padding-top: 20px;
}
/* overrides inline CSS from Index.cb.hoverAdjust */
:root:not(.catalog-hover-expand) .catalog-post {
  left: 0 !important;
  right: 0 !important;
}
/* overrides 4chan CSS on div.post */
.catalog-post.catalog-post {
  margin: -21px -1px -1px;
  overflow: visible;
}
.catalog-thread.noFile > * > .catalog-post {
  margin-top: -7px;
  padding-top: 6px;
}
:root.catalog-hover-expand .catalog-container:hover > .catalog-post {
  margin-left: -61px;
  margin-right: -61px;
}
:root.catalog-hover-expand .catalog-container:hover > * > :not(.catalog-replies) {
  padding-left: 2px;
  padding-right: 2px;
}
.catalog-link {
  display: block;
  position: relative;
}
.catalog-thumb {
  border-radius: 2px;
  box-shadow: 0 0 5px rgba(0, 0, 0, .25);
  vertical-align: top;
}
.catalog-thumb.spoiler-file {
  width: 100px;
  height: 100px;
}
.catalog-thumb.deleted-file {
  width: 127px;
  height: 13px;
  padding: 20px 11px;
}
.catalog-thumb.no-file {
  width: 77px;
  height: 13px;
  padding: 20px 36px;
}
.catalog-icons > img,
.catalog-stats > .menu-button {
  width: 1em;
  height: 1em;
  margin: 0;
  vertical-align: text-top;
  padding-left: 2px;
}
.catalog-stats > .menu-button > .icon {
  height: 10px;
}
.catalog-stats {
  font-size: 10px;
  font-weight: 700;
  padding-top: 2px;
}
.catalog-stats > [title] {
  cursor: help;
}
.catalog-post > .postMessage {
  margin: 0;
  padding-bottom: .3em;
}
.catalog-container:not(:hover) > * > .file,
.catalog-container:not(:hover) > * > .postInfo > :not(.subject),
.catalog-container:not(:hover) > * > .catalog-replies,
.catalog-container:not(:hover) .extra-linebreak,
.catalog-container:not(:hover) .abbr,
:root:not(.catalog-hover-expand) .catalog-container > * > .file,
:root:not(.catalog-hover-expand) .catalog-container > * > .postInfo > :not(.subject),
:root:not(.catalog-hover-expand) .catalog-container > * > .catalog-replies,
:root:not(.catalog-hover-expand) .catalog-container .extra-linebreak,
:root:not(.catalog-hover-expand) .catalog-container .abbr,
.catalog-thread > .catalog-container > :not(.catalog-post),
.preview-summary,
.catalog-post > .file > :not(.fileText),
.catalog-post > * > .fileText > :not(:first-child),
.catalog-post > .postInfo > :not(.subject):not(.nameBlock):not(.dateTime),
.catalog-post > .postInfo > .nameBlock > .contact-links,
.catalog-post > * > * > .posteruid,
.catalog-post > * > * > .postJumper,
:root.bottom-backlinks .catalog-post > .container,
.post:not(.catalog-post) > .catalog-link,
.post:not(.catalog-post) > .catalog-stats,
.post:not(.catalog-post) > .catalog-replies {
  display: none;
}
.catalog-post > .file {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  min-height: 20px;
  background-color: inherit;
}
.catalog-post > * > .fileText {
  position: relative;
  padding: 2px;
  background-color: inherit;
}
.catalog-small .catalog-post > * .fileText {
  font-size: 10px;
}
.catalog-post > * > .fileText:not(:hover) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.catalog-post > * > .fileText:hover {
  z-index: 1;
}
/* overrides 4chan CSS on div.post div.postInfo */
.catalog-post > .postInfo.postInfo {
  width: auto;
}
.catalog-post > * > .subject {
  display: block;
}
.catalog-post > * > .dateTime {
  display: inline-block;
  font-style: italic;
}
:root.catalog-hover-expand .catalog-container:hover > * > * > .nameBlock,
:root.catalog-hover-expand .catalog-container:hover > * > * > .dateTime,
:root.catalog-hover-expand .catalog-container:hover > * > .postMessage:not(:empty) {
  padding-top: .3em;
}
.catalog-post .extra-linebreak {
  content: ''; /* makes this work in Blink/WebKit */
  display: block;
  margin-top: .3em;
}
.catalog-reply {
  text-align: left;
  white-space: nowrap;
  border-top: 1px solid transparent;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}
.catalog-reply > * {
  padding: 3px;
  overflow: hidden;
  flex: none;
}
.catalog-reply > span {
  font-style: italic;
  font-weight: bold;
}
.catalog-reply-excerpt {
  flex: 1 1 auto;
}
.catalog-post .prettyprinted {
  max-width: 100%;
  box-sizing: border-box;
}
.catalog-post .MathJax_Display {
  text-align: center !important;
}
.catalog-container:not(:hover) .exif,
:root:not(.catalog-hover-expand) .catalog-container .exif {
  display: none !important;
}
.catalog-post > * > .exif {
  border-collapse: collapse;
}
:root.catalog-hover-expand .catalog-container:hover .exif[style*="display: block;"] {
  display: inline-block !important;
}
.catalog-post > * > .exif,
.catalog-post > * > .exif > tbody {
  background-color: inherit;
}
.catalog-post > * > .exif,
.catalog-post > * > .exif td {
  min-width: 0;
}
.catalog-post > * > .exif td {
  padding-top: 1px;
}
:root.hats-enabled .catalog-thread::after {
  content: '';
  pointer-events: none;
  position: absolute;
  background-size: contain;
}
:root.hats-enabled .catalog-small > .catalog-thread::after {
  left: -8px;
  top: -59px;
  width: 96px;
  height: 96px;
}
:root.hats-enabled:not(.werkTyme) .catalog-small > .catalog-thread:not(.noFile)::after {
  left: calc(67px - .3px * var(--tn-w));
}
:root.hats-enabled .catalog-large > .catalog-thread::after {
  left: -15px;
  top: -98px;
  width: 160px;
  height: 160px;
}
:root.hats-enabled:not(.werkTyme) .catalog-large > .catalog-thread:not(.noFile)::after {
  left: calc(110px - .5px * var(--tn-w));
}

/* Copy Text Link's textarea element */
textarea.copy-text-element {
  height: 0;
  width: 0;
  position: absolute;
  top: -10000px;
}

/* Announcement Hiding */
:root.hide-announcement $site$psa {
  display: none;
}
.hide-announcement-button {
  opacity: 0.4;
  float: left;
}

/* Unread */
.unread-line {
  margin: 0;
}
.unread-line + br {
  display: none;
}
.unread-mark-read {
  float: right;
  clear: both;
  width: 100%;
  text-align: right;
}
:not(.unread-thread) > .unread-mark-read {
  display: none;
}

/* Thread Updater */
#updater {
  background: none;
  border: none;
  box-shadow: none;
}
#updater > .move {
  position: absolute;
  top: -5px;
  bottom: -5px;
  left: -5px;
  right: -5px;
  z-index: -1;
}
#updater > div:last-child {
  text-align: center;
}
#updater input[type="number"] {
  width: 4em;
}
:root.float #updater {
  padding: 0px 3px;
}
:root:not(.float).shortcut-icons #updater {
  display: inline-block;
  min-width: 12pt;
  text-align: right;
}
.new {
  color: limegreen;
}
#update-status:not(.empty) + #update-timer:not(.empty):not(.loading) {
  margin-left: 5px;
}
#update-timer {
  cursor: pointer;
}

/* Thread Watcher */
#thread-watcher {
  position: absolute;
}
#thread-watcher {
  padding-bottom: 3px;
  padding-left: 3px;
  white-space: nowrap;
  min-width: 146px;
}
#watched-threads {
  overflow-x: hidden;
  overflow-y: auto;
}
:root.fixed-watcher #thread-watcher {
  position: fixed;
}
:root.fixed-watcher #watched-threads {
  max-height: calc(100vh - 75px);
}
:root:not(.fixed-watcher) #watched-threads:not(:hover) {
  max-height: 210px;
  overflow-y: hidden;
}
#thread-watcher > .move {
  padding-top: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}
#watched-threads > div {
  padding-left: 3px;
  padding-right: 3px;
}
#watched-threads .watcher-link {
  max-width: 250px;
  display: inline-flex;
  flex-direction: row;
}
#watched-threads .watcher-page,
#watched-threads .watcher-unread {
  flex: 0 0 auto;
  margin-right: 2px;
}
#watched-threads .watcher-title {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
}
#watched-threads .watcher-title:not(:first-child) {
  margin-left: 2px;
}
.replies-quoting-you > a, #watcher-link.replies-quoting-you, .last-page > a > .watcher-page {
  color: #F00;
}
#thread-watcher a {
  text-decoration: none;
}
#thread-watcher .move > .close {
  margin-left: auto;
}
.watch-thread-link {
  width: 18px;
  height: 18px;
  background: none;
  border: none;
  padding: 2px;
  opacity: 0.2;
  filter: none;
  cursor: pointer;
  color: var(--xt-watcher, #000);
}
.watch-thread-link.watched {
  opacity: 1;
}
:root.oneechan .watch-thread-link > svg {
  display: none;
}


/* Thread Stats */
#thread-stats {
  background: none;
  border: none;
  box-shadow: none;
}
:root.float #thread-stats > .move > :not(#page-count) {
  pointer-events: none;
}
:root.float #thread-stats {
  padding: 0px 3px;
}
#page-count {
  cursor: pointer;
}

/* Quote */
.hashlink::before {
  content: ' ';
  visibility: hidden;
}
.inline + .hashlink {
  display: none !important;
}
:root.resurrect-quotes .deadlink {
  text-decoration: none !important;
}
.catalog-post .qmark-ct {
  display: none;
}
.backlink.deadlink:not(.forwardlink),
.quotelink.deadlink:not(.forwardlink) {
  text-decoration: underline !important;
}
:root:not(.catalog-mode) .inlined {
  opacity: .5;
}
#qp input, .forwarded {
  display: none;
}
.quotelink.forwardlink,
.backlink.forwardlink {
  text-decoration: underline dashed;
}
.filtered {
  text-decoration: underline line-through;
}
:root.hide-backlinks .backlink.filtered,
:root.hide-backlinks .backlink.filtered + .hashlink.filtered {
  display: none;
}
.postNum + .container::before {
  content: " ";
}
:root.bottom-backlinks .container {
  display: block;
  clear: both;
  margin: 0 4px;
}
:root.bottom-backlinks .backlink {
  font-size: 90%;
}
.inline {
  border: 1px solid;
  display: table;
  margin: 2px 0;
}
.container ~ .inline {
  margin-left: 20px;
}
:root.catalog-mode .inline {
  display: none;
}
.inline .post {
  border: 0 !important;
  background-color: transparent !important;
  display: table !important;
  margin: 0 !important;
  padding: 1px 2px !important;
}
#qp > .opContainer::after {
  content: '';
  clear: both;
  display: table;
}
#qp .post {
  border: none;
  margin: 0;
  padding: 2px 2px 5px;
}
#qp img {
  max-height: 80vh;
  max-width: 50vw;
}
#qp .preview-summary {
  display: block;
}

/* Quote Threading */
.threadContainer {
  margin-left: 20px;
  border-left: 1px solid rgba(128,128,128,.3);
}
.threadOP {
  clear: both;
}

/* File */
.expanded-image > .post > .file > .fileThumb {
  display: flex;
  flex-direction: column;
}
.fileText-original,
.fnswitch:hover > .fntrunc,
.fnswitch:not(:hover) > .fnfull,
.expanded-image > .post > .file > .fileThumb > video[data-md5],
.expanded-image > .post > .file > .fileThumb > img[data-md5] {
  display: none;
}
.full-image[data-file-i-d] {
  display: none;
  cursor: pointer;
}
.expanded-image > .post > .file > .fileThumb > .full-image {
  display: inline;
}
.expanded-image > .post > .file > .fileThumb > audio {
  height: 30px;
  width: 100%;
  min-width: 300px;
}
.expanded-image {
  clear: left;
}
.expanding {
  opacity: .5;
}
:root.fit-height .full-image {
  max-height: 100vh;
}
:root.fit-height.fixed .full-image {
  max-height: calc(100vh - 35px);
}
:root.fit-width .full-image {
  max-width: 100%;
}
:root.ua-gecko.fit-width .full-image {
  width: 100%;
}
.fileThumb > .warning {
  clear: both;
}
#ihover {
  pointer-events: none;
  max-height: calc(100vh - 25px);
  max-width: 100vw;
}
/* WEBM Metadata */
.webm-title > a::before {
  content: "title";
  text-decoration: underline;
}
.webm-title.loading > a::after {
  content: "...";
}
.webm-title.error > a:hover::before,
.webm-title.error > a:focus::before {
  content: "error";
  text-decoration: none;
}
.webm-title > span {
  cursor: text;
}
.webm-title.not-found > span::before {
  content: "not found";
}
.webm-title:not(:hover):not(:focus) > span,
.webm-title:hover > span + a,
.webm-title:focus > span + a {
  display: none;
}
/* Volume control */
input[name="Default Volume"] {
  width: 4em;
  height: 1ex;
  vertical-align: middle;
  margin: 0px;
}
/* Fappe and Werk Tyme */
:root.fappeTyme $site$replyOriginal.noFile,
:root.fappeTyme $site$replyOriginal.noFile + br {
  display: none;
}
:root.werkTyme $site$thumbLink,
:root.werkTyme $site$file$thumb,
:root.werkTyme .catalog-thumb:not(.deleted-file):not(.no-file),
:root:not(.werkTyme) .werkTyme-filename {
  display: none;
}
.werkTyme-filename {
  font-weight: bold;
  font-size: 110%;
}
:root.werkTyme .catalog-link {
  box-shadow: 0 0 5px rgba(0, 0, 0, .25);
  padding: 8px;
  text-align: center;
}
:root.werkTyme .catalog-thumb {
  box-shadow: none;
  padding: 0;
  vertical-align: middle;
}
.indicator {
  background: rgba(255,0,0,0.8);
  font-weight: bold;
  display: inline-block;
  min-width: 9px;
  padding: 0px 2px;
  margin: 0 1px;
  text-align: center;
  color: white;
  border-radius: 2px;
  cursor: pointer;
}
:root:not(.fappeTyme) #shortcut-fappe,
:root:not(.werkTyme) #shortcut-werk {
  display: none !important;
}

/* Index/Reply Navigation */
#navlinks {
  top: 25px;
  right: 10px;
}
:root.catalog-mode #navlinks {
  display: none;
}
:root.highlight-own .yourPost$site$highlightable$op::after,
:root.highlight-you .quotesYou$site$highlightable$op::after,
.filter-highlight$site$highlightable$op::after {
  content: "";
  display: block;
  clear: both;
}

/* Spoiler text */
:root.reveal-spoilers $site$spoiler,
:root.reveal-spoilers $site$spoiler > a {
  color: white !important;
}
:root.reveal-spoilers .removed-spoiler::before {
  content: "[spoiler]";
}
:root.reveal-spoilers .removed-spoiler::after {
  content: "[/spoiler]";
}

/* Thread & Reply Hiding */
.hide-thread-button,
.hide-reply-button {
  float: left;
  margin-right: 4px;
  padding: 2px;
}
$site$infoRoot a.hide-reply-button {
  margin-right: 6px;
  padding: 0;
}
.replacedSideArrows {
  float: left;
}
.hide-thread-button:not(:hover),
.hide-reply-button:not(:hover) {
  opacity: 0.4;
}
.threadContainer .hide-reply-button {
  margin-left: 2px !important;
  position: relative;
  left: 1px;
}
.hide-thread-button {
  margin-top: -1px;
  width: 11px;
}
.stub ~ :not(.threadDivider) {
  display: none !important;
}
.stub input {
  display: inline-block;
}
.stub .stub-icon,
.stub-subject {
  margin-right: 1ch;
}
.stub-replies {
  margin-left: 1ch;
}
.stub-reasons::before { content: ' ('; }
.stub-reasons::after { content: ')'; }
.stub-reason:not(:last-of-type)::after { content: ' & '; }
$site$thread[hidden] + hr {
  display: none;
}
:root.reply-hide $site$sideArrows {
  display: none;
}
:root.sw-yotsuba.thread-hide .party-hat {
  left: 19px;
}

/* Anonymize */
:root.anonymize $site$info$name,
:root.sw-yotsuba.anonymize .post-author:not([class*=capcode]) {
  font-size: 0;
}
:root.anonymize $site$info$tripcode,
:root.sw-yotsuba.anonymize .n-pu {
  display: none;
}
:root.anonymize $site$info$name::before,
:root.sw-yotsuba.anonymize .post-author:not([class*=capcode])::before {
  content: "Anonymous";
  font-size: 10pt;
}
:root.sw-yotsuba.anonymize .flashListing .name::before,
:root.sw-yotsuba.anonymize .post-last > .post-author:not([class*=capcode])::before {
  font-size: 9pt;
}

/* QR */
:root.hide-original-post-form #togglePostFormLink,
#qr.autohide:not(.focus):not(:hover):not(:active) > form,
:root.thread-view #qr:not(.show-new-thread-option) select[data-name="thread"],
#file-n-submit:not(.has-file) #qr-filerm {
  display: none;
}
:root.hide-original-post-form #postForm {
  display: none !important;
}
#qr select,
#qr-filename-container > a,
.remove {
  cursor: pointer;
}
#qr {
  position: fixed;
  padding: 1px;
  border: 1px solid transparent;
  min-width: 300px;
  border-radius: 3px 3px 0 0;
}
#qr > form {
  max-height: calc(100vh - 75px);
  overflow: hidden auto;
}
.qr-link-container {
  text-align: center;
  margin: 16px 0;
}
.qr-link-container-bottom {
  position: absolute;
  margin-left: 50%;
  transform: translateX(-50%);
}
.qr-link {
  border-radius: 3px;
  padding: 6px 10px 5px;
  font-weight: bold;
  vertical-align: middle;
  border-style: solid;
  border-width: 1px;
  font-size: 10pt;
}
.qr-link-container + #togglePostFormLink {
  font-size: 10pt;
  font-weight: normal;
  margin: -8px 0 3.5px;
}
.persona {
  width: 100%;
  display: flex;
  flex-direction: row;
}
.persona .field {
  flex: 1;
  width: 0;
}
#qr.forced-anon :is(input[data-name="name"]:not(.force-show), input[data-name="sub"]:not(.force-show)),
#qr.reply-to-thread input[data-name="sub"]:not(.force-show),
body:not(.board_f) #qr select[name="filetag"],
#qr.reply-to-thread select[name="filetag"],
#qr:not(.has-sjis) #sjis-toggle,
#qr:not(.has-math) #tex-preview-button,
#qr.tex-preview .textarea > :not(#tex-preview),
#qr:not(.tex-preview) #tex-preview {
  display: none;
}
#sjis-toggle, #qr.sjis-preview textarea.field {
  font-family: "IPAMonaPGothic","Mona","MS PGothic",monospace;
  font-size: 16px;
  line-height: 17px;
}
#tex-preview-button {
  font-size: 10px;
}
#tex-preview {
  white-space: pre-line;
}
.textarea {
  position: relative;
  display: flex;
}
#qr textarea.field {
  height: 14.8em;
  min-height: 9em;
  min-width: 300px;
  resize: both;
}
#qr.has-captcha textarea.field {
  height: 9em;
}
#char-count {
  color: #000;
  background: hsla(0, 0%, 100%, .5);
  font-size: 8pt;
  position: absolute;
  bottom: 1px;
  right: 1px;
  pointer-events: none;
}
#char-count.warning {
  color: red;
}
input.field.tripped:not(:hover):not(:focus) {
  color: transparent !important;
  text-shadow: none !important;
}

#qr > .move {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#qr > .move label {
  display: inline-flex;
  align-items: center;
}
#qr > .move .close {
  order: 2;
}

/* Recaptcha v2 */
#qr .captcha-root {
  position: relative;
}
#qr .captcha-container > div {
  margin: auto;
  width: 304px;
}
/* XXX scrollable with scroll bar hidden; prevents scroll on space press */
:root.ua-blink #qr .captcha-container > div,
:root.ua-edge #qr .captcha-container > div {
  overflow: hidden;
}
:root.ua-blink #qr .captcha-container > div > div:first-of-type,
:root.ua-edge #qr .captcha-container > div > div:first-of-type {
  overflow-y: scroll;
  overflow-x: hidden;
  padding-right: 30px;
  height: 99%;
  width: 100%;
}
#qr .captcha-counter {
  display: block;
  width: 100%;
  text-align: center;
  pointer-events: none;
}
#qr.captcha-open .captcha-counter {
  position: absolute;
  bottom: 3px;
}
#qr .captcha-counter > a {
  pointer-events: auto;
  display: inline-block; /* XXX https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8851747/ */
}
#qr:not(.captcha-open) .captcha-counter > a {
  display: block;
  width: 100%;
}
#qr.captcha-v2 #qr-captcha-iframe {
  width: 302px;
  height: 423px;
  border: 0;
  display: block;
  margin: auto;
}
.goog-bubble-content {
  max-width: 100vw;
  max-height: 100vh;
  overflow: auto;
}
.goog-bubble-content iframe {
  position: static !important;
}
#overlay.media-preview {
  display: flex;
  overflow: auto;
  align-items: center;
}
#overlay.media-preview :is(img, video) {
  margin: auto;
}
#overlay.media-preview video {
  max-height: 100%;
  max-width: 100%;
}

/* File Input, Submit Button, Oekaki */
#file-n-submit, #qr .oekaki {
  display: flex;
  align-items: stretch;
  margin-top: 1px;
}
#qr-file-button, #qr-draw-button {
  width: 15%;
}
#file-n-submit input[type="submit"] {
  width: 25%;
}
#qr-filename-container {
  flex: 1 1 auto;
  width: 0;
  display: flex;
  align-items: center;
  position: relative;
  padding: 1px;
}
input#qr-filename {
  border: none !important;
  background: none !important;
  outline: none;
}
#qr-filename,
.has-file #qr-no-file {
  display: none;
}
#qr-no-file,
.has-file #qr-filename {
  flex: 1 1 auto;
  width: 0px; /* XXX Fixes filename not shrinking to allow space for buttons in Edge */
  display: inline-block;
  padding: 0;
  padding-left: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#qr-no-file {
  color: #AAA;
}
#qr .oekaki.has-file {
  display: none;
}
#qr .oekaki > label {
  flex: 1 1 auto;
  width: 0;
  display: flex;
  align-items: center;
}
#qr .oekaki > label > span {
  margin: 0 3px;
}
#qr .oekaki > label > input {
  flex: 1 1 auto;
  width: 0;
}
#qr .oekaki-bg {
  position: relative;
  display: inline-block;
  width: 10%;
  margin-left: 3px;
}
#qr .oekaki-bg > * {
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
}
#qr .oekaki-bg > :not([name="oekaki-bgcolor"]) {
  z-index: 1;
}
#qr [name="oekaki-bgcolor"] {
  height: 100%;
  width: 100%;
  border: none;
  padding: 0;
}
#qr [name="oekaki-bg"]:not(:checked) ~ [name="oekaki-bgcolor"] {
  visibility: hidden;
}
#qr input[type="file"] {
  visibility: hidden;
  position: absolute;
}

/* Spoiler Checkbox, QR Icons */
#qr-filename-container > label, #qr-filename-container > a {
  flex: none;
  margin: 0;
  margin-right: 3px;
}
#qr:not(.has-spoiler) #qr-spoiler-label,
#file-n-submit:not(.has-file) :is(#qr-spoiler-label, #qr-randomize, #qr-restore-name),
#file-n-submit:not(.has-image) #qr-jpg,
#file-n-submit:not(.has-image):not(.has-video) #qr-view,
#file-n-submit.has-file :is(#paste-area, #url-button),
#file-n-submit:not(.custom-cooldown) #custom-cooldown-button {
  display: none;
}
#qr-filename-container > label {
  position: relative;
}
#qr-filename-container input[type="checkbox"] {
  margin: 0;
}
.checkbox-letter {
  font-size: 13px;
  font-weight: bold;
}
#qr-filename-container label:not(:hover) > input[type="checkbox"]:not(:focus):not(:checked),
#qr-filename-container label:not(:hover) > input[type="checkbox"]:not(:focus):not(:checked) ~ :not(.checkbox-letter),
#qr-filename-container label:hover > .checkbox-letter,
input[type="checkbox"]:focus ~ .checkbox-letter,
input[type="checkbox"]:checked ~ .checkbox-letter {
  /* not displayed but still focusable */
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.checkbox-letter, #paste-area, #url-button, #custom-cooldown-button, #dump-button, #split-post {
  opacity: 0.6;
}
#paste-area {
  font-size: 0;
}
#paste-area:focus {
  opacity: 1;
}
#custom-cooldown-button.disabled {
  opacity: 0.27;
}

/* Thread and Flash Tag Select */
#qr select {
  background: white;
  border: 1px solid #CCC;
}
#qr select[data-name="thread"] {
  float: right;
}
#qr > form > select {
  margin-top: 1px;
}

/* Dumping UI */
.dump #dump-list-container {
  display: block;
}
#dump-list-container {
  display: none;
  position: relative;
  overflow-y: hidden;
  margin-top: 1px;
}
#dump-list {
  overflow: auto;
  white-space: nowrap;
  width: 248px;
  max-height: 248px;
  min-height: 90px;
  max-width: 100%;
  min-width: 100%;
  display: flex;
  flex-wrap: wrap;
}
.qr-preview {
  box-sizing: border-box;
  counter-increment: thumbnails;
  cursor: move;
  display: inline-block;
  height: 90px;
  width: 90px;
  padding: 2px;
  opacity: .5;
  overflow: hidden;
  position: relative;
  text-shadow: 0 0 2px #000;
  transition: opacity .25s ease-in-out, transform .25s ease-in-out;
  vertical-align: top;
  background-size: cover;
  flex: none;
}
.qr-preview:hover,
.qr-preview:focus {
  opacity: .9;
}
.qr-preview::before {
  content: counter(thumbnails);
  color: #fff;
  position: absolute;
  top: 3px;
  right: 3px;
  text-shadow: 0 0 3px #000, 0 0 8px #000;
}
.qr-preview#selected {
  opacity: 1;
}
.qr-preview.drag {
  box-shadow: 0 0 10px rgba(0,0,0,.5);
  transform: scale(.8);
}
.qr-preview.over {
  border-color: #fff;
  transform: scale(1.1);
  opacity: 0.9;
  z-index: 10;
}
.qr-preview > span {
  color: #fff;
}
.remove {
  background: none;
  color: #e00;
  padding: 1px;
}
.qr-preview:only-of-type > .remove {
  display: none;
}
.remove:hover::after {
  content: " Remove";
}
.qr-preview:not(.has-file) label,
#qr:not(.has-spoiler) .qr-preview-spoiler {
  display: none;
}
.qr-preview > label {
  background: rgba(0,0,0,.5);
  color: #fff;
  right: 0;
  bottom: 0;
  left: 0;
  position: absolute;
  text-align: center;
}
.qr-preview > label > input {
  margin: 0;
}
#add-post {
  cursor: pointer;
  font-size: 1.5em;
  position: absolute;
  bottom: 20px;
  right: 10px;
  transform: translateY(calc(-50% - .75em));
}
#file-n-submit {
  display: flex;
  flex-direction: column;
}
#file-n-submit .row {
  display: flex;
  flex-direction: row;
}
#file-n-submit .row.space {
  justify-content: space-between;
}
#qr-actions {
  align-items: center;
  gap: 6px;
  padding: 0 3px;
}
#qr-actions .qr-action-button {
  display: inline-flex;
  align-items: center;
}

/* Menu */
.menu-button {
  position: relative;
  cursor: pointer;
}
.postInfo > .menu-button {
  margin: 0 4px;
}
#menu {
  position: fixed;
  outline: none;
  font-weight: normal;
}
#menu, .submenu {
  border-radius: 3px;
  padding-top: 1px;
  padding-bottom: 3px;
}
.entry {
  cursor: pointer;
  display: block;
  outline: none;
  padding: 2px 10px;
  position: relative;
  text-decoration: none;
  white-space: nowrap;
  min-width: 70px;
  text-align: left;
  text-shadow: none;
  font-size: 10pt;
}
.entry input[type="checkbox"],
.entry input[type="radio"] {
  margin: 0px;
  position: relative;
  top: 2px;
}
.entry input[type="number"] {
  width: 4.5em;
}
.entry.has-shortcut-text,
.entry.has-submenu {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.entry .shortcut-text {
  opacity: 0.5;
  font-size: 70%;
  margin-left: 5px;
}
.menu-indicator {
  pointer-events: none;
  position: relative;
  right: -7px;
}
.left .menu-indicator > .icon {
  transform: rotate(180deg);
}
.submenu {
  display: none;
  position: absolute;
  left: 100%;
  top: -1px;
  margin-left: 0px;
  margin-top: -2px;
}
.focused > .submenu {
  display: block;
}
.imp-exp-result {
  position: absolute;
  text-align: center;
  margin: auto;
  right: 0px;
  left: 0px;
  width: 200px;
}

/* Custom Board Titles */
.boardTitle, .boardSubtitle {
  white-space: pre-line;
}
.boardTitle[contenteditable="true"],
.boardSubtitle[contenteditable="true"] {
  cursor: text !important;
}

/* Embedding */
.embedder:not(.embedded) > span {
  display: none;
}
#embedding {
  padding: 1px 4px;
  position: fixed;
}
#embedding.empty {
  display: none;
}
#embedding > .move {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

/* Gallery */
#a-gallery {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  background: rgba(0,0,0,0.7);
}
.gal-viewport {
  display: flex;
  align-items: stretch;
  flex-direction: row;
  flex: 1 1 auto;
  overflow: hidden;
}
.gal-thumbnails {
  flex: 0 0 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
  background: rgba(0,0,0,.5);
  border-left: 1px solid #222;
}
.gal-hide-thumbnails .gal-thumbnails {
  display: none;
}
.gal-thumb img,
.gal-thumb video {
  max-width: 125px;
  max-height: 125px;
  height: auto;
  width: auto;
}
.gal-thumb {
  flex: 0 0 auto;
  padding: 3px;
  line-height: 0;
  transition: background .2s linear;
}
.gal-highlight {
  background: rgba(0, 190, 255,.8);
}
.gal-prev {
  border-right: 1px solid #222;
}
.gal-next {
  border-left: 1px solid #222;
}
.gal-prev,
.gal-next {
  flex: 0 0 20px;
  position: relative;
  cursor: pointer;
  opacity: 0.7;
  background-color: rgba(0, 0, 0, 0.3);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  color: #fff;
}
.gal-prev:hover,
.gal-next:hover {
  opacity: 1;
}
.gal-image {
  flex: 1 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  overflow: hidden;
  /* Flex > Non-Flex child max-width and overflow fix (Firefox only?) */
  width: 1%;
}
:root:not(.gal-fit-height):not(.gal-pdf) .gal-image {
  overflow-y: scroll !important;
}
:root:not(.gal-fit-width):not(.gal-pdf) .gal-image {
  overflow-x: scroll !important;
}
.gal-image a {
  display: flex;
  align-items: flex-start;
  margin: auto;
  line-height: 0;
  max-width: 100%;
}
:root.gal-pdf .gal-image a {
  width: 100%;
  height: 100%;
}
.gal-image img,
.gal-image video {
  flex: none;
}
.gal-fit-width .gal-image img,
.gal-fit-width .gal-image video {
  max-width: 100%;
}
.gal-fit-height .gal-image img,
.gal-fit-height .gal-image video {
  max-height: calc(100vh - 25px);
}
.gal-image iframe {
  width: 100%;
  height: 100%;
}
.gal-buttons {
  font-size: 1.5em;
  margin-right: 3px;
  padding-left: 7px;
  padding-right: 7px;
  top: 5px;
}
:root.gal-pdf .gal-buttons {
  top: 40px;
  background: rgba(0,0,0,0.6) !important;
  border-radius: 3px;
}
.gal-buttons a {
  color: #ffffff;
  text-shadow: 0px 0px 1px #000000;
}
.gal-buttons.gal-playing > .gal-start,
.gal-buttons:not(.gal-playing) > .gal-stop {
  display: none;
}
.gal-labels {
  position: fixed;
  bottom: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
:root:not(.show-sauce) .gal-sauce {
  display: none;
}
.gal-name,
.gal-count,
.gal-sauce {
  background: rgba(0,0,0,0.6) !important;
  border-radius: 3px;
  padding: 1px 5px 2px 5px;
  margin-top: 3px;
  color: #ffffff !important;
  text-decoration: none !important;
}
.gal-sauce a {
  color: #ffffff !important;
}
.gal-name:hover,
.gal-buttons a:hover,
.gal-sauce a:hover {
  color: rgb(95, 95, 101) !important;
}
:root.gal-pdf .gal-buttons a:hover {
  color: rgb(204, 204, 204) !important;
}
.gal-buttons,
.gal-labels {
  position: fixed;
  right: 195px;
}
.gal-hide-thumbnails .gal-buttons,
.gal-hide-thumbnails .gal-labels {
  right: 44px;
}
:root:not(.gal-fit-width):not(.gal-pdf) .gal-labels {
  bottom: 23px !important;
}
:root.gal-fit-height:not(.gal-pdf):not(.gal-hide-thumbnails) .gal-buttons,
:root.gal-fit-height:not(.gal-pdf):not(.gal-hide-thumbnails) .gal-labels {
  right: 178px !important;
}
:root.gal-hide-thumbnails.gal-fit-height:not(.gal-pdf) .gal-buttons,
:root.gal-hide-thumbnails.gal-fit-height:not(.gal-pdf) .gal-labels {
  right: 28px !important;
}
:root.gallery-open.fixed #header-bar:not(.autohide) {
  visibility: hidden;
}

/* Mod Contact Links */
.contact-links {
  margin-left: 2px;
}
.move-note > a {
  text-decoration: underline;
}
.invisible {
  font-size: 0;
}

/* PSA */
.fcx-announcement {
  text-align: center;
}
.fcx-announcement a {
  text-decoration: underline;
}

.spin > .icon {
  animation: spin 2s infinite linear;
}

/* To not scroll posts behind the header */
div.post {
  overflow: auto;
  scroll-margin-top: 30px;
}

/* (you) markers on the scrollbar */
.post-scroll-marker {
  border: none;
  padding: 0;
  position: fixed;
  right: -5px;
  background-color: var(
    --xt-scroll-maker-you, 
    var(--xt-border-highlight, currentColor)
  );
  border-radius: 3px;
  width: 10px;
  min-height: 5px;
  top: calc(var(--top) * 1vh);
  height: calc(var(--height) * 1vh);
}

.post-scroll-marker.you-scroll-marker {
  opacity: 50%;
}

.scroll-marker-container {
  display: contents;
}
```

### src/css/tomorrow.css

```css
:root.tomorrow {
  --xt-background: #282A2E;
  --xt-border: #111;
  --xt-border-field-focus: rgb(129, 162, 190);
  --xt-border-highlight: rgba(145, 182, 214, .8);
  --xt-header-dialog-bg: rgba(40,42,46,0.9);
  --xt-header-dialog-fg: #C5C8C6;
  --xt-header-link: #81A2BE;
  --xt-dead-link: #81A2BE;
  --xt-inline: rgba(0, 0, 0, .14);
  --xt-qr-preview-bg: rgba(255, 255, 255, .15);
  --xt-qr-link-border: rgb(25, 27, 31) rgb(25, 27, 31) rgb(10, 12, 16);
  --xt-qr-bg: linear-gradient(#37393D, #282A2E) repeat scroll 0% 0% transparent;
  --xt-menu-fg: #C5C8C6;
  --xt-entry-focus-bg: rgba(0, 0, 0, .33);
  --xt-unread: rgba(40, 42, 46, 0.5);
  --xt-watcher: #c5c8c6;

  --xt-unread-line: rgb(197, 200, 198);
  --xt-filter-highlight: rgba(145, 182, 214, .5);
  --xt-highlight-shadow: rgba(64, 192, 255, .7);
  --xt-watched-border: rgb(64, 192, 255);
  --xt-qphl: rgba(145, 182, 214, .8);
  --xt-highlight-side-arrow: rgb(155, 185, 210);

  --xt-fxt-fg: #c5c8c6;
}

/* 4chan style fixes */
:root.tomorrow #arc-list span.quote {
  color: #B5BD68;
}

:root.tomorrow #header-bar a, :root.tomorrow #notifications a {
  color: #81A2BE;
}
:root.tomorrow.shortcut-icons .native-settings {
  background-image: url('//s.4cdn.org/image/favicon-ws.ico');
}


:root.tomorrow #qr .field {
  background-color: rgb(26, 27, 29);
  color: rgb(197,200,198);
  border-color: rgb(40, 41, 42);
}
:root.tomorrow #qr .field:focus,
:root.tomorrow #qr .field.focus {
  border-color: var(--xt-border-field-focus) !important;
  background-color: rgb(30,32,36);
}
:root.tomorrow #qr select {
  border-color: rgb(40, 41, 42);
  background: unset;
}
:root.tomorrow #qr select > option {
  background-color: var(--xt-background);
}
:root.tomorrow #qr-filename {
  color: rgb(197,200,198);
}
```

### src/css/variableBase.css

```css
/* General */
.dialog {
  background-color: var(--xt-background);
  border-color: var(--xt-border);
}
.field:focus,
.field.focus {
  border-color: var(--xt-border-field-focus);
}

/* 4chan style fixes */
:root:not(.oneechan).highlight-you .quotesYou$site$highlightable$reply {
  border-left: 3px solid var(--xt-border-highlight) !important;
}
:root:not(.oneechan).highlight-own .yourPost$site$highlightable$reply {
  border-left: 3px dashed var(--xt-border-highlight) !important;
}

/* Header */
#header-bar.dialog {
  background-color: var(--xt-header-dialog-bg);
}
:root:not(.fixed) #header-bar, #notifications {
  font-size: var(--xt-notification-size, 9pt);
}
#header-bar, #notifications {
  color: var(--xt-header-dialog-fg);
}
#board-list a, #shortcuts a {
  color: var(--xt-header-link, unset);
}

/* Settings */
#fourchanx-settings fieldset, .section-main div::before {
  border-color: var(--xt-border);
}
.suboption-list > div:last-of-type {
  background-color: var(--xt-background);
}

/* Catalog */
:root.catalog-hover-expand .catalog-container:hover > .post {
  background-color: var(--xt-background);
}
:root.werkTyme .catalog-thread:not(:hover),
:root.werkTyme:not(.catalog-hover-expand) .catalog-thread,
:root.catalog-hover-expand .catalog-container:hover > .post,
:root.catalog-hover-expand .catalog-container:hover .catalog-reply {
  border-color: var(--xt-border);
}

/* Quote */
.backlink.deadlink {
  color: var(--xt-dead-link) !important;
}
.inline {
  border-color: var(--xt-border);
  background-color: var(--xt-inline, rgba(255, 255, 255, .14));
}

/* Fappe and Werk Tyme */
.indicator {
  color: var(--xt-background);
}

/* QR */
#dump-list::-webkit-scrollbar-thumb {
  background-color: var(--xt-background);
  border-color: var(--xt-border);
}
.qr-preview {
  background-color: var(--xt-qr-preview-bg, rgba(0, 0, 0, .15));
}
.qr-link {
  border-color: var(--xt-qr-link-border);
  background: var(--xt-qr-bg);
}
.qr-link:hover {
  background: var(--xt-link-hover-bg, var(--xt-background));
}

/* Menu */
#menu {
  color: var(--xt-menu-fg, var(--xt-header-link));
}
.entry {
  font-size: var(--xt-entry-size, 10pt);
}
.focused.entry {
  background: var(--xt-entry-focus-bg);
}

/* Unread */
.unread-mark-read {
  background-color: var(--xt-unread);
}

/* Thread Watcher */
.replies-quoting-you > a, #watcher-link.replies-quoting-you, .last-page > a > .watcher-page {
  color: var(--xt-watcher-quoting-you, #F00) !important;
}

/* Moved from style.css */

/* Highlighting */
.qphl {
  outline: 2px solid var(--xt-qphl, rgba(216, 94, 49, .8));
}
:root.highlight-you .quotesYou$site$highlightable$op,
:root.highlight-you .quotesYou$site$highlightable$reply {
  border-left: 3px solid var(--xt-border-highlight);
}
:root.highlight-own .yourPost$site$highlightable$op,
:root.highlight-own .yourPost$site$highlightable$reply {
  border-left: 3px dashed var(--xt-border-highlight) ;
}
.filter-highlight$site$highlightable$op,
.filter-highlight$site$highlightable$reply {
  box-shadow: inset 5px 0 var(--xt-filter-highlight, rgba(221, 0, 0, .5));
}
:root.highlight-own .yourPost > $site$sideArrows,
:root.highlight-you .quotesYou > $site$sideArrows,
.filter-highlight > $site$sideArrows {
  color: var(--xt-highlight-side-arrow, rgba(221, 0, 0, .8));
}

:root:not(.werkTyme) .catalog-thread.filter-highlight .catalog-thumb,
:root.werkTyme .catalog-thread.filter-highlight:not(:hover),
:root.werkTyme:not(.catalog-hover-expand) .catalog-thread.filter-highlight,
:root.werkTyme.catalog-hover-expand .catalog-thread.filter-highlight > .catalog-container:hover > .catalog-post,
:root.catalog $site$catalog$thread.filter-highlight$site$highlightable$catalog {
  box-shadow: 0 0 3px 3px var(--xt-highlight-shadow, rgba(255, 0, 0, .5));
}
:root:not(.werkTyme) .catalog-thread.watched .catalog-thumb,
:root:root.werkTyme .catalog-thread.watched:not(:hover),
:root:root.werkTyme:not(.catalog-hover-expand) .catalog-thread.watched,
:root.werkTyme.catalog-hover-expand .catalog-thread.watched > .catalog-container:hover > .catalog-post {
  border: 2px solid var(--xt-watched-border, rgba(255, 0, 0, .75));
}

.unread-line {
  border-color: var(--xt-unread-line, rgb(255,0,0));
}

:root.tomorrow,
:root.spooky {
  color-scheme: dark;
}

:root.tomorrow .field,
:root.spooky .field {
  background-color: unset;
  color: unset;
  border-color: unset;
}

:root.tomorrow input[type="button"],
:root.spooky input[type="button"] {
  filter: brightness(80%);
}
```

### src/css/www.css

```css
#captcha-cnt {
  height: auto;
}
:root:not(.js-enabled) #form {
  display: block;
}
#bd > div[style], #bd > div[style] > * {
  height: auto !important;
  margin: 0 !important;
  font-size: 0;
}
```

### src/css/yotsuba-b.css

```css
:root.yotsuba-b {
  --xt-background: #D6DAF0;
  --xt-link-hover-bg: #D9DDF3;
  --xt-border: #B7C5D9;
  --xt-border-field-focus: #98E;
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-header-dialog-bg: rgba(214,218,240,0.98);
  --xt-header-dialog-fg: #89A;
  --xt-header-link: #34345C;
  --xt-dead-link: #34345C;
  --xt-qr-link-border: rgb(199, 203, 225) rgb(199, 203, 225) rgb(184, 188, 210);
  --xt-qr-bg: linear-gradient(#E5E9FF, #D6DAF0) repeat scroll 0% 0% transparent;
  --xt-menu-fg: #000;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-unread: rgba(214, 218, 240, 0.5);
}
```

### src/css/yotsuba.css

```css
:root.yotsuba {
  --xt-background: #F0E0D6;
  --xt-border: #D9BFB7;
  --xt-border-field-focus: #EA8;
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-header-dialog-bg: rgba(240,224,214,0.98);
  --xt-header-dialog-fg: #B86;
  --xt-header-link: #800000;
  --xt-dead-link: #00E;
  --xt-qr-link-border: rgb(225, 209, 199) rgb(225, 209, 199) rgb(210, 194, 184);
  --xt-qr-bg: linear-gradient(#FFEFE5, #F0E0D6) repeat scroll 0% 0% transparent;
  --xt-entry-focus-bg: rgba(255, 255, 255, .33);
  --xt-unread: rgba(240, 224, 214, 0.5);
  --xt-watcher: #800000;

  --xt-fxt-fg: #800000;
}
```

## Appendix H. Self-contained binary resources

For each record, base64-decode `data` to recreate the path if reproducing the build layout, or use `data:{mime};base64,{data}` when inlining. Verify decoded bytes against SHA-256. These are resource bytes, not executable application code. Retain their original attribution. Font Awesome SVGs are supplied by the package dependencies rather than this table.

```json
[
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadDead.png",
    "mime": "image/png",
    "bytes": 162,
    "sha256": "f3e3125c20d131fbc7daacddd25ac9c5c1cda92cc22c13164ded535e3a9eb656",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAD1BMVEUBAAAAAAD/AABnZ2f///8nFk05AAAAAXRSTlMAQObYZgAAAEFJREFUeNqNjgEKACAMAjvX/98cAkkxgmSgO8Bt/Ai4ApJ6KKhzF3OiEMDASrGB/QWgPEHsUpN+Ng9xAETMYhDrWmeHAMcmvycWAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 197,
    "sha256": "068f8706c58635db756610705564433581b5c1e8f627eb5b7eefa2db28eceefd",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAD1BMVEUAAAAAAAD/AABmZmYA/wBD99DBAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAE9JREFUCNdljcsRACEIQ5MOiNKAdGAJ9N/Uiu7nsMzABHgB4B8ygFoZA2hhVWavhhGeURPJU9q45+17hGbfGxa82Ndex3hEM44SJGD2/b4AzDgGlHbl388AAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 168,
    "sha256": "79471cf8494984965ecc8c72796a6672a594e95bc5715547e8593e36b7d16d3d",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAElBMVEUBAAAAAABmzDNlyjJnZ2f///+6o7dfAAAAAXRSTlMAQObYZgAAAERJREFUeF6NjkEKADEIA51o///lJZfQxUsHITogWi8AvwZJuxmYa25xDooBLEwOWFTYAsYVhdorLZt9Ng9xCUTCUCQ2H3F4ANrZ2WNiAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 197,
    "sha256": "63ec1262175999a3f877d6a464de720f4f71a6038d743fec9ed55beb373df525",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAD1BMVEUAAAAAAABmzDNmZmb/AAC8/wCMAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAE9JREFUCNdljcsRACEIQ5MOiNKAdGAJ9N/Uiu7nsMzABHgB4B8ygFoZA2hhVWavhhGeURPJU9q45+17hGbfGxa82Ndex3hEM44SJGD2/b4AzDgGlHbl388AAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadSFW.png",
    "mime": "image/png",
    "bytes": 162,
    "sha256": "758bdfb08d0ac57e41cc897d0a7a0e4675ce1c245b76b8981337f33753e70dd7",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAD1BMVEUBAAAAAAAul8NnZ2f////82iC9AAAAAXRSTlMAQObYZgAAAEFJREFUeNqNjgEKACAMAjvX/98cAkkxgmSgO8Bt/Ai4ApJ6KKhzF3OiEMDASrGB/QWgPEHsUpN+Ng9xAETMYhDrWmeHAMcmvycWAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/4chanJS.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 197,
    "sha256": "3e13bc04dba92e35d7af92a368f0158442e1787be9b772ffce461ac43f178ff8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAD1BMVEUAAAAAAAAul8NnZ2f/AAD7B+mqAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEgAACxIB0t1+/AAAAE9JREFUCNdljcsRACEIQ5MOiNKAdGAJ9N/Uiu7nsMzABHgB4B8ygFoZA2hhVWavhhGeURPJU9q45+17hGbfGxa82Ndex3hEM44SJGD2/b4AzDgGlHbl388AAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadDead.png",
    "mime": "image/png",
    "bytes": 335,
    "sha256": "0c42108c76b89d4346255e8738ab930b0e4b7a8ed5254d2f61e3eb4a1d5dbea8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABFklEQVR4AZ2R4WqEMBCEFy1yiJQQ14gcIhIuFBFR+qPQ93+v66QMksrlTwMfkZ2ZZbMKTgVqYIDl3YAbeCM31lJP/Zul4MAEPJjBQGNDLGsz8PQ6aqLAP5PTdd1WlmU09mSKtdTDRgrkzspJPKq6RxMahfj9yhOzQEZwZAwfzrk1ox3MXibIN8hO4MAjeV72CemJGWblnRsOYOdoGw0jebB20BPAwKzUQPlrFhrXFw1Wagu9yuzZwINzVAZCURRL+gRr7Wd8Vtqg4Th/lsUmewyk9WQ/A7NiwJz5VV/GmO+MNjMrFvh/NPDMigHTaeJN09a27ZHRJmalBg54CgfvAGYSLpoHjlmpuAwFdzDy7oGS/qIpM9UPFGg1b1kUlssAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 384,
    "sha256": "f670bef0b5e850c31c58f32a904f041a02898692a834a9c242b761388a80c5fc",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABR0lEQVR4AYWSQWq0QBCFCw0SRIK0PQ4hiIhEZBhEySLyewUPEMgqR/JIXiDhzz7kKKYePIZajEzDRxfV9dWU3SO6IiVWUsVxT5R75Y4gTmwNnUh4kCulUiuV8sjChDjmKtaUcHgmHsnNrMPh0IVhiMIjKZGzNXDoyhMzF7C89z2KtFGD+FoNXEUKZdgpaPM8P++cDXTtBDca7EyQK8+bXTufYBccuvLAG26UnqN1LCgI4g/lm7zTgSux4vk0J8rnKw3+m1//pBPbBrVyGZVNmiAITviEtm3t+D+2QcJx7GUxlN4594K4ZY75Xzh0JVWqnad6TdP0H+LRNBjHcYNDV5xS32qwaC4my7Lwn6guu5QoomgbdFmWDYhnM8E8zxscuhLzPWtKA/dGqUizrityX9M0YX+DQ1ciXobnP6vgfmTOM7Znnk70B58pPaEvx+epAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 309,
    "sha256": "21425586a949c9f792a373b1785b39c93962c11311eddb51853d44d8c22c4761",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA/ElEQVR4AZ3RUWqEMBSF4ftQZAihDCKKiAQJShERQx+6o662e2p/4TCEQF468BEm95yLovFr4PBEq9PjgTd5wBcZp6559AiIWDAq6KXV3aJMUMfDOsTf7Mf/XaFBAvYiE9W16b74/vl8UeBAlKOSmWAzUiXwcavMkrrFE9QXVJ+gx5q9XvUVivmqrr1jxIYLCacCs6y6S8psGNU1hw4Bu4JHuUB3pzJBHZcviLiKV9jkyO4vxHyBx1h+qlcY5b2Wj+raE0vlU33dKrNFXWsR/7EgqmtPBIXuIw+dt8osqGsOPaIGSeeGRbZiFtVxsAYeHSbMOgd0MhSzTp3mD4RaQX4aW3NMAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 376,
    "sha256": "0a06be826a267ba1e1d55565726d92299777ddf1c509ae75a52a5c0735144683",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABP0lEQVR4AYWS0UqFQBCGhziImNRBRImDmUgiIaF0kWSP4AMEXXXTE/QiPpL3UdR19Crb/PAvLEtyFj5mmfn/cdxd0RUokbJXEsZYCZUd4D72NBG8wkKmlEqtVMoFhTFJmKuoKelBTVIkjbNE5IainJTIeZqaXjkg8fp+Z7GCjiLQbWgOihTKsCFowUZtoNef4HgDf4JMuTbe8n/Br8NDr5zxhBul52i3FBQE+xflmzzTA69ESmpPmubunwZfztc/6IncBrXSe7/QkK5tW3f8H7dBjHH8q6Kwt033V6Hb4JeeWPgsq42rugfYZ92psWscRwMPvZIo9bEGD2+F2YUnBizLwpeoXnYpbQM34kAB9peP58aueZ4NPPRKxPusaRoYG6UizbquyH1O04T4RA+8EvAwUr6sgjFnDuReLaUn+ANygUa7+9SCWgAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadSFW.png",
    "mime": "image/png",
    "bytes": 309,
    "sha256": "04652d2c79773d17544b6f843427dd4ed5faa2320677f60de648b63819079f40",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA/ElEQVR4AZ3RUWqEMBSF4ftQZAhSREQJIiIXpQwi+tSldkFdWPsLhyEE0ocKH2Fyzg1mNJ4KAQ1arTUeeJMH6qwTUJmCHjMcC6KKtbSIylzdXpl18J/k4fdTpUFmPLOOa9bGe+P4+n5RYYfLXuiMsAlXofBxK2QXpvwN/jqg+AY91vR+pStk+apZe0fEhhMXDhUmWXEoO9WNmrWAzvRPq7jnB2jvUGfWTEgPcJzZFTbZk/0Tnh5QI+af6lVGvq/Do2atwVL4VJ+3QrZo1lr4Pw5wzVqDWaV7SUvHrZDNmrWAHq7g0rphkS3LXDMBVqFGhxGT1gGdDFnWaab6BRmXRvbxDmYiAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/Mayhem.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 377,
    "sha256": "adb75fd96d63fe86aba56bcdd7fa97afb6bafda32d588558c83666420e8dd6a4",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABQElEQVR4AY2SQUrEQBBFS9CMNFEkhAQdYmiCIUgcZlYGc4VsBcGVF/AuWXme4F7RtXiVWF9+Y9MYtOHRTdX/NZWaEj2RYpQTJeEdK4fKPuA7DjSGXiQkU0qlUqxySmFMEsYsNSU8zEmK4OwdEbmkKCclYoGmolfWCGyenh1O0EJE2gXNWpFC2S0IGrCQ29EbdPCPAmEHmXIxByf8hDAPD71yzAnXypatbSgoAN8Pyju5h4deMUrqJk1z+0uBN+/XX+gxfoFK2QafUJO2aRq//Q+/QIx2wr+Kwq0rusrP/QKf9MTCtbQLf9U1wNvYnz3qug45S68kSvVXgbPbx3nvYPXNOI7cRPWySukK+DcGCvA+urqZ3RmGAbmSXjFK5rpwW8nhWVJP04TYa9/3uO/goVciDiPlZhW8c8ZAHuRSeqIv32FK/GYGL8YAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.readNSFW.png",
    "mime": "image/png",
    "bytes": 106,
    "sha256": "763e65e03d083a0e277d3b82eacb15da407effae20d460242bfcf42d414d3a77",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAABmzDMxovcJAAAAAXRSTlMAQObYZgAAABJJREFUCB1jZGBgrMNAQEEc4gCSfAX5bRw/NQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.readSFW.png",
    "mime": "image/png",
    "bytes": 106,
    "sha256": "47e93e3b0bd5b162dccfd8f698c3d6f3288720a4f22e4fa3425e392dcd8c1c39",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAAAul8Or2V3yAAAAAXRSTlMAQObYZgAAABJJREFUCB1jZGBgrMNAQEEc4gCSfAX5bRw/NQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadDead.png",
    "mime": "image/png",
    "bytes": 106,
    "sha256": "40e357feed08de79275631252061751c520dcc4c7bd6a9bb425b71225ba66748",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAAC/AABrZQDiAAAAAXRSTlMAQObYZgAAABJJREFUCB1jZGBgrMNAQEEc4gCSfAX5bRw/NQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "8744cbbd32e0a1d85f391573c3982166e86e185428b9ab71eea557e80f7f940f",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAJFBMVEUAAAAAAAAAAAC/AAD///8dAAApAABsAAAHAAA4AACQAAAsAABMCpCvAAAAA3RSTlMAPse+s4iwAAAAMklEQVQI12NggAFmY2MDECaNAQZCilAzVJyg5oS4GqAxUtygjIp2KGOKJ5SxepcB3BUAcdYRqxAtgFoAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 106,
    "sha256": "e5f6c59c8c437d94a28f15bf6cf2ce01535135add5680910462ef9784fd3ff24",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAABV/wErM5hwAAAAAXRSTlMAQObYZgAAABJJREFUCB1jZGBgrMNAQEEc4gCSfAX5bRw/NQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "d561dec457759c9475b3374bfb6bede04e9510dfc849d3571b2d0a3eecc5e934",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAJFBMVEUAAAAAAAAAAABV/wH///8NKAASOAAwkQADCgAZTABAwQATOwC5e3VGAAAAA3RSTlMAPse+s4iwAAAAMklEQVQI12NggAFmY2MDECaNAQZCilAzVJyg5oS4GqAxUtygjIp2KGOKJ5SxepcB3BUAcdYRqxAtgFoAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadSFW.png",
    "mime": "image/png",
    "bytes": 106,
    "sha256": "d962504002fcfb93d47076abf5171d56bc0bbff531b1102de49cb47704e3341f",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAAAA1/GhpCidAAAAAXRSTlMAQObYZgAAABJJREFUCB1jZGBgrMNAQEEc4gCSfAX5bRw/NQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/Metro.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "366bac5833aa4231d03ca47a4f3f07fcc2af743543e9387a595df8bfcb51735f",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAJFBMVEUAAAAAAAAAAAAA1/H///8AISUALzQAeokACAkAQEcAorYAMTcE9WFNAAAAA3RSTlMAPse+s4iwAAAAMklEQVQI12NggAFmY2MDECaNAQZCilAzVJyg5oS4GqAxUtygjIp2KGOKJ5SxepcB3BUAcdYRqxAtgFoAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadDead.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "12749b6c1ddfba704ea24e2d5d7b665699e54cdbf04e59d27f8882e75de2e1e0",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAgMAAABinRfyAAAADFBMVEX/////AAD///8AAABBZmS3AAAAAXRSTlMAQObYZgAAAExJREFUeF4tyrENgDAMAMFXKuQswQLBG3mOlBnFS1gwDfIYLpEivvjq2MlqjmYvYg5jWEzCwtDSQlwcXKCVLrpFbvLvvSf9uZJ2HusDtJAY7Tkn1oYAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 189,
    "sha256": "86069b4454c545c7c8242ff2a3c163f834f68c676eb3f34ae49b5dc2ec7ddcb8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAhElEQVR42q1RwQnAMAjMu5M4guAKXa4j5dUROo5tipSDcrFChUONd0di2m/hEGVOHDyIPufgwAFASDkpoSzmBrkJ2UMyR9LsJ3rvrqo3Rt1YMIMhhNnOxLMnoMFBxHyJAr2IOBFzA8U+6pLBdmEJTA0aMVjpDd6Loks0s5HZNwYx8tfZCZ0kll7ORffZAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "fde85fec61087c3dffe877b6abd69ac0b8e33d2f60606bac5531609aeb31999d",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAgMAAABinRfyAAAADFBMVEX///9mzDP///8AAACT0n1lAAAAAXRSTlMAQObYZgAAAExJREFUeF4tyrENgDAMAMFXKuQswQLBG3mOlBnFS1gwDfIYLpEivvjq2MlqjmYvYg5jWEzCwtDSQlwcXKCVLrpFbvLvvSf9uZJ2HusDtJAY7Tkn1oYAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 216,
    "sha256": "351fc6f5316b70f92a5f84e9af4b5333037a5248d731f5f5ce9147059fd53dfc",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAALVBMVEUAAAAAAAAAAAAAAAAECAIQIAgWLAsePA8oKCg4ODg6dB07OztmzDPBwcH///+rsf3XAAAAA3RSTlMAx9dmesIgAAAAV0lEQVR42m2NWw6AIBAD1eIDhbn/cTVSCCTsfmw7ybbLZIBBIKkXKKU0E4M3aKT+tjCn5xiziwuIsNr7BTb7ErrDZV/AAaIHdwgV6AcnuFaU0Eeu5dt2XiUyBjCQ2bIrAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadSFW.png",
    "mime": "image/png",
    "bytes": 170,
    "sha256": "9f1fbb8730763916874b9e6f76bf93aeff521d3c34349902701c52da3028e330",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAgMAAABinRfyAAAADFBMVEX///8ul8P///8AAACaqgkzAAAAAXRSTlMAQObYZgAAAExJREFUeF4tyrENgDAMAMFXKuQswQLBG3mOlBnFS1gwDfIYLpEivvjq2MlqjmYvYg5jWEzCwtDSQlwcXKCVLrpFbvLvvSf9uZJ2HusDtJAY7Tkn1oYAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/Original.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 216,
    "sha256": "3b618e66c3947406420be48b11b6ea6369581b4c94897e18d9a78977178678c5",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAALVBMVEUAAAAAAAAAAAAAAAABBQcHFx4KISoNLToaVW4oKCgul8M4ODg7OzvBwcH///8uS/CdAAAAA3RSTlMAx9dmesIgAAAAV0lEQVR42m2NWw6AIBAD1eILZO5/XI0UAgm7H9tOsu0yGWAQSOoFijHOxOANGqm/LczpOaXs4gISrPZ+gc2+hO5w2xdwgOjBFUIF+sEJrhUl9JFr+badFwR+BfqlmGUJAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/dead.gif",
    "mime": "image/gif",
    "bytes": 94,
    "sha256": "63d875f6f56e8f94517743b71adcf98b61c02eb76b7922f799b6d8c9e6c36b8c",
    "data": "R0lGODlhEAAQAKECAAAAAP8AAP///////yH5BAEKAAIALAAAAAAQABAAAAIvlI+pq+D9DAgUoFkPDlbs7lFZKIJOJJ3MyraoB14jFpOcVMpzrnF3OKlZYsMWowAAOw=="
  },
  {
    "path": "src/Monitoring/Favicon/empty.gif",
    "mime": "image/gif",
    "bytes": 94,
    "sha256": "6447ae5bec4f96a90d845a8a5d4becb7b5d9732a42c21c1d6b92ee1b356e44e1",
    "data": "R0lGODlhEAAQAJEAAAAAAP///9vb2////yH5BAEAAAMALAAAAAAQABAAAAIvnI+pq+D9DBAUoFkPFnbs7lFZKIJOJJ3MyraoB14jFpOcVMpzrnF3OKlZYsMWowAAOw=="
  },
  {
    "path": "src/Monitoring/Favicon/exclamation.png",
    "mime": "image/png",
    "bytes": 113,
    "sha256": "5382a007f5b3be0db4ecb53360d50b6c0dd6b874334b6da31df2cc095a2d78be",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAOElEQVR4AWMYycCO4TgQ2uFWcPw/EACV4ATXwQquE1RAgRV5DF+BMA+3gs1gEzbj8+YRILQjKkgA15cin4PAjAYAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadDead.png",
    "mime": "image/png",
    "bytes": 201,
    "sha256": "fd7aeca6569d839e435c5cc13be1e17cba7b4cda271e89b1e0f227ccc7819ded",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAFVBMVEX///9zBQC/AADpDAP/gID/q6voCwJJTwpOAAAAAXRSTlMAQObYZgAAAGJJREFUeF5Fi7ENg0AQBCfa/AFdDh2gdwPIogMK2E2+/xLslwOvdqRJhv+GQQPUCtJM7svankLrq/I+TY5e6Ueh1jyBMX7AFJi9vwfyVO4CbbO6jNYpp9GyVPbdkFhVgAQ2H0NOE5jk9DT8AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 254,
    "sha256": "d78042f75955f88b274aadbc7fd44dacacff300816b1c6de135a178cf11d7d22",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAxUlEQVR42q1TOwrCQBB9s0FRtJI0WoqFtSLYegoP4gVSeJsUHsHSI3iFeIqRXXgwrhlXwYHHhLwPTB7B36abBCV+0pA4DUBQUNZYQptGtW3jtoKyxgoe0yrBCoyZfL/5ioQ3URZOXW9I341l3oo+NXEZiW4CEuIzvPECopED4OaZ3RNmeAm4u+a8Jr5f17VyVoL8fr8qcltzwlyyj2iqcgPOQ9ExkHAITgD75bYBe0A5S4H/P9htuWMF3QXoQpwaKeT+lnsC6JE5I6aq6fEAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 201,
    "sha256": "8368c0d0d3a8e98dc4f855925e86228ebe85b6ba9f298094b5c042b04e6090e3",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAFVBMVEX///8oeQBJ3ABV/wHM/7Lu/+ZU/gAqUP3dAAAAAXRSTlMAQObYZgAAAGJJREFUeF5Fi7ENg0AQBCfa/AFdDh2gdwPIogMK2E2+/xLslwOvdqRJhv+GQQPUCtJM7svankLrq/I+TY5e6Ueh1jyBMX7AFJi9vwfyVO4CbbO6jNYpp9GyVPbdkFhVgAQ2H0NOE5jk9DT8AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 256,
    "sha256": "3893288971e36f40e2a49849d86048b79820038bea4c52fa5c29b1885c649fe7",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAx0lEQVQ4y2NgoBYI+cfwH4ZJVgMS0KhEYGyG4FQDkzjzf9P/d/+fgWl0QwiqgSkI/c8IxsgKkDXD5LFq9rwDweiK0A2HqcNqCK5wICSPEcLYAtH+AMN/IXMIBrEJRie6OEgjDAC5x3FqxuUFNiEUA67j1IweTTBxBQ1puAG86jgSEraogskJWSBcwCGF5k30qMJmgMFEhv/MXBAs5oLDAFj8IsczTE7UEeECbhU8+QGZRpaTi2b4L2zF8J9TGk80wjThykzY5AAW/2O1C2mIbgAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadSFW.png",
    "mime": "image/png",
    "bytes": 201,
    "sha256": "ca2b2d4749e5ab4df324de48a641580cb4d8e809e6d54a6dc5fa9f2f7026c2cc",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAFVBMVEX///8AcH4AtswA2PJ55fKi6fIA1/FtpPADAAAAAXRSTlMAQObYZgAAAGJJREFUeF5Fi7ENg0AQBCfa/AFdDh2gdwPIogMK2E2+/xLslwOvdqRJhv+GQQPUCtJM7svankLrq/I+TY5e6Ueh1jyBMX7AFJi9vwfyVO4CbbO6jNYpp9GyVPbdkFhVgAQ2H0NOE5jk9DT8AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/ferongr.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 253,
    "sha256": "97b17a174e1a2fffdb9bc764dd1ccf70b13c04949f47217c3dddc44cce36aa8c",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAxElEQVQ4y2NgoBq4/vE/HJOsBiRQUIfA2AzBqQYqUfn00/9FLz+BaQxDCKqBmX7jExijKEDSDJPHrnnbGQhGV4RmOFwdVkNwhQMheYwQxhaIi7b9Z9A3gWAQm2BUoQOgRhgA8o7j1ozLC4LCyAZcx6kZI5qg4kLKqggDFFWxJySsUQVzlb4pwgAJaTRvokcVNgOqOv8zcHBCsL07DgNg8YsczzA5MxtUL+DMD8g0slxI/H8GQ/P/DJKyeKIRpglXZsIiBwBhP5O+VbI/JgAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadDead.png",
    "mime": "image/png",
    "bytes": 202,
    "sha256": "5fddc924919a94efe1fe922cf49bd1f0d93fc330d10602b8645d29cc66dc3725",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAG1BMVEX+AACLkZFub2yfaF3zZGIAAAD/AAD/iYr/zs8IPcF6AAAABXRSTlMAeprJ7xzg6IEAAABZSURBVAjXY2DABKGBSkqioQwMrGmpxsZhaQEMDGFpIa5pqSCRtPDSNJBIaGh5eShQDYOye0V7iREKAyQFYoiCFAcyILQDGcGmEEZYkGoqiMHKysAQEICwGwAAjBmBqhYlagAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadDeadY.png",
    "mime": "image/png",
    "bytes": 258,
    "sha256": "a629f142d41447104258cb05fb6c2b44ebb1e5d5c69affff8fc590271bc423b0",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAPFBMVEUAAACEgoBva2ilamDxcG7IaWYgFBNOSEf//f0PDQwBAAA7LCwAAAD/AAD+hIX+m5z+zc5HAADPAAAGAADl032uAAAADHRSTlMAzNv0/vz+6v3+7ALrmfyXAAAAaUlEQVQY042PyxKAIAhFAc1eV7T6/3/N8VXOtAgWwBm4ANEPA8AswpySXHvvYZLlpBNrh9pDtcSqAQ1BUTVIjNUQY5icmwfglmXNgE0d6QBF9GigrU0A9LoM53U1kFzk6SBQuWfD/vHqDUCpBmVKTTM4AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadNSFW.png",
    "mime": "image/png",
    "bytes": 206,
    "sha256": "1cdd1bd87cf5ce15058f33cac086fd2006e55717ebec6f1ba90f3b8699b1d06a",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAHlBMVEUfJSCRi5Frbm9dn19082KR/30AAABmzDOq/5vZ/9Gt/vt2AAAABnRSTlMAe5rJ7/4vxEp4AAAAWUlEQVQI12NgwARpiUpKYmkMDGzlZcbG6eUJDAzp5Slu5WUgkfLUsHKQSFpaRGsaUA2DsmvnjBAjFAZICsQQAylOZEBoBzKSzSCM9CS1MhCDjY2BISEBYTcAtgAcKSK2vuIAAAAASUVORK5CYII="
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadNSFWY.png",
    "mime": "image/png",
    "bytes": 243,
    "sha256": "62569b0f29cd34055d981975728b30e6f032dedf12328d37d2a3a2a706d2cabd",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAM1BMVEUAAACBj39tfm1qj2RepFlu2VQAAQAAAAAAAABmyzOX/oSr/pus/pzk/98PGgtatC4CBAI1ENblAAAACHRSTlMA09/p9v77ig0SBcQAAABnSURBVBjTjY9LDsAgCEQRsR2xWu9/2hK/adJFYQG8wABEPwyAYzNnSatjjPAiviWLhPCqI1R7HBrQdCmGBrEETTmnUAq/QMm5dODHyAQOXXR1zLUGsIEI7lonMGfeHQTq9xw4P159AIxSBSC53km7AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadSFW.png",
    "mime": "image/png",
    "bytes": 213,
    "sha256": "c4929fde89410fed008e9a68d861d7a9fed8120d8f3e0dbfafede93fba2b0bd8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAIVBMVEUAAACRjop4dXVpZ2tdcI9dfKdisfMAAAAumMN9xv+s2/+PADT2AAAAB3RSTlMAepGdv83v3HIc4QAAAFxJREFUCNdjYMAE5YXKRuLlDAzsHe2uIRUdBQwMFR1l6R3tIJGOyukdIJHy8lkry4FqGEwzV62aFozMUAFJOQEZ4iDFhQwI7UBGaTiEUVFs3g5isLMzMBQUIOwGAJRlIu9hk08QAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/Monitoring/Favicon/xat-.unreadSFWY.png",
    "mime": "image/png",
    "bytes": 235,
    "sha256": "741158036f46cdea3538ff19584b89010168e5865cd9d73a8dde1e82a17dd5ab",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAMFBMVEUAAACAgYVlc4ljsu4AAAAAAAAAAAAumMODyP6b1P6e1f/g8v89msgSIiwNFxwbPU3tQYj5AAAABnRSTlMAxej+9VTmD9ciAAAAZElEQVQI12NgwARpiUKKYmkMDGzlZUpK6eUJDAzp5clm5WUgkfKMtnKQSFpa54o0oBoGJYvZO88+gjJu7wMyhIBS2SCGGFDxaxADpP32NjAjSe0bSFd6epIaWISNjYEhJRVhNwAGlyJpYtcvcAAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/Monitoring/ThreadUpdater/beep.wav",
    "mime": "audio/wav",
    "bytes": 828,
    "sha256": "9be86ca4ab226ff0140f5733ee6c2b0874562f94a92a1a46ae093b3f4441cda4",
    "data": "UklGRjQDAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAc21wbDwAAABBAAADAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABkYXRhzAIAAGMms8em0tleMV4zIpLVo8nhfSlcPR102Ki+5JspVEkdVtKzs+K1NEhUIT7DwKrcy0g6WygsrM2k1NpiLl0zIY/WpMrjgCdbPhxw2Kq+5Z4qUkkdU9K1s+K5NkVTITzBwqnczko3WikrqM+l1NxlLF0zIIvXpsnjgydZPhxs2ay95aIrUEkdUdC3suK8N0NUIjq+xKrcz002WioppdGm091pK1w0IIjYp8jkhydXPxxq2K295aUrTkoeTs65suK+OUFUIzi7xqrb0VA0WSoootKm0t5tKlo1H4TYqMfkiydWQBxm16+85actTEseS8y7seHAPD9TIza5yKra01QyWSson9On0d5wKVk2H4DYqcfkjidUQB1j1rG75KsvSkseScu8seDCPz1TJDW2yara1FYxWSwnm9Sn0N9zKVg2H33ZqsXkkihSQR1g1bK65K0wSEsfR8i+seDEQTxUJTOzy6rY1VowWC0mmNWoz993KVc3H3rYq8TklSlRQh1d1LS647AyR0wgRMbAsN/GRDpTJTKwzKrX1l4vVy4lldWpzt97KVY4IXbUr8LZljVPRCxhw7W3z6ZISkw1VK+4sMWvXEhSPk6buay9sm5JVkZNiLWqtrJ+TldNTnquqbCwilZXU1BwpKirrpNgWFhTaZmnpquZbFlbVmWOpaOonHZcXlljhaGhpZ1+YWBdYn2cn6GdhmdhYGN3lp2enIttY2Jjco+bnJuOdGZlZXCImJqakHpoZ2Zug5WYmZJ/bGlobX6RlpeSg3BqaW16jZSVkoZ0bGtteImSk5KIeG5tbnaFkJKRinxxbm91gY2QkIt/c3BwdH6Kj4+LgnZxcXR8iI2OjIR5c3J0e4WLjYuFe3VzdHmCioyLhn52dHR5gIiKioeAeHV1eH+GiYqHgXp2dnh9hIiJh4J8eHd4fIKHiIeDfXl4eHyBhoeHhH96eHmA"
  },
  {
    "path": "src/css/linkify.audio.png",
    "mime": "image/png",
    "bytes": 477,
    "sha256": "c139c53763fcc317b7d203d3223a98e7e1b8fd4048c570d27ab6ecf13f1c770d",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAMBQTFRFAAAAAEmSADyHADN6CEOPKmWmADiKNV6lZoO5E2asU3u8B02hXYTAFXK8BEakS3i7MGS0E1mwZYzHSHjCYIrLIGDICFPDHXrIFWnBEGDDdZzWB1G2UYHMH4DPBU60EYrSSX7PGofXfajkeaPgQHzVSoHSDmHLF3vRjLbtea3sa6rsXJ3oSaHrYZXhW5blIKzwPZrqVozbKp7sRonfHpjoJ4vhRHrQLn/eNXnaJ33fNnHMJGvUFG3ZI2THBlPGAU2+9r1cgwAAACh0Uk5TAAcRGSIrO0RQUF9qdnl5hISEiaSoqqqxssnPz9DY2ery+vv7/P39/p/dKS0AAACXSURBVHjaXdDZEoIwDAXQVMuiIFrcd1FQWSqiouD6/38ltVNkel+SnMnkIfAPwrrZBB5Ft3uzlZs9Bnyuewml9HzLnwISP4hSZz4clxujVkNBAETAVeVNpy9BW8BdhpcMbw6oPPphoE027g80u8s21HUQ5gzMvX9gYGXH+EIK8MLotMUAeLpbElTAIo0dC1hqwIth4MoTvt45DOQxQMWhAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.bitchute.png",
    "mime": "image/png",
    "bytes": 513,
    "sha256": "86ac5424316d3d477c65d3c49fa417740a38598be08a458b60a1814e85b405a1",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAMBQTFRFAAAAgICAzDMzzDMz0i0tzjEx0i0t0S4u0C8v1Csr1Ssr1Csr1Csr0ykp1Ckp0yws1Soq1Soq0i0t1Soq1Csr1Csr1Ckp1ikp1Skp1ikp1ikp1ikp1ygo1ygo1ygo1igo1ygo1ygo1ygo2Ccn2Ccn+enp9+Pj9t7e9NHR9MzM8bu78LS076ys65ub65WV6YqK6ImJ54KC5XR05G5u4V9f4FRU3UhI3UVF3UFB3Dw82jU12S8v2Soq2Ccn2CYm2CQklRbHSwAAACV0Uk5TAAIFChEaIicxO0JNWWNqb3R4iZmboaettLzF1t3j6evt8/f7/Ut/7/wAAAC+SURBVHjaTcfRVoJAFIXhPaGZJqQVGIgWDFYWUZnkqOw57/9Wji4Xy++/OGfDUddBGMdh0FM46Yymmo6ejjtwulHBs2LSBbxHXgg9DDOKtZZ0RyT3EZNmv91Z7uttbWyCZzGfdbkWWS/Kt7LJkMvva7VYiZj3748vq5HK3/JnuRJrqk31L3OEbHYuko2LE/RntK6z+QDqLmMrHynAe2r3y9gDcJOSLEg9iwYKQD+hTh+Gvn/bu8LRfRIF7m0dAEgnJl0bT2c0AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.clyp.png",
    "mime": "image/png",
    "bytes": 217,
    "sha256": "0b7a20aff21b2b22d3f76d00058b16932db0df68c2da7c7f01393fd163cde07f",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IArs4c6QAAAC1QTFRF////8vn9zOX2v9/0s9jxptLvmsztjcXrgL/pdLjmZ7LkWqviTaXgQZ7dNJjb3UEC1wAAAFpJREFUeNpjeAcFDMiMV+egjKd5EMbzBs06MOOQgpIOiPFGSUFJ9dw7hjfKQIaS6DuGV0IgBhNQ6gaQodIHZLxrUlDSegdiPE5QswMz3l3WewdhvNgHYmDYDgDke1tpAZA/swAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.dailymotion.png",
    "mime": "image/png",
    "bytes": 274,
    "sha256": "564ba672a782a4e82372865f04ce1548a060821ac22816b2eed7aedcb686a958",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAAXNSR0IArs4c6QAAAMxJREFUeNqFkdENhSAMRRu/bUz4dBMGYA1GYQs/+XQFB3AFV3AO+q634SU+TR4NxdjT20IFa7hciFqnc25zm06tIQoj3Q1axbqpzU1NKyOOjLtasuyGsBAZd/EFFuHDNltoOKkDq6x9ZWT8XhkugBd8u0qIyFeKLtQoVuAzUSJV0DPlBFkbcxNObKZNp3iYKsQKEOgAzdT4AgJLpg7QO8AS3uZh61uJ3mQh8NJkiF4gscn1eU3pGtjQeDxUf2oi8vPUt2FxRPdhMfp33B/2Tf349B8MPAAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.gfycat.png",
    "mime": "image/png",
    "bytes": 324,
    "sha256": "b6fd676059428ee9910daf0f97426a39740cdddab02438a54d027d333c07364c",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAjVBMVEWn3gCo3gSr3w2t4BSu4Bav4Ri35C+45DK45DO55DXA50rA50vB50zC6E/D6FTF6VjG6VvL62vN7G/P7XbQ7XfW74vY8JDa8ZTe8qDe8qLf86Pi9Kzj9K7k9LHp9sDp98Lq98Ps+Mr0++L5/O75/fD6/fH6/fL6/fP7/fT7/fb8/ff8/vj8/vn+/v7///91X4cfAAAAcklEQVR42o3M2xKBUACF4aVQckrIuRJK6H//x2sme4/MuPDfre9i6c/Cc3U5Dj87BuAxsXvGu6JvIIXEHRWwNHCHQNrCzkAFkbSBg4EM8i+Yw7PXBa3zRfuxVyf/Bis7nKwGKAcWxgC8prI5Sc315OlnDfzpDar2S9/oAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.gist.png",
    "mime": "image/png",
    "bytes": 278,
    "sha256": "d0f022932801878d099363c950762f97242dae41cb0b8668cd982a919454e4ef",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IArs4c6QAAACpQTFRFAAAAaWlpubm5zc3PycrL7u7uCxAX/v7/2NnasbK1gYSIWFxhLTI4GR4lkI5WFQAAAAd0Uk5TADicvur2/XGJAcwAAACHSURBVHjaY2BgEPKcosgABEyzz97ZqQBkWOWeOXNtMVBg2Z67d09nKTBI5lRM8Ww/NpFB+054eXn52U0MPrfKgWDtEYa5N0GMuTcRDJ/bIMbeIwzaZ5aXl1fd3cQgefLs9MqzQO1MuyPDK+5kKzAwWO8Kr7i2GWTpmvaKkwoMQCAUXqrIwAAAoI46gu0lGAYAAAAASUVORK5CYII="
  },
  {
    "path": "src/css/linkify.image.png",
    "mime": "image/png",
    "bytes": 712,
    "sha256": "bc0f420fa5abd92a7c56c01d9d2d5e103c44aed5fc5a36a0b4ebeabd9909d39b",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAoJJREFUeNqlk8trU1sYxX/7cc7JSWqb1Da59iEpXr0ovdxcQcSJFnxMxaGOHDv1D1H/AsWhOlJwogPRsVAFJ+KjSqpto/akycnZ57W3AVEQOnPB4oPF+taafB9/CnH55qtOd7hT/yksz9TXrl88vMYuuHLnVef15u9erZS6dmRvc8U5R54Zzi656Gq3u/rbpnOA49maWfGKJo4fUrOWPtEWxzAesh5P4ck6j7p/1R+vixUtobAwVXUcWpS0W7BnARpmg/WtPnZUkAYlMjM5cRzTmp6nNTtPP1NsG8kglwzH9KqKoRLIMaNCICb38c9Sk370lSzP0aIYcubfWcI5zdQE1BR8+OLIckd/JAkCmJ8ALCxOQlHCqJjm5KEa35ISfenA4MaxE8dWXg4sA5OOG0P+bwu2YkFZOhACTwEK6j6cqDEOgKqewFq3quOdnWhj8yO3795DKcPpcxdY3L9MWBVoIZj0ILFgHRRALKARQlpaHPQ1QJYmfN56S1EYHjy8xUx9ieOd4xw+eJRu5LA4NDn7WyGBFGggcRaERPfkTGdhlPL5/UekckS9HltzPd51X6KrAb7vUwmaVMO91EJNZ+lvOu02zgrWBxn6edw6v/ZiA+kfQSiNVIJ0EGCLKmEeoKsV8tRRFB5ah3za3GZnkPBtMI/nBae0RfC1nMFvHEBpHz8MCXyfiYoaTw9PSXxPMr0nZLoWEkpFNhq3R4K5RoF2pcM52LdwEF/lnFluoaVACoGSDhx4WhJ4iszC0zcJoyRnlCbMjgO1SQ0mHpE5iE0J2ZD/FmrgHO7XJZdAxv03ll4sMSYnMUOkDBDbyXbbRKYNAFCpVKJGo7HKLtjN+8fv/B2VaRzENkpWcwAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.installgentoo.png",
    "mime": "image/png",
    "bytes": 507,
    "sha256": "f415e15fae63cf6f75218c13488165d16575534bfe19aeb43593bc57bee9cb7a",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAMBQTFRFAAAAAAAAAAAAAAAAAAAAAAAAd3KIAAAAEQ4RAwULzs7oAAcM2NbmlIfG5+P4vbPyAAAAAAAAAgkQ7Or4DA8YAAAAERASAwsSubXX3tn07+/3AwwUDCY15OD2XV1nS1BaEzJEZ3iOECs9IFBtaGx7RGmCJVl50Mr48fD4bmuk9vb7xM/jWYGf/f77+fj75+H839v719P2x737uKv2harYe6HSSJfLaoS/RZLDQo28Poe1O4CsLWeKSlpzJ1p+FzxSneqjOwAAAC10Uk5TAAYNEBkbL0tZXmNrcHmJjI2aoqqqrLS6u87m6Onr7e7w8vX5+vr6+/39/v7+2FamfQAAALBJREFUeNpljesaQkAYhHdRLKWSjjqIQrRyKFlK939X2bX1p+/P+80888wAAERJgi1+j2hYFqKPwJ+xW1c2gq32qnojAyAtngU5LEemWxZvTegSEQ7T/FHVNEE79hivVD8/8zJR6k/Dte5n+ZCtUKs3wHGS+SoVbG8X4DBJjwhyfQpwHEQXYnfOxL0l160+bwriyNSYNeT+UihKR2EJz/YcmYN1mMjQIEe3CkX4xf99ABzOEyTh/fKEAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.liveleak.png",
    "mime": "image/png",
    "bytes": 511,
    "sha256": "ec9f00101f8a6bb4b76d01f8da91c42eb34fcff9318c3e7dd840e5a73496e130",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAALRQTFRFcDk5Wx0doj09mSIi/Pv77/Dw6ezs29ra1tLSwrq6wGVlpF1di1ZWjSkpfhER9fT04ubm68zM19LSw7S02aqqzqamvqurwaGhsJOTunR0s3FxqW5uo2xsmm9vtGJimWNjkVxcuUpKtEZGsDU1pSoqeTk5rBIScCkprQsLlxAQpAEBnQICaxUVlAICiAEBYg8PewQEgAEBdQICbAICWwICtpycyHl5p4eHqAAAYQkJXQoKVgAAewTIdwAAADV0Uk5TmZ+or/39/f39/f39/f39/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v5oWOIfAAAAuElEQVR42kXKwS4DYRhA0fPPfKrtpM0sOpsmiCDdef9H8ABWhE0RDWo61dEIHcTC3Z3kRn5W+q++il83xp46pOo0ygaa7d0A7W4vmvfFMR4Hs+s1VR2pWmdgmUMefzJZUUCYpwTtot8yLyOlLP+SvyDpksiTLu8gI7mP7meRSNMaSWT5ZwIMIZIVJlWt3Nl2h9Eb9TB+83rE7VDo9/HxHM1NqxsJ++BkOcPDtImL88Km2BQFHGwuvwGKmzk9p5YkgwAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.pastebin.png",
    "mime": "image/png",
    "bytes": 376,
    "sha256": "3afb876e37bfb2bf57960968be8f4ae30773d04f370c2d7de47ebcf4211ba26b",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAF1QTFRFAAAAMzMzLi5GZGx0BQUFXmhxJScqOz1DXWNoa3F3a290k5melJaara+xlpeY8PHx4eLi29zc1dbWz8/Px8fHv7+/t7e4rq+vpqepnZ6ejo6OhISEfX5+d3d3YGBgwIwa3gAAAA90Uk5TAAULITE2YX6anqrW3vD+JUDspAAAAK5JREFUeNpNz0luwzAMBVA5ieMOiQbOouTc/5il2kXzueLDBwimlC77f66xb99WpVrTZpBtT+naSTKxeXHs/hmgnSd1PdvJw78CWitQsFBlEFyAowzM7hadX2i5ZNap2ZvDApCqTao0RaUFNHDwhKEes4BHl+5MJ0/JC2SKo4NVo6xHgJ06OCiOw+MWMPUlL+pdS33et7eGw/O4pHg2I0KtpdjjHntk//jLcdtSSj+AHw++3ZKWJwAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.peertube.png",
    "mime": "image/png",
    "bytes": 492,
    "sha256": "36dab2406eb5134e40d73390143fd21d2646f7329629d580a22fabed60f2c024",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAMBQTFRFAAAA/wAA/1UA/2YAxlUcdHR0Lhcu62IUKioqcHBwFBQUdnZ2GxIb8WoH82cGc3l5c3NzEhge82gGHBwc9GcFHhkZcXFxJBwZc3Nz8WcFeXNuGxsb8mkFdHR08GkFVi0TlnBZ7mgIHhwecHBwHBoadHR0c3NzGhga8WgFGxkZc3Nz8WcFc3Nz8WgFc3NzGRga8WgFc3N08WkFGxka8WgFdHR0GxkadHR0GxoadHR0GhgZ8WkE8WgE8WgFdHR0GxkaZ7hqxgAAAD10Uk5TAAEDBQkLCw0YGRkcHCQqKiorLC4vMzRbXV5fYGFjZnZ5hYmLkpadnZ+hoqPU1dXV1tjZ2dzi4uPj8/P09Vap/bMAAACRSURBVHjaVc/XEoIwEAXQjYqKGrFXLNg7ILGb5P//ys1IhmQfz869swtQWXUJmFO7h+OiBU/53raJBVIm/YIN4SzomJF9k7KzX9KQYCll/HOsEwXlBTYq4Dzy8wju0tNwHeYQqo944ij47lq4USBeG4+yaIqlKQgRzwNcG3Aa/Q/TkUMDIIPbZeCAMe66Z77/A+q6ElNsGDWuAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.soundcloud.png",
    "mime": "image/png",
    "bytes": 447,
    "sha256": "7c8064497e03f07cbd5cb3960a2bdf8fcf04fa239c39208f482e7ad8b2e3723f",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAMBQTFRF/2cA/2YA/2YA/2YA/2YA/2YA/2YA/////vby/eXW/N3K/NvJ/NnD/NjI/c+6+8uq/MKr+sKi+r6g+rme/LWY+qZ6+aNv/5Ux/48v/4ss/oos/Yos/4ol/Ikr+IFU/oMp/IIo94Iz9n88+XlK+IAo/n0l/Hwk9X0s93ot+Xok/XUh+nMg9m889HEg92k2+msc+2Qa/2YA/mYA/WUA+WAY91wj+lQU+00O+E0O/0kD/UcK+0cK+UYK/kEH/EAH/jwEfj1KkQAAAAd0Uk5TSFrk5+rt9gISbbcAAACaSURBVHjaTcE5igJRFIbR779v6K4OTaTNxFAQdP+LEMElOOEQiGBJvUHRoDxHClN6605h2NELe813fPv3CCEDoFTwRBAegESVVxSONm5yHDRkPEHky+0n1fY4LiY3ku1PKi5B6awxQ9ssIYDrLmD4h+wVgAKGRYCPxvBoUs+Dw/AO2F9Fi18B4q3Sepzo1WrLpC9pKdyM3io/AdrDMCk60CjnAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.streamable.png",
    "mime": "image/png",
    "bytes": 360,
    "sha256": "36066b274c1c9d8c986ea95b068ca22b281b3feac28b443afb6b127840bbdae8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAGBQTFRFAAAAAID/CI/4gsr/BpH5CJH5BpL5arz7BZL6Z7r8BpP7BZH6BpH6JZ76B5L6BpH6BZD6/v//9Pr/5fP+2O7+wOL+veH9rtr9p9f9a7z8Y7j8T7D8O6f7JJ37GJj7BZH6dIRsvAAAABF0Uk5TAAYiKyyAiJCTlK6+0dfy+fzQvCOfAAAAmUlEQVR42l2PbQ+CMAyEC8KciBsbUxl7uf//L21HoobnQ5Neer2WhH6cjZlVTwfdaLGAsapr/YQvkygj/lDstwAKmFyB5SIDOTifKpcduNIMrGHf6muNwRc8yCC7DCQuxe0wTUhAeANVhGZZ49OXWDZf2aKA5Hlpds5H4NZiqySWVFqsjPzQp9PvxzPKorFo6YVBy/t6ICL6AH4DE9XqS58KAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.twitchtv.png",
    "mime": "image/png",
    "bytes": 183,
    "sha256": "7bed7671d4df4c2641b6e269a8dc2690e84312e5d93f858b77e9e9048d181aed",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IArs4c6QAAABVQTFRF////Zz6lZEGlY0KlZUKkZEGlZEGltJNrJQAAAAZ0Uk5TASVPXWV9PfYTqwAAAD5JREFUeNpjYEiDAAZmGIMtjQEEUBksCW74GBi6WGGMsEQgIy0BiAXAjLS0RAYQIw0kwABiJjEwQBgKDAwMAD4aF9kc7HdHAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.video.png",
    "mime": "image/png",
    "bytes": 114,
    "sha256": "169be3e2fe05073527f73e39af740eb386b78a46084d99fcb3379e4a737b2c45",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAAXNSR0IArs4c6QAAACxJREFUeNpj+M+AHzIQVEBYxX98JFEKSHPlf8IK/hNW8J+AAlLdMCgCihAEAJBiCAfi8KAsAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.vidlii.png",
    "mime": "image/png",
    "bytes": 524,
    "sha256": "6335ce7e1a00d46063db0b0e4c796da47fd61413de1e1f973e2bbab6c3d828f9",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAL1QTFRFAAAAAFX/AAAqAFv/ABxVAEr/ACeFAFf/AB1NAFb/ADCbAFD/A1v/AFT/AD68ADqzAEniAln/AD69AEPEBVj6AD7BAkjSD2L/CVHeD2L/GWj8EVvnMXb/GmbzKnH8KHH8U4n/Qn/6GGb9NHf8WIz4Zpf+Zpf2b576//7+//78+/r59Pb97PH/7e/34Or/5On22OP/2eP2ytj6wdL5ssn/tMf4qMH/nbr8mLb4kbP6g639daP/dqL3SIP+KnL+KsPlKgAAACh0Uk5TAAYGDhIfLjU1PkBDVFhfYWl2d36Rk6CmsLjFx9nZ3unu8PL5+/39/kamH9cAAADJSURBVHjaHcjLUoNAEAXQ248hQ0gCxIVW8f8f5d4yVlyICwTm0W0lZ3mItMFWDwNjXgFAh05p/jlf+sP7MzhO3bUNMiyOEAiQyGS2xVM+5lPHOzSny9405H6ffpvCldei1Mfg8vaVYQa23CC1avT5ilAdWtJ3myfMPO3gCjC2rNVuxjC/l0ekorSLM6rkZ1g+UBkfQW4EgUuJ1UsrK9dwbBTYSlg3yK0r516jABRfEvFSi49CHwTgOqpbWlxAtimAPyHPayKAzf4BWmNnf7ZivjUAAAAASUVORK5CYII="
  },
  {
    "path": "src/css/linkify.vimeo.png",
    "mime": "image/png",
    "bytes": 307,
    "sha256": "e53e1dbcca676841e1f8156dd655e09a0f48e8eed962276cbcdc20a3e378d5d8",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAYFBMVEUAAAAIdZUKh6sLlLkLmr4LmsAMp88NrdYVW3MZj7Acstkrt9s1e5E7vN5EfI9JvdtKwuBijp5kpbl30eiDt8aG1uqRr7qTyNehxM+k4PCy3enB3OTg6Ovv9PXw+fz////L9U5WAAAAAXRSTlMAQObYZgAAAIFJREFUeNplz90OwiAMBWAQpAoyxclkP3je/y0H2AQXz0WT8100rRD6kNI9/cRroemQL3hXhoujZYj4OHoAmBvYGcBISwbWBvfXCrytnIDUQMkbsBpagMA7zhtQdyTFQAmIG7IkYniiZuh3XGsPqoOZkMOJOpAcLqUzNFGGu/57fwc1hgtp0mVSyQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.vine.png",
    "mime": "image/png",
    "bytes": 383,
    "sha256": "ed251b98ec7cbbc763b870128658d6ab482c65878a4ea5d94e4ff3e488c2d15e",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAF1QTFRFAAAAAKqqAMaOAL+VALyUALmNAMGTALySAL6RAL2OALyNAMCPAL+PALyPAL2PAL+QALyQAL2QAL6PAL+PAL+QAL6PAL+QAL+PAL6PAL6PAL6QAL6PAL6PAL6PAL6PbycyeQAAAB50Uk5TAAMJDBMdISozNkFJUFttd36ImKqvtL/Iz9zn7/b6+V1hqgAAAKZJREFUeNotyEF2gzAMQMFvyZZJ0sf9zwkpNRhJ3TDLKTzeP8b1PagFEuirwVLmrB/jGPCyOPRly6zyKfdAlHszU0U8UChCZEIiM6hKOCpaMlCsMZzWxQf3EZrWy7wIq5VxRirS1QdBa315cyrZa7mciQlcZ+Uevb2uRCT3P0chu8q8l1XPbSYKLl2Jtd/bCSjgtdXFcv/lifDWNL978gTuWo49APgHoehXKFGk4JYAAAAASUVORK5CYII="
  },
  {
    "path": "src/css/linkify.vocaroo.png",
    "mime": "image/png",
    "bytes": 778,
    "sha256": "f730c4476e9029236a8f44c27d51005dea015c1467afa9d94e7970ac6fe15e9d",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAYBQTFRFAAAAAAAAAFUAJ04UFDsAKFENTnosIU4LO1gUM1URN2ccRm4dOmodaZI2P2seK2ULeZ9MO24VYIgtXIorPXMUI1oIYY0vS40kg65KhaJuZIg+epxVm8ZZYIswNXUPSXIhQ4AaPYQSPYIQpNRlUIAlg6xJTHMyjLpJeKRFmcZbcqA3ksJQPIUNcKA8osCClcRZZ5Mzcp4/m8RjpdRljrtgXp4sRpUSXKcpYqMwk8JVrdtpaKsxga1GjbtVVqcfjbtNocxngrpEt+Zyab02vu53pdFkXqwqotJilcZUzPKTrNV2tb1mq9hnqdlZUKMX7u7uzf6CzP2By/yAzfeOyPd+xfR8wfB6v+52uuhzweJ1tuVvx8fHtOFvsuBrwddyt9iEseJesNtvrdxkpNJhv8JsnNdboNFfotFYpcxposJxm8dco7aFm8BjvatpiMtOkMJOmbFyiMFKlbNlvZ1ghb1Afb5BjqxffJJbe4doUagXxWFTzEVR1zZP4i9QW2hGWmFP8o8FIgAAAE90Uk5TAAIGDQ0TFxcaHiUsNT1FR0pKWmRkZmdpa2trb3V1eH2IjZOVlpqdnp+ipqqtsrO7ws3O2dra2tzd4OHj5ujo7e/x8/P1+Pj6+/z8/P39/a8ykJsAAADdSURBVHjaY4AARg4VXU1tMUYGMGDnFzByjYmISvLlYwADUTWvsAAgiErQYgILSHoGgEFgvp8OWJMeiBdaHh+QVmkGUsJkkliRGZATXR8QXiICUsCTV+RfFxCaXRYQmC4IEmA1DSvICI8NBeqzYQfxuZitgDYkhQQ5aXIC+dK2Fiy8xj7uqaUG8mBncPI4KzFyaBiWFvpkeYCNYBB3UzDPCQ5KiUu2dhMGCTA5OCpK5VbXVkWo61uCncrNxcDtXVNbHGRvJ8cABUxWkcWhLoYesgwwIKEsI8DGpCrEAABv9i67kptWHQAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/css/linkify.x.png",
    "mime": "image/png",
    "bytes": 249,
    "sha256": "fe6133e71c552e198c600366b956656a17094fb9334485a8b28b6629ebbc4915",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAAXNSR0IArs4c6QAAALNJREFUeNpjQAKMUFpQSIoJwudlB1NzLy47yMXEwMRgdFASrEJmJ0/vTAYWBpXThlCd8QsYTngx8B8IYwBrZWBiWBKqeEZ2SzoDM8x0keOS8a9LwPJQJT5rGXaDNUABC8OWMpGLEowIFfYHLyuHrYApYWTQPKFsdphhSQZMhOekDwNDcwfTKQ2w6xk5d8YzMDOxnbC33szMCNLQ2sPAxMDEYHh5wfMYsCZBqDd5pfl4sXgeAOR+JWx65NE5AAAAAElFTkSuQmCC"
  },
  {
    "path": "src/css/linkify.youtube.png",
    "mime": "image/png",
    "bytes": 225,
    "sha256": "894f562e836bf0d77a24c07fc145626d8f1f563818f8a1cbe37590dfa7d0e960",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IArs4c6QAAADBQTFRFAAAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/////+Dg/8DA/7Cw/1BQ/0BA/xsb/wAABceraAAAAAh0Uk5TABAwQFBgcIDN7a/fAAAAS0lEQVR42mPAAoTNy8uLDRkYWP+DQQCDPoTxicEfwvjKUP///8/7//9/BzF+dL+HMrqgjJ/n////DlL8D6QYrh1hIIOwGcgKLHYDAI8wSVRb1KCAAAAAAElFTkSuQmCC"
  },
  {
    "path": "src/meta/icon.gif",
    "mime": "image/gif",
    "bytes": 96,
    "sha256": "aeb216a76138df2f73074befeb566aaf0742323370555d08f957c137ea1c18e4",
    "data": "R0lGODlhEAAQAKECAAAAAGbMM////////yH5BAEKAAIALAAAAAAQABAAAAIxlI+pq+D9DAgUoFkPDlbs7lGiI2bSVnKglnJMOL6omczxVZK3dH/41AG6Lh7i6qUoAAA7"
  },
  {
    "path": "src/meta/icon128.png",
    "mime": "image/png",
    "bytes": 196,
    "sha256": "2afafa25433ea1cd775b795d2af79107b4ffcc7d871ca550e2b162fba2b60492",
    "data": "iVBORw0KGgoAAAANSUhEUgAAAIAAAACAAgMAAAC+UIlYAAAACVBMVEUAAGcAAABmzDNZt9VtAAAAAXRSTlMAQObYZgAAAGlJREFUWMPtlkEKADEIA/tJP9lXLttQto2yHxgDHozTi0ToGK2WKZZ+HAQQMZc+xBwI4EZ+wAC2IfPuSIDOZJrSZQEAX9eVJhhwIuUYAnQe8rhAEMAZlTI2MID9f5Clyh0JeE1V1ZEAvB4qDfwuJTSGRAAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/meta/icon16.png",
    "mime": "image/png",
    "bytes": 154,
    "sha256": "4ac57c88efadca9eee1f7741eb3aceb40d72212d9b41a0841c3e8cdd46745e00",
    "data": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAACVBMVEUAAGcAAABmzDNZt9VtAAAAAXRSTlMAQObYZgAAAD9JREFUeNqNjsEOACAIQsP//+hYydDZIT0Ab2aunwLQDCLiZXqmpYgcn1RrM5ePZm7EO+q8X/kOA7bkErZk1gZjNgDBiT/h1AAAAABJRU5ErkJggg=="
  },
  {
    "path": "src/meta/icon48.png",
    "mime": "image/png",
    "bytes": 185,
    "sha256": "94bf172e06c4ae9b5291edb16609a6a71c816140eb632dbf59a9c1adc680e290",
    "data": "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAACVBMVEUAAGcAAABmzDNZt9VtAAAAAXRSTlMAQObYZgAAAF5JREFUeNrtkTESABAQxPD/R6tsE2dUGYUtFJvLDKf93KevHJAjpBorAQWSBIKqFASC4G0pCAkm4GfaEvgYXl0T6HBaE97f0vmnfYHbZOMLZCx9ISdKWwjOWZSC8GYm4SUGwfYgqI4AAAAASUVORK5CYII="
  }
]
```

## Appendix I. Application license


```text
/*
* 4chan XT
*
* Licensed under the MIT license.
* https://github.com/TuxedoTako/4chan-xt/blob/project-XT/LICENSE
*
* 4chan X Copyright © 2009-2023 ccd0
* https://github.com/ccd0/4chan-x
* Appchan X Copyright © 2013-2016 Zixaphir <zixaphirmoxphar@gmail.com>
* http://zixaphir.github.io/appchan-x/ 
* 4chan x Copyright © 2009-2011 James Campos <james.r.campos@gmail.com>
* https://github.com/aeosynth/4chan-x
* 4chan x Copyright © 2012-2014 Nicolas Stepien <stepien.nicolas@gmail.com>
* https://4chan-x.just-believe.in/
* 4chan x Copyright © 2013-2014 Jordan Bates <saudrapsmann@gmail.com>
* http://seaweedchan.github.io/4chan-x/
* 4chan x Copyright © 2012-2013 ihavenoface
* http://ihavenoface.github.io/4chan-x/
* 4chan SS Copyright © 2011-2013 Ahodesuka
* https://github.com/ahodesuka/4chan-Style-Script/ 
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*
* Contributors:
* aeosynth
* mayhemydg
* noface
* !K.WeEabo0o
* blaise
* that4chanwolf
* desuwa
* seaweed
* e000
* ahodesuka
* Shou
* ferongr
* xat
* Ongpot
* thisisanon
* Anonymous
* Seiba
* herpaderpderp
* WakiMiko
* btmcsweeney
* AppleBloom
* detharonil
* TuxedoTako
*
* All the people who've taken the time to write bug reports.
*
* Thank you.
*/

/*
* Contains data from external sources:
*
* src/Monitoring/ThreadUpdater/beep.wav from http://freesound.org/people/pierrecartoons1979/sounds/90112/
*   cc-by-nc-3.0
*
* Font Awesome (https://fontawesome.com)
*   license: CC BY 4.0 (https://fontawesome.com/license/free#icons)
*
* Icons used to identify various websites are property of the respective websites.
*/
```
