/**
 * WebApp_weather/tide.js
 * 淡水潮汐專屬演算法與 Canvas 24 小時正弦波繪製引擎
 */

/**
 * 依據半日潮極值時序進行餘弦插值，推估任意時間點之潮高 (公分)
 * @param {number|Date} time 目標時間點 (時間戳毫秒或 Date 物件)
 * @param {Array<Object>} timeline 潮汐事件清單 (依 timestamp 升冪排列)
 * @returns {number} 推估之海圖基準潮高 (cm)
 */
export function estimateTideHeight(time, timeline) {
  if (!timeline || timeline.length === 0) return 0;
  const ts = typeof time === 'number' ? time : time.getTime();

  const sorted = [...timeline].sort((a, b) => a.timestamp - b.timestamp);

  // 若目標時間早於第一筆資料
  if (ts <= sorted[0].timestamp) {
    if (sorted.length < 2) return sorted[0].heightChartDatum;
    const p0 = sorted[0];
    const p1 = sorted[1];
    const halfPeriod = p1.timestamp - p0.timestamp;
    const virtualPrevTs = p0.timestamp - halfPeriod;
    const theta = ((ts - virtualPrevTs) / (p0.timestamp - virtualPrevTs)) * Math.PI;
    const h = ((p1.heightChartDatum + p0.heightChartDatum) / 2) +
              ((p1.heightChartDatum - p0.heightChartDatum) / 2) * Math.cos(theta);
    return Math.round(h);
  }

  // 若目標時間晚於最後一筆資料
  if (ts >= sorted[sorted.length - 1].timestamp) {
    if (sorted.length < 2) return sorted[sorted.length - 1].heightChartDatum;
    const pLast = sorted[sorted.length - 1];
    const pPrev = sorted[sorted.length - 2];
    const halfPeriod = pLast.timestamp - pPrev.timestamp;
    const virtualNextTs = pLast.timestamp + halfPeriod;
    const theta = ((ts - pLast.timestamp) / (virtualNextTs - pLast.timestamp)) * Math.PI;
    const h = ((pLast.heightChartDatum + pPrev.heightChartDatum) / 2) +
              ((pLast.heightChartDatum - pPrev.heightChartDatum) / 2) * Math.cos(theta);
    return Math.round(h);
  }

  // 在清單區間內：尋找相鄰的兩個潮汐極值點
  const idx = sorted.findIndex(item => item.timestamp > ts);
  const p1 = sorted[idx - 1];
  const p2 = sorted[idx];

  const t1 = p1.timestamp;
  const t2 = p2.timestamp;
  const h1 = p1.heightChartDatum;
  const h2 = p2.heightChartDatum;

  if (t2 === t1) return Math.round(h1);

  // 潮汐餘弦插值公式 (Half-day sinusoidal curve)
  // θ = (t - t1) / (t2 - t1) * π
  // h(t) = (h1 + h2)/2 + (h1 - h2)/2 * cos(θ)
  const theta = ((ts - t1) / (t2 - t1)) * Math.PI;
  const h = ((h1 + h2) / 2) + ((h1 - h2) / 2) * Math.cos(theta);
  return Math.round(h);
}

/**
 * 計算當前潮汐狀態（漲退潮）、下一次滿乾潮倒數與潮高推估
 * @param {number|Date} now 當前時間
 * @param {Array<Object>} timeline 潮汐事件清單
 * @returns {Object} 潮況分析結果
 */
