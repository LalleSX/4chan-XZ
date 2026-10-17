import { Conf, d, g } from "../globals/globals";
import $ from "../platform/$";
import { dict, HOUR } from "../platform/helpers";


interface HideOptions {
  thisPost?: boolean;
  makeStub: boolean;
  hideRecursively: boolean;
  byId?: boolean;
}

interface WatchedThread {
  excerpt?: string;
  isDead?: boolean;
  isArchived?: boolean;
  page?: number;
  lastPage?: boolean;
  unread?: number;
  quotingYou?: number;
  dismiss?: number;
  last?: number;
  modified?: number;
  replies?: number;
}

interface DataBoardValues {
  hiddenThreads: {makeStub: boolean} | true;
  hiddenPosts: HideOptions;
  hiddenPosterIds: HideOptions;
  lastReadPosts: number;
  yourPosts: boolean;
  watchedThreads: WatchedThread;
  watcherLastModified: string;
  customTitles: {title: string; orig: string};
}

type DataBoardKey = keyof DataBoardValues;
type PostDataKey = 'hiddenPosts' | 'hiddenPosterIds' | 'yourPosts';
type ThreadData<K extends DataBoardKey> = K extends PostDataKey ? Record<string, DataBoardValues[K]> : DataBoardValues[K];
type BoardData<K extends DataBoardKey> = Record<string, ThreadData<K>>;
interface SiteData<K extends DataBoardKey> {
  boards: Record<string, BoardData<K>>;
  lastChecked?: number;
}

interface DataBoardData<K extends DataBoardKey> {
  [key: string]: SiteData<K> | Record<string, BoardData<K>> | number | undefined;
  version?: number;
  lastChecked?: number;
  lastChecked2?: number;
  /** Legacy storage before data was partitioned by site. */
  boards?: Record<string, BoardData<K>>;
}

type ThreadList = {threads: {no: number}[]}[];

interface PostInfo {
  /** Defaults to g.SITE.ID */
  siteID?: string,
  boardID: string,
  threadID ?: string | number,
  postID ?: string | number
};

/**
 * This class handles data related to specific threads or posts. This data is automatically cleaned up when the thread
 * ages out.
 */
export default class DataBoard<K extends DataBoardKey = DataBoardKey> {
  static keys = [
    'hiddenThreads',
    'hiddenPosts',
    'hiddenPosterIds',
    'lastReadPosts',
    'yourPosts',
    'watchedThreads',
    'watcherLastModified',
    'customTitles',
  ] as const;

  declare data: DataBoardData<K>;
  declare changes: (() => void)[];
  declare key: K;
  declare sync?: () => void;

  constructor(key: K, sync?: () => void, dontClean = false) {
    this.changes = [];
    this.onSync = this.onSync.bind(this);
    this.key = key;
    this.initData(Conf[this.key]);
    $.sync(this.key, this.onSync);
    if (!dontClean) this.clean();
    if (!sync) return;
    // Chrome also fires the onChanged callback on the current tab,
    // so we only start syncing when we're ready.
    const init = () => {
      $.off(d, '4chanXInitFinished', init);
      this.sync = sync;
    };
    $.on(d, '4chanXInitFinished', init);
  }

  initData(data: DataBoardData<K>) {
    let boards: Record<string, BoardData<K>>;
    this.data = data;
    if (this.data.boards) {
      let lastChecked: number;
      ({boards, lastChecked} = this.data);
      this.data['4chan.org'] = {boards, lastChecked};
      delete this.data.boards;
      delete this.data.lastChecked;
    }
    return this.siteData(g.SITE.ID) || (this.data[g.SITE.ID] = { boards: dict() });
  }

  private siteData(siteID: string): SiteData<K> | undefined {
    // Callers use site IDs here; version and cleanup timestamps are read by name.
    return this.data[siteID] as SiteData<K> | undefined;
  }

