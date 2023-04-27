import Callbacks from '../classes/Callbacks'
import Get from '../General/Get'
import { Conf, g } from '../globals/globals'
import $ from '../platform/$'
import $$ from '../platform/$$'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const ExpandComment = {
  init() {
    if (
      g.VIEW !== 'index' ||
      !Conf['Comment Expansion'] ||
      Conf['JSON Index']
    ) {
      return
    }

    return Callbacks.Post.push({
      name: 'Comment Expansion',
      cb: this.node,
    })
  },

  node() {
    let a
    if ((a = $('.abbr > a:not([onclick])', this.nodes.comment))) {
      return $.on(a, 'click', ExpandComment.cb)
    }
  },

  callbacks: [],

  cb(e) {
    e.preventDefault()
    return ExpandComment.expand(Get.postFromNode(this))
  },

  expand(post) {
    let a
    if (post.nodes.longComment && !post.nodes.longComment.parentNode) {
      $.replace(post.nodes.shortComment, post.nodes.longComment)
      post.nodes.comment = post.nodes.longComment
      return
    }
    if (!(a = $('.abbr > a', post.nodes.comment))) {
      return
    }
    a.textContent = `Post No.${post} Loading...`
    return $.cache(
      g.SITE.urls.threadJSON(post.thread.ID, post.thread.page),
      function () {
        return ExpandComment.parse(this, a, post)
      }
    )
  },

  contract(post) {
    if (!post.nodes.shortComment) {
      return
    }
    const a = $('.abbr > a', post.nodes.shortComment)
    a.textContent = 'here'
    $.replace(post.nodes.longComment, post.nodes.shortComment)
    return (post.nodes.comment = post.nodes.shortComment)
  },

  parse(req, a, post) {
    let postObj, spoilerRange
    const { status } = req.status
    if (![200, 304].includes(status)) {
      a.textContent = status
        ? `Error ${req.statusText} (${status})`
        : 'Connection Error'
      return
    }

    const { posts } = req.response
    if ((spoilerRange = posts[0].custom_spoiler)) {
      g.SITE.Build.spoilerRange = spoilerRange
    }

    for (postObj of posts) {
      if (postObj.no === post.ID) {
        break
      }
    }
    if (postObj.no !== post.ID) {
      a.textContent = `Post No.${post} not found.`
      return
    }

    const { comment } = post.nodes
    const clone = comment.cloneNode(false)
    clone.innerHTML = postObj.com
    // Fix pathnames
    for (var quote of $$('.quotelink', clone)) {
      var href = quote.getAttribute('href')
      if (href && !href.match(/^https?:/)) {
        quote.setAttribute('href', g.SITE.urls.thread(post.thread.ID) + href)
      }
    }
    post.nodes.shortComment = comment
    $.replace(comment, clone)
    post.nodes.comment = post.nodes.longComment = clone
    post.parseComment()
    post.parseQuotes()

    for (var callback of ExpandComment.callbacks) {
      callback.call(post)
    }
  },
}
export default ExpandComment
