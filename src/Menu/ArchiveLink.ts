import $ from "../platform/$";
import Redirect from "../Archive/Redirect";
import Filter from "../Filtering/Filter";
import { g, Conf } from "../globals/globals";
import Menu, { type MenuPost, type PostMenuEntry } from "./Menu";

type ArchiveLinkType = 'post' | 'name' | 'tripcode' | 'capcode' | 'subject' | 'country' | 'filename' | 'MD5';
interface ArchiveSearch {
  boardID: string;
  type: Exclude<ArchiveLinkType, 'post'> | 'troll_country';
  value: string;
}

const ArchiveLink = {
  init(): void {
    if (!('software' in g.SITE) || (g.SITE.software !== 'yotsuba') || !['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Archive Link']) { return; }

    const div = $.el('div',
      {textContent: 'Archive'});

    const entry: PostMenuEntry = {
      el: div,
      order: 60,
      open({ID, thread, board}) {
        return !!Redirect.to('thread', {postID: ID, threadID: thread.ID, boardID: board.ID});
      },
      subEntries: []
    };

    for (const type of [
      ['Post',      'post'],
      ['Name',      'name'],
      ['Tripcode',  'tripcode'],
      ['Capcode',   'capcode'],
      ['Subject',   'subject'],
      ['Flag',      'country'],
      ['Filename',  'filename'],
      ['Image MD5', 'MD5']
    ] as const) {
      // Add a sub entry for each type.
      entry.subEntries.push(this.createSubEntry(type[0], type[1]));
    }

    Menu.menu.addEntry(entry);
  },

  createSubEntry(text: string, type: ArchiveLinkType): PostMenuEntry {
    const el = $.el('a', {
      textContent: text,
      target: '_blank'
    }
    );

    const open: (post: MenuPost) => boolean = type === 'post' ?
      function({ID, thread, board}) {
        el.href = Redirect.to('thread', {postID: ID, threadID: thread.ID, boardID: board.ID});
        return true;
      }
    :
      function(post) {
        const typeParam = (type === 'country') && post.info.flagCodeTroll ?
          'troll_country'
        :
          type;
        const value = type === 'country' ?
          post.info.flagCode || post.info.flagCodeTroll?.toLowerCase()
        :
          Filter.values(type, post)[0];
        // We want to parse the exact same stuff as the filter does already.
        if (!value) { return false; }
        const search: ArchiveSearch = {
          boardID:  post.board.ID,
          type:     typeParam,
          value
        };
        el.href = Redirect.to('search', search);
        return true;
      };

    return {
      el,
      open
    };
  }
};
export default ArchiveLink;
