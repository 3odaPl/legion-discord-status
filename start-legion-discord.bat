@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -m pip install --quiet pypresence
python legion_discord.py
pause
