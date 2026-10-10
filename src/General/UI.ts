import { Conf, d, doc } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import Header from "./Header";
import Icon from "../Icons/icon";

const dialog = (id: string, properties: Record<string, any>): HTMLElement => {
  const el = $.el('div', { className: 'dialog', id });
  $.extend(el, properties);
  el.style.cssText = Conf[`${id}.position`];

  const move = $('.move', el);
  $.on(move, 'touchstart mousedown', dragstart);
  for (const child of move.children) {
    if (child.tagName) {
      $.on(child, 'touchstart mousedown', e => e.stopPropagation());
    }
  }

  return el;
};

let currentMenu: Menu | null = null;
let lastToggledButton: HTMLElement | null = null;

class Menu {
  type: string;
  entries: any[] = [];
  menu?: HTMLElement;

  constructor(type: string) {
    this.type = type;
    // XXX AddMenuEntry event is deprecated
    $.on(d, 'AddMenuEntry', ({ detail }: any) => {
      if (detail.type !== this.type) return;
      delete detail.open;
      this.addEntry(detail);
    });
  }

  private makeMenu(): HTMLElement {
    const menu = $.el('div', {
      className: 'dialog',
      id: 'menu',
      tabIndex: 0
    });
    menu.dataset.type = this.type;
    $.on(menu, 'click', e => e.stopPropagation());
    $.on(menu, 'keydown', this.keybinds);
    return menu;
  }

  toggle(e: Event, button: HTMLElement, data: any) {
    e.preventDefault();
    e.stopPropagation();

    if (currentMenu) {
      const previousButton = lastToggledButton;
      currentMenu.close();
      if (previousButton === button) return;
    }

    if (!this.entries.length) return;
    this.open(button, data);
  }

  open(button: HTMLElement, data: any) {
    const menu = this.menu = this.makeMenu();
    currentMenu = this;
    lastToggledButton = button;

    this.entries.sort((first, second) => first.order - second.order);

    for (const entry of this.entries) {
      this.insertEntry(entry, menu, data);
    }

    $.addClass(lastToggledButton, 'active');

    $.on(d, 'click CloseMenu', this.close);
    $.on(d, 'scroll', this.setPosition);
    $.on(window, 'resize', this.setPosition);
    $.after(button, menu);

    this.setPosition();

    const entry = $('.entry', menu);
    if (entry) this.focus(entry);

    menu.focus();
  }

  setPosition = () => {
    if (!this.menu || !lastToggledButton) return;
    const mRect = this.menu.getBoundingClientRect();
    const bRect = lastToggledButton.getBoundingClientRect();
    const cHeight = doc.clientHeight;
    const cWidth = doc.clientWidth;

    const spaceBelow = bRect.bottom + mRect.height < cHeight;
    const [top, bottom] = spaceBelow
      ? [`${bRect.bottom}px`, '']
      : ['', `${cHeight - bRect.top}px`];

    const spaceRight = bRect.left + mRect.width < cWidth;
    const [left, right] = spaceRight
      ? [`${bRect.left}px`, '']
      : ['', `${cWidth - bRect.right}px`];

    Object.assign(this.menu.style, { top, right, bottom, left });
    this.menu.classList.toggle('left', !!right);
  };

  private insertEntry(entry: any, parent: HTMLElement, data: any) {
    if (typeof entry.open === 'function') {
      try {
        if (!entry.open(data)) return;
      } catch (err) {
        Main.handleErrors({
          message: `Error in building the ${this.type} menu.`,
          error: err
        });
        return;
      }
    }
    $.add(parent, entry.el);

    if (!entry.subEntries) return;

    const existing = $('.submenu', entry.el);
    if (existing) $.rm(existing);

    const submenu = $.el('div', { className: 'dialog submenu' });
    for (const subEntry of entry.subEntries) {
      this.insertEntry(subEntry, submenu, data);
    }
    $.add(entry.el, submenu);
  }

  close = () => {
    if (this.menu) $.rm(this.menu);
    delete this.menu;
    if (lastToggledButton) $.rmClass(lastToggledButton, 'active');
    currentMenu = null;
    lastToggledButton = null;
    $.off(d, 'click scroll CloseMenu', this.close);
    $.off(d, 'scroll', this.setPosition);
    $.off(window, 'resize', this.setPosition);
  };

  private findNextEntry(entry: HTMLElement, direction: number): HTMLElement | undefined {
    const entries = Array.from(entry.parentNode!.children) as HTMLElement[];
    entries.sort((a, b) => (parseFloat(a.style.order) || 100) - (parseFloat(b.style.order) || 100));
    const idx = entries.indexOf(entry);
    return entries[idx + direction];
  }

