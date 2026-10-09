import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/Filtering/FilterRule.ts';

const { parseRule, matchesRule, buildPattern } = rules;

test('blank lines, comments and indented disabled rules are inactive', () => {
  for (const line of ['', '  ', '#note', '  #/spam/i']) assert.equal(parseRule(line, 'comment'), null);
});

test('literal builder escapes metacharacters and option-looking text', () => {
  for (const value of ['a.b [test] (x)+?', 'https://example.test/a', 'a/;hide', '$5\\day', '<script>']) {
    const rule = parseRule(buildPattern(value, 'equals', true, 'comment'), 'comment')!;
    assert.equal(matchesRule(rule.regexp, value), true, value);
    assert.equal(matchesRule(rule.regexp, `prefix${value}`), false, value);
  }
});

test('all text match modes and case sensitivity', () => {
  for (const [mode, value, expected] of [
    ['contains', 'A SPAM B', true], ['equals', 'SPAM', true], ['equals', 'SPAM B', false],
    ['starts', 'SPAM B', true], ['starts', 'A SPAM', false],
    ['ends', 'A SPAM', true], ['ends', 'SPAM B', false], ['equals', 'spam\n', false]
  ] as const) {
    assert.equal(matchesRule(parseRule(buildPattern('spam', mode, false, 'comment'), 'comment')!.regexp, value), expected);
  }
  assert.equal(matchesRule(parseRule(buildPattern('spam', 'contains', true, 'comment'), 'comment')!.regexp, 'SPAM'), false);
});

test('regex delimiters support legacy URLs, character classes and reasons with slashes', () => {
  for (const line of ['/https://example.test/a/;reason:URL /spam/', '/[/;]/;reason:slash / or semicolon']) {
    const rule = parseRule(line, 'comment')!;
    assert.equal(rule.hide, true);
    assert.ok(rule.reason?.includes('/'));
  }
  assert.equal(matchesRule(parseRule('/[/;]/', 'comment')!.regexp, ';'), true);
  assert.equal(matchesRule(parseRule('/a\\/;b/i;highlight', 'comment')!.regexp, 'A/;B'), true);
});

test('MD5 and poster IDs remain exact strings, including slash and plus', () => {
  for (const field of ['MD5', 'uniqueID']) {
    const value = 'abc/DEF+123==';
    const rule = parseRule(buildPattern(value, 'equals', false, field), field)!;
    assert.equal(rule.regexp, value);
    assert.equal(matchesRule(rule.regexp, value.toLowerCase()), false);
    assert.equal(matchesRule(rule.regexp, value), true);
  }
});

test('delimiter scanning preserves flags, whitespace and the first valid delimiter', () => {
  for (const [line, source, flags, reason] of [
    ['/https://example.test/a/i ;reason:URL /g', 'https://example.test/a', 'i', 'URL /g'],
    ['/a/word/b/g\t;reason:path', 'a/word/b', 'g', 'path'],
    ['/a/\u00a0;reason:space', 'a', '', 'space'],
    ['/a/;reason:first /b/i', 'a', '', 'first /b/i'],
    ['/[/;]/i;reason:class', '[/;]', 'i', 'class'],
    [String.raw`/a\/;b/m;reason:escaped`, String.raw`a\/;b`, 'm', 'escaped'],
    [String.raw`/a\\/i;reason:backslash`, String.raw`a\\`, 'i', 'backslash'],
    ['/a/g', 'a', 'g', undefined],
    ['/a/', 'a', '', undefined]
  ] as const) {
    const rule = parseRule(line, 'comment')!;
    assert.equal(rule.source, source, line);
    assert.equal((rule.regexp as RegExp).flags, flags, line);
    assert.equal(rule.reason, reason, line);
  }
  // A failed candidate must not search forward to flags after a later slash.
  assert.throws(() => parseRule('/a/123', 'comment'), /Expected/);
  for (const line of ['/a/I', '/a/gg', '/a/z']) {
    assert.throws(() => parseRule(line, 'comment'), SyntaxError, line);
  }
});

test('shared delimiter matching is independent across successful and failed rules', () => {
  for (let i = 0; i < 10; i++) {
    assert.equal(parseRule('/long/path/to/a/value/gi;notify', 'comment')!.source, 'long/path/to/a/value');
    assert.throws(() => parseRule('/missing/123', 'comment'));
    assert.equal(parseRule('/x/', 'comment')!.source, 'x');
    assert.equal(parseRule(String.raw`/[abc\DEF+123==/`, 'MD5')!.regexp, String.raw`[abc\DEF+123==`);
    assert.equal(parseRule('#/disabled/', 'comment'), null);
    assert.equal(parseRule('/y/i;reason:short', 'comment')!.reason, 'short');
  }
});

test('notification, highlight and hide actions are independent', () => {
  assert.equal(parseRule('/x/;notify', 'comment')!.hide, false);
  assert.equal(parseRule('/x/;highlight', 'comment')!.hide, false);
  assert.equal(parseRule('/x/;notify;hide', 'comment')!.hide, true);
  const rule = parseRule('/x/;highlight:custom;hide;top:no;poster;replies;reason:$5 / day', 'comment')!;
  assert.equal(rule.hl, 'custom');
  assert.equal(rule.top, false);
  assert.equal(rule.poster, true);
  assert.equal(rule.replies, true);
  assert.equal(rule.reason, '$5 / day');
});

