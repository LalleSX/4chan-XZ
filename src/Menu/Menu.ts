import Callbacks from "../classes/Callbacks"
import Post from "../classes/Post"
import UI from "../General/UI"
import { Conf, g } from "../globals/globals"
import $ from "../platform/$"


const Menu = {
  menu: null,
  init() {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu']) { return }

    this.button = $.el('a', {
      className: 'menu-button',
      href: 'javascript:;'
    }
    )

    $.extend(this.button, { innerHTML: "<i class=\"fa fa-angle-down\"></i>" })

    this.menu = new UI.Menu('post')
    Callbacks.Post.push({
      name: 'Menu',
      cb: this.node
    })

    return Callbacks.CatalogThread.push({
      name: 'Menu',
      cb: this.catalogNode
    })
  },

  node() {
    if (this.isClone) {
      const button = $('.menu-button', this.nodes.info)
      $.rmClass(button, 'active')
      $.rm($('.dialog', this.nodes.info))
      Menu.makeButton(this, button)
      return
    }
    return $.add(this.nodes.info, Menu.makeButton(this))
  },

  catalogNode() {
    return $.after(this.nodes.icons, Menu.makeButton(this.thread.OP))
  },

  makeButton(post, button) {
    if (!button) { button = Menu.button.cloneNode(true) }
    $.on(button, 'click', function (e: MouseEvent) {
      return Menu.menu.toggle(e, this, post)
    })
    return button
  }
}
export default Menu
