export interface ListData {
  ID?: string | number;
  id?: string | number;
}

export interface ListItem<T> {
  prev?: ListItem<T> | null;
  next?: ListItem<T> | null;
  data: T;
  ID: string | number;
}

export default class RandomAccessList<T extends ListData = ListData> {
  declare length: number;
  declare first: ListItem<T> | null | undefined;
  declare last: ListItem<T> | null | undefined;

  constructor(items?: Iterable<T>) {
    this.length = 0;
    if (items) { for (const item of items) { this.push(item); } }
  }

  push(data: T): number | undefined {
    let item: ListItem<T>;
    let {ID} = data;
    if (!ID) { ID = data.id; }
    if (this[ID]) { return; }
    const {last} = this;
    this[ID] = (item = {
      prev: last,
      next: null,
      data,
      ID
    });
    this.last = last ?
      (last.next = item)
    :
      (this.first = item);
    return this.length++;
  }

  before(root: ListItem<T>, item: ListItem<T>): ListItem<T> | undefined {
    if ((item.next === root) || (item === root)) { return; }

    this.rmi(item);

    const {prev} = root;
    root.prev = item;
    item.next = root;
    item.prev = prev;
    if (prev) {
      return prev.next = item;
    } else {
      return this.first = item;
    }
  }

  after(root: ListItem<T>, item: ListItem<T>): ListItem<T> | undefined {
    if ((item.prev === root) || (item === root)) { return; }

    this.rmi(item);

    const {next} = root;
    root.next = item;
    item.prev = root;
    item.next = next;
    if (next) {
      return next.prev = item;
    } else {
      return this.last = item;
    }
  }

  prepend(item: ListItem<T>): boolean | undefined {
    const {first} = this;
    if ((item === first) || !this[item.ID]) { return; }
    this.rmi(item);
    item.next  = first;
    if (first) {
      first.prev = item;
    } else {
      this.last = item;
    }
    this.first = item;
    return delete item.prev;
  }

  shift(): boolean | undefined {
    return this.first ? this.rm(this.first.ID) : undefined;
  }

  order(): ListItem<T>[] {
    const order: ListItem<T>[] = [];
    for (let item = this.first; item; item = item.next) { order.push(item); }
    return order;
  }

  rm(ID: string | number): boolean | undefined {
    const item: ListItem<T> = this[ID];
    if (!item) { return; }
    delete this[ID];
    this.length--;
    this.rmi(item);
    delete item.next;
    return delete item.prev;
  }

  rmi(item: ListItem<T>): ListItem<T> | null | undefined {
    const {prev, next} = item;
    if (prev) {
      prev.next = next;
    } else {
      this.first = next;
    }
    if (next) {
      return next.prev = prev;
    } else {
      return this.last = prev;
    }
  }
}
