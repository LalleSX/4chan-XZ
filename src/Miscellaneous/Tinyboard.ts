import { g } from "../globals/globals"
import Main from "../main/Main"
import $ from "../platform/$"

interface QRPostDetail {
  boardID: string;
  threadID: number;
  postID: number;
  redirect?: string;
}

const Tinyboard = {
  init() {
    if (g.SITE.software !== 'tinyboard') { return }
    if (g.VIEW === 'thread') {
      return Main.ready(() => $.global(function() {
        let base
        const { boardID, threadID } = document.currentScript.dataset
        const threadIdNum = +threadID
        const form = document.querySelector('form[name="post"]') as HTMLFormElement
        window.$(document).ajaxComplete((event, request, settings) => {
          let postID: number
          if (settings.url !== form.action) { return }
          if (!(postID = +request.responseJSON?.id)) { return }
          const detail: QRPostDetail = { boardID, threadID: threadIdNum, postID }
          try {
            const { redirect, noko } = request.responseJSON
            const originalNoko = window.tb_settings?.ajax?.always_noko_replies
            if (redirect && (originalNoko != null) && !originalNoko && !noko) {
              detail.redirect = redirect
            }
          } catch (error) {}
          event = new CustomEvent('QRPostSuccessful', { bubbles: true, detail })
          return document.dispatchEvent(event)
        })
        const originalNoko = window.tb_settings?.ajax?.always_noko_replies;
        ((base = window.tb_settings || (window.tb_settings = {})).ajax || (base.ajax = {})).always_noko_replies = true
      }
      , { boardID: g.BOARD.ID, threadID: g.THREADID }))
    }
  }
}

export default Tinyboard
