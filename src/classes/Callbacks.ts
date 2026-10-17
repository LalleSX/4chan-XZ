import type Post from "./Post";
import type Thread from "./Thread";
import type CatalogThread from "./CatalogThread";
import type CatalogThreadNative from "./CatalogThreadNative";
import Main from "../main/Main";

interface CallbackNode {
  ID: number;
  board: {toString(): string};
  nodes: {root: HTMLElement};
  callbacksExecuted?: boolean;
}

type Callback<T> = (this: T) => unknown;

export default class Callbacks<T extends CallbackNode> {
  declare static Post: Callbacks<Post>;
  declare static Thread: Callbacks<Thread>;
  declare static CatalogThread: Callbacks<CatalogThread>;
  declare static CatalogThreadNative: Callbacks<CatalogThreadNative>;
  declare type: string;
  declare keys: string[];
  private callbacks: Record<string, Callback<T>> = Object.create(null);

  static initClass() {
    this.Post          = new Callbacks('Post');
    this.Thread        = new Callbacks('Thread');
    this.CatalogThread = new Callbacks('Catalog Thread');
    this.CatalogThreadNative = new Callbacks('Catalog Thread');
  }

  constructor(type: string) {
    this.type = type;
    this.keys = [];
  }

  push({name, cb}: {name: string; cb: Callback<T>}): Callback<T> {
    if (!this.callbacks[name]) { this.keys.push(name); }
    return this.callbacks[name] = cb;
  }

  execute(node: T, keys: readonly string[] = this.keys, force = false) {
    let errors: {message: string; error: unknown; html: string | undefined}[];
    if (node.callbacksExecuted && !force) { return; }
    node.callbacksExecuted = true;
    for (const name of keys) {
      try {
        this.callbacks[name]?.call(node);
      } catch (err) {
        if (!errors) { errors = []; }
        errors.push({
          message: ['"', name, '" crashed on node ', this.type, ' No.', node.ID, ' (', node.board, ').'].join(''),
          error: err,
          html: node.nodes?.root?.outerHTML
        });
      }
    }

    if (errors) { return Main.handleErrors(errors); }
  }
}
Callbacks.initClass();
