import { Conf, g } from '../globals/globals'
import $ from '../platform/$'
import type Thread from '../classes/Thread'
import type Post from '../classes/Post'
interface Get {
  url(type: any, IDs: { siteID: string }, ...args: any[]): string | undefined
  threadExcerpt(thread: Thread): string
  threadFromRoot(root: HTMLElement): Thread | null
  threadFromNode(node: HTMLElement): Thread | null
  postFromRoot(root: HTMLElement): Post | null
  postFromNode(root: HTMLElement): Post | null
  allQuotelinksLinkingTo(post: Post): HTMLAnchorElement[]
  postDataFromLink(link: HTMLAnchorElement): { boardID: string; postID: number }
}
  var Get: Get = {
  url(type, IDs, ...args) {
    let f: ((IDs: { siteID: string }, ...args: any[]) => string) | undefined, site: typeof g.sites[0]
    if ((site = g.sites[IDs.siteID]) && (f = $.getOwn(site.urls, type))) {
      return f(IDs, ...Array.from(args))
    } else {
      return undefined
    }
  },
  threadExcerpt(thread) {
    const { OP } = thread
    const excerpt =
      `/${decodeURIComponent(thread.board.ID)}/ - ` +
      (OP.info.subject?.trim() ||
        OP.commentDisplay().replace(/\n+/g, ' // ') ||
        OP.file?.name ||
        `No.${OP}`)
    if (excerpt.length > 73) {
      return `${excerpt.slice(0, 70)}...`
    }
    return excerpt
  },
  threadFromRoot(root) {
    if (root == null) {
      return null
    }
    const { board } = root.dataset
    return g.threads.get(
      `${board ? encodeURIComponent(board) : g.BOARD.ID}.${
        root.id.match(/\d*$/)[0]
      }`,
    )
  },
  threadFromNode(node) {
    return Get.threadFromRoot(
      $.x(`ancestor-or-self::${g.SITE.xpath.threadContainer}[1]`, node)[0],
    )
  },
  postFromRoot(root) {
    if (root == null) {
      return null
    }
    const post = g.posts.get(root.dataset.fullID)
    const index = root.dataset.clone
    if (index) {
      return post.clones[+index]
    } else {
      return post
    }
  },
  postFromNode(root) {
    return Get.postFromRoot(
      $.x(`ancestor-or-self::${g.SITE.xpath.postContainer}`, root)[0],
    )
  },
  postDataFromLink(link: any) {
    let boardID: any, postID: any, threadID: any
    if (link.dataset?.postID) {
      // resurrected quote
      ({ boardID, threadID, postID } = link.dataset)
      if (!threadID) {
        threadID = '0'
      }
    } else {
      const match = link.href.match(g?.SITE?.regexp?.quotelink)
      if (!match) {
        throw new Error('Invalid link')
      }
      [boardID, threadID, postID] = match.slice(1)
      if (!postID) {
        postID = threadID
      }
    }
    return {
      boardID,
      threadID: +threadID,
      postID: +postID,
    }
  },  
  allQuotelinksLinkingTo(post) {
    // Get quotelinks & backlinks linking to the given post.
    const quotelinks = []
    const { posts } = g
    const { fullID } = post
    const handleQuotes = function (qPost, type) {
      quotelinks.push(...Array.from(qPost.nodes[type] || []))
      for (var clone of qPost.clones) {
        quotelinks.push(...Array.from(clone.nodes[type] || []))
      }
    }
    // First:
    //   In every posts,
    //   if it did quote this post,
    //   get all their backlinks.
    posts.forEach(function (qPost) {
      if (qPost.quotes.includes(fullID)) {
        return handleQuotes(qPost, 'quotelinks')
      }
    })

    // Second:
    //   If we have quote backlinks:
    //   in all posts this post quoted
    //   and their clones,
    //   get all of their backlinks.
    if (Conf['Quote Backlinks']) {
      for (var quote of post.quotes) {
        var qPost
        if ((qPost = posts.get(quote))) {
          handleQuotes(qPost, 'backlinks')
        }
      }
    }

    // Third:
    //   Filter out irrelevant quotelinks.
    return quotelinks.filter(function (quotelink) {
      const { boardID, postID } = Get.postDataFromLink(quotelink)
      return boardID === post.board.ID && postID === post.ID
    })
  },
}
export default Get
