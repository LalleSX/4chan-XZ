# Imageboard enhancement extension: product and behavior description

## Intent

This document describes the experience provided by 4chan-XZ as the basis for an independent imageboard enhancement extension. The new version has its own identity, architecture, implementation and preferences. The reference is the product's capabilities, interaction patterns and visual character; its internal organization and historical technical choices do not define the new version.

The description is intentionally about what the extension does and how its features relate. It leaves the choice of language, framework, dependencies, packaging, internal interfaces and persistence format to the implementation. An equivalent experience can be built with different components and a different arrangement of controls.

The accompanying [HTML](visual-reference/html/) and [CSS](visual-reference/css/) retain concrete visual detail: compact controls, spacing, panels, typography, colors and interaction states. They are design references rather than a prescribed application skeleton. Their element identifiers and class names are incidental. The visual examples can be adapted to the independent version's own components and naming.

## The overall experience

The extension turns an imageboard into a more comfortable place to browse, follow conversations, view media and post. It lives primarily inside the board page. A compact navigation bar, contextual post actions, previews, a thread watcher and a floating reply panel work together around the existing content.

A board can appear as a conventional list of threads, a searchable catalog, an infinitely scrolling feed or a view containing all available threads. A thread can update without a full reload. Quotes can reveal their targets in context, media can open without leaving the conversation, and reading progress survives returning later.

Personalization is a large part of the experience. Readers can hide unwanted content, highlight useful posts, adjust presentation and keyboard controls, and choose how much automation they want. A minimal setup still feels like the original imageboard; more features can be exposed without requiring the reader to leave the page for routine actions.

Information about a post remains consistent wherever that post is shown. A preview is another view of the same post, rather than a new contribution. Hiding, own-post markers, media state and quote relationships make sense across the thread, catalog, watcher and previews.

## Page integration and navigation

The extension recognizes board indexes, catalogs, individual threads, archive listings and direct media pages. It adapts to the capabilities of the site and board: available posting fields, supported attachments, spoiler handling, identity indicators and archive access can differ. Other imageboards may expose a smaller set of features than 4chan. Unsupported features are absent or clearly unavailable instead of appearing to work.

Content already on the page and content arriving later receive the same enhancements. Expanding a thread or receiving new replies produces the same quote controls, filtering, formatting and media tools as the initial page. Reopening a preview or initializing the extension again does not multiply controls or count posts twice.

A navigation bar keeps common destinations and actions close at hand. It contains board links, current-board index/catalog/archive destinations, settings and shortcuts for enabled features. Readers can favor particular boards, rename navigation labels and include external destinations. The full board list remains accessible alongside the personalized list.

The bar can stay fixed, move to the bottom, or hide automatically to leave more room for content. Floating panels can be moved and remember useful positions. Scrolling to a post accounts for the space occupied by fixed controls so the target is visible.

Board titles and subtitles can be personalized. Optional navigation controls move between threads, replies, the beginning and end of a thread, or posts sharing an identity marker. Normal link behavior remains available, including opening destinations in a new tab and using browser back and forward navigation.

Missing or partially loaded pages produce useful feedback. A failure affecting one feature does not make unrelated controls disappear. Where the site's native enhancement tools would conflict with the extension, the integration avoids running two competing versions of the same behavior.

## Board browsing and catalogs

The enhanced index brings searching, sorting and layout controls together above the thread list. A refresh action indicates whether loading is in progress and when the displayed information was last refreshed. Empty search results, failed requests and the end of an infinite list have distinct states.

The conventional view presents opening posts with selected recent replies. Long comments and omitted replies can expand in place. A catalog presents threads as compact tiles containing the thumbnail, a comment excerpt and useful counts. Thumbnail sizes are adjustable while preserving aspect ratio. Hovering a tile can reveal a fuller comment and recent replies without navigating away.

Paged browsing, infinite scrolling, all-thread viewing and catalog viewing offer different ways to explore the same board. Changing views retains useful context. Refreshing or moving between pages does not unexpectedly discard a search. Browser history returns to a meaningful previous view.

Sorting covers bump order, thread age, latest visible reply, latest substantial reply, reply count, attachment count and activity. The substantial-reply view emphasizes replies with enough actual text to distinguish them from short reactions; its threshold is adjustable. Sorting can be reversed and remembered per board. Sticky threads, highlighted threads and watched threads can receive priority, while hidden threads can move out of the way.

