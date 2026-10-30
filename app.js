/**
 * WebApp_weather/app.js
 * 淡水潮汐氣象極簡 PWA 核心控制驅動
 */

import { CWA_CONFIG, TAMSUI_MOCK_DATA, fetchTamsuiAll } from './api.js?v=20261024_real';
import { getCurrentTideStatus, drawTideChart } from './tide.js?v=20261024_real';

// LocalStorage 鍵名常數
const STORAGE_KEYS = {
  API_KEY: 'tamsui_cwa_api_key',
  CACHE_DATA: 'tamsui_tide_weather_cache',
  CACHE_TIME: 'tamsui_tide_weather_cache_time'
};

// 狀態管理物件
const state = {
  apiKey: '',
  data: null,
  isRefreshing: false,
  timerInterval: null
};

// 元素快取安全輔助函式 (環境相容性防禦)
const getEl = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

// DOM 快取
const dom = {
  // 按鈕與彈窗
  get btnRefresh() { return getEl('btnRefresh'); },
  get refreshIcon() { return getEl('refreshIcon'); },
  get btnSettings() { return getEl('btnSettings'); },
  get settingsModal() { return getEl('settingsModal'); },
  get btnCloseSettings() { return getEl('btnCloseSettings'); },
  get btnSaveKey() { return getEl('btnSaveKey'); },
  get btnClearKey() { return getEl('btnClearKey'); },
  get inputApiKey() { return getEl('inputApiKey'); },
  
  // 提示訊息
  get toast() { return getEl('toast'); },
  get toastMsg() { return getEl('toastMsg'); },
  get toastIcon() { return getEl('toastIcon'); },
  get offlineBanner() { return getEl('offlineBanner'); },
  
  // 潮況卡片
  get currentClock() { return getEl('currentClock'); },
  get tideStatusBadge() { return getEl('tideStatusBadge'); },
  get tideArrow() { return getEl('tideArrow'); },
  get tideStateText() { return getEl('tideStateText'); },
  get tideProgressText() { return getEl('tideProgressText'); },
  get tideRangeBadge() { return getEl('tideRangeBadge'); },
  get nextTideType() { return getEl('nextTideType'); },
  get nextTideCountdown() { return getEl('nextTideCountdown'); },
  get nextTideTime() { return getEl('nextTideTime'); },
  get nextTideHeight() { return getEl('nextTideHeight'); },
  get currentTideHeight() { return getEl('currentTideHeight'); },
  get todayMaxHeight() { return getEl('todayMaxHeight'); },
  get todayMinHeight() { return getEl('todayMinHeight'); },
  
  // 潮汐時序卡片
  get tideDateText() { return getEl('tideDateText'); },
  get tideScheduleGrid() { return getEl('tideScheduleGrid'); },
  
  // 氣象卡片
  get weatherTextBadge() { return getEl('weatherTextBadge'); },
  get wxTemp() { return getEl('wxTemp'); },
  get wxApparentTemp() { return getEl('wxApparentTemp'); },
  get wxPop() { return getEl('wxPop'); },
  get wxHumidity() { return getEl('wxHumidity'); },
  get wxWindScale() { return getEl('wxWindScale'); },
  get wxWindDir() { return getEl('wxWindDir'); },
  get wxDescription() { return getEl('wxDescription'); },
  
  // 底部更新時間
  get lastUpdateTime() { return getEl('lastUpdateTime'); },
  get tideCanvas() { return getEl('tideCanvas'); }
};

/**
 * 彈出 Toast 提示
 * @param {string} msg 訊息文字
 * @param {string} type 'success' | 'warning' | 'info' | 'error'
 */
export function showToast(msg, type = 'info') {
  if (!dom.toast || !dom.toastMsg) return;
  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };
  dom.toastIcon.textContent = icons[type] || 'ℹ️';
  dom.toastMsg.textContent = msg;

  dom.toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
  dom.toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(dom.toast._timeout);
  dom.toast._timeout = setTimeout(() => {
    dom.toast.classList.remove('opacity-100', 'translate-y-0');
    dom.toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
  }, 2800);
}

/**
 * 打開設定彈窗
 */
