import Notice from '../classes/Notice'
import { g, Conf, doc } from '../globals/globals'
import Main from '../main/Main'
import $ from '../platform/$'

const PSA = {
  init(): void {
    let el: HTMLElement
    if (g.SITE.software === 'yotsuba' && g.BOARD.ID === 'qa') {
      const announcement = {
        innerHTML:
          'Stay in touch with your <a href="https://www.4chan-x.net/qa_friends.html" target="_blank" rel="noopener">/qa/ friends</a>!',
      }
      el = $.el('span', announcement) as HTMLElement
      $.onExists(doc, '.boardBanner', (banner: HTMLElement) => $.after(banner, el))
    }
    if (
      'samachan.org' in Conf['siteProperties'] &&
      !Conf['PSAseen'].includes('samachan')
    ) {
      el = $.el('span', {
        innerHTML:
          '<a href="https://sushigirl.us/yakuza/res/776.html" target="_blank" rel="noopener">Looking for a new home?<br>Some former Samachan users are regrouping on SushiChan.</a><br>(a message from 4chan X)',
      })
      return Main.ready(function () {
        new Notice('info', el)
        Conf['PSAseen'].push('samachan')
        return $.set('PSAseen', Conf['PSAseen'])
      })
    }
  },
}
export default PSA
