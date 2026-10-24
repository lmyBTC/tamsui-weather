@echo off
chcp 65001 >nul
title 淡水潮汐氣象 PWA 本機預覽
echo 正在啟動淡水潮汐氣象 PWA 本機預覽伺服器...
python "%~dp0preview.py"
pause
