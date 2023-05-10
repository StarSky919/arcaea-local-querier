import '/lib/kana-1.0.7.js';
import { VERSION } from '/src/constants.js';
import {
  $,
  Time,
  isNullish,
  isNumber,
  isEmpty,
  rounding,
  flooring,
  sleep,
  range,
  staggeredMerge,
  throttle,
  bindOnClick,
  compile,
  createElement,
  clearChildNodes,
  loadJSON
} from '/src/utils.js';
import Dialog from '/src/dialog.js';

Promise.stop = value => new Promise(() => { Promise.resolve(value) });
window.log = console.log;

$('version').innerText = `v${VERSION.join('.')}`;
window.addEventListener('error', err => {
  Dialog.error(`发生了错误！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err.message}`)
});

async function main(SQL) {
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

  function formatScore(score) {
    const text = score?.toString().padStart(8, '0');
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

  function importData(scores) {
    if (!scores) return;
    for (const i of range(scores.length)) {
      const { songId, songDifficulty, clearType, score } = scores[i];
      const scoreDisplay = formatScore(score);
      const rank = getRank(score);
      const clearTypeDisplay = getClearType(clearType);
      const difficultyName = getDifficultyName(songDifficulty);
      const { constant } = consts[songId][songDifficulty];
      const rating = getRating(constant, score);
      const ratingDisplay = rounding(rating, 4);
      Object.assign(scores[i], { scoreDisplay, rank, clearTypeDisplay, difficultyName, constant, rating, ratingDisplay });
    }
    const records = scores.sort((a, b) => b.rating - a.rating);
    records.forEach((record, index) => record.ranking = index + 1);
    const b30 = records.slice(0, 30);
    const b30avg = b30.reduce((total, record) => total + record.rating, 0) / 30;
    const maxptt = (b30avg * 30 + b30.slice(0, 10).reduce((total, record) => total + record.rating, 0)) / 40;
    clearChildNodes(recordList);
    const recordFrag = document.createDocumentFragment();
    for (const record of records) {
      const { id, title_localized, artist, difficulties } = songs.find(({ id }) => id === record.songId);
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
    recordList.appendChild(recordFrag);
    $('b30_average').innerText = rounding(b30avg, 4);
    $('max_potential').innerText = rounding(maxptt, 4);
    searchContainer.classList.remove('hidden');
    playerInfo.classList.remove('hidden');
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
      scores.forEach(score => score.clearType = clearTypes.find(({ id }) => id === score.id).clearType);
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

  bindOnClick('about_website', event => {
    new Dialog()
      .title('关于本站')
      .content('一个简易的Arcaea查分器，\n以获取本地存档的形式进行Best 30查询。\n配合修改版客户端使用体验最佳！\n\n开发者：StarSky919\nB站：starsky919，QQ群：486908465')
      .show();
  });

  searchInput.addEventListener('input', throttle(event => {
    const input = event.target.value;
    clearChildNodes(resultBox);
    if (!input) return;
    const results = [];
    for (const i of range(recordList.childNodes.length)) {
      const recordBox = recordList.childNodes[i];
      const { songid, difficulty } = recordBox.dataset;
      const { title_localized, difficulties } = songs.find(({ id }) => id === songid);
      const data = {
        node: recordBox,
        nodeBefore: recordList.childNodes[i - 2] || document.body
      };
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
    resultBox.appendChild(createElement({ tag: 'div', classList: ['result_item'], text: isEmpty(results) ? '搜索无结果。' : `搜索到 ${results.length} 条记录（点击可跳转）：` }));
    const resultFrag = document.createDocumentFragment();
    for (const { node, nodeBefore, matchedIndexes } of results) {
      const [resultItem] = resultItemTemplate.content.cloneNode(true).children;
      const item = compile(resultItem, {
        ranking: node.$('.ranking').innerText,
        details: `${node.$('.score_display').innerText} - ${node.$('.rating').innerText}`
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
          titleFrag.appendChild(createElement({ tag: 'span', classList: [matched ? 'matched' : 'not_matched'], text: split }));
        }
        item.$('.title').appendChild(titleFrag);
      } else item.$('.title').innerText = node.$('.title').innerText;
      item.onclick = event => nodeBefore.scrollIntoView({ behavior: "smooth" });
      resultFrag.appendChild(item);
    };
    resultBox.appendChild(resultFrag);
  }, Time.second * 0.2));

  bindOnClick(recordList, event => {
    const recordBox = event.target;
    if (!recordBox.classList.contains('record_box')) return;
    const { songid, difficulty } = recordBox.dataset;
    if (isNullish(songid) || isNullish(difficulty)) return;
    const { title_localized, jacket_localized, artist, bpm, set, date, version, difficulties } = songs.find(({ id }) => id === songid);
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
    for (const { ratingClass, chartDesigner, jacketDesigner, rating, ratingPlus, title_localized, artist, bpm, date, version } of difficulties) {
      // TODO 谱面信息
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
  .catch(err => Dialog.error(`发生了错误！\n请将以下错误信息截图并及时反馈。\n\n错误信息：\n${err}`));