# 4chan-XZ: behavior and reconstruction specification

## 1. Purpose, scope, and how to use this document

This is a descriptive specification of **4chan-XZ**, an imageboard enhancement application distributed as a userscript and an unpacked browser extension. It is intended as the input to an advanced programming model rebuilding the application without the original application source. Implement the described observable behavior, state transitions, configuration, interfaces, and failure handling. Internal implementation choices may differ when they preserve those contracts.

The reference is repository commit `a0becac634e96123c03c4217b6e5b49b3da1a4c4`, inspected on 2026-10-22. The embedded application version is `2.24.2`, with version date `2025-12-23T20:20:20Z`. These are inherited identifiers, not a claim of a new public XZ release. The working tree was clean before this document was added.

This document describes the implementation found in the checkout, rather than treating its README or historical release notes as a complete specification. The project continues 4chan X through 4chan XT. Finishing TypeScript conversion, redesigning architecture, and performance optimization are project directions, not additional user-facing capabilities to invent.

Read sections 2–19 as the behavioral specification. The appendices supply exact settings, installation metadata, archive registry, initialization order, UI templates, styles, and binary resources. Large reference blocks are stored in the companion [reconstruction directory](reconstruction/) and linked from the appendices. Keep this document and that directory together as the reconstruction reference set. Other source paths in the prose identify responsibility in the reference implementation; the companion files provide the extracted reference material. Preserve original attribution and resource licenses.

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

Visually inherit the board's familiar compact layout. Support the bundled Yotsuba, Yotsuba B, Futaba, Burichan, Photon, Tomorrow and Spooky theme adjustments. Use the linked stylesheet resources and `--xt-*` custom properties as the precise styling reference. Settings, QR, menus and watcher adapt to narrow screens; the filter editor must remain usable on mobile widths. Icons have labels/titles and interactive controls remain keyboard-operable. A Notice has info/warning/error style, close action, optional timeout, and optional HTML/link content.

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

Use [archives.json](reconstruction/archives.json) as initial data. Each archive has name, domain, software, HTTP/HTTPS capability, boards, media boards, optional stable UID and report capability. Support `fuuka` and `foolfuuka`. First compatible entry is the default per board and destination; user selections override it only when still compatible. Separate selections for thread pages, thread JSON, individual post API and files. Only FoolFuuka supplies the JSON/post destinations here.

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

Initialize DataBoard keys to empty dictionaries, except customTitles begins with `{"4chan.org":{"boards":{"qa":{"boardTitle":{"orig":"/qa/ - Question & Answer","title":"/qa/ - 2D/Random"}}}}}`. Initialize boardConfig to `{boards:{}}`, archives to the linked archive registry, selectedArchives/cooldowns/Index Sort/siteProperties to empty objects, and both `Last Long Reply Thresholds 0` and `Last Long Reply Thresholds 1` to empty objects. Runtime initialization overrides the configuration grouping named archives with the actual archive registry.

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

The appendices link to declarative reconstruction material in companion files. CSS/templates are exact reference resources rather than a substitute for the behavior above. The asset registry stores base64 data so a reconstruction can recover binary resources locally without downloading originals. Font Awesome icons remain a dependency with their own license; dependency metadata identifies the reference package versions. Preserve the beep's source attribution (pierrecartoons1979, freesound sound 90112, CC BY-NC 3.0) separately from the application's MIT license.

## Appendix A. Complete default configuration

This is the evaluated configuration, including descriptions and indentation. Arrays have `[default, helpText?, indentation?]`; nested objects organize the settings UI and are flattened at startup. Preserve exact key spelling/case. Multiline strings include default rules, templates and CSS. A setting enabling a menu feature is distinct from activating that mode.

Reference file: [config/defaults.json](reconstruction/config/defaults.json).

## Appendix B. Installation identity, hosts, grants and dependencies

These are the reference package metadata and build dependencies. Historical project/support URLs and IDs are intentionally retained. Use the final-build update disabling described above. Dependency ranges alone do not guarantee an identical dependency graph; the reference used a lockfile.

Reference file: [installation.json](reconstruction/installation.json).

## Appendix C. Initial archive registry

Treat these as seed records with capabilities, not verified current service availability. User overrides and refreshed registry data take precedence.

Reference file: [archives.json](reconstruction/archives.json).

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

Reference file: [runtime-modules.txt](reconstruction/runtime-modules.txt).

## Appendix F. Exact UI templates

Use these as DOM/label/layout contracts, binding behavior as described above. Asset imports and generated JSX components must be converted to equivalent DOM. The linked static templates contain no missing local includes. Native posts are generated to match the selectors in section 4.

### src/General/Index/NavLinks.html

Reference file: [src/General/Index/NavLinks.html](reconstruction/resources/src/General/Index/NavLinks.html).

### src/General/Index/PageList.html

