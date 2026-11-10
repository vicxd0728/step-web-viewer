@echo off
cd /d "%~dp0"
where uv.exe >nul 2>&1
if errorlevel 1 (
  echo Install uv from https://docs.astral.sh/uv/getting-started/installation/ and try again.
  pause
  exit /b 1
)
set "READER_PYTHON=3.12"
where py.exe >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%i in ('py -3.12 -c "import sys; print(sys.executable)" 2^>nul') do set "READER_PYTHON=%%i"
)
uv run --python "%READER_PYTHON%" --with "parasolid-kit[occt]==0.3.15" python "%~dp0tools\parasolid_reader.py"
if errorlevel 1 pause
