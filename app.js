import '/lib/kana-1.0.7.js';
import { VERSION } from '/src/constants.js';
import {
  $,
  $$,
  Time,
  isNullish,
  isEmpty,
  rounding,
  inRange,
  range,
  staggeredMerge,
  throttle,
  sleep,
  bindOnClick,
  compile,
  createElement,
  clearChildNodes,
  loadJSON,
  downloadFile
} from '/src/utils.js';
import { generate } from '/src/generator.js';
import Datastore from '/src/datastore.js';
import { Dialog, ItemSelectorDialog } from '/src/dialog.js';

try {
  localStorage.setItem('test', true);
  localStorage.removeItem('test');
} catch (err) {
  Dialog.show('localStorage API发生错误！\n如果您打开了浏览器的无痕（隐私）模式，\n请将它关闭并刷新页面。', '错误');
}

window.log = console.log;
window.alqSettings = new Datastore('alqs:');

$('version').innerText = `v${VERSION.join('.')}`;
window.addEventListener('error', err => {
  Dialog.error(`发生了错误！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err.message}\n(${err.filename}:${err.lineno}:${err.colno})`)
}, true);
window.addEventListener('unhandledrejection', err => {
  Dialog.error(`发生了错误！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err.reason}`);
});

let changelog;
bindOnClick('about_website', event => {
  new Dialog()
    .title('关于本站')
    .content('一个简易的Arcaea查分器，\n以获取本地存档的形式进行Best 30查询。\n配合修改版客户端使用体验最佳！\n\n开发者：StarSky919\nB站：starsky919，QQ群：486908465')
    .button('更新日志', async close => {
      if (!changelog) changelog = await fetch('changelog.txt').then(res => res.text());
      close();
      new Dialog().title('更新日志')
        .content(changelog).show();
      return false;
    }).show();
});

