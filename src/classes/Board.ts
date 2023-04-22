import BoardConfig from '../General/BoardConfig'
import { d, g } from '../globals/globals'
import SimpleDict from './SimpleDict'
import Thread from './Thread'
import Post from './Post'
import Site from './Site'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export default class Board {
  ID: string
  boardID: string
  siteID: string | Site
  threads: SimpleDict<Thread>
  posts: SimpleDict<Post>
  config:
    | string
    | { cooldowns: { threads: number; replies: number; images: number } }
  toString() {
    return this.ID
  }

  constructor(ID: string) {
    this.ID = ID
    this.boardID = this.ID
    this.siteID = g.SITE.ID
    this.threads = new SimpleDict()
    this.posts = new SimpleDict()
    this.config = BoardConfig.boards?.[this.ID] || {}

    g.boards[this.ID] = this
  }

  cooldowns() {
    const c2: { threads: number; replies: number; images: number } =
      this.config.cooldowns || {}
    const c: {
      thread: number
      reply: number
      image: number
      thread_global: number
    } = {
      thread: c2.threads || 0,
      reply: c2.replies || 0,
      image: c2.images || 0,
      thread_global: 300, // inter-board thread cooldown
    }
    // Pass users have reduced cooldowns.
    if (d.cookie.indexOf('pass_enabled=1') >= 0) {
      for (var key of ['reply', 'image']) {
        c[key] = Math.ceil(c[key] / 2)
      }
    }
    return c
  }
}
