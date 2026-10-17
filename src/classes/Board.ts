import BoardConfig from "../General/BoardConfig";
import { type BoardConfig as BoardConfiguration, d, g } from "../globals/globals";
import SimpleDict from "./SimpleDict";
import type Post from "./Post";
import type Thread from "./Thread";

export default class Board {
  declare ID: string;
  declare boardID: string;
  declare siteID: string;
  declare threads: SimpleDict<Thread>;
  declare posts: SimpleDict<Post>;
  declare config: Partial<BoardConfiguration>;

  toString(): string { return this.ID; }

  constructor(ID: string) {
    this.ID = ID;
    this.boardID = this.ID;
    this.siteID  = g.SITE.ID;
    this.threads = new SimpleDict();
    this.posts   = new SimpleDict();
    this.config  = BoardConfig.boards?.[this.ID] || {};

    g.boards[this.ID] = this;
  }

  cooldowns() {
    const c2: Partial<BoardConfiguration['cooldowns']> = this.config.cooldowns || {};
    const c = {
      thread: c2.threads || 0,
      reply:  c2.replies || 0,
      image:  c2.images  || 0,
      thread_global: 300 // inter-board thread cooldown
    };
    // Pass users have reduced cooldowns.
    if (d.cookie.indexOf('pass_enabled=1') >= 0) {
      for (const key of ['reply', 'image'] as const) {
        c[key] = Math.ceil(c[key] / 2);
      }
    }
    return c;
  }
}
