import Notice from "../classes/Notice"
import { Conf, g } from "../globals/globals"
import $ from "../platform/$"
import { dict, HOUR } from "../platform/helpers"


const BoardConfig = {
  cbs: [],

  init() {
    let middle
    if (g.SITE.software !== 'yotsuba') { return }
    const now = Date.now()
    if (now - (2 * HOUR) >= ((middle = Conf['boardConfig'].lastChecked || 0)) || middle > now) {
      return $.ajax(`${location.protocol}//a.4cdn.org/boards.json`,
        { onloadend: this.load }, dict())
    } else {
      const { boards } = Conf['boardConfig']
      return this.set(boards)
    }
  },

  load() {
    let boards
    if ((this.status === 200) && this.response && this.response.boards) {
      boards = dict()
      for (const board of this.response.boards) {
        boards[board.board] = board
      }
      $.set('boardConfig', { boards, lastChecked: Date.now() })
    } else {
      ({ boards } = Conf['boardConfig'])
      const err = (() => {
        switch (this.status) {
          case 0: return 'Connection Error'
          case 200: return 'Invalid Data'
          default: return `Error ${this.statusText} (${this.status})`
        }
      })()
      new Notice('warning', `Failed to load board configuration. ${err}`, 20)
    }
    return BoardConfig.set(boards)
  },

  set(boards) {
    this.boards = boards
    for (const ID in g.boards) {
      const board = g.boards[ID]
      board.config = this.boards[ID] || {}
    }
    for (const cb of this.cbs) {
      $.queueTask(cb)
    }
  },

  ready(cb) {
    if (this.boards) {
      return cb()
    } else {
      return this.cbs.push(cb)
    }
  },

  sfwBoards(sfw) {
    return (() => {
      const result = []
      const object = this.boards || Conf['boardConfig'].boards
      for (const board in object) {
        const data = object[board]
        if (!!data.ws_board === sfw) {
          result.push(board)
        }
      }
      return result
    })()
  },

  isSFW(board) {
    return !!(this.boards || Conf['boardConfig'].boards)[board]?.ws_board
  },

  domain(board) {
    return `boards.${BoardConfig.isSFW(board) ? '4channel' : '4chan'}.org`
  },

  isArchived(board) {
    // assume archive exists if no data available to prevent cleaning of archived threads
    const data = (this.boards || Conf['boardConfig'].boards)[board]
    return !data || data.is_archived
  },

  noAudio(boardID) {
    if (g.SITE.software !== 'yotsuba') { return false }
    const boards = this.boards || Conf['boardConfig'].boards
    return boards && boards[boardID] && !boards[boardID].webm_audio
  },

  title(boardID) {
    return (this.boards || Conf['boardConfig'].boards)?.[boardID]?.title || ''
  }
}
export default BoardConfig
