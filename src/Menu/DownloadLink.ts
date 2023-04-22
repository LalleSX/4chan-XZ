import { g, Conf } from '../globals/globals';
import ImageCommon from '../Images/ImageCommon';
import $ from '../platform/$';
import Menu from './Menu';

const DownloadLink = {
  init(): VoidFunction {
    if (
      !['index', 'thread'].includes(g.VIEW) ||
      !Conf['Menu'] ||
      !Conf['Download Link']
    ) {
      return;
    }

    const a: HTMLAnchorElement = $.el('a', {
      className: 'download-link',
      textContent: 'Download file',
    });

    // Specifying the filename with the download attribute only works for same-origin links.
    $.on(a, 'click', ImageCommon.download);

    return Menu.menu.addEntry({
      el: a,
      order: 100,
      open({ file }) {
        if (!file) {
          return false;
        }
        a.href = file.url;
        a.download = file.name;
        return true;
      },
    }) as VoidFunction;
  },
};
export default DownloadLink;
