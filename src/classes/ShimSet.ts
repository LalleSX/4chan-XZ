import $ from '../platform/$'
class ShimSet {
  elements: { [key: string]: boolean }
  size: number
  constructor() {
    this.elements = $.dict()
    this.size = 0
  }
  has(value: string) {
    return value in this.elements
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
  // @ts-ignore
  window.Set = ShimSet
}
