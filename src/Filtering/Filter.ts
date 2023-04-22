import Callbacks from '../classes/Callbacks';
import Notice from '../classes/Notice';
import Config from '../config/Config';
import Get from '../General/Get';
import Settings from '../General/Settings';
import { g, Conf, doc } from '../globals/globals';
import Menu from '../Menu/Menu';
import Unread from '../Monitoring/Unread';
import $ from '../platform/$';
import $$ from '../platform/$$';
import { dict } from '../platform/helpers';
import QuoteYou from '../Quotelinks/QuoteYou';
import PostHiding from './PostHiding';
import ThreadHiding from './ThreadHiding';
import type Post from '../classes/Post';

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

interface FilterObj {
  isstring: boolean;
  regexp: string | RegExp;
  boards: any;
  excludes: any;
  mask: any;
  hide: boolean;
  stub: any;
  hl: string;
  top: boolean;
  noti: boolean;
}

type FilterType =
  | 'postID'
  | 'name'
  | 'uniqueID'
  | 'tripcode'
  | 'capcode'
  | 'pass'
  | 'email'
  | 'subject'
  | 'comment'
  | 'flag'
  | 'filename'
  | 'dimensions'
  | 'filesize'
  | 'MD5';

var Filter = {
  /**
   * Uses a Map for string types, with the value to filter for as the key.
   * This allows faster lookup than iterating over every filter.
   */
  filters: new Map<FilterType, FilterObj[] | Map<string, FilterObj[]>>(),

  init(this: typeof Filter) {
    if (!['index', 'thread', 'catalog'].includes(g.VIEW) || !Conf['Filter']) {
      return;
    }
    if (g.VIEW === 'catalog' && !Conf['Filter in Native Catalog']) {
      return;
    }

    if (!Conf['Filtered Backlinks']) {
      $.addClass(doc, 'hide-backlinks');
    }

    for (var key in Config.filter) {
      for (var line of (Conf[key] as string).split('\n')) {
        let hl: string;
        let isstring: boolean;
        let regexp: RegExp | string | RegExpMatchArray;
        let top: boolean;
        let types: string[];

        if (line[0] === '#') {
          continue;
        }
        if (!(regexp = line.match(/\/(.*)\/(\w*)/))) {
          continue;
        }

        // Don't mix up filter flags with the regular expression.
        var filter = line.replace(regexp[0], '');

        // List of the boards this filter applies to.
        var boards = this.parseBoards(
          filter.match(/(?:^|;)\s*boards:([^;]+)/)?.[1]
        );

        // Boards to exclude from an otherwise global rule.
        var excludes = this.parseBoards(
          filter.match(/(?:^|;)\s*exclude:([^;]+)/)?.[1]
        );

        if ((isstring = ['uniqueID', 'MD5'].includes(key))) {
          // MD5 filter will use strings instead of regular expressions.
          regexp = regexp[1];
        } else {
          try {
            // Please, don't write silly regular expressions.
            regexp = RegExp(regexp[1], regexp[2]);
          } catch (err) {
            // I warned you, bro.
            // Notice(type, content, timeout, onclose)
            new Notice('error', `Invalid regular expression: ${regexp[1]}`);
            continue;
          }
        }

        // Filter OPs along with their threads or replies only.
        var op = filter.match(/(?:^|;)\s*op:(no|only)/)?.[1] || '';
        var mask = $.getOwn({ no: 1, only: 2 }, op) || 0;

        // Filter only posts with/without files.
        var file = filter.match(/(?:^|;)\s*file:(no|only)/)?.[1] || '';
        mask = mask | ($.getOwn({ no: 4, only: 8 }, file) || 0);

        // Overrule the `Show Stubs` setting.
        // Defaults to stub showing.
        var stub = (() => {
          switch (filter.match(/(?:^|;)\s*stub:(yes|no)/)?.[1]) {
            case 'yes':
              return true;
            case 'no':
              return false;
            default:
              return Conf['Stubs'];
          }
        })();

        // Desktop notification
        var noti = /(?:^|;)\s*notify/.test(filter);

        // Highlight the post.
        // If not specified, the highlight class will be filter-highlight.
        if ((hl = filter.match(/(?:^|;)\s*highlight:([^;]+)/)?.[1])) {
          hl = hl.trim();
        }

        // Fields that this filter applies to (for 'general' filters)
        if (key === 'general') {
          if ((types = filter.match(/(?:^|;)\s*type:([^;]*)/))) {
            types = types[1].split(',');
          } else {
            types = ['subject', 'name', 'filename', 'comment'];
          }
        }

        // Hide the post (default case).
        var hide = !(hl || noti);

        const filterObj = {
          isstring,
          regexp,
          boards,
          excludes,
          mask,
          hide,
          stub,
          hl,
          top,
          noti,
        };
        if (key === 'general') {
          for (var type of types) {
            this.filters.get(type)?.push(filterObj) ??
              this.filters.set(type, [filterObj]);
          }
        } else {
          this.filters.get(key)?.push(filterObj) ??
            this.filters.set(key, [filterObj]);
        }
      }
    }

    if (!this.filters.size) return;

    // conversion from array to map for string types
    for (const type of ['MD5', 'uniqueID'] satisfies FilterType[]) {
      const filtersForType = this.filters.get(type);
      if (!filtersForType) continue;

      const map = new Map<string, FilterObj[]>();
      for (const filter of filtersForType) {
        map.get(filter.regexp)?.push(filter) ??
          map.set(filter.regexp, [filter]);
      }

      this.filters.set(type, map);
    }

    if (g.VIEW === 'catalog') {
      return Filter.catalog();
    } else {
      return Callbacks.Post.push({
        name: 'Filter',
        cb: this.node,
      });
    }
  },

  // Parse comma-separated list of boards.
  // Sites can be specified by a beginning part of the site domain followed by a colon.
  parseBoards(boardsRaw) {
    let boards;
    if (!boardsRaw) {
      return false;
    }
    if ((boards = Filter.parseBoardsMemo[boardsRaw])) {
      return boards;
    }
    boards = dict();
    let siteFilter = '';
    for (var boardID of boardsRaw.split(',')) {
      if (boardID.includes(':')) {
        [siteFilter, boardID] = Array.from(boardID.split(':').slice(-2));
      }
      for (var siteID in g.sites) {
        var site = g.sites[siteID];
        if (siteID.slice(0, siteFilter.length) === siteFilter) {
          if (['nsfw', 'sfw'].includes(boardID)) {
            for (var boardID2 of site.sfwBoards?.(boardID === 'sfw') || []) {
              boards[`${siteID}/${boardID2}`] = true;
            }
          } else {
            boards[`${siteID}/${encodeURIComponent(boardID)}`] = true;
          }
        }
      }
    }
    Filter.parseBoardsMemo[boardsRaw] = boards;
    return boards;
  },

  parseBoardsMemo: dict(),

  test(post: Post, hideable = true) {
    if (post.filterResults) {
      return post.filterResults;
    }
    let hide = false;
    let stub = true;
    let hl = undefined;
    let top = false;
    let noti = false;
    if (QuoteYou.isYou(post)) {
      hideable = false;
    }
    let mask = post.isReply ? 2 : 1;
    mask = mask | (post.file ? 4 : 8);
    const board = `${post.siteID}/${post.boardID}`;
    const site = `${post.siteID}/*`;
    for (const key of Filter.filters.keys()) {
      for (const value of Filter.values(key, post)) {
        const filtersOrMap = Filter.filters.get(key);

        const filtersForType = Array.isArray(filtersOrMap)
          ? filtersOrMap
          : filtersOrMap.get(value);
        if (!filtersForType) continue;

        for (const filter of filtersForType) {
          if (
            (filter.boards && !(filter.boards[board] || filter.boards[site])) ||
            (filter.excludes &&
              (filter.excludes[board] || filter.excludes[site])) ||
            filter.mask & mask ||
            (filter.isstring
              ? filter.regexp !== value
              : !filter.regexp.test(value))
          ) {
            continue;
          }
          if (filter.hide) {
            if (hideable) {
              hide = true;
              if (stub) {
                ({ stub } = filter);
              }
            }
          } else {
            if (!hl || !hl.includes(filter.hl)) {
              (hl || (hl = [])).push(filter.hl);
            }
            if (!top) {
              ({ top } = filter);
            }
            if (filter.noti) {
              noti = true;
            }
          }
        }
      }
    }
    if (hide) {
      return { hide, stub };
    } else {
      return { hl, top, noti };
    }
  },

  node(this: Post) {
    if (this.isClone) {
      return;
    }
    const { hide, stub, hl, top, noti } = Filter.test(
      this,
      !this.isFetchedQuote && (this.isReply || g.VIEW === 'index')
    );
    if (hide) {
      if (this.isReply) {
        PostHiding.hide(this, stub);
      } else {
        ThreadHiding.hide(this.thread, stub);
      }
    } else {
      if (hl) {
        this.highlights = hl;
        $.addClass(this.nodes.root, ...Array.from(hl));
      }
    }
    if (
      noti &&
      Unread.posts &&
      this.ID > Unread.lastReadPost &&
      !QuoteYou.isYou(this)
    ) {
      return Unread.openNotification(this, ' triggered a notification filter');
    }
  },

  catalog() {
    let url;
    if (!(url = g.SITE.urls.catalogJSON?.(g.BOARD))) {
      return;
    }
    Filter.catalogData = dict();
    $.ajax(url, { onloadend: Filter.catalogParse });
    return Callbacks.CatalogThreadNative.push({
      name: 'Filter',
      cb: this.catalogNode,
    });
  },

  catalogParse() {
    if (![200, 404].includes(this.status)) {
      new Notice(
        'warning',
        `Failed to fetch catalog JSON data. ${
          this.status
            ? `Error ${this.statusText} (${this.status})`
            : 'Connection Error'
        }`,
        1
      );
      return;
    }
    for (var page of this.response) {
      for (var item of page.threads) {
        Filter.catalogData[item.no] = item;
      }
    }
    g.BOARD.threads.forEach(function (thread) {
      if (thread.catalogView) {
        return Filter.catalogNode.call(thread.catalogView);
      }
    });
  },

  catalogNode() {
    if (this.boardID !== g.BOARD.ID || !Filter.catalogData[this.ID]) {
      return;
    }
    if (
      QuoteYou.db?.get({
        siteID: g.SITE.ID,
        boardID: this.boardID,
        threadID: this.ID,
        postID: this.ID,
      })
    ) {
      return;
    }
    const { hide, hl, top } = Filter.test(
      g.SITE.Build.parseJSON(Filter.catalogData[this.ID], this)
    );
    if (hide) {
      return (this.nodes.root.hidden = true);
    } else {
      if (hl) {
        this.highlights = hl;
        $.addClass(this.nodes.root, ...Array.from(hl));
      }
      if (top) {
        $.prepend(this.nodes.root.parentNode, this.nodes.root);
        return g.SITE.catalogPin?.(this.nodes.root);
      }
    }
  },

  isHidden(post: Post) {
    return !!Filter.test(post).hide;
  },

  valueF: {
    postID(post) {
      return [`${post.ID}`];
    },
    name(post) {
      return post.info.name === undefined ? [] : [post.info.name];
    },
    uniqueID(post) {
      return [post.info.uniqueID || ''];
    },
    tripcode(post) {
      return post.info.tripcode === undefined ? [] : [post.info.tripcode];
    },
    capcode(post) {
      return post.info.capcode === undefined ? [] : [post.info.capcode];
    },
    pass(post) {
      return [post.info.pass];
    },
    email(post) {
      return [post.info.email];
    },
    subject(post) {
      return [post.info.subject || (post.isReply ? undefined : '')];
    },
    comment(post) {
      if (post.info.comment == null) {
        post.info.comment = g.sites[post.siteID]?.Build?.parseComment?.(
          post.info.commentHTML.innerHTML
        );
      }
      return [post.info.comment];
    },
    flag(post) {
      return post.info.flag === undefined ? [] : [post.info.flag];
    },
    filename(post) {
      return post.files.map(f => f.name);
    },
    dimensions(post) {
      return post.files.map(f => f.dimensions);
    },
    filesize(post) {
      return post.files.map(f => f.size);
    },
    MD5(post) {
      return post.files.map(f => f.MD5);
    },
  } satisfies Record<FilterType, (post: Post) => string[]>,

  values(key: FilterType, post: Post): string[] {
    if ($.hasOwn(Filter.valueF, key)) {
      return Filter.valueF[key](post).filter(v => v != null);
    } else {
      return [
        key
          .split('+')
          .map(function (k) {
            let f: (post: Post) => string[];
            if ((f = $.getOwn(Filter.valueF, k))) {
              return f(post)
                .map(v => v || '')
                .join('\n');
            } else {
              return '';
            }
          })
          .join('\n'),
      ];
    }
  },

  addFilter(type: FilterType, re: string, cb?: () => void) {
    if (!$.hasOwn(Config.filter, type)) {
      return;
    }
    return $.get(type, Conf[type], function (item) {
      let save = item[type];
      // Add a new line before the regexp unless the text is empty.
      save = save ? `${save}\n${re}` : re;
      return $.set(type, save, cb);
    });
  },

  removeFilters(
    type: FilterType,
    res: FilterObj[] | Map<string, FilterObj[]>,
    cb?: () => void
  ) {
    return $.get(type, Conf[type], function (item) {
      let save = item[type];
      const filterArray = Array.isArray(res) ? res : [...res.values()].flat();
      const r = filterArray.map(Filter.escape).join('|');
      save = save.replace(RegExp(`(?:$\n|^)(?:${r})$`, 'mg'), '');
      return $.set(type, save, cb);
    });
  },

  showFilters(type) {
    // Open the settings and display & focus the relevant filter textarea.
    Settings.open('Filter');
    const section = $('.section-container');
    const select = $('select[name=filter]', section);
    select.value = type;
    Settings.selectFilter.call(select);
    return $.onExists(section, 'textarea', function (ta) {
      const tl = ta.textLength;
      ta.setSelectionRange(tl, tl);
      return ta.focus();
    });
  },

  quickFilterMD5() {
    const post: Post = Get.postFromNode(this);
    const files = post.files.filter(f => f.MD5);
    if (!files.length) {
      return;
    }
    const filter = files.map(f => `/${f.MD5}/`).join('\n');
    Filter.addFilter('MD5', filter);
    Filter.showFilters('MD5');
    if (origin.isReply) {
      PostHiding.hide(origin);
    } else if (g.VIEW === 'index') {
      ThreadHiding.hide(origin.thread);
    }

    if (!Conf['MD5 Quick Filter Notifications']) {
      // feedback for when nothing gets hidden
      if (post.nodes.post.getBoundingClientRect().height) {
        new Notice('info', 'MD5 filtered.', 2);
      }
      return;
    }

    let { notice } = Filter.quickFilterMD5;
    if (notice) {
      notice.filters.push(filter);
      notice.posts.push(origin);
      return ($(
        'span',
        notice.el
      ).textContent = `${notice.filters.length} MD5s filtered.`);
    } else {
      const msg = $.el('div', {
        innerHTML:
          '<span>MD5 filtered.</span> [<a href="javascript:;">show</a>] [<a href="javascript:;">undo</a>]',
      });
      notice = Filter.quickFilterMD5.notice = new Notice(
        'info',
        msg,
        undefined,
        () => delete Filter.quickFilterMD5.notice
      );
      notice.filters = [filter];
      notice.posts = [origin];
      const links = $$('a', msg);
      $.on(links[0], 'click', Filter.quickFilterCB.show.bind(notice));
      return $.on(links[1], 'click', Filter.quickFilterCB.undo.bind(notice));
    }
  },

  quickFilterCB: {
    show() {
      Filter.showFilters('MD5');
      return this.close();
    },
    undo() {
      Filter.removeFilters('MD5', this.filters);
      for (var post of this.posts) {
        if (post.isReply) {
          PostHiding.show(post);
        } else if (g.VIEW === 'index') {
          ThreadHiding.show(post.thread);
        }
      }
      return this.close();
    },
  },

  escape(value) {
    return value.replace(
      new RegExp(
        `\
/\
|\\\\\
|\\^\
|\\$\
|\\n\
|\\.\
|\\(\
|\\)\
|\\{\
|\\}\
|\\[\
|\\]\
|\\?\
|\\*\
|\\+\
|\\|\
`,
        'g'
      ),
      function (c) {
        if (c === '\n') {
          return '\\n';
        } else if (c === '\\') {
          return '\\\\';
        } else {
          return `\\${c}`;
        }
      }
    );
  },

  menu: {
    init() {
      if (
        !['index', 'thread'].includes(g.VIEW) ||
        !Conf['Menu'] ||
        !Conf['Filter']
      ) {
        return;
      }

      const div = $.el('div', { textContent: 'Filter' });

      const entry = {
        el: div,
        order: 50,
        open(post) {
          Filter.menu.post = post;
          return true;
        },
        subEntries: [],
      };

      for (var type of [
        ['Name', 'name'],
        ['Unique ID', 'uniqueID'],
        ['Tripcode', 'tripcode'],
        ['Capcode', 'capcode'],
        ['Pass Date', 'pass'],
        ['Email', 'email'],
        ['Subject', 'subject'],
        ['Comment', 'comment'],
        ['Flag', 'flag'],
        ['Filename', 'filename'],
        ['Image dimensions', 'dimensions'],
        ['Filesize', 'filesize'],
        ['Image MD5', 'MD5'],
      ] satisfies [string, FilterType][]) {
        // Add a sub entry for each filter type.
        entry.subEntries.push(Filter.menu.createSubEntry(type[0], type[1]));
      }

      return Menu.menu.addEntry(entry);
    },

    createSubEntry(text, type) {
      const el = $.el('a', {
        href: 'javascript:;',
        textContent: text,
      });
      el.dataset.type = type;
      $.on(el, 'click', Filter.menu.makeFilter);

      return {
        el,
        open(post) {
          return Filter.values(type, post).length;
        },
      };
    },

    makeFilter() {
      const { type } = this.dataset;
      // Convert value -> regexp, unless type is MD5
      const values = Filter.values(type, Filter.menu.post);
      const res = values
        .map(function (value) {
          const re = ['uniqueID', 'MD5'].includes(type)
            ? value
            : Filter.escape(value);
          if (['uniqueID', 'MD5'].includes(type)) {
            return `/${re}/`;
          } else {
            return `/^${re}$/`;
          }
        })
        .join('\n');

      return Filter.addFilter(type, res, () => Filter.showFilters(type));
    },
  },
};
export default Filter;
