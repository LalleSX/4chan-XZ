import { g } from "../globals/globals"
import $ from "../platform/$"
import Board from "./Board"
import Post from "./Post"
import SimpleDict from "./SimpleDict"


export default class Thread {
  ID: number
  OP: Post
  isArchived: boolean
  isClosed: boolean
  lastPost: number
  posts: SimpleDict<Post>
  board: Board
  threadID: number
  boardID: number | string
  siteID: number
  fullID: string
  isDead: boolean
  isHidden: boolean
  isSticky: boolean
  postLimit: boolean
  fileLimit: boolean
  ipCount: number
  json: JSON
  catalogView: Node
  nodes: { root: Post }
  toString() { return this.ID }

  constructor(ID: number | string, board: Board) {
    this.board = board
    this.ID = +ID
    this.threadID = this.ID
    this.boardID = this.board.ID
    this.siteID = g.SITE.ID
    this.fullID = `${this.board}.${this.ID}`
    this.posts = new SimpleDict()
    this.isDead = false
    this.isHidden = false
    this.isSticky = false
    this.isClosed = false
    this.isArchived = false
    this.postLimit = false
    this.fileLimit = false
    this.lastPost = 0
    this.ipCount = undefined
    this.json = null

    this.OP = null
    this.catalogView = null

    this.nodes =
      { root: null }

    this.board.threads.push(this.ID, this)
    g.threads.push(this.fullID, this)
  }

  setPage(pageNum: number) {
    let icon: HTMLElement
    const { info, reply } = this.OP.nodes
    if (!(icon = $('.page-num', info))) {
      icon = $.el('span', { className: 'page-num' })
      $.replace(reply.parentNode.previousSibling, [$.tn(' '), icon, $.tn(' ')])
    }
    icon.title = `This thread is on page ${pageNum} in the original index.`
    icon.textContent = `[${pageNum}]`
    if (this.catalogView) { return this.catalogView.nodes.pageCount.textContent = pageNum }
  }

  setCount(type: string, count: number, reachedLimit: boolean) {
    if (!this.catalogView) { return }
    const el = this.catalogView.nodes[`${type}Count`]
    el.textContent = count
    return (reachedLimit ? $.addClass : $.rmClass)(el, 'warning')
  }

  setStatus(type: string, status: boolean) {
    const name = `is${type}`
    if (this[name] === status) { return }
    this[name] = status
    if (!this.OP) { return }
    this.setIcon('Sticky', this.isSticky)
    this.setIcon('Closed', this.isClosed && !this.isArchived)
    return this.setIcon('Archived', this.isArchived)
  }

  setIcon(type: string, status: boolean) {
    const typeLC = type.toLowerCase()
    let icon = $(`.${typeLC}Icon`, this.OP.nodes.info)
    if (!!icon === status) { return }

    if (!status) {
      $.rm(icon.previousSibling)
      $.rm(icon)
      if (this.catalogView) { $.rm($(`.${typeLC}Icon`, this.catalogView.nodes.icons)) }
      return
    }
    icon = $.el('img', {
      src: `${g.SITE.Build.staticPath}${typeLC}${g.SITE.Build.gifIcon}`,
      alt: type,
      title: type,
      className: `${typeLC}Icon retina`
    }, g.BOARD.ID)
    if (g.BOARD.ID === 'f') {
      icon.style.cssText = 'height: 18px; width: 18px;'
    }

    const root = (type !== 'Sticky') && this.isSticky ?
      $('.stickyIcon', this.OP.nodes.info)
      :
      $('.page-num', this.OP.nodes.info) || this.OP.nodes.quote
    $.after(root, [$.tn(' '), icon])

    if (!this.catalogView) { return }
    return ((type === 'Sticky') && this.isClosed ? $.prepend : $.add)(this.catalogView.nodes.icons, icon.cloneNode())
  }

  kill() {
    return this.isDead = true
  }

  collect() {
    let n = 0
    this.posts.forEach(function (post) {
      if (post.clones.length) {
        return n++
      } else {
        return post.collect()
      }
    })
    if (!n) {
      g.threads.rm(this.fullID)
      return this.board.threads.rm(this)
    }
  }
}
