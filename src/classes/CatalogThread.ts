import $ from "../platform/$"
import Board from "./Board"
import Post from "./Post"
import Thread from "./Thread"

export default class CatalogThread {
  ID: any
  thread: Thread
  board: any
  nodes: { root: Post; thumb: HTMLElement; icons: any; postCount: number; fileCount: number; pageCount: number; replies: any }
  toString() { return this.ID }

  constructor(root: Post, thread: Thread) {
    this.thread = thread
    this.ID = this.thread.ID + ''
    this.board = this.thread.board
    const { post } = this.thread.OP.nodes
    this.nodes = {
      root,
      thumb: $('.catalog-thumb', post),
      icons: $('.catalog-icons', post),
      postCount: $('.post-count', post),
      fileCount: $('.file-count', post),
      pageCount: $('.page-count', post),
      replies: null
    }
    this.thread.catalogView = this
  }
}
