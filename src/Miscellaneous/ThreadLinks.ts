import Callbacks from '../classes/Callbacks';
import { g, Conf } from '../globals/globals';

const ThreadLinks = {
  init(): void {
    if (g.VIEW !== 'index' || !Conf['Open Threads in New Tab']) {
      return;
    }

    Callbacks.Post.push({
      name: 'Thread Links',
      cb: this.node.bind(this),
    });
    Callbacks.CatalogThread.push({
      name: 'Thread Links',
      cb: this.catalogNode.bind(this),
    });
  },

  node(): void {
    if (this.isReply || this.isClone) {
      return;
    }
    ThreadLinks.process(this.nodes.reply);
  },

  catalogNode(): void {
    ThreadLinks.process(this.nodes.thumb.parentNode);
  },

  process(link: HTMLAnchorElement): void {
    link.target = '_blank';
  },
};

export default ThreadLinks;
