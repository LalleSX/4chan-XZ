import $ from '../platform/$'
class ShimSet {
  elements: string
  size: number
  constructor() {
    this.elements = $.cache()
    this.size = 0
  }
  has(value: string) {
    return !!this.elements[value]
  }
  add(value: string) {
    if (this.elements[value]) {
      return
    }
    this.elements[value] = true
    return this.size++
  }
  delete(value: string) {
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
