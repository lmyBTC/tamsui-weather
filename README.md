# 🌊 淡水潮汐與氣象極簡 Web App (PWA)

專為台灣北部「淡水」水域（淡水老街、漁人碼頭、淡水河口）量身打造的專屬個人即時潮汐與氣象 PWA（Progressive Web App）。

核心哲學：**「秒開、零干擾、極致純粹」**。出門釣魚、水上活動、河岸休閒運動時，打開手機一秒即可一覽即時漲退潮狀態、下一次乾滿潮倒數、24H 平滑潮位正弦曲線圖與即時天氣預報。

---

## 🌟 核心特色

- 🎯 **淡水專屬純粹體驗**：移除一切多餘選項與繁複選單，專心呈現淡水單一水域之極致看板。
- ⚡ **純前端零伺服器架構**：100% 靜態網頁（Vanilla HTML5 + Tailwind CSS + 原生 ES6+），無後端負擔，相容 GitHub Pages 與 Cloudflare Pages 免費託管。
- 📊 **HTML5 Canvas 24H 潮位正弦曲線**：自適應 Retina 高解析度螢幕，動態計算餘弦補間平滑曲線，標註高低潮極值點與即時時間呼吸燈光點。
- ⏱️ **秒級即時倒數與狀態監控**：即時計算當前「▲ 漲潮中」或「▼ 退潮中」，精確計算距離下次乾滿潮之剩餘時間。
- 📱 **完備 PWA 離線機制**：
  - 支援 iOS Safari「加入主畫面」全螢幕運行無網址列。
  - 支援 Android Chrome 一鍵安裝為獨立原生應用程式。
  - Service Worker 預先快取核心 App Shell 靜態資源。
  - 智慧 6 小時 TTL 快取機制，海邊訊號微弱或無網路時自動降級顯示最新快取或內建模擬展示資料。
- 🔐 **隱私與安全防護**：氣象署 API 金鑰儲存於使用者瀏覽器本地 `LocalStorage`，絕不外流或硬編碼於代碼庫中。

---

## 📂 檔案架構地圖 (File Map)

```text
WebApp_weather/
├── index.html          # 主頁面骨架、深色海洋主題排版、設定彈窗與 DOM 結構
├── app.js              # 應用程式驅動核心：狀態管理、定時器、LocalStorage 快取與 UI 渲染
├── api.js              # 中央氣象署 OpenData API 串接模組 (潮汐 F-A0021-001 與鄉鎮氣象 F-D0047-069)
├── tide.js             # 潮汐數學演算法、漲退潮狀態計算、倒數計時與 Canvas 24H 波形繪製引擎
├── sw.js               # Service Worker 離線快取守護者 (App Shell + Stale-While-Revalidate)
├── manifest.json       # W3C Web App Manifest (定義獨立視窗 standalone、主題色與圖示)
├── icon.svg            # 向量 App Icon (海浪波紋與漲潮漸層意象，支援任意尺寸無失真縮放)
├── preview.py          # 本機一鍵啟動靜態預覽伺服器 (基於 Python 3 標準庫 http.server)
├── start_preview.bat   # Windows 雙擊即開預覽腳本
└── README.md           # 本專案 SSOT 規格與部屬說明文件
```

---

## 🗺️ 意圖導航速查表 (Intent-to-Code Mapping)

| 開發者想要... | 核心對應檔案 | 關鍵函式 / 區塊 |
| :--- | :--- | :--- |
| 修改頁面視覺排版、文字標題或 Tailwind 樣式 | `index.html` | 頂部 Header、主卡片與 `<style>` 區塊 |
| 調整氣候資訊與潮汐時序列表的 DOM 結構 | `index.html` | `#weatherSummaryCard`, `#tideTimelineList` |
| 調整氣象署 API 欄位解析或資料集代號 | `api.js` | `fetchTideForecast()`, `fetchTamsuiWeather()` |
| 調整內建模擬示範資料 (Mock Data) | `api.js` | `getTamsuiMockData()` |
| 修改漲退潮判定、時間倒數格式或餘弦潮高推估 | `tide.js` | `getCurrentTideStatus()`, `estimateTideHeight()` |
| 客製化 Canvas 潮位波浪顏色、平滑度或當前時間指標 | `tide.js` | `drawTideChart()` |
| 修改 LocalStorage 快取過期時間 (TTL) 或金鑰存取 | `app.js` | `CACHE_TTL_MS`, `loadApiKey()`, `saveApiKey()` |
| 調整離線橫幅提示或手動重新整理行為 | `app.js` | `setOfflineBanner()`, `refreshData()` |
| 增減離線快取資源清單或修改 SW 快取策略 | `sw.js` | `PRECACHE_ASSETS`, `fetch` 事件處理器 |
| 調整 PWA 安裝名稱、色彩或顯示模式 | `manifest.json` | `name`, `theme_color`, `display` |

