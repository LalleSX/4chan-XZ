import $ from '../platform/$'
class ShimSet {
  elements: any
  size: number
  constructor() {
    this.elements = $.dict()
    this.size = 0
  }
  has(value) {
    return value in this.elements
  }
  add(value) {
    if (this.elements[value]) { return }
    this.elements[value] = true
    return this.size++
  }
  delete(value) {
    if (!this.elements[value]) { return }
    delete this.elements[value]
    return this.size--
  }
}

if (!('Set' in window)) { window.Set = ShimSet }
