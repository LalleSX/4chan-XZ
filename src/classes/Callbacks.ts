import Main from '../main/Main'

class Callbacks {
  private keys: string[]
  static Post: Callbacks
  static Thread: Callbacks
  static CatalogThread: Callbacks
  static CatalogThreadNative: Callbacks

  constructor(private type: string) {
    this.keys = []
  }

  static initClass(): void {
    this.Post = new Callbacks('Post')
    this.Thread = new Callbacks('Thread')
    this.CatalogThread = new Callbacks('Catalog Thread')
    this.CatalogThreadNative = new Callbacks('Catalog Thread')
  }

  push({ name, cb }: { name: string; cb: VoidFunction }): void {
    if (!this[name as keyof Callbacks]) {
      this.keys.push(name)
    }
    this[name as keyof Callbacks] = cb
  }

  execute(node: Node, keys: (keyof Callbacks)[] = this.keys, force = false): void {
    if (node.callbacksExecuted && !force) {
      return
    }
    node.callbacksExecuted = true

    const errors: { message: string; error: any; html?: string }[] = []

    keys.forEach((name) => {
      try {
        const callback = this[name]
        if (typeof callback === "function") {
          callback.call(node)
        }
      } catch (err) {
        errors.push({
          message: `"${name}" crashed on node ${this.type} No. ${node.ID} (${node.board}).`,
          error: err,
          html: node.nodes?.root?.outerHTML,
        })
      }
    })

    if (errors.length) {
      Main.handleErrors(errors)
    }
  }
}

Callbacks.initClass()

export default Callbacks
