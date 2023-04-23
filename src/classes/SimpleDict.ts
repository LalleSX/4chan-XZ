import $ from '../platform/$'

export default class SimpleDict<T> {
  keys: string[]

  constructor() {
    this.keys = []
  }

  push(key: string, data: T) {
    key = `${key}`
    if (!this[key]) {
      this.keys.push(key)
    }
    return (this[key] = data)
  }

  rm(key: string | Object) {
    if (typeof key === 'string') {
      key = `${key}`
      if (this[key]) {
        delete this[key]
        this.keys.splice(this.keys.indexOf(key), 1)
      }
    } else {
      for (const k of Object.keys(key)) {
        this.rm(k)
      }
    }
  }

  forEach(fn: (data: T) => void) {
    for (const key of [...Array.from(this.keys)]) {
      fn(this[key])
    }
  }

  get(key: string): T | undefined {
    if (key === 'keys') {
      return undefined
    } else {
      return $.getOwn(this, key)
    }
  }
}
