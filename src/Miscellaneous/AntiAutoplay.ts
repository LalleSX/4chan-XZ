import Callbacks from "../classes/Callbacks"
import { Conf, doc } from "../globals/globals"
import $ from "../platform/$"
import $$ from "../platform/$$"


const AntiAutoplay = {
  init() {
    if (!Conf['Disable Autoplaying Sounds']) { return }
    $.addClass(doc, 'anti-autoplay')
    for (const audio of $$('audio[autoplay]', doc)) { this.stop(audio) }
    window.addEventListener('loadstart', (e => this.stop(e.target)), true)
    Callbacks.Post.push({
      name: 'Disable Autoplaying Sounds',
      cb: this.node
    })
    return $.ready(() => this.process(document.body))
  },

  stop(audio) {
    if (!audio.autoplay) { return }
    audio.pause()
    audio.autoplay = false
    if (audio.controls) { return }
    audio.controls = true
    return $.addClass(audio, 'controls-added')
  },

  node() {
    return AntiAutoplay.process(this.node())
  },

  process(root: HTMLElement) {
    for (const iframe of $$('iframe[src*="youtube"][src*="autoplay=1"]', root)) {
      AntiAutoplay.processVideo(iframe, 'src')
    }
    for (const object of $$('object[data*="youtube"][data*="autoplay=1"]', root)) {
      AntiAutoplay.processVideo(object, 'data')
    }
  },

  processVideo(el: HTMLIFrameElement | HTMLObjectElement, attr: 'src' | 'data') {
    el[attr] = el[attr].replace(/\?autoplay=1&?/, '?').replace('&autoplay=1', '')
    if (window.getComputedStyle(el).display === 'none') { el.style.display = 'block' }
    return $.addClass(el, 'autoplay-removed')
  }
}
export default AntiAutoplay
