import { VERSION } from '/src/constants.js';
import {
  Time,
  Random,
  isNullish,
  rounding,
  range,
  createElement,
  loadImage
} from '/src/utils.js';
import Dialog from '/src/dialog.js';

function getDifficultyName(difficulty) {
  return ['PST', 'PRS', 'FTR', 'BYD'][difficulty];
}

function getClearType(clearType) {
  return ['TL', 'NC', 'FR', 'PM', 'EC', 'HC'][clearType]
}

const cav = createElement('canvas', {
  style: {
    width: '100%',
    height: 'auto'
  }
});
const ctx = cav.getContext('2d');

export async function generate(name = 'Unknown', songs, records = []) {
  records = records.slice();
  const b30 = records.slice(0, 30);
  const b30avg = b30.reduce((total, record) => total + record.rating, 0) / 30;
  const maxptt = (b30avg * 30 + b30.slice(0, 10).reduce((total, record) => total + record.rating, 0)) / 40;

  const realHeight = cav.height = 3200;
  const realWidth = cav.width = cav.height / 18 * 9;
  const lineWidth = realHeight / 800;
  const padding = realHeight / 40;
  const rowCount = 10;
  const columnCount = 3;
  const fs1 = realHeight * 0.005;
  const fs2 = realHeight * 0.01;
  const fs3 = realHeight * 0.02;
  let y = padding * 2;

  ctx.clearRect(0, 0, cav.width, cav.height);

  const img = await loadImage(`/assets/images/backgrounds/${ Random.integer(1, 8)() }.jpg`);
  ctx.drawImage(img, 578.125, 0, 843.75, 1500, 0, 0, realWidth, realHeight);

  const imageData = ctx.getImageData(0, 0, cav.width, cav.height);
  const data = imageData.data;
  let colorSum = 0;
  for (let x = 0, len = data.length; x < len; x += 4) {
    colorSum += Math.floor((data[x] + data[x + 1] + data[x + 2]) / 3);
  }
  const brightness = Math.floor(colorSum / (cav.width * cav.height));

  const fontColor = brightness > 127 ? '#F9F9F9' : '#252525';
  const backgroundColor = brightness > 127 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.65)';
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(padding, padding, realWidth - padding * 2, realHeight - padding * 2);

  ctx.fillStyle = fontColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `${fs3}px "CeraPro"`;
  ctx.fillText(name, padding * 2, y, (realWidth * 0.45 - padding * 2));

  ctx.textAlign = 'right';
  ctx.fillText('Arcaea Player Best 30', realWidth - padding * 2, y);

  y += padding;
  ctx.textAlign = 'left';
  ctx.font = `${fs2 * 1.25}px "CeraPro"`;
  ctx.fillText(`B30 Avg: ${rounding(b30avg, 4)} / Max PTT: ${rounding(maxptt, 4)}`, padding * 2, y);

  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleString(), realWidth - padding * 2, y);

  y += padding * 1.25;
  ctx.strokeStyle = fontColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(padding * 2, y);
  ctx.lineTo(realWidth - padding * 2, y);
  ctx.closePath();
  ctx.stroke();

  y += padding * 0.8125;
  ctx.textAlign = 'center';
  const boxPadding = realHeight * 0.01;
  const boxWidth = (realWidth - padding * 4 - boxPadding * 2) / columnCount;
  for (const i of range(columnCount)) {
    const x = padding * 2 + boxWidth * (i + 0.5) + boxPadding * i;
    ctx.fillText(`#${1 + i * 10} ~ #${(1 + i) * 10}`, x, y);
  }

  y += padding * 1.25;
  const boxHeight = (realHeight - y - padding * 2 - boxPadding * (rowCount - 1)) / rowCount;
  for (const i of range(b30.length)) {
    const row = i % rowCount;
    const column = Math.floor(i / rowCount);
    if (row >= rowCount) break;
    const left = padding * 2 + boxWidth * column + boxPadding * column;
    const top = y + row * boxHeight + boxPadding * row;
    const right = left + boxWidth;
    const bottom = top + boxHeight;
    let Y = top;
    let reverseY = bottom;

    const {
      songId,
      songDifficulty,
      clearType,
      scoreDisplay,
      rank,
      ranking,
      constant,
      ratingDisplay,
      shinyPerfectCount,
      perfectCount,
      nearCount,
      missCount
    } = b30[i];
    const { title_localized, difficulties } = songs.find(({ id }) => id === songId);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `bold ${fs2 * 1.25}px "CeraPro"`;
    const titleLocalized = difficulties[songDifficulty].title_localized;
    ctx.fillText(isNullish(titleLocalized) ? title_localized.en : titleLocalized.en, left, Y, boxWidth);

    Y += boxPadding * 1.4;
    ctx.fillStyle = perfectCount - shinyPerfectCount + nearCount + missCount === 0 ? '#CCFFFF' : fontColor;
    ctx.font = `${fs3}px "CeraPro"`;
    ctx.fillText(scoreDisplay, left, Y, boxWidth);

    ctx.fillStyle = fontColor;
    ctx.textBaseline = 'bottom';
    ctx.font = `${fs2}px "CeraPro"`;
    ctx.fillText(`FAR ${nearCount} / LOST ${missCount}`, left, reverseY, boxWidth);

    ctx.textAlign = 'right';
    ctx.fillText(`#${ranking}`, right, reverseY, boxWidth);

    reverseY -= boxPadding * 1.2;
    ctx.textAlign = 'left';
    ctx.fillText(`PURE ${perfectCount} (+${shinyPerfectCount})`, left, reverseY, boxWidth);

    ctx.textAlign = 'right';
    ctx.fillText(`${rank}`, right, reverseY, boxWidth);

    reverseY -= boxPadding * 1.2;
    ctx.fillStyle = ['#3366FF', '#33FF33', '#9966FF', '#FF6666'][songDifficulty];
    ctx.textAlign = 'left';
    const difficultyName = getDifficultyName(songDifficulty);
    ctx.fillText(difficultyName, left, reverseY, boxWidth);

    ctx.fillStyle = fontColor;
    ctx.fillText(`${constant} > ${ratingDisplay}`, left + ctx.measureText(difficultyName).width + ctx.measureText(' ').width, reverseY, boxWidth);

    ctx.textAlign = 'right';
    ctx.fillText(`${getClearType(clearType)}`, right, reverseY, boxWidth);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = backgroundColor;
  ctx.fillText(`Arcaea Local Querier v${VERSION.join('.')}    https://alq.starsky919.xyz/`, realWidth / 2, realHeight - padding / 2);

  return cav.toDataURL();
}