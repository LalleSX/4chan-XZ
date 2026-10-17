import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the production module with isolated platform dependencies. Browser integration
// remains covered separately by the userscript and unpacked-extension suites.
const source = ts.transpileModule(readFileSync(new URL('../src/platform/$.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

type CacheCallback = (this: Request, result: {isCached: boolean}) => void;
class Request extends EventTarget {
  status = 200;
  upload = new EventTarget();
  callbacks?: CacheCallback[];
  onloadend?: () => void;
  open() {}
  send() {}
  setRequestHeader() {}
}

function fixture(overrides: Record<string, unknown> = {}) {
  const storage = new Map<string, string>();
  const document = new EventTarget();
  const helpers = {
    dict: () => Object.create(null),
    platform: 'userscript',
  };
  const imports: Record<string, object> = {
    '../classes/Notice': {default: class {}},
    '../globals/globals': {d: document, doc: document, c: console, g: {NAMESPACE: 'test.'}, Conf: {}},
    './helpers': helpers,
    '../../package.json': {default: {name: 'test'}},
    '../PageContext/pageContext': {default: {}},
  };
  const exports: {default?: typeof import('../src/platform/$.ts').default} = {};
  const context = vm.createContext({
    exports,
    require: (id: string) => {
      assert.ok(id in imports, `Unexpected dependency: ${id}`);
      return imports[id];
    },
    window: new EventTarget(), document, navigator: {userAgent: 'Chrome/'}, location: {protocol: 'https:'},
    GM: {}, XMLHttpRequest: Request, HTMLFormElement: class {}, FormData, Blob,
    setTimeout, clearTimeout,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    ...overrides,
  });
  vm.runInContext(source, context);
  return exports.default! as typeof exports.default & {
    cache(url: string, callback: CacheCallback, options: {ajax(url: string, options: {onloadend: () => void}): Request}): Request;
    cleanCache(predicate: (url: string) => boolean): void;
  };
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('queueTask preserves FIFO, arguments, nested tasks and interleaved Promise jobs', async () => {
  const $ = fixture();
  const order: string[] = [];
  $.queueTask((value: string, count: number) => {
    order.push(`${value}:${count}`);
    $.queueTask(() => order.push('nested'));
  }, 'first', 2);
  Promise.resolve().then(() => order.push('promise'));
  $.queueTask(() => order.push('last'));
  assert.deepEqual(order, []);
  await flush();
  assert.deepEqual(order, ['first:2', 'promise', 'last', 'nested']);
});

test('queueTask does not assimilate callback return values', async () => {
  const $ = fixture();
  let called = false;
  $.queueTask(() => ({then() { called = true; }}));
  await flush();
  assert.equal(called, false);
});

test('queueTask handles a large burst without dropping or reordering work', async () => {
  const $ = fixture();
  const actual: number[] = [];
  for (let i = 0; i < 10_000; i++) $.queueTask((n: number) => actual.push(n), i);
  await flush();
  assert.deepEqual(actual, Array.from({length: 10_000}, (_, i) => i));
});

test('queueTask rejects a throwing task independently and still runs later tasks', async () => {
  const reactions: Promise<unknown>[] = [];
  const $ = fixture({Promise: {
    resolve: () => ({then(callback: () => void) {
      const reaction = Promise.resolve().then(callback);
      reactions.push(reaction);
      // Observe the rejection without changing the Promise returned by then.
      void reaction.catch(() => {});
      return reaction;
    }}),
  }});
  const error = new Error('expected task error');
  let laterRan = false;
  assert.doesNotThrow(() => $.queueTask(() => { throw error; }));
  $.queueTask(() => { laterRan = true; });
  const results = await Promise.allSettled(reactions);
  assert.deepEqual(results, [{status: 'rejected', reason: error}, {status: 'fulfilled', value: undefined}]);
  assert.equal(laterRan, true);
});

test('debounce retains leading calls, trailing arguments, receiver and return values', () => {
  let now = 100;
  let nextTimer = 0;
  const timers = new Map<number, () => unknown>();
  const $ = fixture({
    Date: {now: () => now},
    setTimeout(callback: () => unknown) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id: number) { timers.delete(id); },
  });
  const calls: string[] = [];
  const debounced = $.debounce(25, function(this: {name: string}, value: string) {
    const result = `${this.name}:${value}`;
    calls.push(result);
    return result;
  });
  assert.equal(debounced.call({name: 'first'}, 'a'), 'first:a');
  now = 110;
  debounced.call({name: 'second'}, 'b');
  now = 120;
  debounced.call({name: 'third'}, 'c');
  assert.equal(timers.size, 1);
  assert.deepEqual(calls, ['first:a']);
  now = 145;
  assert.equal([...timers.values()][0](), 'third:c');
  assert.deepEqual(calls, ['first:a', 'third:c']);
  now = 171;
  assert.equal(debounced.call({name: 'last'}, 'd'), 'last:d');
});

test('cached requests share in-flight work, retain callback receivers and invalidate failures', async () => {
  const $ = fixture();
  let requests = 0;
  const ajax = (_url: string, options: {onloadend: () => void}) => {
    requests++;
    const request = new Request();
    request.onloadend = options.onloadend;
    return request;
  };
  const observations: {request: Request; cached: boolean}[] = [];
  const callback: CacheCallback = function({isCached}) { observations.push({request: this, cached: isCached}); };
  const first = $.cache('shared', callback, {ajax});
  assert.equal($.cache('shared', callback, {ajax}), first);
  assert.equal(requests, 1);
  first.onloadend!();
  assert.equal(first.callbacks, undefined);
  assert.equal(observations.length, 0);
  await flush();
  assert.deepEqual(observations, [{request: first, cached: false}, {request: first, cached: false}]);
  $.cache('shared', callback, {ajax});
  assert.equal(observations.length, 2);
  await flush();
  assert.deepEqual(observations[2], {request: first, cached: true});
  $.cleanCache(url => url === 'shared');
  const failed = $.cache('shared', callback, {ajax});
  failed.status = 0;
  failed.onloadend!();
  assert.notEqual($.cache('shared', callback, {ajax}), failed);
  assert.equal(requests, 3);
  await flush();
});

test('formData preserves falsy omission, primitive coercion and renamed file contents', async () => {
  const $ = fixture();
  const file = Object.assign(new Blob(['contents'], {type: 'text/plain'}), {newName: 'renamed.txt'});
  const data = $.formData({text: 'hello', zero: 0, empty: '', no: false, missing: undefined, nil: null, yes: true, number: 42, file});
  assert.deepEqual([...data.keys()], ['text', 'yes', 'number', 'file']);
  assert.equal(data.get('yes'), 'true');
  assert.equal(data.get('number'), '42');
  const uploaded = data.get('file') as File;
  assert.equal(uploaded.name, 'renamed.txt');
  assert.equal(await uploaded.text(), 'contents');
});

test('unescape keeps single-pass entity decoding, tag stripping and nullish values', () => {
  const $ = fixture();
  assert.equal($.unescape('<b>&amp; &#039; &quot; &lt; &gt; &#44;</b>'), `& ' " < > ,`);
  assert.equal($.unescape('&amp;lt; &unknown;'), '&lt; &unknown;');
  assert.equal($.unescape('&lt;b&gt;'), '<b>');
  assert.equal($.unescape(null), null);
  assert.equal($.unescape(undefined), undefined);
  assert.equal($.unescape(''), '');
});

test('one removes every registered event after the first and preserves this', () => {
  const $ = fixture();
  const target = new EventTarget();
  const observed: Event[] = [];
  $.one(target, 'first second', function(event) {
    assert.equal(this, target);
    observed.push(event);
  });
  const first = new Event('second');
  target.dispatchEvent(first);
  target.dispatchEvent(new Event('first'));
  target.dispatchEvent(new Event('second'));
  assert.deepEqual(observed, [first]);
});

test('extend retains inherited enumerable keys and getOwn excludes inherited keys', () => {
  const $ = fixture();
  const properties = Object.assign(Object.create({inherited: 1}), {own: 2});
  const target: Record<string, number> = {};
  assert.equal($.extend(target, properties), undefined);
  assert.deepEqual(target, {inherited: 1, own: 2});
  assert.equal($.getOwn(properties, 'inherited'), undefined);
  assert.equal($.getOwn(properties, 'own'), 2);
});