  save(change: () => void, cb?: () => void) {
    change();
    this.changes.push(change);
    return $.get(this.key, { boards: dict() }, (items: Record<K, DataBoardData<K>>) => {
      if (!this.changes.length) { return; }
      const needSync = ((items[this.key].version || 0) > (this.data.version || 0));
      if (needSync) {
        this.initData(items[this.key]);
        for (change of this.changes) { change(); }
      }
      this.changes = [];
      this.data.version = (this.data.version || 0) + 1;
      return $.set(this.key, this.data, () => {
        if (needSync) { this.sync?.(); }
        return cb?.();
      });
    });
  }

  forceSync(cb?: () => void) {
    return $.get(this.key, { boards: dict() }, (items: Record<K, DataBoardData<K>>) => {
      if ((items[this.key].version || 0) > (this.data.version || 0)) {
        this.initData(items[this.key]);
        for (const change of this.changes) { change(); }
        this.sync?.();
      }
      return cb?.();
    });
  }

  delete({siteID, boardID, threadID, postID}: PostInfo, cb?: () => void) {
    if (!siteID) { siteID = g.SITE.ID; }
    if (!this.siteData(siteID)) { return; }
    this.save(() => {
      if (postID) {
        if (!this.siteData(siteID).boards[boardID]?.[threadID]) { return; }
        delete this.siteData(siteID).boards[boardID][threadID][postID];
        this.deleteIfEmpty({siteID, boardID, threadID});
      } else if (threadID) {
        if (!this.siteData(siteID).boards[boardID]) { return; }
        delete this.siteData(siteID).boards[boardID][threadID];
        this.deleteIfEmpty({siteID, boardID});
      } else {
        delete this.siteData(siteID).boards[boardID];
      }
    }
    , cb);
  }

  deleteIfEmpty({ siteID, boardID, threadID }: { siteID: string, boardID: string, threadID?: string | number }) {
    if (!this.siteData(siteID)) { return; }
    if (threadID) {
      if (!Object.keys(this.siteData(siteID).boards[boardID][threadID]).length) {
        delete this.siteData(siteID).boards[boardID][threadID];
        this.deleteIfEmpty({siteID, boardID});
      }
    } else if (!Object.keys(this.siteData(siteID).boards[boardID]).length) {
      delete this.siteData(siteID).boards[boardID];
    }
  }

  set(data: Parameters<DataBoard<K>['setUnsafe']>[0], cb?: () => void) {
    this.save(() => {
      this.setUnsafe(data);
    }, cb);
  }

  setUnsafe({ siteID, boardID, threadID, postID, val }: PostInfo & { val?: DataBoardValues[K] | ThreadData<K> | BoardData<K> }) {
    if (!siteID) { siteID = g.SITE.ID; }
    if (!this.siteData(siteID)) this.data[siteID] = { boards: dict() };
    const boards = this.siteData(siteID).boards;
    if (postID !== undefined) {
      const board = boards[boardID] || (boards[boardID] = dict());
      const thread = (board[threadID] || (board[threadID] = dict())) as Record<string, DataBoardValues[K]>;
      thread[postID] = val as DataBoardValues[K];
    } else if (threadID !== undefined) {
      (boards[boardID] || (boards[boardID] = dict()))[threadID] = val as ThreadData<K>;
    } else {
      boards[boardID] = val as BoardData<K>;
    }
  }

  extend(
    { siteID, boardID, threadID, postID, val }: PostInfo & { val?: Partial<Extract<DataBoardValues[K] | ThreadData<K> | BoardData<K>, object>> },
    cb?: () => void,
  ) {
    this.save(() => {
      const oldVal = this.get({ siteID, boardID, threadID, postID, defaultValue: dict() }) as Record<string, unknown>;
      for (const key in val) {
        const subVal = val[key];
        if (typeof subVal === 'undefined') {
          delete oldVal[key];
        } else {
          oldVal[key] = subVal;
        }
      }
      this.setUnsafe({siteID, boardID, threadID, postID, val: oldVal as DataBoardValues[K] | ThreadData<K> | BoardData<K>});
    }, cb);
  }

