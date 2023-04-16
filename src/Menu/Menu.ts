import Callbacks from '../classes/Callbacks';
import UI from '../General/UI';
import { g, Conf } from '../globals/globals';
import $ from '../platform/$';

interface Post {
  isClone?: boolean;
  nodes: {
    info: HTMLElement;
    icons: HTMLElement;
  };
  thread?: {
    OP: Post;
  };
}

const Menu = {
  button: document.createElement('a'),
  menu: new UI.Menu('post'),

  init(): void | ReturnType<typeof Callbacks.CatalogThread.push> {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu']) {
      return;
    }

    this.button = $.el('a', {
      className: 'menu-button',
      href: 'javascript:;',
    });

    $.extend(this.button, { innerHTML: '<i class="fa fa-angle-down"></i>' });

    this.menu = new UI.Menu('post');
    Callbacks.Post.push({
      name: 'Menu',
      cb: this.node,
    });

    return Callbacks.CatalogThread.push({
      name: 'Menu',
      cb: this.catalogNode,
    });
  },

  node(this: Post): void | HTMLElement {
    if (this.isClone) {
      const button = $('.menu-button', this.nodes.info);
      $.rmClass(button, 'active');
      $.rm($('.dialog', this.nodes.info));
      Menu.makeButton(this, button);
      return;
    }
    return $.add(this.nodes.info, Menu.makeButton(this));
  },

  catalogNode(this: Post): void {
    return $.after(this.nodes.icons, Menu.makeButton(this.thread!.OP));
  },

  makeButton(post: Post, button?: HTMLElement): HTMLElement {
    if (!button) {
      button = Menu.button.cloneNode(true) as HTMLElement;
    }
    $.on(button, 'click', function (this: HTMLElement, e: Event) {
      return Menu.menu.toggle(e, this, post);
    });
    return button;
  },
};

export default Menu;
