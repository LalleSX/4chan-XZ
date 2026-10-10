# Build the project and copy the readable userscript to the clipboard.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Push-Location -LiteralPath $PSScriptRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE."
  }

  $userscriptPath = Join-Path $PSScriptRoot 'dist/4chan-XZ.user.js'
  $userscript = Get-Content -LiteralPath $userscriptPath -Raw -Encoding UTF8
  Set-Clipboard -Value $userscript
  Write-Host 'Built project and copied dist/4chan-XZ.user.js to the clipboard.'
}
finally {
  Pop-Location
}