Reference file: [src/General/Index/PageList.html](reconstruction/resources/src/General/Index/PageList.html).

### src/General/Settings/Advanced.html

Reference file: [src/General/Settings/Advanced.html](reconstruction/resources/src/General/Settings/Advanced.html).

### src/General/Settings/Export.html

Reference file: [src/General/Settings/Export.html](reconstruction/resources/src/General/Settings/Export.html).

### src/General/Settings/Filter-editor.html

Reference file: [src/General/Settings/Filter-editor.html](reconstruction/resources/src/General/Settings/Filter-editor.html).

### src/General/Settings/Filter-guide.html

Reference file: [src/General/Settings/Filter-guide.html](reconstruction/resources/src/General/Settings/Filter-guide.html).

### src/General/Settings/Filter-select.html

Reference file: [src/General/Settings/Filter-select.html](reconstruction/resources/src/General/Settings/Filter-select.html).

### src/General/Settings/Keybinds.html

Reference file: [src/General/Settings/Keybinds.html](reconstruction/resources/src/General/Settings/Keybinds.html).

### src/General/Settings/Sauce.html

Reference file: [src/General/Settings/Sauce.html](reconstruction/resources/src/General/Settings/Sauce.html).

### src/Images/Gallery/Gallery.html

Reference file: [src/Images/Gallery/Gallery.html](reconstruction/resources/src/Images/Gallery/Gallery.html).

### src/Linkification/Embedding/Embed.html

Reference file: [src/Linkification/Embedding/Embed.html](reconstruction/resources/src/Linkification/Embedding/Embed.html).

### src/Miscellaneous/Report/ArchiveReport.html

Reference file: [src/Miscellaneous/Report/ArchiveReport.html](reconstruction/resources/src/Miscellaneous/Report/ArchiveReport.html).

### src/Monitoring/ThreadWatcher/ThreadWatcher.html

Reference file: [src/Monitoring/ThreadWatcher/ThreadWatcher.html](reconstruction/resources/src/Monitoring/ThreadWatcher/ThreadWatcher.html).

### src/Posting/QR/QuickReply.html

Reference file: [src/Posting/QR/QuickReply.html](reconstruction/resources/src/Posting/QR/QuickReply.html).

## Appendix G. Exact stylesheet resources

Apply the shared style and variable base together with the matching site theme and appropriate auxiliary-page styles. Inline relative image URLs using the linked binary resource registry. Apply user CSS after defaults so user overrides win. These resources preserve detailed sizing, colors, states, responsive rules and selector contracts that a visual summary cannot capture.

### src/Icons/icons.css

Reference file: [src/Icons/icons.css](reconstruction/resources/src/Icons/icons.css).

### src/Linkification/Embedding/FxTwitter.css

Reference file: [src/Linkification/Embedding/FxTwitter.css](reconstruction/resources/src/Linkification/Embedding/FxTwitter.css).

### src/config/user.css

Reference file: [src/config/user.css](reconstruction/resources/src/config/user.css).

### src/css/burichan.css

Reference file: [src/css/burichan.css](reconstruction/resources/src/css/burichan.css).

### src/css/futaba.css

Reference file: [src/css/futaba.css](reconstruction/resources/src/css/futaba.css).

### src/css/photon.css

Reference file: [src/css/photon.css](reconstruction/resources/src/css/photon.css).

### src/css/report.css

Reference file: [src/css/report.css](reconstruction/resources/src/css/report.css).

### src/css/spooky.css

Reference file: [src/css/spooky.css](reconstruction/resources/src/css/spooky.css).

### src/css/style.css

Reference file: [src/css/style.css](reconstruction/resources/src/css/style.css).

### src/css/tomorrow.css

Reference file: [src/css/tomorrow.css](reconstruction/resources/src/css/tomorrow.css).

### src/css/variableBase.css

Reference file: [src/css/variableBase.css](reconstruction/resources/src/css/variableBase.css).

### src/css/www.css

Reference file: [src/css/www.css](reconstruction/resources/src/css/www.css).

### src/css/yotsuba-b.css

Reference file: [src/css/yotsuba-b.css](reconstruction/resources/src/css/yotsuba-b.css).

### src/css/yotsuba.css

Reference file: [src/css/yotsuba.css](reconstruction/resources/src/css/yotsuba.css).

## Appendix H. Binary resource registry

In [assets.json](reconstruction/assets.json), base64-decode each record's `data` to recreate the path if reproducing the build layout, or use `data:{mime};base64,{data}` when inlining. Verify decoded bytes against SHA-256. These are resource bytes, not executable application code. Retain their original attribution. Font Awesome SVGs are supplied by the package dependencies rather than this registry.

Reference file: [assets.json](reconstruction/assets.json).

## Appendix I. Application license

Reference file: [LICENSE.txt](reconstruction/LICENSE.txt).

