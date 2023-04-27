import { g } from '../globals/globals'
import $ from '../platform/$'
import Post from './Post'
import SimpleDict from './SimpleDict'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export default class Thread {
  board: string
  ID: number | string
  threadID: number
  boardID: string
  siteID: string
  fullID: string
  posts: SimpleDict<Post>
  isDead: boolean
  isHidden: boolean
  isSticky: boolean
  isClosed: boolean
  isArchived: boolean
  postLimit: boolean
  fileLimit: boolean
  lastPost: number
  ipCount: undefined
  json: null | any
  OP: null | Post
  catalogView: null | any
  nodes: { root: null | HTMLElement }
  toString() {
    return this.ID
  }

  constructor(ID: string, board: string) {
    this.board = board
    this.ID = +ID
    this.threadID = this.ID
    this.boardID = g.BOARD.ID
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

    this.nodes = { root: null }

    this.board.threads.push(this.ID, this)
    g.threads.push(this.fullID, this)
  }

  setPage(pageNum: number): void {
    let icon: HTMLElement | null
    const { info, reply } = this.OP.nodes
    if (!(icon = $('.page-num', info))) {
      icon = $.el('span', { className: 'page-num' })
      $.replace(reply.parentNode.previousSibling, [$.tn(' '), icon, $.tn(' ')])
    }
    icon.title = `This thread is on page ${pageNum} in the original index.`
    icon.textContent = `[${pageNum}]`
    if (this.catalogView) {
      return (this.catalogView.nodes.pageCount.textContent = pageNum)
    }
  }

  setCount(type: string, count: number, reachedLimit: boolean): void {
    if (!this.catalogView) {
      return
    }
    const el = this.catalogView.nodes[`${type}Count`]
    el.textContent = count
    return (reachedLimit ? $.addClass : $.rmClass)(el, 'warning')
  }

  setStatus(type: string, status: boolean): void {
    const name = `is${type}`
    if (this[name] === status) {
      return
    }
    this[name] = status
    if (!this.OP) {
      return
    }
    this.setIcon('Sticky', this.isSticky)
    this.setIcon('Closed', this.isClosed && !this.isArchived)
    return this.setIcon('Archived', this.isArchived)
  }

  setIcon(type: string, status: boolean): void {
    const typeLC = type.toLowerCase()
    let icon = $(`.${typeLC}Icon`, this.OP.nodes.info)
    if (!!icon === status) {
      return
    }

    if (!status) {
      $.rm(icon.previousSibling)
      $.rm(icon)
      if (this.catalogView) {
        $.rm($(`.${typeLC}Icon`, this.catalogView.nodes.icons))
      }
      return
    }
    icon = $.el('img', {
      src: `${g.SITE.Build.staticPath}${typeLC}${g.SITE.Build.gifIcon}`,
      alt: type,
      title: type,
      className: `${typeLC}Icon retina`,
    })
    if (g.BOARD.ID === 'f') {
      icon.style.cssText = 'height: 18px; width: 18px;'
    }

    const root =
      type !== 'Sticky' && this.isSticky
        ? $('.stickyIcon', this.OP.nodes.info)
        : $('.page-num', this.OP.nodes.info) || this.OP.nodes.quote
    $.after(root, [$.tn(' '), icon])

    if (!this.catalogView) {
      return
    }
    return (type === 'Sticky' && this.isClosed ? $.prepend : $.add)(
      this.catalogView.nodes.icons,
      icon.cloneNode()
    )
  }

  kill(): boolean {
    return (this.isDead = true)
  }

  collect(): boolean {
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
      return this.board.threads.rm(this.ID)
    }
  }
}