export function getCurrentTideStatus(now, timeline) {
  const defaultResult = {
    status: '潮況計算中',
    arrow: '•',
    isRising: false,
    badgeBgClass: 'bg-slate-700/50 text-slate-300 border-slate-600',
    progressPercent: 50,
    prevEvent: null,
    nextEvent: null,
    countdown: {
      hours: 0,
      minutes: 0,
      seconds: 0,
      text: '--:--:--',
      totalSeconds: 0
    },
    estimatedHeight: 0
  };

  if (!timeline || timeline.length === 0) {
    return defaultResult;
  }

  const nowTs = typeof now === 'number' ? now : now.getTime();
  const sorted = [...timeline].sort((a, b) => a.timestamp - b.timestamp);

  const nextIndex = sorted.findIndex(item => item.timestamp > nowTs);
  let prevEvent = null;
  let nextEvent = null;

  if (nextIndex === -1) {
    // 當前時間已超過最後一筆資料
    prevEvent = sorted[sorted.length - 1];
    nextEvent = null;
  } else if (nextIndex === 0) {
    // 當前時間早於第一筆資料
    prevEvent = null;
    nextEvent = sorted[0];
  } else {
    // 正常夾在兩筆之間
    prevEvent = sorted[nextIndex - 1];
    nextEvent = sorted[nextIndex];
  }

  // 判斷漲潮或退潮
  let isRising = true;
  if (nextEvent) {
    isRising = (nextEvent.type === '滿潮');
  } else if (prevEvent) {
    // 若無下個事件，則與上個極值相反
    isRising = (prevEvent.type === '乾潮');
  }

  const status = isRising ? '漲潮中' : '退潮中';
  const arrow = isRising ? '▲' : '▼';
  const badgeBgClass = isRising
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';

  // 計算進度百分比 (0 - 100%)
  let progressPercent = 50;
  if (prevEvent && nextEvent) {
    const elapsed = nowTs - prevEvent.timestamp;
    const total = nextEvent.timestamp - prevEvent.timestamp;
    if (total > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    }
  } else if (nextEvent) {
    // 預設半日潮週期約 6.2 小時
    const diff = nextEvent.timestamp - nowTs;
    const approxTotal = 6.2 * 3600 * 1000;
    progressPercent = Math.min(100, Math.max(0, Math.round((1 - diff / approxTotal) * 100)));
  }

  // 計算倒數計時
  const countdown = {
    hours: 0,
    minutes: 0,
    seconds: 0,
    text: '--:--:--',
    totalSeconds: 0
  };

  if (nextEvent) {
    const diffMs = Math.max(0, nextEvent.timestamp - nowTs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdown.hours = hours;
    countdown.minutes = minutes;
    countdown.seconds = seconds;
    countdown.totalSeconds = totalSeconds;
    countdown.text = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // 推估當前潮高
  const estimatedHeight = estimateTideHeight(nowTs, sorted);

  return {
    status,
    arrow,
    isRising,
    badgeBgClass,
    progressPercent,
    prevEvent,
    nextEvent,
    countdown,
    estimatedHeight
  };
}

/**
 * 繪製 24 小時連續平滑潮位波形 (Canvas 2D)
 * @param {HTMLCanvasElement} canvas 繪圖畫布元素
 * @param {Array<Object>} timeline 潮汐事件清單
 * @param {Date} [now] 當前時間點 (預設當下)
 */
export function drawTideChart(canvas, timeline, now = new Date()) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 取得容器尺寸與裝置像素比
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 360, height: 144 };
  const width = rect.width || canvas.parentElement?.clientWidth || 360;
  const height = rect.height || 144;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // 調整畫布物理解析度以適應高解析螢幕
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.save();
  ctx.resetTransform?.();
  ctx.scale(dpr, dpr);

  // 清除舊畫布
  ctx.clearRect(0, 0, width, height);

  // 若無資料，繪製暫無資料提示
  if (!timeline || timeline.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暫無潮汐波形資料', width / 2, height / 2);
    ctx.restore();
    return;
  }

  // 計算今日 00:00 至 24:00 (明日 00:00) 的時間範圍
  const nowDate = typeof now === 'number' ? new Date(now) : (now instanceof Date ? now : new Date());
  const startOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const dayDuration = endOfDay - startOfDay;

  // 圖表內邊距
  const padTop = 24;
  const padBottom = 20;
  const padLeft = 14;
  const padRight = 14;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // 取得今日潮位極值以確定 Y 軸縮放範圍
  const sorted = [...timeline].sort((a, b) => a.timestamp - b.timestamp);
  const todayEvents = sorted.filter(t => t.timestamp >= startOfDay && t.timestamp <= endOfDay);
  const sampleHeights = todayEvents.length > 0
    ? todayEvents.map(e => e.heightChartDatum)
    : sorted.slice(0, 4).map(e => e.heightChartDatum);

  const rawMin = Math.min(...sampleHeights);
  const rawMax = Math.max(...sampleHeights);
  // 給予上下預留邊界空間
  const yMin = Math.floor(rawMin - 25);
  const yMax = Math.ceil(rawMax + 30);
  const yRange = (yMax - yMin) || 1;

  // 座標映射函式
  const timeToX = (t) => padLeft + Math.max(0, Math.min(chartW, ((t - startOfDay) / dayDuration) * chartW));
  const heightToY = (h) => padTop + chartH - ((h - yMin) / yRange) * chartH;

  // 1. 繪製背景參考格線 (6h, 12h, 18h)
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;

  [6, 12, 18].forEach(hour => {
    const gx = padLeft + (hour / 24) * chartW;
    ctx.beginPath();
    ctx.moveTo(gx, padTop - 6);
    ctx.lineTo(gx, height - padBottom + 4);
    ctx.stroke();
  });

  // 水平中間參考線
  const midY = padTop + chartH / 2;
  ctx.beginPath();
  ctx.moveTo(padLeft, midY);
  ctx.lineTo(width - padRight, midY);
  ctx.stroke();
  ctx.restore();

  // 2. 取樣生成 24 小時正弦潮位曲線點陣 (每 4 分鐘一個取樣點 = 360 個點)
  const steps = 360;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const sampleTs = startOfDay + (i / steps) * dayDuration;
    const h = estimateTideHeight(sampleTs, sorted);
    const x = timeToX(sampleTs);
    const y = heightToY(h);
    points.push({ x, y, h, ts: sampleTs });
  }

  // 3. 繪製波浪漸層填充 (底層海洋感)
  const fillGrad = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
  fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
  fillGrad.addColorStop(0.65, 'rgba(6, 182, 212, 0.10)');
  fillGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, height - padBottom);
  ctx.lineTo(points[0].x, height - padBottom);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 4. 繪製主波形平滑描邊
  ctx.save();
  ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#22d3ee'; // 亮青色波浪
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // 5. 繪製今日高低潮極值點與數值標籤
  todayEvents.forEach(evt => {
    const exX = timeToX(evt.timestamp);
    const exY = heightToY(evt.heightChartDatum);
    const isHigh = evt.type === '滿潮';

    // 圓點外環與核心
    ctx.beginPath();
    ctx.arc(exX, exY, 4, 0, Math.PI * 2);
    ctx.fillStyle = isHigh ? '#f87171' : '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#031926';
    ctx.stroke();

    // 標籤字體
    ctx.font = 'bold 9px monospace, system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = isHigh ? '#fca5a5' : '#7dd3fc';

    const labelY = isHigh ? exY - 7 : exY + 14;
    ctx.fillText(`${evt.heightChartDatum}cm`, exX, labelY);
  });

  // 6. 標繪「現在時間」所在位置與當前潮高指針
  const nowTs = nowDate.getTime();
  if (nowTs >= startOfDay && nowTs <= endOfDay) {
    const curX = timeToX(nowTs);
    const curH = estimateTideHeight(nowTs, sorted);
    const curY = heightToY(curH);

    // 垂直貫穿指示線
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(curX, padTop - 8);
    ctx.lineTo(curX, height - padBottom + 2);
    ctx.stroke();
    ctx.restore();

    // 呼吸脈衝光暈環 (外圈)
    ctx.beginPath();
    ctx.arc(curX, curY, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
    ctx.fill();

    // 核心光點 (內圈)
    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#06b6d4';
    ctx.stroke();

    // 懸浮潮高膠囊標籤 (Badge)
    const badgeText = `${curH}cm`;
    ctx.font = 'bold 10px monospace, system-ui';
    const textMetrics = ctx.measureText(badgeText);
    const bw = textMetrics.width + 10;
    const bh = 15;
    let bx = curX - bw / 2;
    // 邊界防溢出
    if (bx < padLeft) bx = padLeft;
    if (bx + bw > width - padRight) bx = width - padRight - bw;
    
    // 若靠近頂部則標籤往下移，否則預設往上
    const by = curY > padTop + 24 ? curY - bh - 8 : curY + 10;

    // 繪製微型圓角膠囊背景
    ctx.fillStyle = 'rgba(8, 47, 73, 0.9)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 4) : ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();

    // 膠囊文字
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
  }

  ctx.restore();
}
