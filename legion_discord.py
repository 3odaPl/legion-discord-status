# -*- coding: utf-8 -*-
"""
Легион → Discord: показывает в профиле Discord «Играет в Legion».

Как работает:
  * эта программа держит связь с приложением Discord на компьютере;
  * скрипт для Tampermonkey (legion-discord.user.js) раз в 15 секунд сообщает ей,
    что открыт сайт Легиона и где ты (в шахте, какой этаж);
  * сайт закрыт (сообщений нет 2–3 минуты, или вкладку закрыли) — статус пропадает сам.

Запуск:  python legion_discord.py          — статус по сигналу от браузера
         python legion_discord.py --always — статус всё время, пока программа запущена (без скрипта в браузере)
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

# ---------------- настройки ----------------
CLIENT_ID = "ВСТАВЬ_СЮДА_APPLICATION_ID"   # Discord Developer Portal → твоё приложение «Legion» → Application ID
PORT = 47321                                # тот же порт стоит в скрипте для Tampermonkey
LARGE_IMAGE = "legion"                      # ключ картинки из Rich Presence → Art Assets (нет картинки — просто без неё)
GAME_URL = "https://play.multidonate.ru/c/zakvielchannel/"
SHOW_BUTTON = True                          # кнопка «Открыть Легион» в профиле
TIMEOUT = 150                               # секунд без сигнала от браузера — убрать статус (фоновые вкладки Chrome шлют реже)
# -------------------------------------------

try:
    from pypresence import Presence
except ImportError:
    print("Нет библиотеки pypresence. Установи командой:  pip install pypresence")
    input("Enter — выход")
    sys.exit(1)

ALWAYS = "--always" in sys.argv
lock = threading.Lock()
state = {"seen": time.time() if ALWAYS else 0.0, "details": "На сайте Легиона", "state": None}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            d = json.loads(self.rfile.read(min(n, 4096)) or b"{}")
        except Exception:
            d = {}
        with lock:
            if d.get("closed"):
                state["seen"] = 0.0
            else:
                state["seen"] = time.time()
                state["details"] = str(d.get("details") or "На сайте Легиона")[:120]
                state["state"] = (str(d["state"])[:120] or None) if d.get("state") else None
        self.send_response(204); self._cors(); self.end_headers()

    def log_message(self, *a):
        pass   # не засоряем окно


def serve():
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


def main():
    if not CLIENT_ID.isdigit():
        print("Сначала впиши Application ID в CLIENT_ID (см. инструкцию).")
        input("Enter — выход")
        return
    threading.Thread(target=serve, daemon=True).start()
    print(f"Жду сигнала от браузера на 127.0.0.1:{PORT}" + (" (режим --always)" if ALWAYS else ""))

    rpc, shown, start, last_push = None, None, None, 0.0
    while True:
        try:
            if rpc is None:
                rpc = Presence(CLIENT_ID)
                rpc.connect()
                print("Discord подключён")
                shown = None

            with lock:
                active = ALWAYS or time.time() - state["seen"] < TIMEOUT
                want = (state["details"], state["state"]) if active else None

            if want and start is None:
                start = int(time.time())          # «играет N минут» — с начала сессии
            if not want:
                start = None

            # Discord разрешает обновлять статус не чаще раза в 15 с — шлём только изменения
            if want != shown and time.time() - last_push >= 15:
                if want:
                    kw = dict(details=want[0], start=start, large_image=LARGE_IMAGE, large_text="Легион")
                    if want[1]:
                        kw["state"] = want[1]
                    if SHOW_BUTTON:
                        kw["buttons"] = [{"label": "Открыть Легион", "url": GAME_URL}]
                    rpc.update(**kw)
                    print("Статус:", " · ".join(x for x in want if x))
                else:
                    rpc.clear()
                    print("Статус убран")
                shown, last_push = want, time.time()
        except KeyboardInterrupt:
            break
        except Exception as e:   # Discord закрыт или перезапущен — пробуем снова
            if rpc is not None:
                print("Нет связи с Discord, пробую снова…", type(e).__name__)
            try:
                if rpc is not None:
                    rpc.close()
            except Exception:
                pass
            rpc, shown = None, None
            time.sleep(10)
            continue
        time.sleep(2)

    try:
        if rpc is not None:
            rpc.clear(); rpc.close()
    except Exception:
        pass


if __name__ == "__main__":
    main()