  keybinds = (e: KeyboardEvent) => {
    let entry = $('.focused', this.menu!) as HTMLElement | null;
    if (!entry) return;

    let subEntry: HTMLElement | null;
    while ((subEntry = $('.focused', entry) as HTMLElement | null)) {
      entry = subEntry;
    }

    let next: HTMLElement | undefined;
    switch (e.keyCode) {
      case 27: // Esc
        lastToggledButton?.focus();
        this.close();
        break;
      case 13:
      case 32: // Enter, Space
        entry.click();
        break;
      case 38: // Up
        next = this.findNextEntry(entry, -1);
        if (next) this.focus(next);
        break;
      case 40: // Down
        next = this.findNextEntry(entry, 1);
        if (next) this.focus(next);
        break;
      case 39: // Right
        const submenu = $('.submenu', entry);
        if (submenu && (next = submenu.firstElementChild as HTMLElement)) {
          let nextPrev: HTMLElement | undefined;
          while ((nextPrev = this.findNextEntry(next, -1))) {
            next = nextPrev;
          }
          this.focus(next);
        }
        break;
      case 37: // Left
        next = $.x('parent::*[contains(@class,"submenu")]/parent::*', entry) as HTMLElement;
        if (next) this.focus(next);
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
  };

  onFocus = (e: Event) => {
    e.stopPropagation();
    this.focus(e.target as HTMLElement);
  };

  private focus(entry: HTMLElement) {
    let focused: HTMLElement | null;
    while ((focused = $.x('parent::*/child::*[contains(@class,"focused")]', entry) as HTMLElement | null)) {
      $.rmClass(focused, 'focused');
    }
    for (const f of $$('.focused', entry)) {
      $.rmClass(f, 'focused');
    }
    $.addClass(entry, 'focused');

    const submenu = $('.submenu', entry);
    if (!submenu) return;

    const sRect = submenu.getBoundingClientRect();
    const eRect = entry.getBoundingClientRect();
    const cHeight = doc.clientHeight;
    const cWidth = doc.clientWidth;

    const [top, bottom] = eRect.top + sRect.height < cHeight
      ? ['0px', 'auto']
      : ['auto', '0px'];

    const [left, right] = eRect.right + sRect.width < cWidth - 150
      ? ['100%', 'auto']
      : ['auto', '100%'];

    Object.assign(submenu.style, { top, bottom, left, right });
  }

  addEntry = (entry: any) => {
    this.parseEntry(entry);
    this.entries.push(entry);
  };

  private parseEntry(entry: any) {
    const { el, subEntries } = entry;
    $.addClass(el, 'entry');
    $.on(el, 'focus mouseover', this.onFocus);
    el.style.order = String(entry.order || 100);
    if (!subEntries) return;
    $.addClass(el, 'has-submenu');
    for (const subEntry of subEntries) {
      this.parseEntry(subEntry);
    }
    const span = $.el('span', { className: 'menu-indicator' });
    Icon.set(span, 'caretRight');
    $.add(el, span);
  }
}

export const dragstart = function (this: HTMLElement, e: MouseEvent | TouchEvent) {
  if (e.type === 'mousedown' && (e as MouseEvent).button !== 0) return;
  e.preventDefault();

  let isTouching = false;
  let clientX: number, clientY: number, identifier: number | undefined;
  if (e.type === 'touchstart') {
    isTouching = true;
    const touch = (e as TouchEvent).changedTouches[(e as TouchEvent).changedTouches.length - 1];
    clientX = touch.clientX;
    clientY = touch.clientY;
    identifier = touch.identifier;
  } else {
    clientX = (e as MouseEvent).clientX;
    clientY = (e as MouseEvent).clientY;
  }

  const el = $.x('ancestor::div[contains(@class,"dialog")][1]', this) as HTMLElement;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const screenHeight = doc.clientHeight;
  const screenWidth = doc.clientWidth;

  const o = {
    id: el.id,
    style: el.style,
    dx: clientX - rect.left,
    dy: clientY - rect.top,
    height: screenHeight - rect.height,
    width: screenWidth - rect.width,
    screenHeight,
    screenWidth,
    isTouching,
    topBorder: 0,
    bottomBorder: 0,
    identifier,
    move: null as any,
    up: null as any
  };

  if (!(Conf['Header auto-hide'] || !Conf['Fixed Header'])) {
    const headerHeight = Header.bar.getBoundingClientRect().height;
    if (Conf['Bottom Header']) {
      o.bottomBorder = headerHeight;
    } else {
      o.topBorder = headerHeight;
    }
  }

  if (isTouching) {
    o.move = touchmove.bind(o);
    o.up = touchend.bind(o);
    $.on(d, 'touchmove', o.move);
    $.on(d, 'touchend touchcancel', o.up);
  } else {
    o.move = drag.bind(o);
    o.up = dragend.bind(o);
    $.on(d, 'mousemove', o.move);
    $.on(d, 'mouseup', o.up);
  }
};

export const touchmove = function (this: any, e: TouchEvent) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === this.identifier) {
      drag.call(this, touch);
      return;
    }
  }
};

