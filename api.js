/**
 * WebApp_weather/api.js
 * 中央氣象署 (CWA) 開放資料 API 串接與資料清洗模組
 * 支援 CORS 直連前端存取
 */

export const CWA_CONFIG = {
  BASE_URL: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/',
  DEFAULT_API_KEY: 'CWA-6415A32C-BD2F-4601-9B2A-A430E565FEE7',
  TIDE_DATASET: 'F-A0021-001',       // 未來 1 個月潮汐預報
  WEATHER_DATASET: 'F-D0047-069',    // 新北市鄉鎮未來 2 天天氣預報
  STATION: {
    key: 'tamsui',
    label: '淡水',
    fullName: '新北市淡水區',
    tideLocationId: '65000100',
    weatherLocationName: '淡水區',
    description: '淡水老街・漁人碼頭・淡水河口'
  },
  STATIONS: {
    tamsui: {
      key: 'tamsui',
      label: '淡水',
      fullName: '新北市淡水區',
      tideLocationId: '65000100',
      weatherLocationName: '淡水區',
      description: '淡水老街・漁人碼頭・淡水河口'
    }
  }
};

/**
 * 淡水離線／展示 Mock 數據（當未填 API Key 或網路斷線且無快取時使用）
 */
export const TAMSUI_MOCK_DATA = {
  isMock: true,
  tide: {
    stationKey: 'tamsui',
    stationName: '新北市淡水區 (淡水河口)',
    today: {
      date: new Date().toISOString().slice(0, 10),
      lunarDate: '農曆初九',
      tideRange: '中潮'
    },
    // 標準淡水半日潮示範時序
    timeline: [
      {
        date: new Date().toISOString().slice(0, 10),
        lunarDate: '農曆初九',
        tideRange: '中潮',
        dateTime: `${new Date().toISOString().slice(0, 10)}T03:12:00+08:00`,
        timestamp: new Date(`${new Date().toISOString().slice(0, 10)}T03:12:00+08:00`).getTime(),
        type: '滿潮',
        heightChartDatum: 236,
        heightTWVD: 78,
        heightMSL: 74
      },
      {
        date: new Date().toISOString().slice(0, 10),
        lunarDate: '農曆初九',
        tideRange: '中潮',
        dateTime: `${new Date().toISOString().slice(0, 10)}T09:45:00+08:00`,
        timestamp: new Date(`${new Date().toISOString().slice(0, 10)}T09:45:00+08:00`).getTime(),
        type: '乾潮',
        heightChartDatum: 68,
        heightTWVD: -90,
        heightMSL: -94
      },
      {
        date: new Date().toISOString().slice(0, 10),
        lunarDate: '農曆初九',
        tideRange: '中潮',
        dateTime: `${new Date().toISOString().slice(0, 10)}T15:38:00+08:00`,
        timestamp: new Date(`${new Date().toISOString().slice(0, 10)}T15:38:00+08:00`).getTime(),
        type: '滿潮',
        heightChartDatum: 248,
        heightTWVD: 90,
        heightMSL: 86
      },
      {
        date: new Date().toISOString().slice(0, 10),
        lunarDate: '農曆初九',
        tideRange: '中潮',
        dateTime: `${new Date().toISOString().slice(0, 10)}T22:15:00+08:00`,
        timestamp: new Date(`${new Date().toISOString().slice(0, 10)}T22:15:00+08:00`).getTime(),
        type: '乾潮',
        heightChartDatum: 52,
        heightTWVD: -106,
        heightMSL: -110
      }
    ]
  },
  weather: {
    stationKey: 'tamsui',
    stationName: '淡水區',
    temperature: '23',
    apparentTemperature: '24',
    rainProb: '30',
    weatherText: '陰短暫雨',
    weatherCode: '08',
    windSpeed: '6.2',
    beaufortScale: '4',
    windDirection: '東北風',
    humidity: '78',
    description: '東北季風增強，淡水河口風勢較大，偶有局部短暫毛毛雨，請注意保暖與防風。'
  }
};

/**
 * 取得潮汐預報並過濾淡水測站
 * @param {string} apiKey 氣象署授權碼
 * @returns {Promise<Object>} 各測站整理後的每日與時序潮汐清單
 */
