import Callbacks from "../classes/Callbacks"
import type Post from "../classes/Post"
import { Conf, g } from "../globals/globals"

const ThreadLinks = {
  init(): void {
    if ((g.VIEW !== 'index') || !Conf['Open Threads in New Tab']) { return }

    const postCallback: Post = {
      name: 'Thread Links',
      cb: this.node.bind(this)
    }
    const catalogThreadCallback: Post = {
      name: 'Thread Links',
      cb: this.catalogNode.bind(this)
    }

    Callbacks.Post.push(postCallback)
    Callbacks.CatalogThread.push(catalogThreadCallback)
  },

  node(): void {
    if (this.isReply || this.isClone) { return }
    ThreadLinks.process(this.nodes.reply)
  },

  catalogNode(): void {
    ThreadLinks.process(this.nodes.thumb.parentNode)
  },

  process(link: HTMLAnchorElement): void {
    link.target = '_blank'
  }
}

export default ThreadLinks