---

## 📦 安裝與使用指南 (Installation & Setup)

本專案採**純前端零伺服器（Serverless）極簡架構**，**不需要**執行任何 `npm install` 或繁雜的建構打包編譯，提供多種最適合使用場景的安裝與執行方式：

---

### 📱 方式一：手機端安裝為 App（最推薦・海邊出門必備）

本 Web App 為標準 **PWA (Progressive Web App)**，**無需透過 App Store 或 Google Play 商店審查下載**，直接透過手機瀏覽器 10 秒內即可安裝至桌面，享受**無網址列全螢幕**與**離線快取**的原生 App 體驗：

#### 🍏 iOS 裝置（iPhone / iPad）
1. 使用 **Safari** 瀏覽器開啟應用程式網址（例如 GitHub Pages 或本機預覽網址）。
2. 點擊螢幕下方工具列中央的「**分享**」圖示（帶向上箭頭的方塊按鈕）。
3. 在選單中向下滑動，找到並點選「**加入主畫面**」（Add to Home Screen）。
4. 確認名稱為「**淡水潮汐**」，點擊右上角「**新增**」。
5. 手機桌面隨即出現專屬海浪圖示，點開即以獨立全螢幕運行，無 Safari 頂部與底部導覽列。

#### 🤖 Android 裝置（Google Chrome / Edge / Samsung 瀏覽器）
1. 使用 **Google Chrome** 瀏覽器開啟應用程式網址。
2. 頁面載入完成後，底部通常會自動跳出「**將淡水潮汐新增至主畫面**」橫幅；或點擊瀏覽器右上角的「**選單**」（三個垂直圓點）。
3. 點選「**安裝應用程式**」或「**新增至主畫面**」。
4. 點擊「**安裝**」確認，系統將在桌面與應用程式抽屜建立原生獨立 App。

> [!TIP]
> **💡 常見問題：如果我把整個 `WebApp_weather` 資料夾複製到手機資料夾中，要如何啟動與建立桌面圖示？**
>
> 1. **為什麼直接用檔案管理員點開 `index.html` 不能安裝成 App？**
>    - 現代手機瀏覽器基於安全防護政策，以 `file:///`（本機檔案協定）開啟時，**強制禁止**註冊離線快取（Service Worker）與觸發 PWA 安裝圖示機制。
> 2. **最推薦做法：免傳資料夾，利用同一 Wi-Fi 或免費雲端一次搞定（極速且完美）：**
>    - **電腦開預覽，手機連同 Wi-Fi 開啟**：在電腦執行 `python preview.py`，終端機會顯示電腦 IP（例如 `http://192.168.1.100:8080/`），手機瀏覽器輸入此網址打開後，點擊「**安裝應用程式**」。
>    - **為什麼這樣更好？** 本 App 具備 PWA 離線機制，安裝成功後**所有網頁與圖片會自動快取進手機內部**。之後就算手機開飛航模式或在海邊無網路，點擊手機桌面圖示依舊能秒開運作，完全不需要手動把資料夾拷貝到手機。
> 3. **若堅持在手機本機資料夾內獨立啟動（完全不連電腦）：**
>    - **Android 用戶**：在 Google Play 免費下載輕量 Web Server App（例如 **Simple HTTP Server** 或 **AWebServer**）。
>    - 打開 App，將 Document Root（根目錄）選擇您手機內的 `WebApp_weather` 資料夾，點擊「Start」。
>    - 手機瀏覽器開啟 `http://127.0.0.1:8080`，此時為標準 HTTP 協定，瀏覽器就會出現「**安裝應用程式**」按鈕，點擊即可建立專屬桌面圖示！

---

### 💻 方式二：電腦端安裝為獨立桌面軟體（Windows / macOS / Linux）

利用現代 Chromium 核心瀏覽器（Edge / Chrome），可直接將本網頁安裝為電腦原生桌面軟體：

1. 使用 **Google Chrome** 或 **Microsoft Edge** 開啟網頁。
2. 查看瀏覽器**網址列最右側**，會出現一個「**電腦螢幕帶有向下箭頭**」的安裝圖示（或提示「可安裝應用程式」）。
3. 點擊該圖示並選擇「**安裝**」。
   > *（若未見圖示，可點選瀏覽器右上角選單 `...` ->「應用程式」->「將此站台作為應用程式安裝」）*
4. 安裝完成後，系統會自動在桌面與「開始功能表」建立捷徑，以獨立視窗運行，支援固定至工作列，開機即可隨時一鍵查看。