  setLastChecked(key: 'lastChecked' | 'lastChecked2' = 'lastChecked') {
    this.save(() => {
      this.data[key] = Date.now();
    });
  }

  get(info: PostInfo & {postID: string | number; defaultValue?: DataBoardValues[K]}): DataBoardValues[K] | undefined;
  get(info: PostInfo & {threadID: string | number; postID?: undefined; defaultValue?: ThreadData<K>}): ThreadData<K> | undefined;
  get(info: PostInfo & {threadID?: undefined; postID?: undefined; defaultValue?: BoardData<K>}): BoardData<K> | undefined;
  get(info: PostInfo & {defaultValue?: DataBoardValues[K] | ThreadData<K> | BoardData<K>}): DataBoardValues[K] | ThreadData<K> | BoardData<K> | undefined;
  get({ siteID, boardID, threadID, postID, defaultValue }: PostInfo & {
    defaultValue?: DataBoardValues[K] | ThreadData<K> | BoardData<K>;
  }): DataBoardValues[K] | ThreadData<K> | BoardData<K> | undefined {
    let val: DataBoardValues[K] | ThreadData<K> | BoardData<K>;
    if (!siteID) { siteID = g.SITE.ID; }
    const board = this.siteData(siteID)?.boards[boardID];
    if (board) {
      if (threadID == null) {
        if (postID != null) {
          for (const id in board) {
            const thread = board[id];
            if (thread && typeof thread === 'object' && postID in thread) {
              val = (thread as Record<string, DataBoardValues[K]>)[postID];
              break;
            }
          }
        } else {
          val = board;
        }
      } else {
        const thread = board[threadID];
        if (thread) {
          val = (postID != null) ? (thread as Record<string, DataBoardValues[K]>)[postID] : thread;
        }
      }
    }
    return val || defaultValue;
  }

  clean() {
    let boardID: string, middle: number;
    const siteID = g.SITE.ID;
    for (boardID in this.siteData(siteID).boards) {
      this.deleteIfEmpty({siteID, boardID});
    }
    const now = Date.now();
    if (now - (2 * HOUR) >= ((middle = this.siteData(siteID).lastChecked || 0)) || middle > now) {
      this.siteData(siteID).lastChecked = now;
      for (boardID in this.siteData(siteID).boards) {
        this.ajaxClean(boardID);
      }
    }
  }

  ajaxClean(boardID: string) {
    const that = this;
    const siteID = g.SITE.ID;
    const threadsList = g.SITE.urls.threadsListJSON?.({siteID, boardID});
    if (!threadsList) { return; }
    $.cache(threadsList, function() {
      if (this.status !== 200) { return; }
      const archiveList = g.SITE.urls.archiveListJSON?.({siteID, boardID});
      if (!archiveList) return that.ajaxCleanParse(boardID, this.response);
      const response1 = this.response;
      $.cache(archiveList, function() {
        if ((this.status !== 200) && (!!g.SITE.archivedBoardsKnown || (this.status !== 404))) { return; }
        that.ajaxCleanParse(boardID, response1, this.response);
      });
    });
  }

  ajaxCleanParse(boardID: string, response1: ThreadList, response2?: number[]) {
    let board: BoardData<K>, ID: number;
    const siteID = g.SITE.ID;
    if (!(board = this.siteData(siteID).boards[boardID])) return;
    const threads: BoardData<K> = dict();
    if (response1) {
      for (const page of response1) {
        for (const thread of page.threads) {
          ID = thread.no;
          if (ID in board) { threads[ID] = board[ID]; }
        }
      }
    }
    if (response2) {
      for (ID of response2) {
        if (ID in board) threads[ID] = board[ID];
      }
    }
    this.siteData(siteID).boards[boardID] = threads;
    this.deleteIfEmpty({siteID, boardID});
    $.set(this.key, this.data);
  }

  onSync(data: DataBoardData<K>) {
    if ((data.version || 0) <= (this.data.version || 0)) { return; }
    this.initData(data);
    this.sync?.();
  }
}
