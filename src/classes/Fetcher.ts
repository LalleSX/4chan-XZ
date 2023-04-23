import Redirect from '../Archive/Redirect'
import Get from '../General/Get'
import Index from '../General/Index'
import { Conf, d, E, g } from '../globals/globals'
import ImageHost from '../Images/ImageHost'
import Main from '../main/Main'
import $ from '../platform/$'
import CrossOrigin from '../platform/CrossOrigin'
import { dict } from '../platform/helpers'
import Board from './Board'
import Post from './Post'
import Thread from './Thread'
export default class Fetcher {
  archiveTags!: {
    '\n': { innerHTML: string }
    '[b]': { innerHTML: string }
    '[/b]': { innerHTML: string }
    '[spoiler]': { innerHTML: string }
    '[/spoiler]': { innerHTML: string }
    '[code]': { innerHTML: string }
    '[/code]': { innerHTML: string }
    '[moot]': { innerHTML: string }
    '[/moot]': { innerHTML: string }
    '[banned]': { innerHTML: string }
    '[/banned]': { innerHTML: string }
    '[fortune]'(text: string): { innerHTML: string }
    '[/fortune]': { innerHTML: string }
    '[i]': { innerHTML: string }
    '[/i]': { innerHTML: string }
    '[red]': { innerHTML: string }
    '[/red]': { innerHTML: string }
    '[green]': { innerHTML: string }
    '[/green]': { innerHTML: string }
    '[blue]': { innerHTML: string }
    '[/blue]': { innerHTML: string }
  }
  boardID: string
  threadID: string | number
  postID: number
  root: Document | HTMLElement
  quoter: HTMLElement | Post
  static flagCSS: HTMLStyleElement | HTMLElement
  static initClass() {
    this.prototype.archiveTags = {
      '\n': { innerHTML: '<br>' },
      '[b]': { innerHTML: '<b>' },
      '[/b]': { innerHTML: '</b>' },
      '[spoiler]': { innerHTML: '<s>' },
      '[/spoiler]': { innerHTML: '</s>' },
      '[code]': { innerHTML: '<pre class="prettyprint">' },
      '[/code]': { innerHTML: '</pre>' },
      '[moot]': {
        innerHTML:
          '<div style="padding:5px;margin-left:.5em;border-color:#faa;border:2px dashed rgba(255,0,0,.1);border-radius:2px">',
      },
      '[/moot]': { innerHTML: '</div>' },
      '[banned]': { innerHTML: '<strong style="color: red;">' },
      '[/banned]': { innerHTML: '</strong>' },
      '[fortune]'(text) {
        return {
          innerHTML:
            '<span class="fortune" style="color:' +
            E(text.match(/#\w+|$/)[0]) +
            '"><b>',
        }
      },
      '[/fortune]': { innerHTML: '</b></span>' },
      '[i]': { innerHTML: '<span class="mu-i">' },
      '[/i]': { innerHTML: '</span>' },
      '[red]': { innerHTML: '<span class="mu-r">' },
      '[/red]': { innerHTML: '</span>' },
      '[green]': { innerHTML: '<span class="mu-g">' },
      '[/green]': { innerHTML: '</span>' },
      '[blue]': { innerHTML: '<span class="mu-b">' },
      '[/blue]': { innerHTML: '</span>' },
    }
  }
  constructor(boardID: number | string, threadID: number, postID: number, root: Document | HTMLElement, quoter: Post) {
    let post: Post, thread: Thread
    this.boardID = boardID as string
    this.threadID = threadID
    this.postID = postID
    this.root = root
    this.quoter = quoter
    if ((post = g.posts.get(`${this.boardID}.${this.postID}`))) {
      this.insert(post)
      return
    }

    // 4chan X catalog data
    if (
      (post = Index.replyData?.[`${this.boardID}.${this.postID}`]) &&
      (thread = g.threads.get(`${this.boardID}.${this.threadID}`))
    ) {
      const board = g.boards[this.boardID]
      post = new Post(
        g.SITE.Build.postFromObject(post, this.boardID),
        thread,
        board,
        { isFetchedQuote: true }
      )
      Main.callbackNodes('Post', [post])
      this.insert(post)
      return
    }

    this.root.textContent = `Loading post No.${this.postID}...`
    if (this.threadID) {
      Fetcher.fetchThread(
        this.boardID,
        this.threadID,
        function (req) {
          this.fetchedThread(req)
        },
        true
      )
    } else {
      Fetcher.fetchPost(
        this.boardID,
        this.postID,
        function (req, isCached) {
          this.fetchedPost(req, isCached)
        },
        true
      )
    }
  }
  static fetchThread(
    boardID: string | number,
    threadID: string | number,
    arg2: (req: XMLHttpRequest, isCached: boolean) => void,
    arg3: boolean
  ) {
    throw new Error('Method not implemented.')
  }
  static fetchPost(
    boardID: string | number,
    postID: string | number,
    arg2: (req: XMLHttpRequest, isCached: boolean) => void,
    arg3: boolean
  ) {
    throw new Error('Method not implemented.')
  }

  fetchedThread(req: XMLHttpRequest) {
    const { status, response } = req
    const { boardID, threadID } = this
    const board = g.boards[boardID]
    if (status === 404) {
      this.root.textContent = `Thread No.${threadID} not found.`
      return
    }
    if (status !== 200) {
      this.root.textContent = `Error loading thread No.${threadID}.`
      return
    }
    if (response === '') {
      this.root.textContent = `Thread No.${threadID} is empty.`
      return
    }
    const thread = new Thread(
      g.SITE.Build.threadFromObject(response, boardID), board.ID)
    Main.callbackNodes('Thread', [thread])
    const post = thread.posts.get(`${boardID}.${this.postID}`)
    if (post) {
      this.insert(post)
    } else {
      this.root.textContent = `Post No.${this.postID} not found.`
    }
  }
  insert(post: Post) {
    // Stop here if the container has been removed while loading.
    if (!this.root.parentNode) {
      return
    }
    if (!this.quoter) {
      this.quoter = post
    }
    const clone = post.addClone(
      this.quoter.context,
      $.hasClass(this.root.appendChild($.el('div')), 'backlink')
    )
    Main.callbackNodes('Post', [clone])

    // Get rid of the side arrows/stubs.
    const { nodes } = clone
    $.rmAll(nodes.root)
    $.add(nodes.root, nodes.post)

    // Indicate links to the containing post.
    const quotes = [...clone.nodes.quotelinks, ...clone.nodes.backlinks]
    for (const quote of quotes) {
      const { boardID, postID } = Get.postDataFromLink(quote)
      if (postID === this.quoter.ID && boardID === this.quoter.board.ID) {
        $.addClass(quote, 'forwardlink')
      }
    }

    // Set up flag CSS for cross-board links to boards with flags
    if (
      clone.nodes.flag &&
      !(
        Fetcher.flagCSS ||
        (Fetcher.flagCSS = $('link[href^="//s.4cdn.org/css/flags."]'))
      )
    ) {
      const cssVersion =
        $('link[href^="//s.4cdn.org/css/"]')?.href.match(
          /\d+(?=\.css$)|$/
        )[0] || Date.now()
      Fetcher.flagCSS = $.el('link', {
        rel: 'stylesheet',
        href: `//s.4cdn.org/css/flags.${cssVersion}.css`,
      })
      $.add(d.head, Fetcher.flagCSS)
    }

    $.rmAll(this.root)
    $.add(this.root, nodes.root)
    return $.event('PostsInserted', null, Document.apply(this.root))
  }

  fetchedPost(req: XMLHttpRequest, isCached: boolean) {
    const { status, response } = req
    const { boardID, postID, threadID } = this
    const postKey = `${boardID}.${postID}`

    const post = g.posts.get(postKey)
    if (post) {
      this.insert(post)
      return
    }

    if (status !== 200) {
      this.handleNon200Status(status, req)
      return
    }

    const { posts } = response
    g.SITE.Build.spoilerRange[boardID] = posts[0].custom_spoiler

    const foundPost = posts.find((p: Post) => p.ID === postID)

    if (!foundPost) {
      this.handlePostNotFound(isCached)
      return
    }

    const board = g.boards[boardID] || new Board(boardID)
    const threadKey = `${boardID}.${threadID}`
    const thread = g.threads.get(threadKey) || new Thread(threadID as string, board)
    const newPost = new Post(
      g.SITE.Build.postFromObject(foundPost, boardID),
      thread,
      board,
      { isFetchedQuote: true }
    )
    Main.callbackNodes('Post', [newPost])
    return this.insert(newPost)
  }

  handleNon200Status(status, req) {
    if (status === 404) {
      this.handlePostNotFound(false, req)
      return
    }
  }

  handlePostNotFound(isCached: boolean, req?: XMLHttpRequest) {
    if (isCached) {
      const api = g.SITE.urls.threadJSON(this.boardID as string, this.threadID as string)
      $.cleanCache((url: string) => url === api)
      $.cache(api, () => this.fetchedPost(req, false))
      return
    }

    if (this.archivedPost()) {
      return
    }

    $.addClass(this.root.appendChild($.el('div')), 'backlink')
    this.root.textContent = `Post No.${this.postID} was not found.`
  }

  archivedPost() {
    let url: string
    if (!Conf['Resurrect Quotes']) {
      return false
    }
    if (
      !(url = Redirect.to('post', {
        boardID: this.boardID,
        postID: this.postID,
      }))
    ) {
      return false
    }
    const archive = Redirect.data.post[this.boardID]
    const encryptionOK =
      /^https:\/\//.test(url) || location.protocol === 'http:'
    if (encryptionOK || Conf['Exempt Archives from Encryption']) {
      CrossOrigin.cache(url, function () {
        if (!encryptionOK && this.response?.media) {
          const { media } = this.response
          for (const key in media) {
            // Image/thumbnail URLs loaded over HTTP can be modified in transit.
            // Require them to be from an HTTP host so that no referrer is sent to them from an HTTPS page.
            if (/_link$/.test(key)) {
              if (!$.getOwn(media, key)?.match(/^http:\/\//)) {
                delete media[key]
              }
            }
          }
        }
        return this.parseArchivedPost(this.response, url, archive)
      })
      return true
    }
    return false
  }

  parseArchivedPost(data: any, url: string, archive: any) {
    // In case of multiple callbacks for the same request,
    // don't parse the same original post more than once.
    let post: Post
    if ((post = g.posts.get(`${this.boardID}.${this.postID}`))) {
      this.insert(post)
      return
    }

    if (data == null) {
      $.addClass(this.root.appendChild($.el('div')), 'backlink')
      this.root.textContent = `Error fetching Post No.${this.postID} from ${archive.name}.`
      return
    }

    if (data.error) {
      $.addClass(this.root.appendChild($.el('div')), 'backlink')
      this.root.textContent = data.error
      return
    }

    // https://github.com/eksopl/asagi/blob/v0.4.0b74/src/main/java/net/easymodo/asagi/YotsubaAbstract.java#L82-L129
    // https://github.com/FoolCode/FoolFuuka/blob/800bd090835489e7e24371186db6e336f04b85c0/src/Model/Comment.php#L368-L428
    // https://github.com/bstats/b-stats/blob/6abe7bffaf6e5f523498d760e54b110df5331fbb/inc/classes/Yotsuba.php#L157-L168
    let comment = (data.comment || '').split(
      /(\n|\[\/?(?:b|spoiler|code|moot|banned|fortune(?: color="#\w+")?|i|red|green|blue)\])/
    )
    comment = (() => {
      const result = []
      for (let i = 0; i < comment.length; i++) {
        let text = comment[i]
        if (i % 2 === 1) {
          const tag = Fetcher.archiveTags[text.replace(/\ .*\]/, ']')]
          if (typeof tag === 'function') {
            result.push(tag(text))
          } else {
            result.push(tag)
          }
        } else {
          const greentext = text[0] === '>'
          text = text.replace(/(\[\/?[a-z]+):lit(\])/g, '$1$2')
          text = text.split(/(>>(?:>\/[a-z\d]+\/)?\d+)/g).map((text2, j) => {
            j % 2
              ? '<span class="deadlink">' + E(text2) + '</span>'
              : E(text2)
          })
          text = {
            innerHTML: greentext
              ? '<span class="quote">' + E.cat(text) + '</span>'
              : E.cat(text),
          }
          result.push(text)
        }
      }
      return result
    })()
    comment = { innerHTML: E.cat(comment) }

    this.threadID = +data.thread_num
    const o = {
      ID: this.postID,
      threadID: this.threadID,
      boardID: this.boardID,
      isReply: this.postID !== this.threadID,
      info: null,
      file: data.media,
      time: +data.timestamp,
      fileDeleted: data.media_status === 'b',
      extra: null,
    }
    o.info = {
      uniqueID: data.poster_hash,
      subject: data.title,
      email: data.email,
      name: data.name || '',
      tripcode: data.trip,
      capcode: (() => {
        switch (data.capcode) {
          // https://github.com/pleebe/FoolFuuka/blob/bf4224eed04637a4d0bd4411c2bf5f9945dfec0b/assets/themes/foolz/foolfuuka-theme-fuuka/src/Partial/Board.php#L77
          case 'M':
            return 'Mod'
          case 'A':
            return 'Admin'
          case 'D':
            return 'Developer'
          case 'V':
            return 'Verified'
          case 'F':
            return 'Founder'
          case 'G':
            return 'Manager'
        }
      })(),
      flagCode: data.poster_country,
      flagCodeTroll: data.troll_country_code,
      flag: data.poster_country_name || data.troll_country_name,
      dateUTC: data.timestamp,
      dateText: data.fourchan_date,
      commentHTML: comment,
    }
    if (o.info.capcode) {
      delete o.info.uniqueID
    }
    if (data.media && !!+data.media.banned) {
      o.fileDeleted = true
    } else if (data.media?.media_filename) {
      let { thumb_link } = data.media
      // Fix URLs missing origin
      if (thumb_link?.[0] === '/') {
        thumb_link = url.split('/', 3).join('/') + thumb_link
      }
      if (!Redirect.securityCheck(thumb_link)) {
        thumb_link = ''
      }
      let media_link = Redirect.to('file', {
        boardID: this.boardID,
        filename: data.media.media_orig,
      })
      if (!Redirect.securityCheck(media_link)) {
        media_link = ''
      }
      o.file = {
        name: data.media.media_filename,
        url:
          media_link ||
          (this.boardID === 'f'
            ? `${location.protocol}//${ImageHost.flashHost()}/${this.boardID
            }/${encodeURIComponent(E(data.media.media_filename))}`
            : `${location.protocol}//${ImageHost.host()}/${this.boardID}/${data.media.media_orig
            }`),
        height: data.media.media_h,
        width: data.media.media_w,
        MD5: data.media.media_hash,
        size: $.bytesToString(data.media.media_size),
        thumbURL:
          thumb_link ||
          `${location.protocol}//${ImageHost.thumbHost()}/${this.boardID}/${data.media.preview_orig
          }`,
        theight: data.media.preview_h,
        twidth: data.media.preview_w,
        isSpoiler: data.media.spoiler === '1',
      }
      if (!/\.pdf$/.test(o.file.url)) {
        o.file.dimensions = `${o.file.width}x${o.file.height}`
      }
      if (this.boardID === 'f' && data.media.exif) {
        o.file.tag = JSON.parse(data.media.exif).Tag
      }
    }
    o.extra = dict()

    const board = g.boards[this.boardID] || new Board(this.boardID)
    const thread =
      g.threads.get(`${this.boardID}.${this.threadID}`) ||
      new Thread(this.threadID, board)
    post = new Post(g.SITE.Build.post(o), thread, board, {
      isFetchedQuote: true,
    })
    post.kill(post.file)
    if (post.file) {
      post.file.thumbURL = o.file.thumbURL
    }
    Main.callbackNodes('Post', [post])
    return this.insert(post)
  }
}
Fetcher.initClass()