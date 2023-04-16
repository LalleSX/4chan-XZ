import $ from '../platform/$';
import { g } from '../globals/globals';

interface Callbacks {
  [key: string]: (value: any) => void;
}

export default class Connection {
  private target: Window | HTMLIFrameElement;
  private origin: string;
  private cb: Callbacks;
  
  constructor(target: Window | HTMLIFrameElement, origin: string, cb: Callbacks = {}) {
    this.send = this.send.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.target = target;
    this.origin = origin;
    this.cb = cb;
    $.on(window, 'message', this.onMessage);
  }

  private targetWindow(): Window {
    if (this.target instanceof window.HTMLIFrameElement) {
      return this.target.contentWindow;
    } else {
      return this.target;
    }
  }

  public send(data: any): void {
    return this.targetWindow().postMessage(
      `${g.NAMESPACE}${JSON.stringify(data)}`,
      this.origin,
    );
  }

  private onMessage(e: MessageEvent): void {
    if (
      e.source !== this.targetWindow() ||
      e.origin !== this.origin ||
      typeof e.data !== 'string' ||
      e.data.slice(0, g.NAMESPACE.length) !== g.NAMESPACE
    ) {
      return;
    }
    const data = JSON.parse(e.data.slice(g.NAMESPACE.length));
    for (const type in data) {
      const value = data[type];
      if ($.hasOwn(this.cb, type)) {
        this.cb[type](value);
      }
    }
  }
}
