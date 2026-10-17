import Notice from "../classes/Notice";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import { dict } from "../platform/helpers";
import QR from "../Posting/QR";
import Menu, { type MenuPost, type PostMenuEntry } from "./Menu";

type AutoDelete = Partial<Record<string, true>>;
interface DeleteLinkNodes {
  menu: ChildNode;
  links: [HTMLAnchorElement, HTMLAnchorElement];
}

const auto: [AutoDelete, AutoDelete] = [dict(), dict()];
const seconds: Partial<Record<string, number>> = dict();

const DeleteLink = {
  auto,
  nodes: null as DeleteLinkNodes | null,
  post: null as MenuPost | null,

  init(): void {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Delete Link']) { return; }

    const div = $.el('div', {
      className: 'delete-link',
      textContent: 'Delete'
    }
    );
    const postEl = $.el('a', {
      className: 'delete-post',
      href: 'javascript:;'
    }
    );
    const fileEl = $.el('a', {
      className: 'delete-file',
      href: 'javascript:;'
    }
    );
    this.nodes = {
      menu:  div.firstChild,
      links: [postEl, fileEl]
    };

    const postEntry: PostMenuEntry = {
      el: postEl,
      open() {
        postEl.textContent = DeleteLink.linkText(false);
        $.on(postEl, 'click', DeleteLink.toggle);
        return true;
      }
    };
    const fileEntry: PostMenuEntry = {
      el: fileEl,
      open({file}) {
        if (!file || file.isDead) { return false; }
        fileEl.textContent = DeleteLink.linkText(true);
        $.on(fileEl, 'click', DeleteLink.toggle);
        return true;
      }
    };

    const entry: PostMenuEntry = {
      el: div,
      order: 40,
      open(post) {
        if (post.isDead) { return false; }
        DeleteLink.post = post;
        DeleteLink.nodes.menu.textContent = DeleteLink.menuText();
        DeleteLink.cooldown.start(post);
        return true;
      },
      subEntries: [postEntry, fileEntry]
    };
    Menu.menu.addEntry(entry);
  },

  menuText(): string {
    const seconds = DeleteLink.cooldown.seconds[DeleteLink.post.fullID];
    return seconds ? `Delete (${seconds})` : 'Delete';
  },

  linkText(fileOnly: boolean): string {
    let text = fileOnly ? 'File' : 'Post';
    if (DeleteLink.auto[fileOnly ? 1 : 0][DeleteLink.post.fullID]) {
      text = `Deleting ${text.toLowerCase()}...`;
    }
    return text;
  },

  toggle(this: HTMLAnchorElement): void {
    const {post} = DeleteLink;
    const fileOnly = $.hasClass(this, 'delete-file');
    const auto = DeleteLink.auto[fileOnly ? 1 : 0];

    if (auto[post.fullID]) {
      delete auto[post.fullID];
    } else {
      auto[post.fullID] = true;
    }
    this.textContent = DeleteLink.linkText(fileOnly);

    if (!DeleteLink.cooldown.seconds[post.fullID]) {
      DeleteLink.delete(post, fileOnly);
    }
  },

  delete(post: MenuPost, fileOnly: boolean): XMLHttpRequest | undefined {
    const formEl = document.querySelector<HTMLFormElement>('form#delform');
    if (!formEl) { return; }

    const index = fileOnly ? 1 : 0;
    const link = DeleteLink.nodes.links[index];
    delete DeleteLink.auto[index][post.fullID];
    if (post.fullID === DeleteLink.post.fullID) { $.off(link, 'click', DeleteLink.toggle); }

    const form: Record<string, string | boolean> = {
      mode: 'usrdel',
      onlyimgdel: fileOnly,
      pwd: QR.persona.getPassword()
    };
    form[+post.ID] = 'delete';

    return $.ajax(formEl.action.replace(`/${g.BOARD}/`, `/${post.board.ID}/`), {
      responseType: 'document',
      withCredentials: true,
      onloadend(this: XMLHttpRequest): void { DeleteLink.load(link, post, fileOnly, this.responseXML); },
      form: $.formData(form)
    }
    );
  },

  load(link: HTMLAnchorElement, post: MenuPost, fileOnly: boolean, resDoc: Document | null): void {
    if (!resDoc) {
      new Notice('warning', 'Connection error, please retry.', 20, undefined);
      if (post.fullID === DeleteLink.post.fullID) { $.on(link, 'click', DeleteLink.toggle); }
      return;
    }

    link.textContent = DeleteLink.linkText(fileOnly);
    if (resDoc.title === '4chan - Banned') { // Ban/warn check
      const el = $.el('span', {innerHTML: "You can&#039;t delete posts because you are <a href=\"//www.4chan.org/banned\" target=\"_blank\">banned</a>."});
      new Notice('warning', el, 20, undefined);
      return;
    }

    const msg = resDoc.getElementById('errmsg');
    if (msg) { // error!
      new Notice('warning', msg.textContent, 20, undefined);
      if (post.fullID === DeleteLink.post.fullID) { $.on(link, 'click', DeleteLink.toggle); }
      if (QR.cooldown.data && Conf['Cooldown'] && /\bwait\b/i.test(msg.textContent)) {
        DeleteLink.cooldown.start(post, 5);
        DeleteLink.auto[fileOnly ? 1 : 0][post.fullID] = true;
        DeleteLink.nodes.links[fileOnly ? 1 : 0].textContent = DeleteLink.linkText(fileOnly);
      }
    } else {
      if (!fileOnly) { QR.cooldown.delete(post); }
      if (resDoc.title === 'Updating index...') {
        // We're 100% sure.
        (post.origin || post).kill(fileOnly);
      }
      if (post.fullID === DeleteLink.post.fullID) { link.textContent = 'Deleted'; }
    }
  },

  cooldown: {
    seconds,

    start(post: MenuPost, seconds?: number): void {
      // Already counting.
      if (DeleteLink.cooldown.seconds[post.fullID] != null) { return; }

      if (seconds == null) { seconds = QR.cooldown.secondsDeletion(post); }
      if (seconds > 0) {
        DeleteLink.cooldown.seconds[post.fullID] = seconds;
        DeleteLink.cooldown.count(post);
      }
    },

    count(post: MenuPost): void {
      if (post.fullID === DeleteLink.post.fullID) { DeleteLink.nodes.menu.textContent = DeleteLink.menuText(); }
      if ((DeleteLink.cooldown.seconds[post.fullID] > 0) && Conf['Cooldown']) {
        DeleteLink.cooldown.seconds[post.fullID]--;
        setTimeout(DeleteLink.cooldown.count, 1000, post);
      } else {
        delete DeleteLink.cooldown.seconds[post.fullID];
        for (const fileOnly of [false, true]) {
          if (DeleteLink.auto[fileOnly ? 1 : 0][post.fullID]) {
            DeleteLink.delete(post, fileOnly);
          }
        }
      }
    }
  }
};
export default DeleteLink;
