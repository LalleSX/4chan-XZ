export default class SimpleDict<T> {
  keys: string[]

  constructor() {
    this.keys = []
  }

  push(key: string, data: T): T {
    key = `${key}`
    this[key] = data
    this.keys.push(key)
    return data
  }

  rm(key: string) {
    key = `${key}`
    delete this[key]
    this.keys = this.keys.filter(k => k !== key)
  }

  forEach(fn: (value: T) => void): void {
    for (const key of [...Array.from(this.keys)]) { fn(this[key]) }
  }

  get(key: string): T {
    return this[key]
  }
}
