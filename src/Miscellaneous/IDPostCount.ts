import Callbacks from "../classes/Callbacks"
import Post from "../classes/Post"
import Thread from "../classes/Thread"
import Get from "../General/Get"
import { Conf, g } from "../globals/globals"
import $ from "../platform/$"

const IDPostCount = {
  init() {
    if ((g.VIEW !== 'thread') || !Conf['Count Posts by ID']) { return }
    Callbacks.Thread.push({
      name: 'Count Posts by ID',
      cb() { return IDPostCount.thread = this }
    })
    return Callbacks.Post.push({
      name: 'Count Posts by ID',
      cb: this.node
    })
  },

  node(): void {
    if (this.nodes.uniqueID && (this.thread === IDPostCount.thread)) {
      return $.on(this.nodes.uniqueID, 'mouseover', IDPostCount.count)
    }
  },

  count(): string {
    const { uniqueID } = Get.postFromNode(this).info
    let n = 0
    IDPostCount.thread.posts.forEach((post: Post) => {
      if (post.info.uniqueID === uniqueID) { return n++ }
    })
    return this.title = `${n} post${n === 1 ? '' : 's'} by this ID`
  }
}
export default IDPostCount