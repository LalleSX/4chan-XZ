import { g } from "../globals/globals"
import $ from "../platform/$"
import Callbacks from "./Callbacks"


export default class Connection {
  target: Window | HTMLIFrameElement
  origin: string
  cb: Callbacks
  constructor(target: Window, origin: string, cb: Callbacks) {
    this.send = this.send.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this.target = target
    this.origin = origin
    this.cb = cb
    $.on(window, 'message', this.onMessage)
  }

  targetWindow() {
    if (this.target instanceof window.HTMLIFrameElement) {
      return this.target.contentWindow
    } else {
      return this.target
    }
  }

  send(data) {
    return this.targetWindow().postMessage(`${g.NAMESPACE}${JSON.stringify(data)}`, this.origin)
  }

  onMessage(e: MessageEvent) {
    if ((e.source !== this.targetWindow()) ||
      (e.origin !== this.origin) ||
      (typeof e.data !== 'string') ||
      (e.data.slice(0, g.NAMESPACE.length) !== g.NAMESPACE)) { return }
    const data = JSON.parse(e.data.slice(g.NAMESPACE.length))
    for (const type in data) {
      const value = data[type]
      if ($.hasOwn(this.cb, type)) {
        this.cb[type](value)
      }
    }
  }
}
