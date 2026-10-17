export const boardURL = 'https://boards.4chan.org/g/thread/100';
export const boards = { boards: [{ board: 'g', title: 'Technology', ws_board: 1 }] };

// IDs agree with the URL. All markup and responses are synthetic.
export const html = `<!doctype html><html><head><title>/g/ - QA fixture</title>
<link rel="stylesheet" href="/test-yotsuba.css" title="switch" id="stylesheet">
<link rel="alternate stylesheet" href="/test-yotsuba.css" title="Yotsuba">
<link rel="shortcut icon" href="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
</head>
<body><div id="boardNavDesktop"><span class="boardList">[<a href="/g/">g</a>]</span><span></span></div>
<div class="boardBanner"><div id="bannerCnt"><span>QA banner</span></div><div class="boardTitle">/g/ - Technology</div></div><hr>
<div id="boardNavDesktopFoot"><span class="boardList">[<a href="/g/">g</a>]</span></div>
<div id="delform"><div class="board"><div class="thread" id="t100">
${[100, 101, 102].map(id => `<div class="postContainer ${id === 100 ? 'opContainer' : 'replyContainer'}" id="pc${id}">
<div class="sideArrows">&gt;&gt;</div><div class="post ${id === 100 ? 'op' : 'reply'}" id="p${id}">
<div class="postInfo" id="pi${id}"><input type="checkbox" name="${id}"><span class="subject"></span>
<span class="nameBlock"><span class="name">QA author</span></span>
<span class="dateTime" data-utc="1700000000">11/14/23</span>
<span class="postNum"><a href="#p${id}">No.</a><a href="javascript:;">${id}</a></span></div>
<blockquote class="postMessage" id="m${id}">${id === 101 ? 'QA blocked text' : 'QA ordinary text'}</blockquote>
</div></div>`).join('')}
</div></div><div class="navLinksBot"></div></div></body></html>`;
