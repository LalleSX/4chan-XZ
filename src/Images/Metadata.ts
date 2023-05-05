import Callbacks from "../classes/Callbacks"
import Get from "../General/Get"
import { Conf, d, g } from "../globals/globals"
import $ from "../platform/$"
import CrossOrigin from "../platform/CrossOrigin"

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const Metadata = {
  init() {
    if (!Conf['WEBM Metadata'] || !['index', 'thread'].includes(g.VIEW)) { return }

    return Callbacks.Post.push({
      name: 'WEBM Metadata',
      cb: this.node
    })
  },

  node() {
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]
      if (/webm$/i.test(file.url)) {
        let el

        if (this.isClone) {
          el = $('.webm-title', file.text)
        } else {
          el = $.el('span',
            { className: 'webm-title' })
          el.dataset.index = i
          $.extend(el,
            { innerHTML: "<a href=\"javascript:;\"></a>" })
          $.add(file.text, [$.tn(' '), el])
        }
        if (el.children.length === 1) { $.one(el.lastElementChild, 'mouseover focus', Metadata.load) }
      }
    }
  },

  load() {
    $.rmClass(this.parentNode, 'error')
    $.addClass(this.parentNode, 'loading')
    const { index } = this.parentNode.dataset
    return CrossOrigin.binary(Get.postFromNode(this).files[+index].url, data => {
      $.rmClass(this.parentNode, 'loading')
      if (data != null) {
        const title = Metadata.parse(data)
        const output = $.el('span',
          { textContent: title || '' })
        if (title == null) { $.addClass(this.parentNode, 'not-found') }
        $.before(this, output)
        this.parentNode.tabIndex = 0
        this.parentNode.onfocus = function () { this.parentNode.focus() }
        return this.tabIndex = -1
      } else {
        $.addClass(this.parentNode, 'error')
        return $.one(this, 'click', Metadata.load)
      }
    }
      ,
      { Range: 'bytes=0-9999' })
  },

  parse(data) {
    const readInt = function () {
      let n = data[i++]
      let len = 0
      while (n < (0x80 >> len)) { len++ }
      n ^= (0x80 >> len)
      while (len-- && (i < data.length)) {
        n = (n << 8) ^ data[i++]
      }
      return n
    }

    let i = 0
    while (i < data.length) {
      const element = readInt()
      let size = readInt()
      if (element === 0x3BA9) { // Title
        let title = ''
        while (size-- && (i < data.length)) {
          title += String.fromCharCode(data[i++])
        }
        return decodeURIComponent(escape(title)) // UTF-8 decoding
      } else if (![0x8538067, 0x549A966].includes(element)) { // Segment, Info
        i += size
      }
    }
    return null
  }
}
export default Metadata
