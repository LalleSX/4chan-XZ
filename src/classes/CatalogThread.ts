import type Board from "./Board";
import type Thread from "./Thread";
import $ from "../platform/$";

export default class CatalogThread {
  declare ID: number;
  declare board: Board;
  declare thread: Thread;
  declare callbacksExecuted?: boolean;
  declare nodes: {
    root: HTMLElement;
    thumb: HTMLElement;
    icons: HTMLElement;
    postCount: HTMLElement;
    fileCount: HTMLElement;
    pageCount: HTMLElement;
    replies: HTMLElement | null;
  };

  toString(): number { return this.ID; }

  constructor(root: HTMLElement, thread: Thread) {
    this.thread = thread;
    this.ID    = this.thread.ID;
    this.board = this.thread.board;
    const {post} = this.thread.OP.nodes;
    this.nodes = {
      root,
      thumb:     $('.catalog-thumb', post),
      icons:     $('.catalog-icons', post),
      postCount: $('.post-count',    post),
      fileCount: $('.file-count',    post),
      pageCount: $('.page-count',    post),
      replies:   null
    };
    this.thread.catalogView = this;
  }
}
