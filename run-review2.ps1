# Chạy toàn bộ kiểm thử và ghi kết quả vào review-output.txt (cùng thư mục với script này).
# Cách chạy: mở PowerShell tại D:\InternshipManagement rồi gõ:
#   powershell -ExecutionPolicy Bypass -File .\run-review.ps1
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$log = Join-Path $root 'review-output.txt'
"=== REVIEW RUN $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Encoding utf8

function Step($title, $dir, $cmd) {
  "`n========== $title ==========" | Out-File $log -Append -Encoding utf8
  Push-Location $dir
  $out = cmd /c "$cmd 2>&1"
  $code = $LASTEXITCODE
  Pop-Location
  $out | Out-File $log -Append -Encoding utf8
  "---- exit code: $code ----" | Out-File $log -Append -Encoding utf8
  Write-Host "$title -> exit $code"
}

Step 'ENV' $root 'node -v && npm -v && where mysql'
Step 'TEST DB SETUP' (Join-Path $root 'server') 'npm run test:setup'
Step 'SERVER npm test' (Join-Path $root 'server') 'npm test'
Step 'REVIEW FINDINGS (test xac nhan loi)' (Join-Path $root 'server') 'npx cross-env NODE_ENV=test node --test tests/reviewFindings2.test.js'
Step 'CLIENT lint' (Join-Path $root 'client') 'npm run lint'
Step 'CLIENT build' (Join-Path $root 'client') 'npm run build'
Step 'CLIENT test' (Join-Path $root 'client') 'npm test'
Step 'E2E' $root 'npx playwright test'

"`n=== DONE ===" | Out-File $log -Append -Encoding utf8
Write-Host "Xong. Ket qua o: $log"
