import type Post from "../classes/Post";
import type Thread from "../classes/Thread";
import { Conf, g } from "../globals/globals";
import $ from "../platform/$";

const Get = {
  url(type: string, IDs: IDs, ...args: unknown[]): string | undefined {
    const site = g.sites[IDs.siteID];
    if (!site) return undefined;

    const f = $.getOwn(site.urls, type);
    return f ? f(IDs, ...args) : undefined;
  },

  threadExcerpt(thread: Thread): string {
    const { OP } = thread;
    const excerpt =
      `/${decodeURIComponent(thread.board.ID)}/ - ` +
      (OP.info.subject?.trim() ||
        OP.commentDisplay().replace(/\n+/g, " // ") ||
        OP.file?.name ||
        `No.${OP}`);

    if (excerpt.length > 73) {
      return `${excerpt.slice(0, 70)}...`;
    }
    return excerpt;
  },

  threadFromRoot(root: HTMLElement | null): Thread | null | undefined {
    if (root == null) {
      return null;
    }
    const { board } = root.dataset;
    const match = root.id.match(/\d*$/);
    const id = match ? match[0] : "";
    return g.threads.get(
      `${board ? encodeURIComponent(board) : g.BOARD.ID}.${id}`
    );
  },

  threadFromNode(node: Node | null): Thread | null | undefined {
    if (node == null) {
      return null;
    }
    return Get.threadFromRoot(
      $.x(`ancestor-or-self::${g.SITE.xpath.thread}`, node) as HTMLElement | null
    );
  },

  postFromRoot(root: HTMLElement | null): Post | null | undefined {
    if (root == null) {
      return null;
    }
    const post = g.posts.get(root.dataset.fullID);
    const index = root.dataset.clone;
    if (index && post) {
      return post.clones[+index];
    } else {
      return post;
    }
  },

  postFromNode(root: Node | null): Post | null | undefined {
    if (root == null) {
      return null;
    }
    return Get.postFromRoot(
      $.x(
        `ancestor-or-self::${g.SITE.xpath.postContainer}[1]`,
        root
      ) as HTMLElement | null
    );
  },

  postDataFromLink(link: HTMLAnchorElement): PostLinkData {
    let boardID = "";
    let threadID: string | number = 0;
    let postID: string | number = 0;

    if (link.dataset.postID) {
      // resurrected quote
      boardID = link.dataset.boardID || "";
      threadID = link.dataset.threadID || 0;
      postID = link.dataset.postID;
    } else {
      const match = link.href.match(g.SITE.regexp.quotelink);
      if (match) {
        [boardID, threadID, postID] = match.slice(1);
        if (!postID) {
          postID = threadID;
        }
      }
    }

    return {
      boardID,
      threadID: +threadID,
      postID: +postID,
    };
  },

  allQuotelinksLinkingTo(post: Post): HTMLAnchorElement[] {
    // Get quotelinks & backlinks linking to the given post.
    const quotelinks: HTMLAnchorElement[] = [];
    const { posts } = g;
    const { fullID } = post;

    const handleQuotes = (
      qPost: Post,
      type: "quotelinks" | "backlinks"
    ): void => {
      quotelinks.push(...(qPost.nodes[type] || []));
      for (const clone of qPost.clones) {
        quotelinks.push(...(clone.nodes[type] || []));
      }
    };

    // First:
    //   In every post,
    //   if it quoted this post,
    //   get all their backlinks.
    posts.forEach((qPost: Post) => {
      if (qPost.quotes.includes(fullID)) {
        handleQuotes(qPost, "quotelinks");
      }
    });

    // Second:
    //   If we have quote backlinks:
    //   in all posts this post quoted
    //   and their clones,
    //   get all of their backlinks.
    if (Conf["Quote Backlinks"]) {
      for (const quote of post.quotes) {
        const qPost = posts.get(quote);
        if (qPost) {
          handleQuotes(qPost, "backlinks");
        }
      }
    }

    // Third:
    //   Filter out irrelevant quotelinks.
    return quotelinks.filter((quotelink) => {
      const { boardID, postID } = Get.postDataFromLink(quotelink);
      return boardID === post.board.ID && postID === post.ID;
    });
  },
};

export default Get;