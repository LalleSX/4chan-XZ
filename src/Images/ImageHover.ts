import Callbacks from "../classes/Callbacks"
import Post from "../classes/Post"
import Header from "../General/Header"
import UI from "../General/UI"
import { Conf, doc, g } from "../globals/globals"
import $ from "../platform/$"
import { SECOND } from "../platform/helpers"
import type { File } from "../types/globals"
import ImageCommon from "./ImageCommon"
import Volume from "./Volume"
const ImageHover = {
  init() {
    if (!['index', 'thread'].includes(g.VIEW)) { return }
    if (Conf['Image Hover']) {
      Callbacks.Post.push({
        name: 'Image Hover',
        cb: this.node
      })
    }
    if (Conf['Image Hover in Catalog']) {
      return Callbacks.CatalogThread.push({
        name: 'Image Hover',
        cb: this.catalogNode
      })
    }
  },

  node() {
    return this.files.filter((file) => (file.isImage || file.isVideo) && file.thumb).map((file: File) =>
      $.on(file.thumb, 'mouseover', ImageHover.mouseover(this, file)))
  },

  catalogNode() {
    const file = this.thread.OP.files[0]
    if (!file || (!file.isImage && !file.isVideo)) {
      return
    }
    const hover = ImageHover.mouseover(this.thread.OP, file)
    if (!hover) {
      return
    }
    return $.on(this.nodes.thumb, 'mouseover', hover)
  },

  mouseover(post: Post, file: File) {
    return function (e) {
      let el, height, width
      if (!doc.contains(this)) { return }
      const { isVideo } = file
      if (file.isExpanding || file.isExpanded || g.SITE.isThumbExpanded?.(file)) { return }
      const error = ImageHover.error(this.post, file)
      if (ImageCommon.cache?.dataset.fileID === `${post.fullID}.${file.index}`) {
        el = ImageCommon.popCache()
        $.on(el, 'error', error)
      } else {
        el = $.el((isVideo ? 'video' : 'img'), {
          className: 'ihover',
          style: {
            maxWidth: '100%',
            maxHeight: '100%'
          }
        })
        el.dataset.fileID = `${post.fullID}.${file.index}`
        $.on(el, 'error', error)
        el.src = file.url
      }

      if (Conf['Restart when Opened']) {
        ImageCommon.rewind(el)
        ImageCommon.rewind(this)
      }
      el.id = 'ihover'
      $.add(Header.hover, el)
      if (isVideo) {
        el.loop = true
        el.controls = false
        Volume.setup(el)
        if (Conf['Autoplay']) {
          el.play()
          if (this.nodeName === 'VIDEO') { this.currentTime = el.currentTime }
        }
      }
      if (file.dimensions) {
        [width, height] = Array.from((file.dimensions.split('x').map((x) => +x)))
        const maxWidth = doc.clientWidth
        const maxHeight = doc.clientHeight - UI.hover.padding
        const scale = Math.min(1, maxWidth / width, maxHeight / height)
        width *= scale
        height *= scale
        el.style.maxWidth = `${width}px`
        el.style.maxHeight = `${height}px`
      }
      return UI.hover({
        root: this,
        el,
        latestEvent: e,
        endEvents: 'mouseout click',
        height,
        width,
        noRemove: true,
        cb() {
          $.off(el, 'error', error)
          ImageCommon.pushCache(el)
          ImageCommon.pause(el)
          $.rm(el)
          el.removeAttribute('style')
          return el.remove()
        }
      })
    }
  },

  error(post: HTMLElement, file: File) {
    return function () {
      if (ImageCommon.decodeError(this, file)) { return }
      return ImageCommon.error(this, post, file, 3 * SECOND, URL => {
        if (URL) {
          this.src = URL + (this.src === URL ? '?' + Date.now() : '')
          if (this.src !== URL) { return }
        }
        if (this.src !== file) {
          this.src = file
          return
        }
        return $.rm(this)
      })
    }
  }
}
export default ImageHover
