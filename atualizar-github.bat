@echo off
setlocal

cd /d "%~dp0"

echo === Status atual ===
git status -sb

echo.
echo === Adicionando arquivos ===
git add -A

echo.
git diff --cached --quiet
if %errorlevel%==0 (
  echo Nao ha mudancas para commitar. Encerrando.
  exit /b 0
)

set "MSG="
set /p MSG=Mensagem do commit (vazio para usar padrao): 
if "%MSG%"=="" set "MSG=Atualizacao do sistema"

echo.
echo === Commit ===
git commit -m "%MSG%"
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo === Push ===
git push origin main
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo Atualizacao no GitHub concluida com sucesso.

endlocal

