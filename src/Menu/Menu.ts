import Callbacks from "../classes/Callbacks";
import UI from "../General/UI";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import Icon from "../Icons/icon";
import type Post from "../classes/Post";

export type MenuPost = Post & { origin?: Post };

export interface PostMenuEntry {
  el: HTMLElement;
  order?: number;
  open?: (post: MenuPost) => boolean;
  subEntries?: PostMenuEntry[];
}

interface CatalogMenuContext {
  nodes: { icons: HTMLElement };
  thread: { OP: MenuPost };
}

interface MenuCallbacks<T> {
  push(callback: { name: string; cb: (this: T) => void }): void;
}

const Menu = {
  button: null as HTMLAnchorElement | null,
  menu: null as InstanceType<typeof UI.Menu> | null,

  init(): void {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu']) { return; }

    this.button = $.el('a', {
      className: 'menu-button',
      href:      'javascript:;'
    }
    );

    Icon.set(this.button, 'caretDown');

    this.menu = new UI.Menu('post');
    // The legacy callback class creates these static registries in initClass().
    const callbacks = Callbacks as typeof Callbacks & {
      Post: MenuCallbacks<MenuPost>;
      CatalogThread: MenuCallbacks<CatalogMenuContext>;
    };
    callbacks.Post.push({
      name: 'Menu',
      cb:   this.node
    });

    callbacks.CatalogThread.push({
      name: 'Menu',
      cb:   this.catalogNode
    });
  },

  node(this: MenuPost): void {
    if (this.isClone) {
      const button = this.nodes.info.querySelector<HTMLAnchorElement>('.menu-button');
      button?.classList.remove('active');
      this.nodes.info.querySelector('.dialog')?.remove();
      if (button) {
        Menu.makeButton(this, button);
      } else {
        $.add(this.nodes.info, Menu.makeButton(this));
      }
      return;
    }
    $.add(this.nodes.info, Menu.makeButton(this));
  },

  catalogNode(this: CatalogMenuContext): void {
    $.after(this.nodes.icons, Menu.makeButton(this.thread.OP));
  },

  makeButton(post: MenuPost, button?: HTMLAnchorElement): HTMLAnchorElement {
    if (!button) { button = Menu.button.cloneNode(true) as HTMLAnchorElement; }
    $.on(button, 'click', function(this: HTMLAnchorElement, e: MouseEvent): void {
      Menu.menu.toggle(e, this, post);
    });
    return button;
  }
};
export default Menu;
