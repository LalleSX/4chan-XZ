import BoardConfig from "../General/BoardConfig"
import { d, g } from "../globals/globals"
import Post from "./Post"
import SimpleDict from "./SimpleDict"
import Thread from "./Thread"


export default class Board {
  ID: string
  boardID: number | string
  siteID: string
  threads: SimpleDict<Thread>
  posts: SimpleDict<Post>
  config: any
  toString() { return this.ID }

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
    const c2 = (this.config || {}).cooldowns || {}
    const c = {
      thread: c2.threads || 0,
      reply: c2.replies || 0,
      image: c2.images || 0,
      thread_global: 300 // inter-board thread cooldown
    }
    // Pass users have reduced cooldowns.
    if (d.cookie.indexOf('pass_enabled=1') >= 0) {
      for (const key of ['reply', 'image']) {
        c[key] = Math.ceil(c[key] / 2)
      }
    }
    return c
  }
}
