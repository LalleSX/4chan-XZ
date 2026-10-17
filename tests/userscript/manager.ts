export type Api = 'legacy' | 'modern';

type ValueListener = (key: string, oldValue: unknown, newValue: unknown, remote: boolean) => void;
type RequestResult = {
  status: number;
  statusText: string;
  response: unknown;
  responseText: string;
  responseHeaders: string;
};
type RequestOptions = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: XMLHttpRequestResponseType;
  onload?: (response: RequestResult) => void;
  onerror?: (response: RequestResult) => void;
  onabort?: (response: RequestResult) => void;
  ontimeout?: (response: RequestResult) => void;
};

export const storagePrefix = '__userscript_test_GM__:';

// Serialized into the browser before the production bundle. Keep this function
// self-contained: imports and module variables do not exist in the page.
export function installManager({ api, prefix }: { api: Api; prefix: string }) {
  const listeners = new Map<number, { key: string; callback: ValueListener }>();
  const stats = { reads: 0, writes: 0, initEvents: 0 };
  const decode = (raw: string | null): unknown => raw === null ? undefined : JSON.parse(raw);
  const getValue = (key: string, fallback?: unknown) => {
    stats.reads++;
    const raw = localStorage.getItem(prefix + key);
    return raw === null ? fallback : decode(raw);
  };
  const notify = (key: string, oldValue: unknown, newValue: unknown, remote: boolean) => {
    for (const listener of listeners.values()) {
      if (listener.key === key) listener.callback(key, oldValue, newValue, remote);
    }
  };
  const setValue = (key: string, value: unknown) => {
    stats.writes++;
    const oldValue = decode(localStorage.getItem(prefix + key));
    localStorage.setItem(prefix + key, JSON.stringify(value));
    notify(key, oldValue, value, false);
  };
  const deleteValue = (key: string) => {
    const oldValue = decode(localStorage.getItem(prefix + key));
    localStorage.removeItem(prefix + key);
    notify(key, oldValue, undefined, false);
  };
  const listValues = () => Object.keys(localStorage)
    .filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
  window.addEventListener('storage', event => {
    if (event.key?.startsWith(prefix)) {
      notify(event.key.slice(prefix.length), decode(event.oldValue), decode(event.newValue), true);
    }
  });
  document.addEventListener('4chanXInitFinished', () => stats.initEvents++);

  // All requests still pass through Playwright's fail-closed routing. This is
  // intentionally not an implementation of real manager CORS/permission rules.
  const xmlHttpRequest = (options: RequestOptions) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? 'GET', options.url);
    xhr.timeout = options.timeout ?? 0;
    xhr.responseType = options.responseType ?? '';
    for (const [key, value] of Object.entries(options.headers ?? {})) xhr.setRequestHeader(key, value);
    const result = (): RequestResult => ({
      status: xhr.status,
      statusText: xhr.statusText,
      response: xhr.response,
      responseText: ['', 'text'].includes(xhr.responseType) ? xhr.responseText : '',
      responseHeaders: xhr.getAllResponseHeaders(),
    });
    xhr.onload = () => options.onload?.(result());
    xhr.onerror = () => options.onerror?.(result());
    xhr.onabort = () => options.onabort?.(result());
    xhr.ontimeout = () => options.ontimeout?.(result());
    xhr.send();
    return { abort: () => xhr.abort() };
  };
  const info = { scriptHandler: '4chan-XZ test harness', version: '1.0' };
  const openInTab = () => { throw new Error('Unexpected GM tab opening in userscript test'); };
  Object.assign(window, { __userscriptTest: stats, GM_info: info });
  if (api === 'modern') {
    Object.assign(window, {
      GM: {
        info,
        getValue: async (key: string, fallback?: unknown) => getValue(key, fallback),
        setValue: async (key: string, value: unknown) => setValue(key, value),
        deleteValue: async (key: string) => deleteValue(key),
        listValues: async () => listValues(),
        xmlHttpRequest,
        openInTab,
      },
    });
  } else {
    Object.assign(window, {
      GM: { info },
      GM_getValue: getValue,
      GM_setValue: setValue,
      GM_deleteValue: deleteValue,
      GM_listValues: listValues,
      GM_addValueChangeListener: (key: string, callback: ValueListener) => {
        const id = listeners.size + 1;
        listeners.set(id, { key, callback });
        return id;
      },
      GM_xmlhttpRequest: xmlHttpRequest,
      GM_openInTab: openInTab,
    });
  }
}
