import { g, Conf, d } from "../globals/globals";
import $ from "../platform/$";
import Menu, { type MenuPost, type PostMenuEntry } from "./Menu";

const CopyTextLink = {
  post: null as MenuPost | null,

  init(): void {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Copy Text Link']) { return; }

    const a = $.el('a', {
      className: 'copy-text-link',
      href: 'javascript:;',
      textContent: 'Copy Text'
    }
    );
    $.on(a, 'click', CopyTextLink.copy);

    const entry: PostMenuEntry = {
      el: a,
      order: 12,
      open(post) {
        CopyTextLink.post = post.origin || post;
        return true;
      }
    };
    Menu.menu.addEntry(entry);
  },

  copy(): void {
    const {post} = CopyTextLink;
    if (!post) { return; }

    const el = $.el('textarea', {
      className: 'copy-text-element',
      value: post.commentOrig()
    }
    );
    $.add(d.body, el);
    el.select();
    try {
      d.execCommand('copy');
    } catch {
      // Some browsers deny clipboard access even after a user gesture.
    } finally {
      $.rm(el);
    }
  }
};
export default CopyTextLink;
