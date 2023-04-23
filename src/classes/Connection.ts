import { g } from '../globals/globals'
import $ from '../platform/$'

interface ConnectionCallback {
  [key: string]: (value: any) => void
}

export default class Connection {
  private target: Window | HTMLIFrameElement
  private origin: string
  private cb: ConnectionCallback

  constructor(
    target: Window | HTMLIFrameElement,
    origin: string,
    cb: ConnectionCallback = {}
  ) {
    this.send = this.send.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this.target = target
    this.origin = origin
    this.cb = cb
    $.on(window, 'message', this.onMessage)
  }

  private targetWindow(): Window {
    if (this.target instanceof HTMLIFrameElement) {
      return this.target.contentWindow as Window
    } else {
      return this.target as Window
    }
  }

  public send(data: any): void {
    this.targetWindow().postMessage(
      `${g.NAMESPACE}${JSON.stringify(data)}`,
      this.origin
    )
  }

  public onMessage(e: MessageEvent): void {
    if (
      e.source !== this.targetWindow() ||
      e.origin !== this.origin ||
      typeof e.data !== 'string' ||
      e.data.slice(0, g.NAMESPACE.length) !== g.NAMESPACE
    ) {
      return
    }
    const data = JSON.parse(e.data.slice(g.NAMESPACE.length))
    for (const type in data) {
      const value = data[type]
      if (Object.prototype.hasOwnProperty.call(this.cb, type)) {
        this.cb[type](value)
      }
    }
  }
}