---

### 🛠️ 方式三：本機電腦免安裝快速運行（Local Preview）

適合開發者、測試或離線本機使用。完全無需安裝 Node.js 或第三方套件：

#### 1. Windows 一鍵雙擊啟動（最簡便）
- 直接在檔案總管中雙擊執行 `WebApp_weather/start_preview.bat`。
- 腳本會自動啟動靜態伺服器並自動開啟預設瀏覽器造訪 `http://localhost:8080/`。

#### 2. Python 終端啟動（跨平台 Windows / Mac / Linux）
```bash
# 切換至 WebApp_weather 目錄
cd WebApp_weather

# 啟動專用預覽伺服器 (預設 8080 埠，自動開啟瀏覽器)
python preview.py

# 若需自訂連接埠或靜音背景啟動：
python preview.py --port 3000 --no-browser
```
*(若本機已有 Python，亦可直接使用內建伺服器：`python -m http.server 8080`)*

#### 3. 其它靜態伺服器（VS Code / Node.js）
- **VS Code**：安裝擴充套件「Live Server」，在 `index.html` 按右鍵選擇「Open with Live Server」。
- **Node.js**：在專案目錄下執行 `npx serve .`。

---

### 🌐 方式四：免伺服器雲端免費部屬（Serverless Deployment）

本專案採純靜態與相對路徑設計，可 100% 免費託管於任何靜態網頁平台：

#### 1. GitHub Pages (推薦，永久免費)

##### 方案 A：託管於獨立 GitHub 儲存庫根目錄
1. 在 GitHub 建立新 Repository（例如 `tamsui-tide`）。
2. 將 `WebApp_weather` 資料夾內的檔案推送至儲存庫的 `main` 分支根目錄。
3. 進入儲存庫的 **Settings** -> **Pages**。
4. **Source** 選擇 `Deploy from a branch`，Branch 選擇 `main`，目錄選擇 `/ (root)`，點擊 **Save**。
5. 約 1 分鐘後，即可獲得專屬 HTTPS 網址：`https://<使用者名稱>.github.io/tamsui-tide/`。

##### 方案 B：在現有 Mono-repo 中以子目錄部屬
若專案包含其他工具，可利用 GitHub Actions 自動將 `WebApp_weather/` 目錄單獨部署至 `gh-pages` 分支：
```yaml
# .github/workflows/deploy-weather.yml
name: Deploy WebApp to GitHub Pages
on:
  push:
    branches: [main]
    paths:
      - 'WebApp_weather/**'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'WebApp_weather'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 2. Cloudflare Pages (極速全球 CDN)
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) 點選 **Workers & Pages** -> **Create application** -> **Pages**。
2. 連結 GitHub 儲存庫，Build output directory 填入 `WebApp_weather`（若為獨立 Repo 則填 `/`）。
3. 點選 **Save and Deploy**，30 秒內即可取得具備全球 CDN 加速之 HTTPS 網址，支援自訂個人網域。

---

### 🔑 氣象署 API 金鑰設定說明 (首次設定)

1. 前往 [中央氣象署氣象資料開放平台](https://opendata.cwa.gov.tw/) 免費註冊帳號。
2. 登入後至「會員中心」->「個人授權碼」，複製專屬的 32 碼授權碼（API Key）。
3. 打開淡水潮汐 Web App，點擊右上角「**⚙️ 設定**」齒輪按鈕。
4. 將 32 碼授權碼貼入欄位中，點擊「**儲存並更新**」。
5. 授權碼將安全儲存於您本機瀏覽器的 LocalStorage 中，App 將立即自動同步氣象署最新之淡水潮汐與氣象資料。
6. **未填寫金鑰亦可使用**：App 內建淡水河口示範數據 (Mock Data)，UI 與 Canvas 波形圖皆能正常完整運作體驗。

---

## 🧪 品質保證與自動化驗證

所有功能均具備自動化回歸驗證腳本：
- `scratch/tmp/verify_phase1.mjs`: API 模組欄位對齊與 Mock 數據結構驗證
- `scratch/tmp/verify_phase2.mjs`: UI 骨架、DOM 節點 ID、淡水專屬排版驗證
- `scratch/tmp/verify_phase3.mjs`: 潮汐正弦波數學演算法、極值判定、Canvas 繪圖渲染驗證
- `scratch/tmp/verify_phase4.mjs`: 6 小時 TTL 快取機制、離線降級、PWA Manifest 與 Service Worker 驗證
- `scratch/tmp/verify_phase5.mjs`: HTTP 靜態伺服器連線、MIME-Type 支援、相對路徑與全系統整合驗收

執行驗證指令：
```bash
node scratch/tmp/verify_phase5.mjs
```
