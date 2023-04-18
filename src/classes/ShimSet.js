/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import $ from '../platform/$'
class ShimSet {
  constructor() {
    this.elements = $.cache()
    this.size = 0
  }
  has(value) {
    return value in this.elements
  }
  add(value) {
    if (this.elements[value]) {
      return
    }
    this.elements[value] = true
    return this.size++
  }
  delete(value) {
    if (!this.elements[value]) {
      return
    }
    delete this.elements[value]
    return this.size--
  }
}

if (!('Set' in window)) {
  window.Set = ShimSet
}
