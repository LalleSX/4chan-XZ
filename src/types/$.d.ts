import SimpleDict from '../classes/SimpleDict';

export interface ElementProperties {
  [key: string]: any;
}
interface AjaxPageOptions {
  onloadend?: (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void;
  timeout?: number;
  responseType?: XMLHttpRequestResponseType;
  withCredentials?: boolean;
  type?: string;
  onprogress?: (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void;
  form?: FormData;
  headers?: Record<string, string>;
}
export interface LastModified {
  [bucket: string]: { [url: string]: string | undefined };
}
export interface WhenModifiedOptions {
  timeout?: number;
  ajax?: (url: string, settings?: AjaxPageOptions) => Promise<string>;
}

declare global {
  interface JQueryStatic {
    engine?: string;
    lastModified: LastModified;
    whenModified: (
      url: string,
      bucket: string,
      cb: (this: JQueryXHR) => void,
      options?: WhenModifiedOptions
    ) => JQueryXHR;
  }
}
export type Dict = { [key: string]: any };
export interface SyncObject {
  deleteValue: (key: string) => void;
  oldValue?: Dict;
  syncing?: Dict;
  hasStorage?: boolean;
  cantSync?: boolean;
  cantSet?: boolean;
}
