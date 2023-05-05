import Callbacks from "../classes/Callbacks"
import Get from "../General/Get"
import { Conf, g } from "../globals/globals"
import $ from "../platform/$"


const QuoteStrikeThrough = {
  init() {
    if (!['index', 'thread'].includes(g.VIEW) ||
      (!Conf['Reply Hiding Buttons'] && (!Conf['Menu'] || !Conf['Reply Hiding Link']) && !Conf['Filter'])) { return }

    return Callbacks.Post.push({
      name: 'Strike-through Quotes',
      cb: this.node
    })
  },

  node() {
    if (this.isClone) { return }
    for (const quotelink of this.nodes.quotelinks) {
      const { boardID, postID } = Get.postDataFromLink(quotelink)
      if (g.posts.get(`${boardID}.${postID}`)?.isHidden) {
        $.addClass(quotelink, 'filtered')
      }
    }
  }
}
export default QuoteStrikeThrough
