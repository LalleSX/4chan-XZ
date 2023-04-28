import $ from "../platform/$"

export default class SimpleDict<T> {
  keys: string[]

  constructor() {
    this.keys = []
  }

  push(key: string, data: T): T {
    key = `${key}`
    if (!this[key]) { this.keys.push(key) }
    return this[key] = data
  }

  rm(key: string) {
    let i: number
    key = `${key}`
    if ((i = this.keys.indexOf(key)) !== -1) {
      this.keys.splice(i, 1)
      return delete this[key]
    }
  }

  forEach(fn: (value: T) => void): void {
    for (const key of [...Array.from(this.keys)]) { fn(this[key]) }
  }

  get(key: string): T {
    if (key === 'keys') {
      return undefined
    } else {
      return $.getOwn(this, key)
    }
  }
}
