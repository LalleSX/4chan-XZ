import { g } from '../globals/globals'
import $ from '../platform/$'
import Board from './Board'
import Thread from './Thread'

export default class CatalogThreadNative {
  toString() {
    return this.ID
  }

  constructor(root) {
    const thumb = $(g.SITE.selectors.catalog.thumb, root);
    this.nodes = { root, thumb };
    this.siteID = g.SITE.ID;
    this.boardID = thumb.parentNode.pathname.split(/\/+/)[1];
    this.board = g.boards[this.boardID] ?? new Board(this.boardID);
    this.ID = this.threadID = +root.dataset.id || $(root).data('id');
    this.thread = this.board.threads.get(this.ID) ?? new Thread(this.ID, this.board);
  }
}
