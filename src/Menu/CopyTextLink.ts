import { g, Conf, d } from '../globals/globals'
import $ from '../platform/$'
import Menu from './Menu'
import type Post  from '../classes/Post'

var CopyTextLink = {
  text: '',
  init(): void {
    if (
      !['index', 'thread'].includes(g.VIEW) ||
      !Conf['Menu'] ||
      !Conf['Copy Text Link']
    ) {
      return
    }

    const a: HTMLAnchorElement = $.el('a', {
      className: 'copy-text-link',
      href: 'javascript:;',
      textContent: 'Copy Text',
    })
    $.on(a, 'click', CopyTextLink.copy)

    return Menu.menu.addEntry({
      el: a,
      order: 12,
      open(post: Post): boolean {
        CopyTextLink.text = (post.origin || post).commentOrig()
        return true
      },
    })
  },

  copy() {
    const el: HTMLTextAreaElement = $.el('textarea', {
      className: 'copy-text-element',
      value: CopyTextLink.text,
    })
    $.add(d.body, el)
    el.select()
    try {
      d.execCommand('copy')
    } catch (error) {}
    return $.rm(el)
  },
}
export default CopyTextLink