export const drag = function (this: any, e: { clientX: number; clientY: number }) {
  const { clientX, clientY } = e;

  let left: string | number = clientX - this.dx;
  left = left < 10
    ? 0
    : (this.width - left) < 10
      ? ''
      : `${(left / this.screenWidth) * 100}%`;

  let top: string | number = clientY - this.dy;
  top = top < (10 + this.topBorder)
    ? `${this.topBorder}px`
    : (this.height - top) < (10 + this.bottomBorder)
      ? ''
      : `${(top / this.screenHeight) * 100}%`;

  const right = left === '' ? 0 : '';
  const bottom = top === '' ? `${this.bottomBorder}px` : '';

  Object.assign(this.style, { left, right, top, bottom });
};

export const touchend = function (this: any, e: TouchEvent) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === this.identifier) {
      dragend.call(this);
      return;
    }
  }
};

export const dragend = function (this: any) {
  if (this.isTouching) {
    $.off(d, 'touchmove', this.move);
    $.off(d, 'touchend touchcancel', this.up);
  } else {
    $.off(d, 'mousemove', this.move);
    $.off(d, 'mouseup', this.up);
  }

  if (this.style.length === 2) {
    $.set(`${this.id}.position`, this.style.cssText);
  } else {
    const { left, right, top, bottom } = this.style;
    let position = '';
    if (left) position += `left:${left};`;
    if (right) position += `right:${right};`;
    if (top) position += `top:${top};`;
    if (bottom) position += `bottom:${bottom};`;
    $.set(`${this.id}.position`, position);
  }
};

interface HoverState {
  root: HTMLElement;
  el: HTMLElement;
  style: CSSStyleDeclaration;
  isImage: boolean;
  cb?: Function;
  endEvents: string;
  latestEvent: MouseEvent;
  clientHeight: number;
  clientWidth: number;
  height?: number;
  width?: number;
  noRemove?: boolean;
  clientX: number;
  clientY: number;
  hover: (e: MouseEvent) => void;
  hoverend: (e: Event) => void;
  workaround: (e: MouseEvent) => void;
}

const hoverstart = function ({ root, el, latestEvent, endEvents, height, width, cb, noRemove }: any) {
  const rect = root.getBoundingClientRect();
  const o: HoverState = {
    root,
    el,
    style: el.style,
    isImage: ['IMG', 'VIDEO'].includes(el.nodeName),
    cb,
    endEvents,
    latestEvent,
    clientHeight: doc.clientHeight,
    clientWidth: doc.clientWidth,
    height,
    width,
    noRemove,
    clientX: (rect.left + rect.right) / 2,
    clientY: (rect.top + rect.bottom) / 2,
    hover: null as any,
    hoverend: null as any,
    workaround: null as any
  };
  o.hover = hover.bind(o);
  o.hoverend = hoverend.bind(o);

  o.hover(o.latestEvent);

  new MutationObserver(() => {
    if (el.parentNode) o.hover(o.latestEvent);
  }).observe(el, { childList: true });

  $.on(root, endEvents, o.hoverend);
  if ($.x('ancestor::div[contains(@class,"inline")][1]', root)) {
    $.on(d, 'keydown', o.hoverend);
  }
  $.on(root, 'mousemove', o.hover);

  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=674955
  o.workaround = (e: MouseEvent) => {
    if (!root.contains(e.target as Node)) o.hoverend(e);
  };
  $.on(doc, 'mousemove', o.workaround);
};

hoverstart.padding = 25;

export const hover = function (this: HoverState, e: MouseEvent) {
  this.latestEvent = e;
  const height = (this.height ?? this.el.offsetHeight) + hoverstart.padding;
  const width = this.width ?? this.el.offsetWidth;
  const { clientX, clientY } = Conf['Follow Cursor'] ? e : this;

  const top = this.isImage
    ? Math.max(0, (clientY * (this.clientHeight - height)) / this.clientHeight)
    : Math.max(0, Math.min(this.clientHeight - height, clientY - 120));

  let threshold = this.clientWidth / 2;
  if (!this.isImage) threshold = Math.max(threshold, this.clientWidth - 400);
  let marginX = (clientX <= threshold ? clientX : this.clientWidth - clientX) + 45;
  if (this.isImage) marginX = Math.min(marginX, this.clientWidth - width);
  const marginXStr = marginX + 'px';
  const [left, right] = clientX <= threshold ? [marginXStr, ''] : ['', marginXStr];

  Object.assign(this.style, {
    top: top + 'px',
    left,
    right
  });
};

export const hoverend = function (this: HoverState, e: Event) {
  if ((e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) || (e.target as HTMLElement).nodeName === 'TEXTAREA') return;
  if (!this.noRemove) $.rm(this.el);
  $.off(this.root, this.endEvents, this.hoverend);
  $.off(d, 'keydown', this.hoverend);
  $.off(this.root, 'mousemove', this.hover);
  $.off(doc, 'mousemove', this.workaround);
  if (this.cb) this.cb.call(this);
};

export const checkbox = (name: string, text: string, checked?: boolean): HTMLElement => {
  if (checked == null) checked = Conf[name];
  const label = $.el('label');
  const input = $.el('input', { type: 'checkbox', name, checked });
  $.add(label, [input, $.tn(` ${text}`)]);
  return label;
};

const UI = {
  dialog,
  Menu,
  hover: hoverstart,
  checkbox
};

export default UI;
