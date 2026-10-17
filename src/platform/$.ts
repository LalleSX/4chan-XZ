// loosely follows the jquery api:
// http://api.jquery.com/

import Notice from "../classes/Notice";
import { c, Conf, d, doc, g } from "../globals/globals";
import { debounce, dict, MINUTE, platform, SECOND } from "./helpers";
import meta from '../../package.json';
import PageContextFunctions from "../PageContext/pageContext";

export interface AjaxOptions {
  onloadend?: (this: XMLHttpRequest, event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
  timeout?: number;
  responseType?: XMLHttpRequestResponseType;
  withCredentials?: boolean;
  type?: string;
  onprogress?: (this: XMLHttpRequestUpload, event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
  form?: Document | XMLHttpRequestBodyInit | null;
  headers?: Record<string, string>;
}

type FormValue = string | number | boolean | (Blob & { newName?: string }) | null | undefined;

type ElementProperties<K extends keyof HTMLElementTagNameMap> = {
  [P in keyof HTMLElementTagNameMap[K]]?: P extends 'classList'
    ? DOMTokenList | string
    : HTMLElementTagNameMap[K][P] extends string
      ? HTMLElementTagNameMap[K][P] | number
      : HTMLElementTagNameMap[K][P];
};

type AudioVideo = Element & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number };

const $ = (selector: string, root: ParentNode = document.body) => root.querySelector(selector);

$.id = (id: string) => d.getElementById(id);

$.ready = (fc: () => void): void => {
  if (d.readyState !== 'loading') {
    $.queueTask(fc);
    return;
  }
  const cb = () => {
    $.off(d, 'DOMContentLoaded', cb);
    fc();
  };
  $.on(d, 'DOMContentLoaded', cb);
};

$.formData = (form: HTMLFormElement | Record<string, FormValue>): FormData => {
  if (form instanceof HTMLFormElement) return new FormData(form);

  const fd = new FormData();
  for (const key in form) {
    const val = form[key];
    if (!val) continue;
    if (typeof val === 'object' && 'newName' in val) {
      fd.append(key, val, val.newName);
    } else {
      fd.append(key, val as string | Blob);
    }
  }
  return fd;
};

$.extend = <P extends object>(object: object, properties: P): void => {
  for (const key in properties) {
    (object as P)[key] = properties[key];
  }
};

$.hasOwn = (obj: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(obj, key);

$.getOwn = (obj: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

$.ajax = (() => {
  let pageXHR = XMLHttpRequest;
  if (window.wrappedJSObject && !XMLHttpRequest.wrappedJSObject) {
    try {
      pageXHR = XPCNativeWrapper(window.wrappedJSObject.XMLHttpRequest);
    } catch {}
  }

  return (url: string, options: AjaxOptions = {}): XMLHttpRequest => {
    options.responseType ??= 'json';
    options.type ??= (options.form && 'post') || 'get';

    // XXX https://forums.lanik.us/viewtopic.php?f=64&t=24173&p=78310
    url = url.replace(/^((?:https?:)?\/\/(?:\w+\.)?(?:4chan|4channel|4cdn)\.org)\/adv\//, '$1//adv/');

    const { onloadend, timeout, responseType, withCredentials, type, onprogress, form, headers } = options;
    const r = new pageXHR();

    try {
      r.open(type!, url, true);
      if (headers) {
        for (const key in headers) r.setRequestHeader(key, headers[key]);
      }
      $.extend(r, { onloadend, timeout, responseType, withCredentials });
      if (onprogress) $.extend(r.upload, { onprogress });

      $.on(r, 'error', () => {
        if (!r.status) c.warn(`${meta.name} failed to load: ${url}`);
      });
      r.send(form);
    } catch (err: any) {
      // XXX Some content blockers in Firefox (e.g. Adblock Plus and NoScript) throw instead of simulating a connection error.
      if (err.result !== 0x805e0006) throw err;
      r.onloadend = onloadend;
      $.queueTask($.event, 'error', null, r);
      $.queueTask($.event, 'loadend', null, r);
    }
    return r;
  };
})();

// Status Code 304: Not modified
// With the `If-Modified-Since` header we only receive the HTTP headers and no body for 304 responses.
// This saves a lot of bandwidth and CPU time for both the users and the servers.
$.lastModified = dict() as Record<string, Record<string, string | null>>;

$.whenModified = (url: string, bucket: string, cb: Function, options: { timeout?: number; ajax?: typeof $.ajax } = {}) => {
  const { timeout, ajax } = options;
  const headers: Record<string, string> = dict();
  const t = $.lastModified[bucket]?.[url];
  if (t != null) headers['If-Modified-Since'] = t;

  return (ajax || $.ajax)(url, {
    onloadend() {
      ($.lastModified[bucket] ??= dict())[url] = this.getResponseHeader('Last-Modified');
      return cb.call(this);
    },
    timeout,
    headers,
  });
};

(() => {
  const reqs = dict() as Record<string, XMLHttpRequest & { callbacks?: Function[] }>;

  $.cache = (url: string, cb: Function, options: { ajax?: typeof $.ajax } = {}) => {
    const existing = reqs[url];
    if (existing) {
      if (existing.callbacks) {
        existing.callbacks.push(cb);
      } else {
        $.queueTask(() => cb.call(existing, { isCached: true }));
      }
      return existing;
    }

    const onloadend = function (this: XMLHttpRequest & { callbacks?: Function[] }) {
      if (!this.status) delete reqs[url];
      for (const callback of this.callbacks!) {
        $.queueTask(() => callback.call(this, { isCached: false }));
      }
      delete this.callbacks;
    };

    const req = (options.ajax || $.ajax)(url, { onloadend });
    req.callbacks = [cb];
    return (reqs[url] = req);
  };

  $.cleanCache = (testf: (url: string) => boolean): void => {
    for (const url in reqs) {
      if (testf(url)) delete reqs[url];
    }
  };
})();

$.cb = {
  checked(this: HTMLInputElement) {
    if ($.hasOwn(Conf, this.name)) {
      $.set(this.name, this.checked);
      Conf[this.name] = this.checked;
    }
  },
  value(this: HTMLInputElement | HTMLTextAreaElement) {
    if ($.hasOwn(Conf, this.name)) {
      $.set(this.name, this.value.trim());
      Conf[this.name] = this.value;
    }
  },
};

$.asap = (test: () => unknown, cb: Function): void => {
  if (test()) return cb();
  setTimeout($.asap, 25, test, cb);
};

$.onExists = (root: Node, selector: string, cb: (el: Element) => void): void => {
  const el = $(selector, root);
  if (el) return cb(el);

  const observer = new MutationObserver(() => {
    const found = $(selector, root);
    if (found) {
      observer.disconnect();
      cb(found);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
};

$.addStyle = (css: string, id?: string, test = 'head'): HTMLStyleElement => {
  const style = $.el('style', { textContent: css });
  if (id != null) style.id = id;
  $.onExists(doc, test, () => $.add(d.head, style));
  return style;
};

$.addCSP = (policy: string): void => {
  const metaEl = $.el('meta', {
    httpEquiv: 'Content-Security-Policy',
    content: policy,
  });
  if (d.head) {
    $.add(d.head, metaEl);
    $.rm(metaEl);
  } else {
    const head = $.add(doc || d, $.el('head'));
    $.add(head, metaEl);
    $.rm(head);
  }
};

$.x = <T extends Node = Node>(path: string, root: Node = d.body): T | null =>
  d.evaluate(path, root, null, 8, null).singleNodeValue as T | null;

$.X = (path: string, root: Node = d.body): XPathResult =>
  d.evaluate(path, root, null, 7, null);

$.addClass = (el: Element, ...classNames: string[]): void => el.classList.add(...classNames);
$.rmClass = (el: Element, ...classNames: string[]): void => el.classList.remove(...classNames);
$.toggleClass = (el: Element, className: string): boolean => el.classList.toggle(className);
$.hasClass = (el: Element, className: string): boolean => el.classList.contains(className);

$.rm = (el?: Element | null): void => el?.remove();
$.rmAll = (root: Node): null => (root.textContent = null);

$.tn = (s: string): Text => d.createTextNode(s);
$.frag = (): DocumentFragment => d.createDocumentFragment();

$.nodes = (nodes: Node | Node[]): Node | DocumentFragment => {
  if (!(nodes instanceof Array)) return nodes;
  const frag = $.frag();
  for (const node of nodes) frag.appendChild(node);
  return frag;
};

$.add = (parent: Node, el: Node | Node[]) => parent.appendChild($.nodes(el));
$.prepend = (parent: Node, el: Node | Node[]) => parent.insertBefore($.nodes(el), parent.firstChild);
$.after = (root: Node, el: Node | Node[]) => root.parentNode!.insertBefore($.nodes(el), root.nextSibling);
$.before = (root: Node, el: Node | Node[]) => root.parentNode!.insertBefore($.nodes(el), root);
$.replace = (root: Node, el: Node | Node[]) => root.parentNode!.replaceChild($.nodes(el), root);

$.el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  properties?: ElementProperties<K>,
  properties2?: ElementProperties<K>
): HTMLElementTagNameMap[K] => {
  const el = d.createElement(tag);
  if (properties) $.extend(el, properties);
  if (properties2) $.extend(el, properties2);
  return el;
};

$.on = <E extends Event>(el: EventTarget, events: string, handler: (event: E) => void): void => {
  for (const event of events.split(' ')) el.addEventListener(event, handler, false);
};

$.off = (el: EventTarget, events: string, handler: EventListener): void => {
  for (const event of events.split(' ')) el.removeEventListener(event, handler, false);
};

$.one = <T extends EventTarget, E extends Event>(
  el: T,
  events: string,
  handler: (this: T, event: E) => void
): void => {
  const cb = function (this: T, e: E) {
    $.off(el, events, cb);
    return handler.call(this, e);
  };
  $.on(el, events, cb);
};

$.event = (event: string, detail?: unknown, root: EventTarget = d): boolean => {
  if (!globalThis.chrome?.extension && detail != null && typeof cloneInto === 'function') {
    detail = cloneInto(detail, d.defaultView);
  }
  return root.dispatchEvent(new CustomEvent(event, { bubbles: true, cancelable: true, detail }));
};

if (platform === 'userscript') {
  // XXX Make $.event work in Pale Moon with GM 3.x (no cloneInto function).
  (() => {
    if (!/PaleMoon\//.test(navigator.userAgent) || (+GM_info?.version?.split('.')[0] < 2) || typeof cloneInto !== 'undefined') return;

    try {
      new CustomEvent('x', { detail: {} });
    } catch {
      const unsafeConstructors = {
        Object: unsafeWindow.Object,
        Array: unsafeWindow.Array,
      };
      const clone = (obj: any): any => {
        if (obj != null && typeof obj === 'object') {
          const Ctor = unsafeConstructors[obj.constructor.name as keyof typeof unsafeConstructors];
          if (Ctor) {
            const obj2 = new Ctor();
            for (const key in obj) obj2[key] = clone(obj[key]);
            return obj2;
          }
        }
        return obj;
      };
      $.event = (event, detail, root = d) =>
        root.dispatchEvent(new CustomEvent(event, { bubbles: true, cancelable: true, detail: clone(detail) }));
    }
  })();
}

$.modifiedClick = (e: MouseEvent): boolean =>
  e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.button !== 0;

$.open =
  !globalThis.chrome?.extension
    ? GM?.openInTab ?? (typeof GM_openInTab !== 'undefined' ? GM_openInTab : (url: string) => window.open(url, '_blank'))
    : (url: string) => window.open(url, '_blank');

$.debounce = <T, A extends unknown[], R>(wait: number, fn: (this: T, ...args: A) => R) => {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let that: T;
  let args: A;

  const exec = () => {
    lastCall = Date.now();
    return fn.apply(that, args);
  };

  return function (this: T, ...nextArgs: A): R | ReturnType<typeof setTimeout> {
    args = nextArgs;
    that = this;
    if (lastCall < Date.now() - wait) return exec();
    clearTimeout(timeout!);
    return (timeout = setTimeout(exec, wait));
  };
};

$.queueTask = (() => {
  const resolved = Promise.resolve();
  return <A extends unknown[]>(fn: (...args: A) => unknown, ...args: A): void => {
    // setTimeout is throttled in background tabs on firefox
    resolved.then(() => fn(...args));
  };
})();

if (platform === 'crx') {
  const callbacks = new Map<number, (data: unknown) => void>();

  chrome.runtime.onMessage.addListener(({ id, data }) => {
    callbacks.get(id)?.(data);
    callbacks.delete(id);
  });

  $.eventPageRequest = (params: object): Promise<unknown> =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage(params, (id: number) => callbacks.set(id, resolve));
    });
}

/**
 * Runs a function on the page instead of the user script or extension context.
 * @param fn The name of the function in pageContext.ts. It must be defined there to run in a manifest V3 context.
 * @param data Data to pass to the function. Will be passed as `this`.
 * @returns A promise with the data object, which might be mutated by the function. If you're not using that, you can
 * still await it to make sure the function is done.
 */
$.global = async (fn: string, data?: Record<string, string>) => {
  if (platform === 'crx' && chrome.runtime.getManifest().manifest_version === 3) {
    return $.eventPageRequest({ type: 'runInPageContext', fn, data });
  }

  if (doc) {
    const script = $.el('script', {
      textContent: `(${PageContextFunctions[fn]})(document.currentScript.dataset);`,
    });
    if (data) $.extend(script.dataset, data);
    $.add(d.head || doc, script);
    $.rm(script);
    return script.dataset;
  }

  // XXX dwb
  try {
    PageContextFunctions[fn](data);
  } catch (error) {
    console.error(error);
  }
  return data;
};

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

$.bytesToString = (size: number | string): string => {
  let unit = 0;
  let n = +size;
  while (n >= 1024 && unit < 3) {
    n /= 1024;
    unit++;
  }
  const rounded = unit > 1 ? Math.round(n * 100) / 100 : Math.round(n);
  return `${rounded} ${UNITS[unit]}`;
};

$.minmax = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

$.hasAudio = (video: AudioVideo): boolean =>
  !!video.mozHasAudio || !!video.webkitAudioDecodedByteCount || video.nextElementSibling?.tagName === 'AUDIO';

$.luma = (rgb: readonly (number | string)[]): number =>
  (+rgb[0] * 0.299) + (+rgb[1] * 0.587) + (+rgb[2] * 0.114);

$.unescape = (() => {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&#039;': "'",
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
    '&#44;': ',',
  };
  const re = /&(amp|#039|quot|lt|gt|#44);/g;
  return (text: string | null | undefined): string | null | undefined => {
    if (text == null) return text;
    return text.replace(/<[^>]*>/g, '').replace(re, (entity) => entities[entity]);
  };
})();

$.isImage = (url: string): boolean => /\.(jpe?g|jfif|png|gif|bmp|webp|avif|jxl)$/i.test(url);
$.isVideo = (url: string): boolean => /\.(webm|mp4|ogv)$/i.test(url);

$.engine = (() => {
  const ua = navigator.userAgent;
  if (/Edge\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'blink';
  if (/WebKit\//.test(ua)) return 'webkit';
  if (/Gecko\/|Goanna/.test(ua)) return 'gecko';
})();

$.hasStorage = (() => {
  try {
    const key = g.NAMESPACE + 'hasStorage';
    if (localStorage.getItem(key) === 'true') return true;
    localStorage.setItem(key, 'true');
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
})();

$.item = <T>(key: string, val: T): Record<string, T> => {
  const item = dict() as Record<string, T>;
  item[key] = val;
  return item;
};

$.oneItemSugar = (fn: Function) =>
  ((key: string | Record<string, any>, val?: any, cb?: () => void) => {
    if (typeof key === 'string') return fn($.item(key, val), cb);
    return fn(key, val);
  }) as {
    (key: string, value: any, callback?: () => void): void;
    (values: Record<string, any>, callback?: () => void): void;
  };

$.syncing = dict();

$.securityCheck = (data: Record<string, unknown>): boolean | undefined => {
  if (location.protocol !== 'https:') return delete data['Redirect to HTTPS'];
};

// Storage implementation (Chrome extension vs userscript/GM)
if (platform === 'crx') {
  $.oldValue = { local: dict(), sync: dict() };

  chrome.storage.onChanged.addListener((changes, area) => {
    for (const key in changes) {
      const oldValue = $.oldValue.local[key] ?? $.oldValue.sync[key];
      $.oldValue[area][key] = dict.clone(changes[key].newValue);
      const newValue = $.oldValue.local[key] ?? $.oldValue.sync[key];
      const cb = $.syncing[key];
      if (cb && JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        cb(newValue, key);
      }
    }
  });

  $.sync = (key: string, cb: Function) => ($.syncing[key] = cb);
  $.forceSync = () => {};

  $.crxWorking = (): boolean => {
    try {
      if (chrome.runtime.getManifest()) return true;
    } catch {}
    if (!$.crxWarningShown) {
      const msg = $.el('div', {
        innerHTML: `${meta.name} seems to have been updated. You will need to <a href="javascript:;">reload</a> the page.`,
      });
      $.on($('a', msg)!, 'click', () => location.reload());
      new Notice('warning', msg);
      $.crxWarningShown = true;
    }
    return false;
  };

  $.get = $.oneItemSugar((data: Record<string, any>, cb: Function) => {
    if (!$.crxWorking()) return;
    const results: Record<string, any> = {};
    const get = (area: 'local' | 'sync') => {
      let keys: string[] | null = Object.keys(data);
      if ($.engine === 'gecko' && area === 'sync' && keys.length > 3) keys = null;

      chrome.storage[area].get(keys, (result) => {
        result = dict.clone(result);
        if (chrome.runtime.lastError) c.error(chrome.runtime.lastError.message);

        if (keys === null) {
          const filtered = dict();
          for (const key in result) {
            if ($.hasOwn(data, key)) filtered[key] = result[key];
          }
          result = filtered;
        }

        for (const key in data) $.oldValue[area][key] = result[key];
        results[area] = result;

        if (results.local && results.sync) {
          $.extend(data, results.sync);
          $.extend(data, results.local);
          cb(data);
        }
      });
    };
    get('local');
    get('sync');
  });

  (() => {
    const items = { local: dict(), sync: dict() };

    const exceedsQuota = (key: string, value: any) =>
      unescape(encodeURIComponent(JSON.stringify(key))).length +
        unescape(encodeURIComponent(JSON.stringify(value))).length >
      chrome.storage.sync.QUOTA_BYTES_PER_ITEM;

    $.delete = (keys: string | string[]) => {
      if (!$.crxWorking()) return;
      if (typeof keys === 'string') keys = [keys];
      for (const key of keys) {
        delete items.local[key];
        delete items.sync[key];
      }
      chrome.storage.local.remove(keys);
      chrome.storage.sync.remove(keys);
    };

    const timeout: Record<string, number> = {};
    const setArea = (area: 'local' | 'sync', cb?: Function) => {
      const data = dict();
      $.extend(data, items[area]);
      if (!Object.keys(data).length || timeout[area] > Date.now()) return;

      chrome.storage[area].set(data, () => {
        if (chrome.runtime.lastError) {
          c.error(chrome.runtime.lastError.message);
          setTimeout(setArea, MINUTE, area);
          timeout[area] = Date.now() + MINUTE;
          return cb?.(chrome.runtime.lastError);
        }

        delete timeout[area];
        for (const key in data) {
          if (items[area][key] === data[key]) delete items[area][key];
        }

        if (area === 'local') {
          for (const key in data) {
            if (!exceedsQuota(key, data[key])) items.sync[key] = data[key];
          }
          setSync();
        } else {
          const toRemove = [];
          for (const key in data) {
            if (!(key in items.local)) toRemove.push(key);
          }
          if (toRemove.length) chrome.storage.local.remove(toRemove);
        }
        cb?.();
      });
    };

    const setSync = debounce(SECOND, () => setArea('sync'));

    $.set = $.oneItemSugar((data: Record<string, any>, cb?: Function) => {
      if (!$.crxWorking()) return;
      $.securityCheck(data);
      $.extend(items.local, data);
      setArea('local', cb);
    });

    $.clear = (cb?: Function) => {
      if (!$.crxWorking()) return;
      items.local = dict();
      items.sync = dict();
      let count = 2;
      let err: any = null;
      const done = () => {
        if (chrome.runtime.lastError) c.error(chrome.runtime.lastError.message);
        if (err == null) err = chrome.runtime.lastError;
        if (!--count) cb?.(err);
      };
      chrome.storage.local.clear(done);
      chrome.storage.sync.clear(done);
    };
  })();
} else {
  // Greasemonkey / Tampermonkey / localStorage fallback
  if (GM?.deleteValue != null && window.BroadcastChannel && (typeof GM_addValueChangeListener === 'undefined' || GM_addValueChangeListener === null)) {
    $.syncChannel = new BroadcastChannel(g.NAMESPACE + 'sync');

    $.on($.syncChannel, 'message', (e: MessageEvent<Record<string, unknown>>) => {
      for (const key in e.data) {
        const cb = $.syncing[key];
        if (cb) cb(dict.json(JSON.stringify(e.data[key])), key);
      }
    });

    $.sync = (key: string, cb: Function) => ($.syncing[key] = cb);
    $.forceSync = () => {};

    $.delete = (keys: string | string[], cb?: () => void) => {
      if (!(keys instanceof Array)) keys = [keys];
      Promise.all(keys.map((key) => GM.deleteValue(g.NAMESPACE + key))).then(() => {
        const items = dict();
        for (const key of keys) items[key] = undefined;
        $.syncChannel.postMessage(items);
        cb?.();
      });
    };

    $.get = $.oneItemSugar((items: Record<string, any>, cb: Function) => {
      const keys = Object.keys(items);
      Promise.all(keys.map((key) => GM.getValue(g.NAMESPACE + key))).then((values) => {
        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          if (val) items[keys[i]] = dict.json(val);
        }
        cb(items);
      });
    });

    $.set = $.oneItemSugar((items: Record<string, any>, cb?: Function) => {
      $.securityCheck(items);
      Promise.all(
        Object.keys(items).map((key) => GM.setValue(g.NAMESPACE + key, JSON.stringify(items[key])))
      ).then(() => {
        $.syncChannel.postMessage(items);
        cb?.();
      });
    });

    $.clear = (cb?: Function) =>
      GM.listValues()
        .then((keys) => $.delete(keys.map((key) => key.replace(g.NAMESPACE, '')), cb))
        .catch(() => $.delete(Object.keys(Conf).concat(['previousversion', 'QR Size', 'QR.persona']), cb));
  } else {
    // Legacy GM / localStorage path
    if (typeof GM_deleteValue !== 'undefined' && GM_deleteValue !== null) {
      $.getValue = GM_getValue;
      $.listValues = () => GM_listValues();
    } else if ($.hasStorage) {
      $.getValue = (key: string) => localStorage.getItem(key);
      $.listValues = () => {
        const result: string[] = [];
        for (const key in localStorage) {
          if (key.startsWith(g.NAMESPACE)) result.push(key);
        }
        return result;
      };
    } else {
      $.getValue = () => undefined;
      $.listValues = () => [];
    }

    if (typeof GM_addValueChangeListener !== 'undefined' && GM_addValueChangeListener !== null) {
      $.setValue = GM_setValue;
      $.deleteValue = GM_deleteValue;
    } else if (typeof GM_deleteValue !== 'undefined' && GM_deleteValue !== null) {
      $.oldValue = dict();
      $.setValue = (key: string, val: string) => {
        GM_setValue(key, val);
        if (key in $.syncing) {
          $.oldValue[key] = val;
          if ($.hasStorage) localStorage.setItem(key, val);
        }
      };
      $.deleteValue = (key: string) => {
        GM_deleteValue(key);
        if (key in $.syncing) {
          delete $.oldValue[key];
          if ($.hasStorage) localStorage.removeItem(key);
        }
      };
      if (!$.hasStorage) $.cantSync = true;
    } else if ($.hasStorage) {
      $.oldValue = dict();
      $.setValue = (key: string, val: string) => {
        if (key in $.syncing) $.oldValue[key] = val;
        localStorage.setItem(key, val);
      };
      $.deleteValue = (key: string) => {
        if (key in $.syncing) delete $.oldValue[key];
        localStorage.removeItem(key);
      };
    } else {
      $.setValue = () => {};
      $.deleteValue = () => {};
      $.cantSync = ($.cantSet = true);
    }

    if (typeof GM_addValueChangeListener !== 'undefined' && GM_addValueChangeListener !== null) {
      $.sync = (key: string, cb: Function) =>
        ($.syncing[key] = GM_addValueChangeListener(g.NAMESPACE + key, (key2, oldValue, newValue, remote) => {
          if (remote) {
            if (newValue !== undefined) newValue = dict.json(newValue);
            cb(newValue, key);
          }
        }));
      $.forceSync = () => {};
    } else if ((typeof GM_deleteValue !== 'undefined' && GM_deleteValue !== null) || $.hasStorage) {
      $.sync = (key: string, cb: Function) => {
        const fullKey = g.NAMESPACE + key;
        $.syncing[fullKey] = cb;
        $.oldValue[fullKey] = $.getValue(fullKey);
      };

      const onChange = ({ key, newValue }: { key: string; newValue: string | null }) => {
        const cb = $.syncing[key];
        if (!cb) return;
        if (newValue != null) {
          if (newValue === $.oldValue[key]) return;
          $.oldValue[key] = newValue;
          cb(dict.json(newValue), key.slice(g.NAMESPACE.length));
        } else if ($.oldValue[key] != null) {
          delete $.oldValue[key];
          cb(undefined, key.slice(g.NAMESPACE.length));
        }
      };

      $.on(window, 'storage', onChange);
      $.forceSync = (key: string) => onChange({ key: g.NAMESPACE + key, newValue: $.getValue(g.NAMESPACE + key) });
    } else {
      $.sync = () => {};
      $.forceSync = () => {};
    }

    $.delete = (keys: string | string[]) => {
      if (!(keys instanceof Array)) keys = [keys];
      for (const key of keys) $.deleteValue(g.NAMESPACE + key);
    };

    $.get = $.oneItemSugar((items: Record<string, any>, cb: Function) => $.queueTask($.getSync, items, cb));

    $.getSync = (items: Record<string, any>, cb: Function) => {
      for (const key in items) {
        const val = $.getValue(g.NAMESPACE + key);
        if (val) {
          try {
            items[key] = dict.json(val);
          } catch (err) {
            if (!/^(?:undefined)*$/.test(val)) throw err;
          }
        }
      }
      cb(items);
    };

    $.set = $.oneItemSugar((items: Record<string, any>, cb?: Function) => {
      $.securityCheck(items);
      $.queueTask(() => {
        for (const key in items) {
          $.setValue(g.NAMESPACE + key, JSON.stringify(items[key]));
        }
        cb?.();
      });
    });

    $.clear = (cb?: Function) => {
      $.delete(Object.keys(Conf));
      $.delete(['previousversion', 'QR Size', 'QR.persona']);
      try {
        $.delete($.listValues().map((key) => key.replace(g.NAMESPACE, '')));
      } catch {}
      cb?.();
    };
  }
}

export default $;