import Main from '../main/Main';

export default class Callbacks {
  private type: string;
  private keys: string[];

  static Post: Callbacks;
  static Thread: Callbacks;
  static CatalogThread: Callbacks;
  static CatalogThreadNative: Callbacks;

  static initClass() {
    this.Post = new Callbacks('Post');
    this.Thread = new Callbacks('Thread');
    this.CatalogThread = new Callbacks('Catalog Thread');
    this.CatalogThreadNative = new Callbacks('Catalog Thread');
  }

  constructor(type: string) {
    this.type = type;
    this.keys = [];
  }

  push({ name, cb }: { name: string; cb: () => void }) {
    if (!this[name]) {
      this.keys.push(name);
    }
    return (this[name] = cb);
  }

  execute(node: any, keys = this.keys, force = false) {
    let errors: any[];
    if (node.callbacksExecuted && !force) {
      return;
    }
    node.callbacksExecuted = true;
    for (let name of keys) {
      try {
        this[name]?.call(node);
      } catch (err: any) {
        if (!errors) {
          errors = [];
        }
        errors.push({
          message: [
            '"',
            name,
            '" crashed on node ',
            this.type,
            ' No.',
            node.ID,
            ' (',
            node.board,
            ').',
          ].join(''),
          error: err,
          html: node.nodes?.root?.outerHTML,
        });
      }
    }

    if (errors) {
      return Main.handleErrors(errors);
    }
  }
}

Callbacks.initClass();
