import { g, Conf, d } from "../globals/globals";
import $ from "../platform/$";
import Menu, { type PostMenuEntry } from "./Menu";

const ReportLink = {
  url: '',
  dims: '',

  init(): void {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Report Link']) { return; }

    const a = $.el('a', {
      className: 'report-link',
      href: 'javascript:;',
      textContent: 'Report'
    }
    );
    $.on(a, 'click', ReportLink.report);

    const entry: PostMenuEntry = {
      el: a,
      order: 10,
      open(post) {
        ReportLink.url = `//sys.${location.hostname.split('.')[1]}.org/${post.board.ID}/imgboard.php?mode=report&no=${post.ID}`;
        ReportLink.dims = d.cookie.includes('pass_enabled=1') ? 'width=350,height=275' : 'width=400,height=550';
        return true;
      }
    };
    Menu.menu.addEntry(entry);
  },

  report(): Window | null {
    const {url, dims} = ReportLink;
    const id  = Date.now();
    const set = `toolbar=0,scrollbars=1,location=0,status=1,menubar=0,resizable=1,${dims}`;
    return window.open(url, String(id), set);
  }
};
export default ReportLink;
