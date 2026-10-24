"""
WebApp_weather/preview.py
淡水潮汐氣象 PWA 本機一鍵預覽靜態伺服器
採用 Python 標準庫 http.server，零第三方相依性
"""

import argparse
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Windows UTF-8 防禦：避免 cp950 終端因 emoji 或特殊符號崩潰
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


class UTF8StaticHTTPRequestHandler(SimpleHTTPRequestHandler):
    """
    自訂 HTTP 處理器：
    - 強制支援 UTF-8 字元編碼
    - 支援 ES 模組 (.js)、Web App Manifest (.json) 與 SVG (.svg) 的精確 MIME 類型
    - 停用快取標頭以便本地即時除錯
    """

    def end_headers(self):
        # 本機除錯開發時停用快取
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        content_type = super().guess_type(path)
        if path.endswith(".js") or path.endswith(".mjs"):
            return "application/javascript; charset=utf-8"
        if path.endswith(".json") or path.endswith(".webmanifest"):
            return "application/json; charset=utf-8"
        if path.endswith(".svg"):
            return "image/svg+xml"
        if path.endswith(".html"):
            return "text/html; charset=utf-8"
        return content_type


def run_preview_server(port: int = 8080, open_browser: bool = True):
    web_dir = Path(__file__).resolve().parent
    os.chdir(web_dir)

    server_address = ("127.0.0.1", port)
    try:
        httpd = ThreadingHTTPServer(server_address, UTF8StaticHTTPRequestHandler)
    except OSError as e:
        # 若連接埠被佔用，嘗試自動遞增連接埠
        if port < 8090:
            print(f"[提示] 連接埠 {port} 被佔用，嘗試使用 {port + 1}...")
            run_preview_server(port + 1, open_browser)
            return
        raise e

    url = f"http://localhost:{port}/"
    print("=" * 60)
    print("🌊 淡水潮汐與氣象極簡 Web App (PWA) 本機預覽伺服器")
    print(f"📁 託管目錄: {web_dir}")
    print(f"🔗 預覽網址: {url}")
    print("💡 按下 Ctrl+C 即可終止伺服器")
    print("=" * 60)

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"[警告] 無法自動喚起瀏覽器: {e}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[系統] 伺服器已正常停止。")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="淡水潮汐氣象 PWA 本機靜態預覽伺服器")
    parser.add_argument("--port", type=int, default=8080, help="HTTP 監聽連接埠 (預設: 8080)")
    parser.add_argument("--no-browser", action="store_true", help="啟動時不要自動開啟系統瀏覽器")
    args = parser.parse_args()

    run_preview_server(port=args.port, open_browser=not args.no_browser)
