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