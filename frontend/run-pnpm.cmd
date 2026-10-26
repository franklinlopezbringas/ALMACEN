@echo off
setlocal
if exist "%~dp0..\.tools\node-path.txt" (
  set /p GYMFLOW_NODE_DIRECTORY=<"%~dp0..\.tools\node-path.txt"
)
if defined GYMFLOW_NODE_DIRECTORY set "PATH=%GYMFLOW_NODE_DIRECTORY%;%PATH%"
if exist "%~dp0..\.tools\pnpm\node_modules\pnpm\bin\pnpm.mjs" goto local_pnpm
call npm.cmd exec --yes --package=pnpm@12.14.0 -- pnpm %*
exit /b %errorlevel%

:local_pnpm
node "%~dp0..\.tools\pnpm\node_modules\pnpm\bin\pnpm.mjs" %*
exit /b %errorlevel%