function openSettingsModal() {
  if (!dom.settingsModal) return;
  dom.inputApiKey.value = state.apiKey || '';
  dom.settingsModal.classList.remove('opacity-0', 'pointer-events-none');
  dom.settingsModal.classList.add('opacity-100');
  const inner = dom.settingsModal.querySelector('div');
  if (inner) {
    inner.classList.remove('scale-95');
    inner.classList.add('scale-100');
  }
}

/**
 * 關閉設定彈窗
 */
function closeSettingsModal() {
  if (!dom.settingsModal) return;
  dom.settingsModal.classList.remove('opacity-100');
  dom.settingsModal.classList.add('opacity-0', 'pointer-events-none');
  const inner = dom.settingsModal.querySelector('div');
  if (inner) {
    inner.classList.remove('scale-100');
    inner.classList.add('scale-95');
  }
}

/**
 * 儲存 API 金鑰
 */
async function handleSaveKey() {
  const newKey = dom.inputApiKey.value.trim();
  state.apiKey = newKey;
  if (newKey) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, newKey);
    showToast('API 金鑰已安全儲存至本機', 'success');
  } else {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    showToast('已清除金鑰，將使用離線示範資料', 'info');
  }
  closeSettingsModal();
  await refreshData(true);
}

/**
 * 清除金鑰
 */
async function handleClearKey() {
  dom.inputApiKey.value = '';
  state.apiKey = '';
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  showToast('已清除金鑰', 'info');
  closeSettingsModal();
  await refreshData(true);
}

// 快取存活時間 (TTL): 3 小時 (中央氣象署鄉鎮氣象逐 3 小時預報更新週期)
export const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * 讀取本機快取與狀態檢查 (支援 3 小時 TTL)
 * @param {boolean} allowExpired 是否允許回傳過期快取 (用於離線備援降級)
 * @returns {{ data: any, isExpired: boolean, cacheTime: number, formattedTime: string } | null}
 */
export function loadLocalCacheInfo(allowExpired = true) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CACHE_DATA);
    const timeStr = localStorage.getItem(STORAGE_KEYS.CACHE_TIME);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const cacheTime = timeStr ? parseInt(timeStr, 10) : 0;
    const isExpired = (Date.now() - cacheTime) > CACHE_TTL_MS;

    if (isExpired && !allowExpired) {
      return null;
    }

    const date = new Date(cacheTime);
    const formattedTime = cacheTime > 0
      ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
      : '未知時間';

    return {
      data,
      isExpired,
      cacheTime,
      formattedTime
    };
  } catch (e) {
    console.error('讀取快取失敗:', e);
    return null;
  }
}

/**
 * 讀取本機快取資料物件
 * @param {boolean} allowExpired 是否允許過期快取
 */
export function loadLocalCache(allowExpired = true) {
  const info = loadLocalCacheInfo(allowExpired);
  return info ? info.data : null;
}

/**
 * 寫入本機快取
 */
export function saveLocalCache(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHE_DATA, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.CACHE_TIME, Date.now().toString());
  } catch (e) {
    console.warn('快取寫入失敗 (可能是配額上限):', e);
  }
}

/**
 * 設定離線橫幅提示訊息與可見度
 * @param {boolean} visible 是否顯示
 * @param {string} [message] 自訂文字
 */
export function setOfflineBanner(visible, message = '') {
  if (!dom.offlineBanner) return;
  if (visible) {
    if (message) dom.offlineBanner.textContent = message;
    dom.offlineBanner.classList.remove('hidden');
  } else {
    dom.offlineBanner.classList.add('hidden');
  }
}

/**
 * 渲染氣象資訊
 */
function renderWeather(wx) {
  if (!wx) return;
  if (dom.weatherTextBadge) dom.weatherTextBadge.textContent = wx.weatherText || '正常';
  if (dom.wxTemp) dom.wxTemp.textContent = wx.temperature || '--';
  if (dom.wxApparentTemp) dom.wxApparentTemp.textContent = wx.apparentTemperature || '--';
  if (dom.wxPop) dom.wxPop.textContent = wx.rainProb || '0';
  if (dom.wxHumidity) dom.wxHumidity.textContent = wx.humidity || '--';
  if (dom.wxWindScale) dom.wxWindScale.textContent = wx.beaufortScale || '--';
  if (dom.wxWindDir) dom.wxWindDir.textContent = `${wx.windDirection || '無風'} (${wx.windSpeed || '--'}m/s)`;
  if (dom.wxDescription) dom.wxDescription.textContent = wx.description || '無詳細天氣提醒。';
}