export async function fetchTideData(apiKey) {
  const url = `${CWA_CONFIG.BASE_URL}${CWA_CONFIG.TIDE_DATASET}?Authorization=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`潮汐 API 請求失敗 (HTTP ${resp.status})`);
  }
  const json = await resp.json();
  if (!json.success) {
    throw new Error(`潮汐 API 回應錯誤: ${json.message || '授權無效或伺服器異常'}`);
  }

  const forecasts = json.records?.TideForecasts || [];
  const result = {
    tamsui: null,
    rawTime: new Date().toISOString()
  };

  for (const item of forecasts) {
    const loc = item.Location || {};
    const locId = loc.LocationId;

    let targetStation = null;
    if (locId === CWA_CONFIG.STATIONS.tamsui.tideLocationId) {
      targetStation = 'tamsui';
    }

    if (targetStation) {
      const dailyList = loc.TimePeriods?.Daily || [];
      // 依日期排序
      dailyList.sort((a, b) => (a.Date > b.Date ? 1 : -1));

      // 攤平成連續事件清單
      const timeline = [];
      for (const d of dailyList) {
        for (const t of (d.Time || [])) {
          timeline.push({
            date: d.Date,
            lunarDate: d.LunarDate,
            tideRange: d.TideRange,
            dateTime: t.DateTime,
            timestamp: new Date(t.DateTime).getTime(),
            type: t.Tide, // '滿潮' | '乾潮'
            heightChartDatum: Number(t.TideHeights?.AboveChartDatum ?? 0),
            heightTWVD: Number(t.TideHeights?.AboveTWVD ?? 0),
            heightMSL: Number(t.TideHeights?.AboveLocalMSL ?? 0)
          });
        }
      }
      timeline.sort((a, b) => a.timestamp - b.timestamp);

      result[targetStation] = {
        stationKey: targetStation,
        stationName: loc.LocationName,
        dailyList,
        timeline
      };
    }
  }

  return result;
}

/**
 * 取得新北鄉鎮逐 3 小時天氣預報
 * @param {string} apiKey 氣象署授權碼
 * @returns {Promise<Object>} 淡水整理後的當前天氣資訊
 */
export async function fetchWeatherData(apiKey) {
  const url = `${CWA_CONFIG.BASE_URL}${CWA_CONFIG.WEATHER_DATASET}?Authorization=${encodeURIComponent(apiKey)}&locationName=${encodeURIComponent(CWA_CONFIG.STATION.weatherLocationName)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`氣象 API 請求失敗 (HTTP ${resp.status})`);
  }
  const json = await resp.json();
  if (!json.success) {
    throw new Error(`氣象 API 回應錯誤: ${json.message || '授權無效或伺服器異常'}`);
  }

  const locations = json.records?.Locations?.[0]?.Location || [];
  const result = {
    tamsui: null,
    rawTime: new Date().toISOString()
  };

  const now = Date.now();

  for (const loc of locations) {
    const locName = loc.LocationName;
    let targetStation = null;
    if (locName === CWA_CONFIG.STATIONS.tamsui.weatherLocationName) {
      targetStation = 'tamsui';
    }

    if (targetStation) {
      const elements = loc.WeatherElement || [];
      const parsedElements = {};

      for (const elem of elements) {
        const name = elem.ElementName;
        parsedElements[name] = elem.Time || [];
      }

      // 找出最接近當前時間點的數值
      const pickClosest = (timeArray) => {
        if (!timeArray || timeArray.length === 0) return null;
        for (const item of timeArray) {
          const st = item.StartTime ? new Date(item.StartTime).getTime() : 0;
          const et = item.EndTime ? new Date(item.EndTime).getTime() : Number.MAX_SAFE_INTEGER;
          if (now >= st && now <= et) {
            return item;
          }
        }
        return timeArray[0];
      };

      const tempItem = pickClosest(parsedElements['溫度']);
      const popItem = pickClosest(parsedElements['3小時降雨機率']);
      const wxItem = pickClosest(parsedElements['天氣現象']);
      const wsItem = pickClosest(parsedElements['風速']);
      const wdItem = pickClosest(parsedElements['風向']);
      const atItem = pickClosest(parsedElements['體感溫度']);
      const rhItem = pickClosest(parsedElements['相對濕度']);
      const descItem = pickClosest(parsedElements['天氣預報綜合描述']);

      result[targetStation] = {
        stationKey: targetStation,
        stationName: locName,
        temperature: tempItem?.ElementValue?.[0]?.Temperature ?? '--',
        apparentTemperature: atItem?.ElementValue?.[0]?.ApparentTemperature ?? '--',
        rainProb: popItem?.ElementValue?.[0]?.ProbabilityOfPrecipitation ?? '0',
        weatherText: wxItem?.ElementValue?.[0]?.Weather ?? '多雲',
        weatherCode: wxItem?.ElementValue?.[0]?.WeatherCode ?? '01',
        windSpeed: wsItem?.ElementValue?.[0]?.WindSpeed ?? '--',
        beaufortScale: wsItem?.ElementValue?.[0]?.BeaufortScale ?? '--',
        windDirection: wdItem?.ElementValue?.[0]?.WindDirection ?? '無風',
        humidity: rhItem?.ElementValue?.[0]?.RelativeHumidity ?? '--',
        description: descItem?.ElementValue?.[0]?.WeatherDescription ?? '',
        forecastTimes: parsedElements
      };
    }
  }

  return result;
}

/**
 * 一次性取得淡水潮汐與氣象整合資料
 * @param {string} apiKey 
 * @returns {Promise<Object>}
 */
export async function fetchTamsuiAll(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return {
      ...TAMSUI_MOCK_DATA,
      isMock: true,
      rawTime: new Date().toISOString()
    };
  }

  try {
    const [tideMap, weatherMap] = await Promise.all([
      fetchTideData(apiKey.trim()),
      fetchWeatherData(apiKey.trim())
    ]);

    const tide = tideMap?.tamsui;
    const weather = weatherMap?.tamsui;

    if (!tide) {
      throw new Error('未取得淡水測站之潮汐資料');
    }

    return {
      isMock: false,
      tide,
      weather: weather || TAMSUI_MOCK_DATA.weather,
      rawTime: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[CWA API] 抓取失敗，準備降級或拋出:', err);
    throw err;
  }
}
