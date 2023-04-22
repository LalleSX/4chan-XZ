import Callbacks from '../classes/Callbacks'
import UI from '../General/UI'
import { g, Conf } from '../globals/globals'
import $ from '../platform/$'
import Post from '../classes/Post'

var Menu: any = {
  init(): VoidFunction {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu']) {
      return
    }

    this.button = $.el('a', {
      className: 'menu-button',
      href: 'javascript:;',
    })

    $.extend(this.button, { innerHTML: '<i class="fa fa-angle-down"></i>' })

    this.menu = new UI.Menu('post')
    Callbacks.Post.push({
      name: 'Menu',
      cb: this.node,
    })

    return Callbacks.CatalogThread.push({
      name: 'Menu',
      cb: this.catalogNode,
    })
  },

  node(): HTMLElement {
    if (this.isClone) {
      const button = $('.menu-button', this.nodes.info)
      $.rmClass(button, 'active')
      $.rm($('.dialog', this.nodes.info))
      Menu.makeButton(this, button)
      return
    }
    return $.add(this.nodes.info, Menu.makeButton(this))
  },

  catalogNode(): HTMLElement {
    return $.after(this.nodes.icons, Menu.makeButton(this.thread.OP))
  },

  makeButton(post: Post, button?: HTMLElement): HTMLElement {
    if (!button) {
      button = Menu.button.cloneNode(true)
    }
    $.on(button, 'click', (e: Event) => {
      return Menu.menu.toggle(e, this, post)
    })
    return button
  },
}
export default Menu
