import $ from "../platform/$";

const compareNumericKeys = (lastKey: string, key: string | number): boolean => (+lastKey) < (+key);

export default class SimpleDict<T> {
  keys: string[];

  constructor() {
    this.keys = [];
  }

  push(key: string | number, data: T): void {
    const keyString = `${key}`;
    if (!$.hasOwn(this, keyString)) { this.keys.push(keyString); }
    this[keyString] = data;
  }

  /**
   * Inserts at the right place. Assumes the keys are numeric and already sorted ascending.
   * @returns The index where the item was inserted.
   */
  insert(key: number, data: T): number;
  /**
   * Inserts at the right place. Assumes the keys are already sorted ascending.
   * @param compare A function to compare the keys. Should return true if the given key is bigger than the one compared
   * to, and false otherwise. Defaults to a numeric comparison.
   * @returns The index where the item was inserted.
   */
  insert(key: string | number, data: T, compare: (lastKey: string, key: string | number) => boolean): number;
  insert(key: string | number, data: T, compare = compareNumericKeys): number {
    const keyString = key.toString();
    if (keyString in this) {
      this[keyString] = data;
      return this.keys.indexOf(keyString);
    }

    const length = this.keys.length;
    if (!length || compare(this.lastKey(), key)) {
      this.push(key, data);
      return length;
    }

    // Global post keys can interleave boards. Preserve the first matching key
    // for caller-supplied comparisons, even when that order is not monotonic.
    if (compare !== compareNumericKeys) {
      const index = this.keys.findIndex(k => !compare(k, key));
      if (index === -1) {
        this.push(key, data);
      } else {
        this[keyString] = data;
        this.keys.splice(index, 0, keyString);
      }
      return index;
    }

    // Find the insertion point without scanning every preceding key.
    let low = 0;
    let high = length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (compare(this.keys[middle], key)) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    this[keyString] = data;
    this.keys.splice(low, 0, keyString);
    return low;
  }

  insertAt(key: string, index: number, data: T): void {
    this[key] = data;
    this.keys.splice(index, 0, key);
  }

  rm(key: string | number): void {
    let i;
    key = `${key}`;
    if ((i = this.keys.indexOf(key)) !== -1) {
      this.keys.splice(i, 1);
      delete this[key];
    }
  }

  forEach(fn: (data: T) => void): void {
    for (const key of this.keys) { fn(this[key]); }
  }

  get(key: string | number): T | undefined {
    if (key === 'keys') {
      return undefined;
    } else {
      return $.getOwn(this, key);
    }
  }

  lastKey(): string | undefined {
    return this.keys[this.keys.length - 1];
  }

  last(): T | undefined {
    return this.keys.length ? this.get(this.lastKey()) : undefined;
  }
}