test('scope masks, stub defaults, and combined general fields', () => {
  const rule = parseRule('/x/;op:only;file:no;stub:no;boards:g, v;exclude:pol;type:comment, filename+filesize', 'general')!;
  assert.equal(rule.mask, 6);
  assert.equal(rule.stub, false);
  assert.equal(rule.boards, 'g, v');
  assert.equal(rule.excludes, 'pol');
  assert.deepEqual(rule.types, ['comment', 'filename+filesize']);
  assert.equal(parseRule('/x/', 'comment', false)!.stub, false);
  assert.equal(parseRule('/x/;stub:yes', 'comment', false)!.stub, true);
  assert.deepEqual(parseRule('/x/', 'general')!.types, ['subject', 'name', 'filename', 'comment']);
});

test('global and sticky regexes match successive posts identically', () => {
  for (const flags of ['g', 'y', 'gi']) {
    const rule = parseRule(`/spam/${flags}`, 'comment')!;
    for (let i = 0; i < 5; i++) assert.equal(matchesRule(rule.regexp, 'spam'), true);
  }
});

test('errors and warnings identify malformed rules and unknown options', () => {
  for (const line of ['text', '/[/', '/x/ii', '/x/z', '/x/;highlight:bad class']) {
    assert.throws(() => parseRule(line, 'comment'), undefined, line);
  }
  assert.throws(() => buildPattern('a\nb', 'contains', false, 'comment'));
  assert.throws(() => buildPattern('a', 'regex', false, 'comment', 'mm'));
  assert.equal(parseRule('/x/;typo;op:bad;type:unknown;op:no', 'general')!.warnings.length, 4);
});

test('multiline regex builder round trips extra flags', () => {
  const rule = parseRule(buildPattern('^spam$', 'regex', false, 'comment', 'm'), 'comment')!;
  assert.equal(matchesRule(rule.regexp, 'first\nSPAM\nlast'), true);
});

// Exercise the production Filter.init/test paths with browser services replaced by fixtures.
function runtime(config: Record<string, string>) {
  const Conf = { Filter: true, Stubs: true, 'Filtered Backlinks': true, ...config };
  const notices: string[] = [];
  const dependencies: Record<string, unknown> = {
    '../config/Config': { filter: config },
    '../globals/globals': { Conf, doc: {}, g: { VIEW: 'index', sites: { '4chan.org': {} } } },
    '../platform/helpers': { dict: () => Object.create(null) },
    '../platform/$': {
      hasOwn: (obj: object, key: string) => Object.hasOwn(obj, key),
      getOwn: (obj: Record<string, unknown>, key: string) => Object.hasOwn(obj, key) ? obj[key] : undefined
    },
    '../classes/Callbacks': { Post: [] },
    '../classes/Notice': class { constructor(_level: string, message: string) { notices.push(message); } },
    '../Quotelinks/QuoteYou': { isYou: () => false },
    './FilterRule': rules
  };
  const source = ts.transpileModule(readFileSync(new URL('../src/Filtering/Filter.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, RegExp, Map,
    require: (id: string) => {
      const value = dependencies[id] ?? {};
      return { __esModule: true, default: value, ...value as object };
    }
  });
  const filter = (exports as { default: {
    init(): void;
    test(post: object): { hide: boolean; hl?: string[]; noti?: boolean; stub?: boolean };
  } }).default;
  filter.init();
  return { filter, notices };
}

function post(overrides = {}) {
  return { ID: 1, siteID: '4chan.org', boardID: 'g', isReply: true,
    info: { comment: 'spam', uniqueID: 'abc', subject: '' }, files: [], ...overrides };
}

test('production runtime handles board whitespace, exclusions, scopes and repeated matching', () => {
  const { filter, notices } = runtime({ comment: '/spam/g;boards:g, v;exclude:pol;op:no;file:no' });
  assert.equal(notices.length, 0);
  assert.equal(filter.test(post()).hide, true);
  assert.equal(filter.test(post({ boardID: 'v' })).hide, true);
  assert.equal(filter.test(post({ boardID: 'pol' })).hide, false);
  assert.equal(filter.test(post({ isReply: false })).hide, false);
  assert.equal(filter.test(post({ file: {} })).hide, false);
});

test('production runtime preserves exact maps and isolates invalid rules', () => {
  const { filter, notices } = runtime({ uniqueID: '/abc/;highlight', comment: '/[/\n/spam/;notify' });
  const result = filter.test(post());
  assert.equal(notices.length, 1);
  assert.equal(result.hide, false);
  assert.equal(result.noti, true);
  assert.deepEqual(Array.from(result.hl!), ['filter-highlight']);
});

test('general rules cover multiple fields, combined values and exact IDs', () => {
  const { filter } = runtime({ general: '/abc/;type:uniqueID;highlight\n/photo\\.jpg\\n2 MB/;type:filename+filesize;stub:no' });
  const result = filter.test(post({ files: [{ name: 'photo.jpg', size: '2 MB' }] }));
  assert.equal(result.hide, true);
  assert.equal(result.stub, false);
  assert.deepEqual(Array.from(result.hl!), ['filter-highlight']);
});

test('inherited example filters still parse without warnings', () => {
  const source = ts.transpileModule(readFileSync(new URL('../src/config/Config.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (id: string) => ({ __esModule: true, default: id.endsWith('banners.json') ? [] : {} }) });
  const config = (exports as { default: { filter: Record<string, string> } }).default;
  for (const [field, value] of Object.entries(config.filter)) {
    for (const line of value.split('\n').filter(line => line.startsWith('#/'))) {
      assert.deepEqual(parseRule(line.slice(1), field)!.warnings, [], `${field}: ${line}`);
    }
  }
});
