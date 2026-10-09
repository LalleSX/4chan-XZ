export const filterFields = [
  'postID', 'name', 'uniqueID', 'tripcode', 'capcode', 'pass', 'email',
  'subject', 'comment', 'flag', 'filename', 'dimensions', 'filesize', 'MD5'
] as const;

export type FilterField = typeof filterFields[number];
export type MatchMode = 'contains' | 'equals' | 'starts' | 'ends' | 'regex';

export interface ParsedRule {
  source: string;
  regexp: string | RegExp;
  types: string[];
  boards?: string;
  excludes?: string;
  mask: number;
  hide: boolean;
  stub: boolean;
  hl?: string;
  top: boolean;
  noti: boolean;
  poster: boolean;
  replies: boolean;
  reason?: string;
  warnings: string[];
}

export function exactField(field: string): boolean {
  return field === 'uniqueID' || field === 'MD5';
}

// Sticky matching checks only the candidate delimiter, without slicing the line.
const ruleSuffix = /[a-z]*(?=\s*(?:;|$))/iy;

/** The closing slash is followed by flags and an option separator or end of line.
 * Slashes inside legacy MD5 values and unescaped URL patterns remain supported.
 */
export function parseRule(line: string, field: string, stubs = true): ParsedRule | null {
  line = line.trim();
  if (!line || line.startsWith('#')) return null;
  let end = -1;
  let flags = '';
  let inClass = false;
  const exact = exactField(field);
  if (line.startsWith('/')) {
    for (let index = 1; index < line.length; index++) {
      const char = line[index];
      if (!exact) {
        if (char === '\\') { index++; continue; }
        if (char === '[') inClass = true;
        if (char === ']') inClass = false;
      }
      if (char !== '/' || inClass) continue;
      // Reset before every attempt, including after another rule used this regex.
      ruleSuffix.lastIndex = index + 1;
      const suffix = ruleSuffix.exec(line);
      if (suffix) { end = index; flags = suffix[0]; break; }
    }
  }
  if (end < 0) throw new Error('Expected /pattern/flags followed by optional ;options.');
  const source = line.slice(1, end);
  const regexp = exact ? source : new RegExp(source, flags);
  const options = new Map<string, string>();
  const warnings: string[] = [];
  for (const part of line.slice(end + 1 + flags.length).split(';')) {
    if (!part.trim()) continue;
    const colon = part.indexOf(':');
    const key = (colon < 0 ? part : part.slice(0, colon)).trim();
    const value = colon < 0 ? '' : part.slice(colon + 1).trim();
    if (options.has(key)) warnings.push(`Duplicate option: ${key}`);
    else options.set(key, value);
    if (!['boards', 'exclude', 'op', 'file', 'stub', 'notify', 'highlight', 'top', 'hide', 'reason', 'poster', 'replies', 'type'].includes(key)) {
      warnings.push(`Unknown option: ${key}`);
    }
    if (['op', 'file'].includes(key) && !['yes', 'no', 'only'].includes(value) ||
        ['stub', 'top'].includes(key) && !['yes', 'no'].includes(value)) {
      warnings.push(`Invalid value for ${key}: ${value}`);
    }
  }
  const types = field === 'general'
    ? (options.get('type') ?? 'subject,name,filename,comment').split(',').map(type => type.trim())
    : [field];
  for (const type of types) {
    if (!type.split('+').every(part => (filterFields as readonly string[]).includes(part))) {
      warnings.push(`Unknown field: ${type || '(empty)'}`);
    }
  }
  const highlight = options.has('highlight');
  const hl = highlight ? options.get('highlight') || 'filter-highlight' : undefined;
  if (hl && !/^[\w-]+$/.test(hl)) throw new Error('Highlight class must contain only letters, numbers, underscores or hyphens.');
  const noti = options.has('notify');
  return {
    source, regexp, types, warnings,
    boards: options.get('boards'), excludes: options.get('exclude'),
    mask: (options.get('op') === 'no' ? 1 : options.get('op') === 'only' ? 2 : 0) |
      (options.get('file') === 'no' ? 4 : options.get('file') === 'only' ? 8 : 0),
    hide: options.has('hide') || !(highlight || noti),
    stub: options.get('stub') === 'yes' ? true : options.get('stub') === 'no' ? false : stubs,
    hl, top: highlight && options.get('top') !== 'no', noti,
    poster: options.has('poster'), replies: options.has('replies'), reason: options.get('reason')
  };
}

export function matchesRule(regexp: string | RegExp, value: string): boolean {
  if (typeof regexp === 'string') return regexp === value;
  // Global and sticky expressions must not retain state between posts or previews.
  regexp.lastIndex = 0;
  return regexp.test(value);
}

export function buildPattern(value: string, mode: MatchMode, caseSensitive: boolean, field: string, flags = ''): string {
  if (!value || /[\r\n]/.test(value)) throw new Error('Enter a nonempty, single-line match value.');
  if (exactField(field)) return `/${value}/`;
  let source = value;
  if (mode !== 'regex') {
    source = value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    if (mode === 'equals' || mode === 'starts') source = `^${source}`;
    if (mode === 'equals' || mode === 'ends') source = `${source}$(?![\\s\\S])`;
  }
  // RegExp.source normalizes literal slashes, so they cannot become option delimiters.
  if (mode !== 'regex') flags = '';
  if (!/^[gmsuy]*$/.test(flags)) throw new Error('Extra flags may contain g, m, s, u or y.');
  const regexp = new RegExp(source, `${caseSensitive ? '' : 'i'}${flags}`);
  return `/${regexp.source}/${regexp.flags}`;
}
