import Header from '../General/Header'
import { d } from '../globals/globals'
import $ from '../platform/$'
import { SECOND } from '../platform/helpers'

export default class Notice {
  private el: HTMLDivElement
  private timeout?: number
  private onclose?: () => void
  private closed = false

  constructor(
    type: string,
    private content: string | Node,
    timeout?: number,
    onclose?: () => void
  ) {
    this.el = document.createElement('div')
    this.el.innerHTML =
      '<a href="javascript:;" class="close fa fa-times" title="Close"></a><div class="message"></div>'
    this.el.style.opacity = '0'

    this.setType(type)

    $.on(this.el.firstElementChild!, 'click', this.close)

    if (typeof content === 'string') {
      this.content = $.tn(content)
    }

    $.add(this.el.lastElementChild!, this.content)

    $.ready(this.add)

    this.timeout = timeout
    this.onclose = onclose
  }

  private setType(type: string) {
    this.el.className = `notification ${type}`
  }

  private add = () => {
    if (this.closed) {
      return
    }

    if (d.hidden) {
      $.on(d, 'visibilitychange', this.add)
      return
    }

    $.off(d, 'visibilitychange', this.add)

    Header.noticesRoot.appendChild(this.el)

    this.el.clientHeight // force reflow

    this.el.style.opacity = '1'

    if (this.timeout) {
      setTimeout(this.close, this.timeout * SECOND)
    }
  }

  private close = () => {
    this.closed = true
    $.off(d, 'visibilitychange', this.add)
    $.rm(this.el)
    this.onclose?.()
  }
}
