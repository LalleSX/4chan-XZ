import BoardConfig from '../General/BoardConfig';
import { d, g } from '../globals/globals';
import Post from './Post';
import Thread from './Thread';
import SimpleDict from './SimpleDict';

export default class Board {
  ID: string;
  boardID: string;
  siteID: string;
  threads: SimpleDict<Thread>;
  posts: SimpleDict<Post>;
  config: any;

  constructor(ID: string) {
    this.ID = ID;
    this.boardID = this.ID;
    this.siteID = g.SITE.ID;
    this.threads = new SimpleDict();
    this.posts = new SimpleDict();
    this.config = BoardConfig.domain(this.ID)

    g.boards[this.ID] = this;
  }

  toString() {
    return this.ID;
  }

  cooldowns() {
    const c2 = (this.config || {}).cooldowns || {};
    const c = {
      thread: c2.threads || 0,
      reply: c2.replies || 0,
      image: c2.images || 0,
      thread_global: 300, // inter-board thread cooldown
    };
    // Pass users have reduced cooldowns.
    if (d.cookie.indexOf('pass_enabled=1') >= 0) {
      for (let key of ['reply', 'image']) {
        c[key] = Math.ceil(c[key] / 2);
      }
    }
    return c;
  }
}
