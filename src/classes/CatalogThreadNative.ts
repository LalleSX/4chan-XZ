import { g } from '../globals/globals'
import $ from '../platform/$'
import Board from './Board'
import Thread from './Thread'

export default class CatalogThreadNative {
  boardID: Board
  nodes: { root: any; thumb: any }
  siteID: number
  threadID: number
  ID: string
  thread: any
  toString() {
    return this.ID
  }

  constructor(root: HTMLElement) {
    const thumb = $(g.SITE.selectors.catalog.thumb, root)
    this.nodes = { root, thumb }
    this.siteID = g.SITE.ID
    this.boardID = thumb.parentNode.pathname.split(/\/+/)[1]
    this.boardID = g.boards[g.BOARD.ID] ?? new Board(this.boardID)
    this.ID = this.threadID = +root.dataset.id || $(root).data('id')
    this.threadID =
      this.boardID.threads.get(this.ID) ?? new Thread(this.ID, g.BOARD.ID)
  }
}