/**
 * 渲染今日乾滿潮時序表格
 */
function renderTideSchedule(timeline, todayMeta) {
  if (!dom.tideScheduleGrid) return;
  if (!timeline || timeline.length === 0) {
    dom.tideScheduleGrid.innerHTML = `
      <div class="col-span-full py-4 text-center text-xs text-slate-500">
        暫無今日潮汐時序數據
      </div>
    `;
    return;
  }

  // 取得今日 YYYY-MM-DD
  const todayStr = new Date().toISOString().slice(0, 10);
  // 篩選今日事件
  const todayEvents = timeline.filter(t => t.date === todayStr || (t.dateTime && t.dateTime.startsWith(todayStr)));
  const displayEvents = todayEvents.length > 0 ? todayEvents : timeline.slice(0, 4);

  if (dom.tideDateText && todayMeta) {
    dom.tideDateText.textContent = `${todayStr} (${todayMeta.lunarDate || '農曆'} • ${todayMeta.tideRange || '中潮'})`;
  }
  if (dom.tideRangeBadge && todayMeta) {
    dom.tideRangeBadge.textContent = `${todayMeta.tideRange || '中潮'} • ${todayMeta.lunarDate || '農曆'}`;
  }

  // 渲染時序方格 (平衡協調大字版，適配 2x2 網格防破版)
  dom.tideScheduleGrid.innerHTML = displayEvents.map(item => {
    const isHigh = item.type === '滿潮';
    const timeStr = item.dateTime ? item.dateTime.slice(11, 16) : '--:--';
    const tagBg = isHigh 
      ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-rose-950/30' 
      : 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 shadow-cyan-950/30';
    
    return `
      <div class="bg-ocean-950/70 rounded-2xl p-3 text-center border border-white/10 flex flex-col items-center justify-between transition hover:border-ocean-600 shadow-md">
        <div class="inline-block px-3 py-0.5 rounded-lg text-sm font-black border ${tagBg} mb-1.5 tracking-wider shadow-sm">
          ${item.type}
        </div>
        <div class="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono my-0.5">
          ${timeStr}
        </div>
        <div class="text-xs sm:text-sm font-mono text-slate-200 mt-0.5">
          <strong class="${isHigh ? 'text-rose-300' : 'text-cyan-300'} text-base font-black">${item.heightChartDatum}</strong> cm
        </div>
      </div>
    `;
  }).join('');

  // 今日最高最低極值
  const heights = displayEvents.map(e => e.heightChartDatum).filter(h => !isNaN(h));
  if (heights.length > 0) {
    const maxH = Math.max(...heights);
    const minH = Math.min(...heights);
    if (dom.todayMaxHeight) dom.todayMaxHeight.textContent = `${maxH}cm`;
    if (dom.todayMinHeight) dom.todayMinHeight.textContent = `${minH}cm`;
  }
}

/**
 * 即時更新潮況看版數值與 Canvas 圖表
 */