Plain search combines terms across the opening post's text, subject, displayed identity and filename. More expressive field-based or pattern searches are available for readers who want them. A malformed search produces understandable feedback rather than breaking the index. Search and sort cooperate with filtering, so hidden material does not unexpectedly dominate results or previews.

Readers can temporarily inspect hidden threads through a separate reveal control. Their hidden state remains intact when the normal view returns. Catalogs supplied by the site can receive appropriate enhancements even when the extension's own index is not being used.

## Local filtering and hiding

Filtering gives each reader control over their own view. It affects local presentation; hiding a post does not remove it from the board for anyone else.

A reader can hide an entire thread, a single reply or contributions from a particular poster where the site provides a usable identity. Hidden content can disappear completely or leave a small stub. A stub shows what was hidden, optionally explains why, and offers a way to reveal it. Replies to hidden posts can also be hidden recursively, keeping a filtered conversation from continuing through visible responses.

Rules can examine post numbers, names, identity markers, tripcodes, staff roles, pass indicators, email/options, subjects, comments, flags, filenames, dimensions, file sizes and image hashes. General rules can search several fields together. Image hashes and poster identifiers represent exact identities; a text pattern has a different meaning from matching one of these identifiers.

Matching supports ordinary text operations and regular expressions. Rules can apply globally, to selected boards or sites, or to work-safe/non-work-safe groups, with explicit exceptions. They can distinguish opening posts from replies and posts with attachments from posts without them.

A match may hide, highlight or notify. Highlighted threads can move toward the front of the index. A rule can combine highlighting and hiding, attach a custom reason, include the same poster, or follow replies. Multiple rules can contribute useful actions to the same post without duplicating the visible result. Remembered own posts receive special treatment so broad filters do not casually erase the reader's own contributions from view.

The rule editor makes this expressive system approachable. Its main form offers a field, matching mode, value and action. Additional controls reveal scope, exclusions, attachment restrictions, recursion and highlighting options. A live preview explains the pending rule, and a sample-text tester helps the reader understand a match before saving it.

Saved rules can be disabled, re-enabled, edited or removed. Removal can be undone. Advanced readers can inspect and edit a textual representation, but no particular serialization language is essential to the independent version. Errors identify the affected rule and leave valid rules usable. Saving communicates whether the current page updates immediately or requires a refresh.

Quick image filtering is available directly from image actions and contextual shortcuts, without opening the full editor. Quote links and backlinks to hidden posts either remain recognizable with a subdued/struck-through treatment or disappear according to preference.

An independent anonymization option makes displayed identities anonymous while retaining the underlying identity information needed for filtering and conversation features.

## Quotes and conversation context

Quote links are a way to explore a conversation without repeatedly losing the current reading position. Hovering one opens a floating preview of its target. Clicking can expand that post inline, with a corresponding way to collapse it. A reader can keep ordinary same-thread navigation while using inlining mainly for cross-thread references.

Backlinks on a post show which later posts quote it. They are navigable through the same preview and inline interactions. A target can be highlighted while it is being previewed, making its position in the surrounding thread clear. Optional labels distinguish the opening post, the reader's own posts and cross-thread references.

A preview or inline expansion can contain further quote navigation. These nested views remain understandable and reversible. An expanded backlink can temporarily hide the original copy of the response to reduce duplication, restoring it when the expansion closes.

Missing targets show a loading state while the extension looks for available live or archived content. A failed lookup leaves an explanatory state and a usable link where possible. Closing a preview while loading prevents the eventual response from reopening an unwanted panel. Archived or deleted content is visibly distinguishable from a normal live post.

Remembering the reader's own posts enables “you” markers on quotes, own-post highlighting and distinct highlighting for replies to them. Scrollbar markers help locate these contributions in a long thread. These markers follow layout changes caused by expanded media or replies.

A conversation-threading view can rearrange replies around the posts they address. Readers can return to chronological presentation. New replies and restored archived posts fit into the active view without making the underlying conversation incoherent.

## Reading progress, live updates and watched threads

A thread can receive new replies and updated status without reloading the page. A small updater displays progress, a countdown or a manual refresh action. Automatic updating can be enabled and its frequency adjusted. Quiet threads can be checked less aggressively while a return to the tab makes the view responsive again.

New replies receive the same processing as existing ones. Deleted posts, removed attachments, closed threads, archived threads and exhausted limits have recognizable states. Temporary network trouble is distinguishable from a thread that has actually ended; one failed request is not treated as conclusive deletion.

Live updates respect the reader's position. Automatic scrolling is useful when following the newest activity, but does not pull a reader away from older posts. Background tabs can remain stationary. Replies to a just-submitted post appear naturally in the ongoing thread rather than requiring a separate workflow.

