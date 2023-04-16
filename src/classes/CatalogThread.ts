import $ from '../platform/$';

export default class CatalogThread {
  private thread: any;
  private ID: number;
  private board: string;
  private nodes: {
    root: any,
    thumb: HTMLElement,
    icons: HTMLElement,
    postCount: HTMLElement,
    fileCount: HTMLElement,
    pageCount: HTMLElement,
    replies: null | any,
  };

  constructor(root: any, thread: any) {
    this.thread = thread;
    this.ID = this.thread.ID;
    this.board = this.thread.board;
    const { post } = this.thread.OP.nodes;
    this.nodes = {
      root,
      thumb: $('.catalog-thumb', post),
      icons: $('.catalog-icons', post),
      postCount: $('.post-count', post),
      fileCount: $('.file-count', post),
      pageCount: $('.page-count', post),
      replies: null,
    };
    this.thread.catalogView = this;
  }

  public toString(): string {
    return this.ID.toString();
  }
}