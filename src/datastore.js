import { isNullish } from './utils.js';

export class Datastore {
  _prefix;
  _storage = localStorage;

  constructor(prefix) {
    this._prefix = prefix;
  }

  _realKey(key) {
    return `${key.startsWith(this._prefix) ? '' : this._prefix}${key}`;
  }

  _getData(realKey) {
    return JSON.parse(this._storage.getItem(realKey));
  }

  set(key, value, { fallback, expires } = {}) {
    const realKey = this._realKey(key);
    const old = this._getData(realKey);
    const data = {
      value,
      time: Date.now()
    };
    if (fallback) data.fallback = fallback;
    if (expires) data.expires = expires;
    this._storage.setItem(realKey,
      JSON.stringify(Object.assign(isNullish(old) ? {} : old, data)));
    return value;
  }

  get(key) {
    const realKey = this._realKey(key);
    const { value, time, fallback, expires } = this._getData(realKey) || {};
    if (expires && time + expires <= Date.now()) {
      this._storage.removeItem(realKey);
      return null;
    }
    return isNullish(value) ? fallback : value;
  }

  getAll() {
    const s = this._storage;
    const data = {};
    Array.from({ length: s.length }, (_, index) => s.key(index))
      .filter(key => key.startsWith(this._prefix))
      .forEach(key => data[key.replace(this._prefix, '')] = JSON.parse(s.getItem((key))));
    return JSON.stringify(data) === '{}' ? null : data;
  }

  has(key) {
    const realKey = this._realKey(key);
    return !!this._storage.getItem(realKey);
  }

  remove(key) {
    const realKey = this._realKey(key);
    this._storage.removeItem(realKey);
  }

  reset() {
    const s = this._storage;
    Array.from({ length: s.length }, (_, index) => s.key(index))
      .filter(key => key.startsWith(this._prefix))
      .forEach(key => this.set(key, s.getItem(key)?.fallback ?? null));
  }

  clear() {
    const s = this._storage;
    Array.from({ length: s.length }, (_, index) => s.key(index))
      .filter(key => key.startsWith(this._prefix))
      .forEach(key => s.removeItem(key));
  }
}

export default Datastore;