Unread state reflects meaningful posts the reader has not yet reached. Duplicate previews, hidden material and the reader's own contributions do not inflate the count. A boundary separates read from unread content. The tab title and favicon can show unread activity and replies directed at the reader. Returning to a thread can restore the last-read position.

Notifications and sounds are optional. A general new-post alert and a reply-to-you alert are different signals, and can be controlled separately. Opening many tabs does not need to become an uncontrolled stream of beeps.

The thread watcher is a compact bookmark panel. Each entry identifies the thread with a short excerpt and can display its board, page, unread count, replies to the reader and dead/archive state. It can combine threads from several boards or sites, or focus on the current board. Threads the reader creates or replies to can be watched automatically.

Watched threads can be removed individually, refreshed together and optionally pruned when they end. The panel can remain visible, hide until needed, or move to a useful location. Watching a thread connects to index priority, unread state and posting activity rather than being an unrelated bookmark list.

Thread statistics show replies, attachments and available participant/page information. Optional indicators help identify a thread approaching board limits or removal. On boards with suitable identity data, newly appearing participants can be marked and posts from one identity can be counted, colored and navigated together.

Very long threads can temporarily show only recent replies, with an indication that older content is hidden. Earlier posts remain available through reveal and quote navigation. A direct link to an older post does not lead to an apparently missing destination. Conversation threading and reply pruning present compatible alternatives rather than combining into an unreadable arrangement.

## Media viewing and image tools

Thumbnails can expand into full images or playable video inside a post. Expansion respects available width and height and offers a way to contract again. Expanding several items at once can be limited to a thread, the current reading position, or selected media types. Spoiler treatment remains under the reader's control.

Hover previews provide a faster inspection path. They stay within the viewport and can follow the pointer. Loading and failed-media states are visible without permanently covering the page. Closing a media view stops obsolete playback and leaves the original post usable.

The gallery provides a focused view of a thread's attachments. It has previous/next navigation, a thumbnail strip, fit controls, rotation, download, slideshow and optional fullscreen presentation. A reader can move from the gallery back to the relevant post. PDFs can be included where viewing is supported.

Video behavior is coherent across inline expansion, hover, gallery and a media tab. Playback, looping, sound, volume, restart-on-open and control visibility are preferences. Keyboard playback and wheel volume adjustment are available where useful. Browser playback restrictions are reflected honestly in the interface.

Optional media loading modes replace static thumbnails with original images or video and can prefetch media for quicker viewing. Two temporary browsing modes emphasize attachments: one hides posts without media, and another conceals media while preserving text. Their active state is visible and easy to reverse.

File information can show the original name, size, dimensions, spoiler status and useful actions in a compact line. Long names remain recoverable even when abbreviated. Downloads can retain the original filename. Video title metadata is available as an additional detail, with clear loading and unavailable states.

Source and reverse-search links sit beside suitable attachments. They can use the image, thumbnail, original filename, board or hash to open a relevant external search or source page. Readers can customize destinations and limit them by attachment type or board. Missing metadata does not produce misleading links. The experience is the useful shortcut; a historical provider list or exact template syntax is not part of the product identity.

Some posts associate an external audio track with an attachment. When that capability is enabled, playback keeps the related audio and video coordinated and makes the external load understandable to the reader.

## Links and embedded content

Plain web addresses in comments become readable links while existing links, code and surrounding punctuation remain intact. Supported links can gain a meaningful title, small service indicator, cover preview or expandable player/card.

An embed can be opened deliberately, opened automatically by preference, or placed in a floating panel that remains accessible while scrolling. Closing it returns to the ordinary link. Several occurrences of the same destination do not need repeated metadata loading.

Embedded content includes ordinary images, audio and video, along with supported video, social, music, code and text-sharing services. Social cards can present the author, post text, attached media and related conversation. The outbound destination remains accessible even when the card or player cannot load.

External services change over time. The independent version can choose current integrations and providers that deliver these capabilities. An unavailable service leaves a useful link and an honest error/unsupported state rather than imitating a working player.

## Posting and Quick Reply

Quick Reply is a compact floating composer available from the page. It supports replying to the current thread, choosing another destination and creating a new thread where permitted. Selecting a post number or quoting selected text brings the relevant context into the composer without losing the reading position.

The composer contains the posting fields appropriate to the board: identity/options, subject, comment, attachment, spoiler, optional flags or tags, verification and submit status. It reflects anonymity rules, required fields and available file types. Character counts and previews help the reader understand the pending post.

