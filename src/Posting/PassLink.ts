import { g, Conf } from '../globals/globals';
import Main from '../main/Main';
import $ from '../platform/$';

const PassLink = {
  init(): void {
    if ((g.SITE.software !== 'yotsuba') || !Conf['Pass Link']) { return; }
    return Main.ready(this.ready);
  },

  ready(): void {
    let styleSelector;
    if (!(styleSelector = $.id('styleSelector'))) { return; }

    const passLink = $.el('span',
      {className: 'brackets-wrap pass-link-container'});
    $.extend(passLink, {innerHTML: "<a href=\"javascript:;\">4chan Pass</a>"});
    $.on(passLink.firstElementChild, 'click', () => window.open(`//sys.${location.hostname.split('.')[1]}.org/auth`,
      Date.now().toString(),
      'width=500,height=280,toolbar=0'));
    return $.before(styleSelector.previousSibling, [passLink, $.tn('\u00A0\u00A0')]);
  }
};
export default PassLink;
