import $ from '../platform/$'
import Board from './Board'
import Thread from './Thread'

export default class CatalogThread {
  ID: string | number
  thread: Thread
  board: Board | string
  nodes: {
    root: HTMLElement
    thumb: HTMLElement
    icons: HTMLElement
    postCount: number
    fileCount: number
    pageCount: number
    replies: null
  }
  toString() {
    return this.ID
  }

  constructor(root: HTMLElement, thread: Thread) {
    this.thread = thread
    this.ID = this.thread.ID
    this.board = this.thread.board
    const { post } = this.thread.OP.nodes
    this.nodes = {
      root,
      thumb: $('.catalog-thumb', post),
      icons: $('.catalog-icons', post),
      postCount: $('.post-count', post),
      fileCount: $('.file-count', post),
      pageCount: $('.page-count', post),
      replies: null,
    }
    this.thread.catalogView = this
  }
}
