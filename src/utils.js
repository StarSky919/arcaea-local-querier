export const $ = id => document.getElementById(id);
Node.prototype.$ = function(selector) {
  try {
    const nodes = this.querySelectorAll(selector);
    return nodes.length > 1 ? nodes : nodes[0];
  } catch (e) {
    return null;
  }
}

export function noop() {}

const p0 = (num, length = 2) => num.toString().padStart(length, '0');
const millisecond = 1;
const second = 1000;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
export const Time = {
  millisecond,
  second,
  minute,
  hour,
  day,
  week,
  template(template, timestamp) {
    const time = new Date(timestamp);
    return template
      .replace('yyyy', time.getFullYear().toString())
      .replace('yy', time.getFullYear().toString().slice(2))
      .replace('MM', p0(time.getMonth() + 1))
      .replace('dd', p0(time.getDate()))
      .replace('hh', p0(time.getHours()))
      .replace('mm', p0(time.getMinutes()))
      .replace('ss', p0(time.getSeconds()))
      .replace('SSS', p0(time.getMilliseconds(), 3));
  },
  formatTimeInterval(ms) {
    const abs = Math.abs(ms);
    if (abs >= day - hour / 2) {
      return Math.round(ms / day) + 'd';
    } else if (abs >= hour - minute / 2) {
      return Math.round(ms / hour) + 'h';
    } else if (abs >= minute - second / 2) {
      return Math.round(ms / minute) + 'm';
    } else if (abs >= second) {
      return Math.round(ms / second) + 's';
    }
    return ms + 'ms';
  }
}

function getTag(source) {
  return Object.prototype.toString.call(source);
}

export function isNullish(source) {
  return source === void 0 || source === null;
}

export function isNumber(source) {
  const value = +source;
  return Number.isFinite(value);
}

export function isString(source) {
  return typeof source === 'string';
}

export function isFunction(source) {
  return typeof source === 'function';
}

export function isObject(source) {
  return typeof source === 'object';
}

export function isRegExp(source) {
  return getTag(source) === '[object RegExp]';
}

export function isMap(source) {
  return getTag(source) === '[object Map]';
}

export function isSet(source) {
  return getTag(source) === '[object Set]';
}

export function isArray(source) {
  return Array.isArray(source);
}

export function isEmpty(source) {
  if (isString(source) || isArray(source)) return !source.length;
  if (isMap(source) || isSet(source)) return !source.size;
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return false
    }
  }
  return true;
}

export function* range(min, max, step = 1) {
  if (max === void 0) max = min, min = 0;
  for (let i = min; i < max; i += step) {
    yield i;
  }
}

export function* enumerate(iterable) {
  let i = 0;
  for (const value of iterable) {
    yield [i++, value];
  }
}

export function staggeredMerge(target, offset, ...sources) {
  const result = [];
  result.push(...target.splice(0, offset));
  const maxCount = Math.max(target.length, ...sources.reduce((p, c) => {
    p.push(c.length);
    return p;
  }, []));
  for (const i of range(maxCount)) {
    for (const arr of [target, ...sources]) {
      result.push(arr[i] ?? null);
    }
  }
  return result;
}

export function random(min, max) {
  return () => Math.round(Math.random() * (max - min) + min);
}

export function rounding(num, digit = 0) {
  return +(Math.round(num * (10 ** digit)) / 10 ** digit).toFixed(digit);
}

export function flooring(num, digit = 0) {
  return +(Math.floor(num * (10 ** digit)) / 10 ** digit).toFixed(digit);
}

export function sleep(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay);
  });
}

export function debounce(callback, delay) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    const [that, args] = [this, arguments];
    timeout = setTimeout(function() {
      callback.apply(that, args);
      clearTimeout(timeout);
      timeout = null;
    }, delay);
  }
}

export function throttle(callback, delay) {
  let timer;
  return function() {
    if (timer) { return; }
    const [that, args] = [this, arguments];
    timer = setTimeout(function() {
      clearTimeout(timer);
      timer = null;
      callback.apply(that, args);
    }, delay);
  }
}

export function createElement({ tag, id, classList, attr, style, cssText, text, html }) {
  const el = document.createElement(tag);
  id && (el.id = id);
  classList && el.classList.add(...classList);
  attr && Object.keys(attr).forEach(name => el.setAttribute(name, attr[name]));
  style && Object.keys(style).forEach(name => el.style[name] = style[name]);
  cssText && (el.style.cssText += cssText);
  text && (el.innerText = text);
  html && (el.innerHTML = html);
  return el;
}

export function clearChildNodes(node) {
  for (let i = node.childNodes.length; i--;) node.removeChild(node.childNodes[i]);
}

export function compile(node, data) {
  const pattern = /\{\{\s*(\S+)\s*\}\}/;
  if (node.nodeType === 3) {
    let result;
    while (result = pattern.exec(node.nodeValue)) {
      const key = result[1];
      const value = key.split('.').reduce((p, c) => p[c], data);
      node.nodeValue = node.nodeValue.replace(pattern, value);
    }
    return;
  }
  node.childNodes.forEach(node => compile(node, data));
  return node;
}

export function bindOnClick(el, func) {
  if (typeof el === 'string') el = $(el);
  el.addEventListener('click', func);
}

export async function loadJSON(url, errMsg) {
  return await fetch(url).then(res => res.json())
    .catch(err => errMsg && Dialog.error(errMsg));
}