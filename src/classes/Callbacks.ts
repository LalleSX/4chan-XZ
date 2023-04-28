import Main from "../main/Main"
import Post from "./Post"


export default class Callbacks {
  static Post: Callbacks
  static Thread: Callbacks
  static CatalogThread: Callbacks
  static CatalogThreadNative: Callbacks
  type: string
  keys: string[]
  static initClass() {
    this.Post = new Callbacks('Post')
    this.Thread = new Callbacks('Thread')
    this.CatalogThread = new Callbacks('Catalog Thread')
    this.CatalogThreadNative = new Callbacks('Catalog Thread')
  }

  constructor(type) {
    this.type = type
    this.keys = []
  }

  push({ name, cb }) {
    if (!this[name]) { this.keys.push(name) }
    return this[name] = cb
  }

  execute(node, keys = this.keys, force = false) {
    let errors
    if (node.callbacksExecuted && !force) { return }
    node.callbacksExecuted = true
    for (const name of keys) {
      try {
        this[name]?.call(node)
      } catch (err) {
        if (!errors) { errors = [] }
        errors.push({
          message: ['"', name, '" crashed on node ', this.type, ' No.', node.ID, ' (', node.board, ').'].join(''),
          error: err,
          html: node.nodes?.root?.outerHTML
        })
      }
    }

    if (errors) { return Main.handleErrors(errors) }
  }
}
Callbacks.initClass()
