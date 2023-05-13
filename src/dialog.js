import { $, noop, Time, isNullish, isEmpty, sleep, createElement, bindOnClick } from './utils.js';

const { body } = document;
const template = $('dialog_template');

export class Dialog {
  constructor(options) {
    this.closed = false;
    this._options = Object.assign({
      cancellable: true,
    }, options);
    [this._container] = template.content.cloneNode(true).children;
    [this._mask, this._box] = this._container.children;
    [this._title, this._content, this._buttons] = this._box.children;
    this._options.cancellable && bindOnClick(this._mask, () => this.close());
    this.button('确定');
    this._buttons.children[0].classList.add('full_width');
  }

  title(text) {
    this._title.innerText = text;
    return this;
  }

  content(content, html = false) {
    if (typeof content === 'string') {
      if (html) this._content.innerHTML = content;
      else this._content.innerText = content;
    } else {
      this._content.appendChild(content);
    }
    return this;
  }

  button(text, func = noop) {
    if (!isEmpty(this._buttons.children)) {
      this._buttons.children[0].innerText = '返回';
      this._buttons.children[0].classList.remove('full_width');
    }
    const close = this.close.bind(this);
    const button = createElement({
      tag: 'span',
      classList: ['button'],
      text
    });
    bindOnClick(button, async event => await func.call(this, close) !== false && await close());
    this._buttons.appendChild(button);
    return this;
  }

  show() {
    body.appendChild(this._container);
    sleep(0.1 * Time.second).then(() => {
      this._container.classList.remove('hidden');
    });
    return this;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    return new Promise(resolve => {
      this._container.classList.add('hidden');
      sleep(0.5 * Time.second).then(() => {
        body.removeChild(this._container);
        resolve();
      });
    });
  }

  getButton(index) {
    const button = this._buttons.children[index];
    return {
      button,
      enable() { button.classList.remove('disable'); },
      disable() { button.classList.add('disable'); },
      setText(text) { button.innerText = text; }
    };
  }

  static show(content, title, options) {
    return new Dialog(options).title(title).content(content).show();
  }

  static message(content, options) {
    return Dialog.show(content, '信息', options);
  }

  static notice(content, options) {
    return Dialog.show(content, '提示', options);
  }

  static error(content, options) {
    return Dialog.show(content, '错误', Object.assign({ cancellable: false }, options));
  }
}

export default Dialog;