A queue holds multiple drafts and attachments for a sequence of posts. Drafts can be added, selected, reordered and removed. Each retains its own content, destination and attachment details. Switching drafts does not silently overwrite another draft. A draft currently being sent is visibly busy and protected from conflicting edits.

Attachments can originate from a file picker, drag-and-drop, the clipboard or a deliberately selected remote URL. The composer can show a preview, edit or restore the filename, remove a file, adjust spoiler state and offer relevant image processing. Conversion, resizing or compression explains meaningful losses such as transparency or animation. Unsupported or oversized files produce actionable feedback while preserving the draft.

Optional drawing/editing tools, text-formatting previews and splitting long comments support more elaborate posts. Personas remember useful identity/options/subject choices for particular boards. Filename randomization, panel size, persistent visibility and spoiler memory are independent preferences.

Submission has understandable stages: ready to edit, waiting for verification or cooldown, uploading, awaiting the server, success, or a recoverable error. Upload progress and waiting indicators refer to the active draft. A cancel action stops the current attempt without pretending it succeeded.

The extension cooperates with the site's verification challenges and valid verification state. Verification can load when needed; solving a challenge can optionally complete a pending submission. An expired or failed challenge leaves the draft intact. A queued post does not imply that the extension bypasses verification or posting restrictions.

Cooldowns are visible and can support a deliberate posting sequence. Unexpected edits or repeated failures interrupt automation instead of causing an endless retry loop. Server errors remain visible and retryable. A success is recognized from the actual posting result and updates own-post markers, reading context, the watcher and the live thread view.

After posting, the composer can remain open, hide or reset according to preference. Creating a thread can open its destination, and replying outside the currently viewed thread can make the result accessible. The completed draft is removed or reset without discarding other queued drafts.

## Post actions, archives and presentation details

A contextual menu acts on the post from which it was opened, including a post shown in a preview. Opening a different post's menu changes the target. Actions include copying comment text, reporting, local hiding/filtering, deletion where authorized by the site, archive access, media download and editing where available.

Destructive site actions are distinct from local hiding. Deletion uses the site's own authorization and reports failure before changing the displayed state. A retry remains possible. Reporting presents the relevant destination and context. Menus close predictably through selection, outside interaction and keyboard dismissal.

Archive support extends navigation when a live thread, post or file is unavailable. The extension can open an archive destination, recover a quoted post or restore available missing replies into the current conversation. Archive selection follows actual board/content coverage. A restored post is marked as archived and fits into chronological or conversational order without duplicating an existing post.

Readers can choose suitable archives. Failure to find content is different from failure to contact an archive. Restoration preserves access to the original thread context; it does not imply that the live site now hosts the recovered content. Archived text and attachments remain subject to the same local presentation and media controls.

Presentation features include localized timestamps, relative ages, configurable file information, identity colors, spoiler visibility and hidden announcements. Optional banner, board-title and auxiliary-page enhancements stay secondary to reading and posting. Features tied to obsolete site technology can be replaced or omitted when the equivalent experience no longer exists.

## Preferences and remembered state

Preferences are organized around capabilities the reader recognizes: browsing, filtering, quotes, media, monitoring, posting, appearance and shortcuts. Related settings are grouped and advanced controls remain discoverable without overwhelming common tasks. The reference's five-section settings panel is one useful layout, but its exact taxonomy and fields do not constrain the independent design.

Changes have clear scope. Some preferences are global, others can be remembered per site or board, and temporary modes are visibly distinct from saved choices. Live previews make appearance, sound and formatting adjustments understandable. If a preference requires a page refresh, that is communicated.

Useful state survives returning: selected preferences, watched threads, hidden content, reading position, own-post identity, volume, board-view choices and panel placement. Open tabs converge on the reader's latest choices without one tab casually erasing another tab's activity. Stale or unavailable storage does not make an apparently saved change disappear without explanation.

Settings can be exported, imported and reset. History can be included or excluded deliberately. Cancellation leaves current state alone; importing or resetting explains replacement of existing information. The independent version defines its own storage and transfer formats. Compatibility with the original extension's preference files is not an assumed feature.

Keyboard actions cover navigation, quotes, media/gallery controls, composing, submission, watching and closing panels. Shortcuts can be changed or disabled. Ordinary typing remains ordinary typing, and a key shared between two views acts on the active context.

## Visual character and interaction states

The interface remains compact and content-focused. Small bracketed navigation links, understated icons, short status labels and dense but legible panels fit the imageboard's existing rhythm. The extension does not turn every action into a large card or an interruption.