async function main(SQL) {
  const fontLoader = createElement('div', {
    style: {
      visibility: 'hidden',
      position: 'fixed',
      top: 0,
      'font-family': 'CeraPro',
      'pointer-events': 'none',
      'user-select': 'none'
    },
    innerHTML: 'Test<strong>Test</strong>'
  })
  document.body.appendChild(fontLoader);

  const playerInfo = $('player_info');
  const searchContainer = $('search_container');
  const searchBox = $('search_box');
  const searchMask = $('search_mask');
  const searchInput = $('search');
  const resultBox = $('result_box');
  const recordList = $('record_list');
  const recordBoxTemplate = $('record_box_template');
  const resultItemTemplate = $('result_item_template');
  const dbFileInput = $('dbFile');

  const { packs } = await loadJSON('/assets/packlist.json', '曲包数据加载失败，请尝试刷新网页！');
  const { songs } = await loadJSON('/assets/songlist.json', '歌曲数据加载失败，请尝试刷新网页！');
  const { consts } = await loadJSON('/assets/constants.json', '定数表加载失败，请尝试刷新网页！');

  function getTitle({ en, ja }) {
    return ja || en;
  }

  function formatText(source) {
    return source.toHankakuCase().toZenkanaCase().toHiraganaCase().toLowerCase();
  }

  function sortTitles(titles) {
    return [titles.ja, titles.en, titles['zh-Hans'], titles['zh-Hant'], titles.kr].filter(title => !isNullish(title));
  }

  function isTitleMatched(input, titles) {
    const result = [];
    const { length } = input;
    input = formatText(input);
    let title;
    for (title of sortTitles(titles)) {
      const _title = formatText(title);
      let i = 0,
        j = 0;
      while (true) {
        i = _title.indexOf(input, j);
        if (i > -1) {
          result.push(i);
          j += i + length;
        } else break;
      }
      if (!isEmpty(result)) break;
    }
    return isEmpty(result) ? null : { title, result, inputLength: length, titleLength: title.length };
  }

  function formatScore(score = '') {
    const text = score.toString().padStart(8, '0');
    let result = "";
    for (let i = text.length - 1, j = 1; i >= 0; i--, j++) {
      if (j % 3 === 0 && i !== 0) {
        result += text[i] + "'";
        continue;
      }
      result += text[i];
    }
    return result.split('').reverse().join("");
  }

  function getDifficultyName(difficulty) {
    return ['Past', 'Present', 'Future', 'Beyond'][difficulty];
  }

  function getRating(constant, score) {
    if (score > 1e7) {
      return constant + 2.0;
    } else if (score > 98e5) {
      return constant + 1.0 + (score - 98e5) / 2e5;
    } else {
      return Math.max(constant + (score - 95e5) / 3e5, 0);
    }
  }

  function getRank(score) {
    for (const [s, r] of [[86e5, 'D'], [89e5, 'C'], [92e5, 'B'], [95e5, 'A'], [98e5, 'AA'], [99e5, 'EX']]) {
      if (score < s) return r;
    }
    return 'EX+';
  }

  function getClearType(clearType) {
    return ['Track Lost', 'Normal Clear', 'Full Recall', 'Pure Memory', 'Easy Clear', 'Hard Clear'][clearType]
  }

  function getSortMethod(order = 0) {
    return [(a, b) => b.rating - a.rating, (a, b) => b.constant - a.constant, (a, b) => Math.min(b.score, 1e7) - Math.min(a.score, 1e7)][order];
  }

  const searchFn = throttle(event => {
    const input = searchInput.value;
    clearChildNodes(resultBox);
    if (!input) return;
    const results = [];
    for (const i of range(recordList.childNodes.length)) {
      const recordBox = recordList.childNodes[i];
      const { songid, difficulty } = recordBox.dataset;
      if (isNullish(songid) || isNullish(difficulty)) continue;
      const { title_localized, difficulties } = songs.find(({ id }) => id === songid);
      const data = { node: recordBox };
      if (input === songid) {
        data.priority = 999;
      } else if (difficulties[difficulty].title_localized) {
        if (data.matchedIndexes = isTitleMatched(input, difficulties[difficulty].title_localized)) data.priority = 99;
      } else if (data.matchedIndexes = isTitleMatched(input, title_localized)) {
        data.priority = 99;
      }
      if (data.priority) results.push(data);
    }
    results.sort((a, b) => b.priority - a.priority);
    resultBox.appendChild(createElement('div', { classList: ['result_item'], innerText: isEmpty(results) ? '搜索无结果。' : `搜索到 ${results.length} 条记录（点击可跳转）：` }));
    const resultFrag = document.createDocumentFragment();
    for (const { node, matchedIndexes } of results) {
      const [resultItem] = resultItemTemplate.content.cloneNode(true).children;
      const item = compile(resultItem, {
        ranking: node.$$('.ranking').innerText,
        details: `${node.$$('.score_display').innerText} - ${node.$$('.rating').innerText}`
      });
      if (matchedIndexes) {
        const { title, result, inputLength, titleLength } = matchedIndexes;

        const indexes = [];
        for (const index of result) indexes.push(index + inputLength);
        const finalIndexes = staggeredMerge(result, 0, indexes);
        if (finalIndexes[0] > 0) finalIndexes.unshift(0);
        if (finalIndexes[finalIndexes.length - 1] < titleLength) finalIndexes.push(titleLength);

        const splitChars = [];
        for (const i of range(finalIndexes.length)) {
          const idx = finalIndexes[i];
          const idxNext = finalIndexes[i + 1];
          if (isNullish(idxNext)) break;
          const split = title.slice(idx, idxNext);
          splitChars.push({ split, matched: result.includes(idx) });
        }

        const titleFrag = document.createDocumentFragment();
        for (const { split, matched } of splitChars) {
          titleFrag.appendChild(createElement('span', { classList: [matched ? 'matched' : 'not_matched'], innerText: split }));
        }
        item.$$('.title').appendChild(titleFrag);
      } else item.$$('.title').innerText = node.$$('.title').innerText;
      item.onclick = event => {
        window.scrollTo({
          top: node.offsetTop + node.offsetHeight * 0.5 - window.innerHeight / 2,
          behavior: 'smooth'
        });

      }
      resultFrag.appendChild(item);
    };
    resultBox.appendChild(resultFrag);
  }, Time.second * 0.2);

  searchInput.addEventListener('input', searchFn);

  function renderRecords() {
    clearChildNodes(recordList);
    if (isNullish(window.scores)) return;
    const sortOrder = alqSettings.get('sort_order') || 0;
    const difficultyFilter = alqSettings.get('difficulty_filter') || [];
    const constantFilter = alqSettings.get('constant_filter') || [];
    const records = window.scores.slice();
    const b30 = records.slice(0, 30);
    const b30avg = b30.reduce((total, record) => total + record.rating, 0) / 30;
    const maxptt = (b30avg * 30 + b30.slice(0, 10).reduce((total, record) => total + record.rating, 0)) / 40;
    let finalRecords = records;
    if (!isEmpty(difficultyFilter)) finalRecords = finalRecords.filter(({ songDifficulty }) => difficultyFilter.includes(songDifficulty));
    if (!isEmpty(constantFilter)) {
      const [min, max] = constantFilter;
      finalRecords = finalRecords.filter(({ constant }) => inRange(constant, min, max));
    }
    finalRecords.sort(getSortMethod(sortOrder))
    const recordFrag = document.createDocumentFragment();
    for (const record of finalRecords) {
      const song = songs.find(({ id }) => id === record.songId);
      if (isNullish(song)) continue;
      const { id, title_localized, artist, difficulties } = song;
      const difficulty = difficulties[record.songDifficulty];
      const data = Object.assign({}, record, {
        title: difficulty.title_localized ? getTitle(difficulty.title_localized) : getTitle(title_localized),
        artist: difficulty.artist || artist
      });
      const [recordBox] = recordBoxTemplate.content.cloneNode(true).children;
      recordBox.dataset.songid = id;
      recordBox.dataset.difficulty = record.songDifficulty;
      recordFrag.appendChild(compile(recordBox, data));
    }
    while (recordFrag.children.length % 3) {
      const [recordBox] = recordBoxTemplate.content.cloneNode(true).children;
      recordFrag.appendChild(compile(recordBox, {
        ranking: -1,
        title: 'PLACEHOLDER',
        artist: '--',
        scoreDisplay: '00\'000\'000',
        rank: '--',
        difficultyName: '--',
        constant: 0,
        ratingDisplay: 0,
        clearTypeDisplay: '--',
        perfectCount: 0,
        shinyPerfectCount: 0,
        nearCount: 0,
        missCount: 0
      }));
    }
    recordList.appendChild(recordFrag);
    $('b30_average').innerText = rounding(b30avg, 4);
    $('max_potential').innerText = rounding(maxptt, 4);
    searchContainer.classList.remove('hidden');
    playerInfo.classList.remove('hidden');
    searchInput.value = '';
    searchFn();
  }

  function importData(scores, autoRendering = true) {
    if (!scores) return;
    const noConst = [];
    const noData = [];
    for (const i of range(scores.length)) {
      const { songId, songDifficulty, clearType, score } = scores[i];
      const scoreDisplay = formatScore(score);
      const rank = getRank(score);
      const clearTypeDisplay = getClearType(clearType);
      const difficultyName = getDifficultyName(songDifficulty);
      const { constant } = isNullish(consts[songId]) ? { constant: -1 } : consts[songId][songDifficulty];
      if (constant < 0) {
        noData.push(`${songId} (${difficultyName})`);
      } else if (constant === 0) {
        const { title_localized, difficulties } = songs.find(({ id }) => id === songId);
        const title = getTitle(difficulties[songDifficulty].title_localized || title_localized);
        noConst.push(`${title} (${difficultyName})`);
      }
      const rating = getRating(constant, score);
      const ratingDisplay = rounding(rating, 4);
      Object.assign(scores[i], { scoreDisplay, rank, clearTypeDisplay, difficultyName, constant, rating, ratingDisplay });
    }
    window.scores = scores.sort((a, b) => b.rating - a.rating);
    window.scores.forEach((record, index) => record.ranking = index + 1);
    if (!isEmpty(noData)) Dialog.show(`无法识别以下记录，若其中包含非愚人节曲目，请截图进行反馈：\n${noData.join('\n')}`, '提示');
    if (!isEmpty(noConst)) Dialog.show(`以下谱面暂无定数数据，将以0来进行计算：\n${noConst.join('\n')}`, '提示');
    if (autoRendering) renderRecords();
  }

  function parseDB(arrayBuffer) {
    try {
      const scores = [];
      const clearTypes = [];
      const db = new SQL.Database(new Uint8Array(arrayBuffer));
      const stmt1 = db.prepare('select * from scores');
      while (stmt1.step()) scores.push(stmt1.getAsObject());
      const stmt2 = db.prepare('select * from cleartypes');
      while (stmt2.step()) clearTypes.push(stmt2.getAsObject());
      scores.forEach(score => {
        const temp = clearTypes.find(({ id }) => id === score.id) ||
          clearTypes.find(({ songId, songDifficulty }) => songId === score.songId && songDifficulty === score.songDifficulty);
        score.clearType = temp.clearType;
      });
      return scores;
    } catch (err) {
      Dialog.error('请选择正确的文件！');
    }
  }

  dbFileInput.addEventListener('click', event => dbFileInput.value = null);

  dbFileInput.addEventListener('change', event => {
    const reader = new FileReader();
    reader.addEventListener('load', event => {
      importData(parseDB(event.target.result));
    });
    reader.readAsArrayBuffer(event.target.files[0]);
  });

  bindOnClick('import_data', event => {
    new Dialog()
      .title('导入数据')
      .content('目前已支持的文件类型：\nArcaea本体的存档文件（st3）')
      .button('导入', () => dbFile.click()).show();
  });

  bindOnClick('generate_image', event => {
    if (isNullish(window.scores)) return Dialog.error('请先导入一个存档！', { cancellable: true });
    const dialog = new Dialog()
      .title('生成图片');
    const nameInput = createElement('input', {
      type: 'text',
      placeholder: '输入你的名字',
      style: {
        width: '100%',
        padding: '0.65rem 1rem',
        color: 'var(--text-color)',
        background: 'var(--background-color-second)',
        'border-radius': 'var(--border-radius)',
        'font-size': '1em',
        'text-align': 'center'
      }
    });
    dialog.content(nameInput)
      .button('确定', async close => {
        await close();
        const name = nameInput.value.trim();
        if (isEmpty(name)) alqSettings.remove('nickname');
        else alqSettings.set('nickname', name);
        await generate(name || void 0, songs, window.scores)
          .then(blob => {
            new Dialog({ cancellable: false })
              .title('生成图片')
              .content('成功！点击“下载”按钮即可保存。')
              .button('下载', () => downloadFile(`${Date.now()}.png`, blob)).show();
          })
          .catch(err => {
            Dialog.error(`图片生成失败！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err.stack}`);
          });
      }).show();
    if (alqSettings.has('nickname')) nameInput.value = alqSettings.get('nickname');
    if (isEmpty(nameInput.value)) sleep(Time.second * 0.5).then(() => nameInput.focus());
  });

  bindOnClick('sort_order', event => {
    new ItemSelectorDialog({ settingName: 'sort_order', defaultValue: 0 })
      .title('排序方式')
      .setItem([{ id: 0, text: '单曲PTT' }, { id: 1, text: '定数' }, { id: 2, text: '分数' }])
      .onConfirm(() => renderRecords())
      .show();
  });

  bindOnClick('difficulty_filter', event => {
    new ItemSelectorDialog({ settingName: 'difficulty_filter', multiple: true, defaultValue: [0, 1, 2, 3] })
      .title('筛选难度')
      .setItem([{ id: 0, text: 'Past' }, { id: 1, text: 'Present' }, { id: 2, text: 'Future' }, { id: 3, text: 'Beyond' }])
      .onConfirm(() => renderRecords())
      .show();
  });

  bindOnClick('constant_filter', event => {
    const dialog = new Dialog()
      .title('筛选定数');
    const container = createElement('div');
    const input = createElement('input', {
      type: 'text',
      placeholder: '输入定数范围',
      style: {
        width: '100%',
        'margin-top': '1rem',
        padding: '0.65rem 1rem',
        color: 'var(--text-color)',
        background: 'var(--background-color-second)',
        'border-radius': 'var(--border-radius)',
        'font-size': '1em',
        'text-align': 'center'
      }
    });
    const constantFilter = alqSettings.get('constant_filter') || [];
    if (!isEmpty(constantFilter)) {
      const [min, max] = constantFilter;
      if (min === max) input.value = min;
      else if (max === 9999) input.value = `${min}+`;
      else if (min === -9999) input.value = `${max}-`;
      else input.value = `${min}~${max}`;
    }
    container.appendChild(createElement('div', {
      innerText: '示例：\n只显示定数11.0：11.0\n定数大于等于10.7：10.7+\n定数小于等于9.9：9.9-\n定数在10.0与10.9之间：10.0~10.9\n所有符号均为英文符号'
    }));
    container.appendChild(input);
    dialog.content(container)
      .button('确定', close => {
        const source = input.value.trim();
        let min = 0,
          max = 0;
        if (/^([0-9]{1,2}|[0-9]{1,2}\.[0-9])$/.test(source)) {
          min = max = Number(source);
        } else if (/^([0-9]{1,2}|[0-9]{1,2}\.[0-9])\+$/.test(source)) {
          min = Number(source.slice(0, -1));
          max = 9999;
        } else if (/^([0-9]{1,2}|[0-9]{1,2}\.[0-9])\-$/.test(source)) {
          min = -9999;
          max = Number(source.slice(0, -1));
        } else if (/^([0-9]{1,2}|[0-9]{1,2}\.[0-9])\~([0-9]{1,2}|[0-9]{1,2}\.[0-9])$/.test(source)) {
          let [a, b] = source.split('~');
          a = Number(a), b = Number(b);
          min = Math.min(a, b);
          max = Math.max(a, b);
        }
        if (!isEmpty(source) && min + max === 0) return Dialog.error('请输入正确的范围！', { cancellable: true }), false;
        alqSettings.set('constant_filter', isEmpty(source) ? [] : [min, max]);
        renderRecords();
      }).show();
    if (isEmpty(input.value)) sleep(Time.second * 0.5).then(() => input.focus());
  });

  bindOnClick(recordList, event => {
    const recordBox = event.target;
    if (!recordBox.classList.contains('record_box')) return;
    const { songid, difficulty } = recordBox.dataset;
    if (isNullish(songid) || isNullish(difficulty)) return;
    const { title_localized, artist, bpm, set, date, version, difficulties } = songs.find(({ id }) => id === songid);
    const content = [];
    if (title_localized.ja) content.push(title_localized.ja);
    if (title_localized.en) content.push(title_localized.en);
    if (title_localized['zh-Hans']) content.push(title_localized['zh-Hans']);
    content.push(`曲师：${artist}`);
    content.push(`BPM：${bpm}`);
    const pack = packs.find(({ id }) => id === set) || {};
    const packName = set === 'single' ? 'Memory Archive' : pack.name_localized.en;
    const packParentName = pack.pack_parent ? packs.find(({ id }) => id === pack.pack_parent).name_localized.en + ' - ' : '';
    content.push(`曲包：${packParentName}${packName}`);
    content.push(`版本：${version} 时间：${new Date(date * 1e3).toLocaleDateString()}`);
    for (const { ratingClass, chartDesigner, jacketDesigner, title_localized, artist, bpm, date, version } of difficulties) {
      content.push('');
      content.push(`${getDifficultyName(ratingClass)} ${consts[songid][ratingClass].constant}`);
      if (title_localized) {
        if (title_localized.ja) content.push(title_localized.ja);
        if (title_localized.en) content.push(title_localized.en);
        if (title_localized['zh-Hans']) content.push(title_localized['zh-Hans']);
      }
      if (artist) content.push(`曲师：${artist}`);
      if (jacketDesigner) content.push(`曲绘：${jacketDesigner}`);
      if (chartDesigner) content.push(`谱师：${chartDesigner}`);
      if (bpm) content.push(`BPM：${bpm}`);
      if (version && date) content.push(`版本：${version} 时间：${new Date(date * 1e3).toLocaleDateString()}`);
    }
    new Dialog()
      .title('歌曲详情')
      .content(content.join('\n'))
      .show();
  });

  $('loading_mask').classList.add('hidden');
  document.body.classList.add('loaded');

  let initialized = false;
  const observer = new IntersectionObserver(entries => {
    if (!initialized) return initialized = true;
    if (!entries[0].isIntersecting) searchBox.classList.add('floating');
    else searchBox.classList.remove('floating');
  });
  observer.observe($('sentinel'));
}

fetch('/lib/sql-wasm.wasm')
  .then(res => res.arrayBuffer(), err => Promise.stop(Dialog.error('您的网络似乎有点问题……\n请检查网络连接并尝试刷新网页。')))
  .then(wasmBinary => initSqlJs({ wasmBinary }))
  .then(main, err => Promise.stop(Dialog.error('sql.js组件加载失败，请尝试刷新网页。')))
  .catch(err => Dialog.error(`发生了错误！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err.stack}`));