export function updateTideLiveStatus() {
  const now = new Date();

  // 0. 更新即時時鐘
  if (dom.currentClock) {
    dom.currentClock.textContent = now.toTimeString().slice(0, 8);
  }

  if (!state.data || !state.data.tide || !state.data.tide.timeline) return;
  const status = getCurrentTideStatus(now, state.data.tide.timeline);

  // 1. 漲退潮 Badge 樣式與大字 (長輩醒目高對比)
  if (dom.tideStatusBadge) {
    dom.tideStatusBadge.className = `flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300 shadow-lg ${
      status.isRising
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-emerald-950/30'
        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-cyan-950/30'
    }`;
  }
  if (dom.tideArrow) dom.tideArrow.textContent = status.arrow;
  if (dom.tideStateText) dom.tideStateText.textContent = status.status;
  if (dom.tideProgressText) dom.tideProgressText.textContent = `${status.progressPercent}%`;

  // 2. 倒數與下個潮位
  if (dom.nextTideType) {
    dom.nextTideType.textContent = status.nextEvent ? status.nextEvent.type : (status.isRising ? '滿潮' : '乾潮');
  }
  if (dom.nextTideCountdown) {
    dom.nextTideCountdown.textContent = status.countdown.text;
  }
  if (dom.nextTideTime) {
    dom.nextTideTime.textContent = status.nextEvent?.dateTime ? `預計 ${status.nextEvent.dateTime.slice(11, 16)}` : '預計 --:--';
  }
  if (dom.nextTideHeight) {
    dom.nextTideHeight.textContent = status.nextEvent ? `預計 ${status.nextEvent.heightChartDatum} cm` : '預計 -- cm';
  }

  // 3. 當前推估潮位 (整合至底部波形圖下方)
  if (dom.currentTideHeight) {
    dom.currentTideHeight.textContent = status.estimatedHeight ?? '--';
  }

  // 4. 重繪 Canvas 波形
  if (dom.tideCanvas) {
    drawTideChart(dom.tideCanvas, state.data.tide.timeline, now);
  }
}

/**
 * 啟動即時秒級更新計時器
 */
export function startLiveTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  updateTideLiveStatus();
  state.timerInterval = setInterval(() => {
    updateTideLiveStatus();
    // 定期檢查快取時間：若距上次更新已滿 3 小時，自動觸發背景更新
    const cacheTimeStr = localStorage.getItem(STORAGE_KEYS.CACHE_TIME);
    if (cacheTimeStr && !state.isRefreshing) {
      const cacheTime = parseInt(cacheTimeStr, 10);
      if (Date.now() - cacheTime >= CACHE_TTL_MS) {
        console.log('[Auto Refresh] 快取已逾 3 小時，自動觸發背景更新...');
        refreshData(false);
      }
    }
  }, 1000);
}

/**
 * 核心刷新資料流程
 * @param {boolean} force 是否強制發送網路請求
 */
export async function refreshData(force = false) {
  if (state.isRefreshing) return;
  state.isRefreshing = true;

  // 旋轉刷新按鈕動畫
  if (dom.refreshIcon) dom.refreshIcon.classList.add('animate-spin-custom');

  try {
    let payload = null;

    let fromCache = false;

    // 檢查是否有未過期快取 (小於 3 小時)
    const validCacheInfo = loadLocalCacheInfo(false);

    if (!force && validCacheInfo) {
      // 非強制刷新且快取在 3 小時有效期限內：直接使用本機快取，優化 API 呼叫頻率
      payload = validCacheInfo.data;
      fromCache = true;
      setOfflineBanner(false);
    } else if (state.apiKey) {
      try {
        payload = await fetchTamsuiAll(state.apiKey);
        saveLocalCache(payload);
        setOfflineBanner(false);
      } catch (err) {
        console.error('API 抓取異常，嘗試回退快取:', err);
        window.__LAST_ERROR__ = {
          message: err?.message || String(err),
          stack: err?.stack || ''
        };
        const errDetail = err?.message || String(err);
        const cacheInfo = loadLocalCacheInfo(true);
        if (cacheInfo) {
          payload = cacheInfo.data;
          const expireNote = cacheInfo.isExpired ? ' (已逾 3 小時)' : '';
          setOfflineBanner(true, `⚠️ 連線異常 (${errDetail})，已切換至本機快取資料（快取於 ${cacheInfo.formattedTime}${expireNote}）`);
          showToast('已切換為本地離線快取資料', 'warning');
        } else {
          payload = TAMSUI_MOCK_DATA;
          setOfflineBanner(true, `⚠️ 連線異常: ${errDetail}，目前顯示展示示範資料`);
          showToast(`連線失敗: ${errDetail}`, 'warning');
        }
      }
    } else {
      // 無 API Key，優先檢查快取，若無則用 Mock
      const cacheInfo = loadLocalCacheInfo(true);
      if (cacheInfo && !force) {
        payload = cacheInfo.data;
        const expireNote = cacheInfo.isExpired ? ' (已逾 3 小時)' : '';
        setOfflineBanner(true, `ℹ️ 未輸入金鑰，目前顯示本機快取資料（快取於 ${cacheInfo.formattedTime}${expireNote}）`);
      } else {
        payload = TAMSUI_MOCK_DATA;
        setOfflineBanner(true, 'ℹ️ 未輸入 API 金鑰，目前顯示淡水展示示範資料');
      }
    }

    state.data = payload;

    // 渲染資料
    if (payload.weather) {
      renderWeather(payload.weather);
    }
    if (payload.tide) {
      renderTideSchedule(payload.tide.timeline, payload.tide.today);
    }

    // 啟動即時潮況看板計算與 24H Canvas 正弦波形渲染
    startLiveTimer();

    // 更新最後更新時間
    if (dom.lastUpdateTime) {
      if (fromCache && validCacheInfo?.cacheTime) {
        const cacheDate = new Date(validCacheInfo.cacheTime);
        dom.lastUpdateTime.textContent = `更新於 ${cacheDate.toTimeString().slice(0, 8)} (快取)`;
      } else {
        const now = new Date();
        dom.lastUpdateTime.textContent = `更新於 ${now.toTimeString().slice(0, 8)}`;
      }
    }

    showToast(payload.isMock ? '已載入淡水展示資料' : (fromCache ? '已載入快取數據 (3小時內有效)' : '淡水即時數據已更新'), 'success');

  } catch (e) {
    console.error('全域刷新發生未預期異常:', e);
    showToast('資料更新時遭遇異常', 'error');
  } finally {
    state.isRefreshing = false;
    setTimeout(() => {
      if (dom.refreshIcon) dom.refreshIcon.classList.remove('animate-spin-custom');
    }, 750);
  }
}