Floating panels use a clear boundary, a recognizable header/drag area, a close action and a higher visual layer than the page. Menus sit close to their target and remain inside the viewport. Hover previews provide enough separation from ordinary content to be recognizable while retaining the post's own visual structure.

Light themes use the board's pale backgrounds and restrained borders; darker themes retain legibility through appropriately contrasting surfaces, text, links and fields. Theme colors express roles such as panel background, border, active field, unread boundary, quote target, own post and filter highlight. Readers can customize these roles without rebuilding the application.

Loading, empty, unread, selected, highlighted, hidden, deleted, archived, disabled, success, warning and error are distinct states. Color is supported by text, icons, boundaries or labels. A control that cannot perform its action communicates why. Notifications can be dismissed and avoid continually obscuring content.

The layout remains useful at narrow widths. Composer rows and settings controls can wrap, dense filter options can collapse, and dialogs remain reachable. Focus, accessible labels, keyboard dismissal and motion that does not impede reading are part of the interaction design.

The supplied CSS retains detailed sizes, spacing, responsive rules, theme treatments and selected/hover/focus states. It is reference material, not a requirement to preserve the original selectors or every visual quirk. The HTML illustrates the hierarchy and density of particular controls; it is not a complete application or an instruction to reuse the original component boundaries.

## HTML and CSS visual references

These files exist solely to retain useful visual and interaction detail. Their names organize the illustrations and do not describe the independent application's file structure. Some fragments need ordinary surrounding page content to illustrate their intended appearance. Site-specific selectors in the CSS are examples of visual targets; the new version can express the same roles differently.

### HTML

| Reference | Visual detail |
| --- | --- |
| [Index controls](visual-reference/html/index-controls.html) | Search, refresh, hidden-thread controls and compact view/sort selectors |
| [Pagination](visual-reference/html/pagination.html) | Page links, navigation buttons and catalog access |
| [Preferences panel](visual-reference/html/preferences-panel.html) | Settings navigation, grouped options, advanced preferences and transfer actions |
| [Filter editor](visual-reference/html/filter-editor.html) | Rule builder, advanced controls, preview, tester and saved-rule states |
| [Filter field selector](visual-reference/html/filter-fields.html) | Compact selection among post and attachment fields |
| [Source links](visual-reference/html/source-links.html) | Attachment-source shortcuts and an editable destination list |
| [Settings transfer](visual-reference/html/settings-transfer.html) | History choice and export confirmation |
| [Keyboard controls](visual-reference/html/keyboard-shortcuts.html) | Editable action/shortcut table and reset action |
| [Quick Reply](visual-reference/html/quick-reply.html) | Movable composer, draft strip, file tools and submission row |
| [Thread watcher](visual-reference/html/thread-watcher.html) | Compact floating bookmark panel |
| [Gallery](visual-reference/html/gallery.html) | Focused media area, navigation, thumbnails and display controls |
| [Floating embed](visual-reference/html/floating-embed.html) | Movable embedded-content panel |
| [Archive reporting](visual-reference/html/archive-report.html) | Optional reporting controls and feedback area |

### CSS

| Reference | Visual detail |
| --- | --- |
| [Interface](visual-reference/css/interface.css) | Header, menus, dialogs, filters, quotes, composer, watcher and gallery states |
| [Theme roles](visual-reference/css/theme-roles.css) | Color roles shared across interface elements |
| [Icons](visual-reference/css/icons.css) | Inline icon sizing, alignment and activity animation |
| [Social embeds](visual-reference/css/social-embed.css) | Author, text, media and related-content layout in social cards |
| [Theme accents](visual-reference/css/theme-accents.css) | Subtle board-title typography and accents |
| [Yotsuba](visual-reference/css/yotsuba.css) | Pale warm theme |
| [Yotsuba B](visual-reference/css/yotsuba-b.css) | Pale blue theme |
| [Futaba](visual-reference/css/futaba.css) | Warm classic theme |
| [Burichan](visual-reference/css/burichan.css) | Cool classic theme |
| [Photon](visual-reference/css/photon.css) | Neutral light theme |
| [Tomorrow](visual-reference/css/tomorrow.css) | Dark theme |
| [Spooky](visual-reference/css/spooky.css) | Seasonal dark/accent theme |
| [Reporting](visual-reference/css/report.css) | Compact report-page treatment |
| [Auxiliary pages](visual-reference/css/auxiliary-pages.css) | Small adjustments on related site pages |
