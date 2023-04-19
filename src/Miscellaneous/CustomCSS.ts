import $ from '../platform/$'
import CSS from '../css/CSS'
import { Conf } from '../globals/globals'


const CustomCSS = {
  init(): void {
    if (!Conf['Custom CSS']) {
      return
    }
    return this.addStyle()
  },

  addStyle(): HTMLStyleElement {
    return (this.style = $.addStyle(
      CSS.sub(Conf['usercss']),
      'custom-css',
      '#fourchanx-css',
    ))
  },

  rmStyle(): boolean {
    if (this.style) {
      $.rm(this.style)
      return delete this.style
    }
  },

  update(): void {
    if (this.style) {
      this.rmStyle()
      this.addStyle()
    }
  }
}
export default CustomCSS
