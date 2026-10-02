$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
$zipPath = Join-Path $artifactRoot 'KidsDashboard-iMac.zip'
Add-Type -AssemblyName System.IO.Compression
$rootFiles = @('.config.example','.env.example','.gitignore','.vercelignore','AGENTS.md','auth.ts','components.json','compose.yaml','next-env.d.ts','next.config.ts','package-lock.json','package.json','postcss.config.mjs','prisma.config.ts','proxy.ts','README.md','tsconfig.json','vercel.json')
$folders = @('app','components','lib','prisma','public','collector','classroom-extension','docs','macos','tests')
$scriptFiles = @('build-cloud-collector.mjs','setup-collector.mjs','setup-local-db.mjs','macos-schedule.mjs')
$files = @($rootFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($folder in $folders) {
  $folderPath = Join-Path $projectRoot $folder
  if (Test-Path -LiteralPath $folderPath) {
    $files += Get-ChildItem -LiteralPath $folderPath -File -Recurse | Where-Object { $_.FullName -notmatch '[\\/](node_modules|dist|\.collector)[\\/]' }
  }
}
$files += $scriptFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $PSScriptRoot $_) }
$stream = [IO.File]::Open($zipPath,[IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative = [IO.Path]::GetRelativePath($projectRoot,$file.FullName).Replace('\','/')
    if ($relative.StartsWith('../') -or (($file.Name -like '.env*') -and $file.Name -ne '.env.example') -or (($file.Name -like '.config*') -and $file.Name -ne '.config.example')) { throw 'Private or unexpected file rejected.' }
    $entry = $archive.CreateEntry('KidsDashboard/'+$relative,[IO.Compression.CompressionLevel]::Optimal)
    if ($file.Extension -eq '.command') { $entry.ExternalAttributes = -2115174400 }
    $inputStream = $file.OpenRead()
    $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
  }
} finally { $archive.Dispose(); $stream.Dispose() }
$verify = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if ($verify.Entries.Count -ne $files.Count) { throw 'Archive count mismatch.' }
  Write-Output ('Packaged '+$verify.Entries.Count+' source files. Private configuration and dependencies excluded.')
} finally { $verify.Dispose() }
Get-FileHash -LiteralPath $zipPath -Algorithm SHA256 | Select-Object Hash
