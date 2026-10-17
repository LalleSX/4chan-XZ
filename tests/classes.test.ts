import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import type SimpleDict from '../src/classes/SimpleDict.ts';
import type RandomAccessList from '../src/classes/RandomAccessList.ts';
import type DataBoard from '../src/classes/DataBoard.ts';
import type Callbacks from '../src/classes/Callbacks.ts';
import type Fetcher from '../src/classes/Fetcher.ts';
import type Post from '../src/classes/Post.ts';

// Exercise the production classes while isolating their browser/platform imports.
function loadModule<T>(name: string, imports: Record<string, object> = {}, globals: Record<string, unknown> = {}): T {
  const source = ts.transpileModule(readFileSync(new URL(`../src/classes/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: false},
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(id: string) {
      assert.ok(id in imports, `Unexpected dependency: ${id}`);
      return imports[id];
    },
    ...globals,
  });
  return (exports as {default: T}).default;
}

const own = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);
const dollar = {hasOwn: own, getOwn: (object: object, key: PropertyKey) => own(object, key) ? object[key] : undefined};
const Dict = loadModule<typeof SimpleDict>('SimpleDict', {'../platform/$': {default: dollar}});
const List = loadModule<typeof RandomAccessList>('RandomAccessList');

test('SimpleDict preserves insertion order, replaces falsy values and retrieves the last key', () => {
  const dict = new Dict<number>();
  assert.equal(dict.last(), undefined);
  dict.push(10, 0);
  dict.push(10, 1);
  dict.push(30, 3);
  assert.deepEqual(Array.from(dict.keys), ['10', '30']);
  assert.equal(dict.last(), 3);
  dict.rm(30);
  assert.equal(dict.last(), 1);
  assert.equal(dict.get('keys'), undefined);
  assert.equal(dict.get('toString'), undefined);
  dict.rm(10);
  assert.equal(dict.last(), undefined);
});

test('SimpleDict sorted insertion handles front, middle, end, updates and numeric string keys', () => {
  const dict = new Dict<string>();
  for (const key of [9, 1, 5, 3, 7, 11]) dict.insert(key, String(key));
  assert.deepEqual(Array.from(dict.keys), ['1', '3', '5', '7', '9', '11']);
  assert.equal(dict.insert(5, 'updated'), 2);
  assert.equal(dict.get(5), 'updated');
  assert.equal(dict.keys.length, 6);
  assert.equal(dict.insert('6', 'six', (a, b) => +a < +b), 3);
  const values: string[] = [];
  dict.forEach(value => values.push(value));
  assert.deepEqual(values, ['1', '3', 'updated', 'six', '7', '9', '11']);
});

test('SimpleDict handles large numeric dictionaries and custom ordering', () => {
  const dict = new Dict<number>();
  for (let key = 0; key < 4096; key += 2) dict.push(key, key);
  assert.equal(dict.insert(2047, 2047), 1024);
  assert.equal(dict.get(2047), 2047);
  const descending = new Dict<number>();
  for (const key of [4, 8, 2, 6, 0]) descending.insert(key, key, (a, b) => +a > +b);
  assert.deepEqual(Array.from(descending.keys), ['8', '6', '4', '2', '0']);
});

test('SimpleDict preserves the first custom match when global post keys interleave boards', () => {
  const dict = new Dict<number>();
  for (const key of ['g.100', 'g.102', 'a.50', 'g.104']) dict.push(key, +key.split('.')[1]);
  assert.equal(dict.insert('g.101', 101, key => +key.split('.')[1] < 101), 1);
  assert.deepEqual(Array.from(dict.keys), ['g.100', 'g.101', 'g.102', 'a.50', 'g.104']);
});

test('RandomAccessList handles empty and singleton lists and duplicate IDs', () => {
  const list = new List<{ID: number}>();
  assert.deepEqual(Array.from(list.order()), []);
  assert.equal(list.shift(), undefined);
  assert.equal(list.push({ID: 1}), 0);
  assert.equal(list.push({ID: 1}), undefined);
  assert.equal(list.length, 1);
  assert.equal(list.shift(), true);
  assert.equal(list.length, 0);
  assert.deepEqual(Array.from(list.order()), []);
  assert.equal(list.shift(), undefined);
  const ids = new List([{id: 'a'}, {id: 'b'}]);
  assert.deepEqual(Array.from(ids.order(), item => item.ID), ['a', 'b']);
});

test('RandomAccessList retains forward/backward links and indexed access through repeated moves', () => {
  const list = new List(Array.from({length: 24}, (_, i) => ({ID: i + 1})));
  const expected = Array.from({length: 24}, (_, i) => i + 1);
  let seed = 12345;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 300; i++) {
    const itemID = random() % 24 + 1;
    const rootID = random() % 24 + 1;
    if (itemID === rootID) continue;
    const operation = random() % 3;
    expected.splice(expected.indexOf(itemID), 1);
    if (operation === 0) {
      list.before(list[rootID], list[itemID]);
      expected.splice(expected.indexOf(rootID), 0, itemID);
    } else if (operation === 1) {
      list.after(list[rootID], list[itemID]);
      expected.splice(expected.indexOf(rootID) + 1, 0, itemID);
    } else {
      list.prepend(list[itemID]);
      expected.unshift(itemID);
    }
    const ordered = Array.from(list.order());
    assert.deepEqual(ordered.map(item => item.ID), expected);
    assert.equal(list.length, expected.length);
    assert.equal(list.first, ordered[0]);
    assert.equal(list.last, ordered.at(-1));
    for (let j = 0; j < ordered.length; j++) {
      assert.equal(ordered[j].prev ?? undefined, ordered[j - 1]);
      assert.equal(ordered[j].next ?? undefined, ordered[j + 1]);
      assert.equal(list[expected[j]], ordered[j]);
    }
  }
  for (const id of expected) list.rm(id);
  assert.equal(list.length, 0);
  assert.equal(list.first ?? null, null);
  assert.equal(list.last ?? null, null);
});

function storageFixture(key: string, initial: object = {boards: {}}) {
  let stored = structuredClone(initial);
  const reads: (() => void)[] = [];
  const document = new EventTarget();
  const DB = loadModule<typeof DataBoard>('DataBoard', {
    '../globals/globals': {Conf: {[key]: structuredClone(initial)}, d: document, g: {SITE: {ID: '4chan.org'}}},
    '../platform/helpers': {dict: () => Object.create(null), HOUR: 3_600_000},
    '../platform/$': {default: {
      sync() {},
      on: (target: EventTarget, name: string, cb: EventListener) => target.addEventListener(name, cb),
      off: (target: EventTarget, name: string, cb: EventListener) => target.removeEventListener(name, cb),
      get: (name: string, fallback: object, cb: (items: object) => void) => reads.push(() => cb({[name]: structuredClone(stored)})),
      set: (name: string, data: object, cb?: () => void) => { stored = structuredClone(data); cb?.(); },
    }},
  });
  return {
    DB,
    document,
    flush() { while (reads.length) reads.shift()!(); },
    replace(data: object) { stored = structuredClone(data); },
    stored: () => stored,
  };
}

test('DataBoard migrates legacy storage without changing version or losing cleanup timestamps', () => {
  const fixture = storageFixture('lastReadPosts', {boards: {g: {100: 105}}, lastChecked: 123, version: 4});
  const db = new fixture.DB('lastReadPosts', undefined, true);
  assert.equal(db.get({boardID: 'g', threadID: 100}), 105);
  assert.equal(db.data['4chan.org'].lastChecked, 123);
  assert.equal(db.data.version, 4);
  assert.equal(own(db.data, 'boards'), false);
  assert.equal(own(db.data, 'lastChecked'), false);
});

test('DataBoard reads post, thread and board levels and can find a post without its thread ID', () => {
  const fixture = storageFixture('yourPosts');
  const db = new fixture.DB('yourPosts', undefined, true);
  db.setUnsafe({boardID: 'g', threadID: 100, postID: 101, val: true});
  db.setUnsafe({boardID: 'g', threadID: 200, postID: 202, val: true});
  assert.equal(db.get({boardID: 'g', postID: 202}), true);
  assert.equal(db.get({boardID: 'g', threadID: 100, postID: 101}), true);
  assert.equal(db.get({boardID: 'g', threadID: 100})?.[101], true);
  assert.equal(db.get({boardID: 'g'})?.[200][202], true);
  assert.equal(db.get({boardID: 'missing', postID: 101, defaultValue: false}), false);
  assert.equal(db.get({boardID: 'g', postID: 999}), undefined);
  db.setUnsafe({siteID: 'other.example', boardID: 'g', threadID: 100, postID: 999, val: true});
  assert.equal(db.get({boardID: 'g', postID: 999}), undefined);
  assert.equal(db.get({siteID: 'other.example', boardID: 'g', postID: 999}), true);
});

test('DataBoard replays pending changes over newer storage and prunes empty containers on deletion', () => {
  const fixture = storageFixture('yourPosts');
  let synced = 0;
  let saved = 0;
  const db = new fixture.DB('yourPosts', () => synced++, true);
  fixture.document.dispatchEvent(new Event('4chanXInitFinished'));
  db.set({boardID: 'g', threadID: 100, postID: 101, val: true}, () => saved++);
  fixture.replace({'4chan.org': {boards: {g: {200: {201: true}}}}, version: 5});
  fixture.flush();
  assert.equal(db.data.version, 6);
  assert.equal(db.get({boardID: 'g', postID: 101}), true);
  assert.equal(db.get({boardID: 'g', postID: 201}), true);
  assert.equal(synced, 1);
  assert.equal(saved, 1);
  db.delete({boardID: 'g', threadID: 100, postID: 101});
  fixture.flush();
  assert.equal(db.get({boardID: 'g', threadID: 100}), undefined);
  db.delete({boardID: 'g', threadID: 200});
  fixture.flush();
  assert.equal(db.get({boardID: 'g'}), undefined);
  assert.ok(fixture.stored());
});

test('DataBoard extends objects, ignores stale synchronization and retains live and archived threads during cleanup', () => {
  const fixture = storageFixture('watchedThreads');
  const db = new fixture.DB('watchedThreads', undefined, true);
  db.set({boardID: 'g', threadID: 100, val: {excerpt: 'example', isDead: true}});
  fixture.flush();
  db.extend({boardID: 'g', threadID: 100, val: {isDead: undefined, unread: 2}});
  fixture.flush();
  assert.equal(db.get({boardID: 'g', threadID: 100})?.excerpt, 'example');
  assert.equal(db.get({boardID: 'g', threadID: 100})?.unread, 2);
  assert.equal(own(db.get({boardID: 'g', threadID: 100})!, 'isDead'), false);
  db.onSync({version: 1});
  assert.equal(db.data.version, 2);
  db.setUnsafe({boardID: 'g', threadID: 200, val: {excerpt: 'archived'}});
  db.setUnsafe({boardID: 'g', threadID: 300, val: {excerpt: 'expired'}});
  db.ajaxCleanParse('g', [{threads: [{no: 100}, {no: 999}]}], [200]);
  assert.deepEqual(Object.keys(db.get({boardID: 'g'})!), ['100', '200']);
});

test('Callbacks preserves callback context and order, replaces registrations and isolates exceptions', () => {
  const errors: {message: string; error: unknown; html: string}[][] = [];
  const Registry = loadModule<typeof Callbacks>('Callbacks', {
    '../main/Main': {default: {handleErrors: (items: typeof errors[number]) => errors.push(items)}},
  });
  const registry = new Registry('Test');
  const node = {ID: 1, board: {toString: () => 'g'}, nodes: {root: {outerHTML: '<div>post</div>'} as HTMLElement}};
  const order: string[] = [];
  registry.push({name: 'first', cb() { assert.equal(this, node); order.push('obsolete'); }});
  registry.push({name: 'first', cb() { assert.equal(this, node); order.push('first'); }});
  registry.push({name: 'broken', cb() { throw new Error('expected'); }});
  registry.push({name: 'last', cb() { order.push('last'); }});
  registry.execute(node);
  registry.execute(node);
  assert.deepEqual(order, ['first', 'last']);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0].message, /broken.*No\.1 \(g\)/);
  assert.equal(errors[0][0].html, '<div>post</div>');
  registry.execute(node, ['last'], true);
  assert.deepEqual(order, ['first', 'last', 'last']);
});

function fetcherFixture(posts: {no: number; custom_spoiler?: number}[], isCached = false) {
  const inserted: unknown[] = [];
  const requests: string[] = [];
  const root = {textContent: ''} as HTMLElement;
  const Fetch = loadModule<typeof Fetcher>('Fetcher', {
    '../Archive/Redirect': {default: {}},
    './Board': {default: class {}},
    './Thread': {default: class {}},
    './Post': {default: class {data: unknown; constructor(data: unknown) { this.data = data; }}},
    '../platform/$': {default: {
      cache(url: string, cb: (this: object, result: {isCached: boolean}) => void) {
        requests.push(url);
        if (requests.length === 1) cb.call({status: 200, response: {posts}}, {isCached});
      },
      cleanCache(predicate: (url: string) => boolean) { assert.equal(predicate('/thread'), true); },
      addClass() {},
    }},
    '../main/Main': {default: {callbackNodes() {}}},
    '../General/Index': {default: {}},
    '../globals/globals': {E: (value: string) => value, Conf: {}, g: {
      posts: {get() {}}, threads: {get: () => ({})}, boards: {g: {}},
      SITE: {urls: {threadJSON: () => '/thread'}, Build: {spoilerRange: {}, postFromObject: (data: unknown) => data}},
    }},
    '../platform/CrossOrigin': {default: {}},
    '../General/Get': {default: {}},
    '../Archive/RestoreDeletedFromArchive': {default: {}},
  });
  Fetch.prototype.insert = function(post) { inserted.push(post); };
  new Fetch('g', 100, '101', root);
  return {inserted, requests, root};
}

test('Fetcher matches string input IDs to numeric API IDs', () => {
  const {inserted} = fetcherFixture([{no: 100}, {no: 101}]);
  assert.equal(inserted.length, 1);
  assert.equal((inserted[0] as {data: {no: number}}).data.no, 101);
});

test('Fetcher rechecks stale caches and handles missing posts or empty API responses', () => {
  const cached = fetcherFixture([{no: 100}], true);
  assert.equal(cached.requests.length, 2);
  assert.equal(cached.inserted.length, 0);
  const missing = fetcherFixture([{no: 100}]);
  assert.equal(missing.root.textContent, 'Post No.101 was not found.');
  const empty = fetcherFixture([]);
  assert.equal(empty.inserted.length, 0);
  assert.equal(empty.root.textContent, 'Post No.101 was not found.');
});


test('Post clone removal accepts dataset indices and updates remaining clones in place', () => {
  const Model = loadModule<typeof Post>('Post', {
    '../General/Get': {default: {}},
    '../General/Test': {default: {}},
    '../globals/globals': {g: {}, Conf: {}},
    '../Images/ImageExpand': {default: {}},
    '../platform/$': {default: {}},
    '../platform/$$': {default: {}},
    './Callbacks': {default: {}},
  }, {document: {createElement: () => ({})}});
  const post = new Model();
  const clones = Array.from({length: 4}, (_, i) => ({nodes: {root: {dataset: {clone: String(i)}}}}));
  post.clones = clones as unknown as Post['clones'];
  post.rmClone('1');
  assert.deepEqual(clones.map(clone => clone.nodes.root.dataset.clone), ['0', '1', '2']);
  post.rmClone(0);
  assert.deepEqual(clones.map(clone => clone.nodes.root.dataset.clone), ['0', '1']);
  post.rmClone('1');
  assert.equal(post.clones.length, 1);
});
