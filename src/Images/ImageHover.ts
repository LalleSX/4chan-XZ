import Callbacks from "../classes/Callbacks";
import Header from "../General/Header";
import UI from "../General/UI";
import { g, Conf, doc } from "../globals/globals";
import $ from "../platform/$";
import { SECOND } from "../platform/helpers";
import ImageCommon from "./ImageCommon";
import Volume from "./Volume";

// Minimal interfaces inferred from usage. Expand from the rest of the codebase as needed.
interface File {
  isImage: boolean;
  isVideo: boolean;
  thumb?: HTMLElement;
  index: number;
  url: string;
  dimensions?: string;
  isExpanding?: boolean;
  isExpanded?: boolean;
}

interface Post {
  fullID: string;
  files: File[];
}

interface CatalogThread {
  thread: { OP: Post };
  nodes: { thumb: HTMLElement };
}

type HoverElement = HTMLImageElement | HTMLVideoElement;

const ImageHover = {
  init(): void {
    if (!['index', 'thread'].includes(g.VIEW)) return;

    if (Conf['Image Hover']) {
      Callbacks.Post.push({
        name: 'Image Hover',
        cb: this.node,
      });
    }

    if (Conf['Image Hover in Catalog']) {
      Callbacks.CatalogThread.push({
        name: 'Image Hover',
        cb: this.catalogNode,
      });
    }
  },

  node(this: Post): void {
    this.files
      .filter((file): file is File & { thumb: HTMLElement } =>
        (file.isImage || file.isVideo) && !!file.thumb
      )
      .forEach((file) => {
        $.on(file.thumb, 'mouseover', ImageHover.mouseover(this, file));
      });
  },

  catalogNode(this: CatalogThread): void {
    const file = this.thread.OP.files[0];
    if (!file || (!file.isImage && !file.isVideo)) return;
    $.on(this.nodes.thumb, 'mouseover', ImageHover.mouseover(this.thread.OP, file));
  },

  mouseover(post: Post, file: File) {
    return function (this: HTMLElement, e: MouseEvent): void {
      if (!doc.contains(this)) return;

      const { isVideo } = file;
      if (file.isExpanding || file.isExpanded || g.SITE.isThumbExpanded?.(file)) return;

      const error = ImageHover.error(post, file);
      let el: HoverElement;

      const cacheId = `${post.fullID}.${file.index}`;
      if (ImageCommon.cache?.dataset.fileID === cacheId) {
        el = ImageCommon.popCache() as HoverElement;
        $.on(el, 'error', error);
      } else {
        el = $.el(isVideo ? 'video' : 'img') as HoverElement;
        el.dataset.fileID = cacheId;
        $.on(el, 'error', error);
        el.src = file.url;
      }

      if (Conf['Restart when Opened']) {
        ImageCommon.rewind(el);
        ImageCommon.rewind(this);
      }

      el.id = 'ihover';
      $.add(Header.hover, el);

      if (isVideo) {
        const video = el as HTMLVideoElement;
        video.loop = true;
        video.controls = false;
        Volume.setup(video);
        if (Conf['Autoplay']) {
          video.play();
          if (this.nodeName === 'VIDEO') {
            (this as HTMLVideoElement).currentTime = video.currentTime;
          }
        }
      }

      let width: number | undefined;
      let height: number | undefined;

      if (file.dimensions) {
        const [w, h] = file.dimensions.split('x').map(Number);
        const maxWidth = doc.clientWidth;
        const maxHeight = doc.clientHeight - UI.hover.padding;
        const scale = Math.min(1, maxWidth / w, maxHeight / h);
        width = w * scale;
        height = h * scale;
        el.style.maxWidth = `${width}px`;
        el.style.maxHeight = `${height}px`;
      }

      UI.hover({
        root: this,
        el,
        latestEvent: e,
        endEvents: 'mouseout click',
        height,
        width,
        noRemove: true,
        cb() {
          $.off(el, 'error', error);
          ImageCommon.pushCache(el);
          ImageCommon.pause(el);
          $.rm(el);
          el.removeAttribute('style');
        },
      });
    };
  },

  error(post: Post, file: File) {
    return function (this: HoverElement): void {
      if (ImageCommon.decodeError(this, file)) return;

      ImageCommon.error(this, post, file, 3 * SECOND, (URL?: string) => {
        if (URL) {
          this.src = URL + (this.src === URL ? `?${Date.now()}` : '');
        } else {
          $.rm(this);
        }
      });
    };
  },
};

export default ImageHover;