/**
 * 綁定事件監聽器
 */
function bindEvents() {
  // 手動更新按鈕
  dom.btnRefresh?.addEventListener('click', () => refreshData(true));

  // 設定 Modal
  dom.btnSettings?.addEventListener('click', openSettingsModal);
  dom.btnCloseSettings?.addEventListener('click', closeSettingsModal);
  dom.btnSaveKey?.addEventListener('click', handleSaveKey);
  dom.btnClearKey?.addEventListener('click', handleClearKey);

  // 點擊彈窗外部背景關閉
  dom.settingsModal?.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) {
      closeSettingsModal();
    }
  });

  // ESC 鍵關閉彈窗
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.settingsModal.classList.contains('opacity-0')) {
      closeSettingsModal();
    }
  });

  // 視窗尺寸改變時重繪 Canvas (自適應螢幕拉伸或手機旋轉)
  window.addEventListener('resize', () => {
    if (dom.tideCanvas && state.data?.tide?.timeline) {
      drawTideChart(dom.tideCanvas, state.data.tide.timeline, new Date());
    }
  });

  // 網路在線與離線監聽
  window.addEventListener('online', () => {
    setOfflineBanner(false);
    showToast('網路連線已恢復，正在同步最新資料...', 'success');
    refreshData(true);
  });

  window.addEventListener('offline', () => {
    setOfflineBanner(true, '⚠️ 網路已斷開，已自動啟用本機離線防護模式');
    showToast('網路已斷開，切換為離線模式', 'warning');
  });
}

/**
 * 註冊 PWA Service Worker
 */
function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.protocol.startsWith('http')) {
    // 檢查是否有舊快取，先執行清理
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name !== 'tamsui-tide-pwa-v4') caches.delete(name);
        }
      });
    }
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker 註冊成功，範圍:', reg.scope);
        reg.update();
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 註冊略過或失敗:', err);
      });
  }
}

/**
 * 初始化入口
 */
export function initApp() {
  // 1. 讀取 LocalStorage 金鑰，若無則採用 CWA_CONFIG 內設預設金鑰
  state.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || CWA_CONFIG.DEFAULT_API_KEY || '';

  // 2. 綁定事件
  bindEvents();

  // 3. 註冊 Service Worker
  registerServiceWorker();

  // 4. 初始載入資料
  refreshData(false);
}

// 頁面載入完成後啟動
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else if (typeof window !== 'undefined') {
  initApp();
}
