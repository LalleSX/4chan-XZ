import { g } from '../globals/globals'
import $ from '../platform/$'
import Board from './Board'
import Thread from './Thread'

export default class CatalogThreadNative {
  boardID: string | Board
  nodes: { root: any; thumb: any }
  siteID: number
  threadID: number
  ID: number
  thread: Thread
  toString() {
    return this.ID
  }

  constructor(root: HTMLElement) {
    const thumb = $(g.SITE.selectors.catalog.thumb, root)
    this.nodes = { root, thumb }
    this.siteID = g.SITE.ID
    this.boardID = g.BOARD
    this.boardID = this.boardID || $(root).data('board')
    this.ID = this.threadID = +root.dataset.id || $(root).data('id')
    this.threadID = this.ID = this.threadID || this.ID
  }
}