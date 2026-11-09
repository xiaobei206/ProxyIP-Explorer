$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogPath = Join-Path $ProjectRoot 'install-dependencies.log'
$TranscriptStarted = $false
$ExitCode = 0

function Write-Section([string]$Text) {
    Write-Host ''
    Write-Host $Text -ForegroundColor Cyan
}

function Invoke-NpmInstall([string]$Registry) {
    Write-Host "      Registry: $Registry" -ForegroundColor Gray
    & $script:NpmPath 'install' "--registry=$Registry" '--no-audit' '--no-fund' '--foreground-scripts' '--loglevel=info' 2>&1 | ForEach-Object { Write-Host $_ }
    return $LASTEXITCODE
}

function Remove-PartialElectronFiles([string]$ElectronRoot) {
    $DistPath = Join-Path $ElectronRoot 'dist'
    $PathFile = Join-Path $ElectronRoot 'path.txt'
    if (Test-Path -LiteralPath $DistPath) {
        Remove-Item -LiteralPath $DistPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $PathFile) {
        Remove-Item -LiteralPath $PathFile -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-ElectronBinaryDownload([string]$ElectronInstallScript, [string]$ElectronRoot, [string]$Mirror, [string]$Label) {
    Write-Host "      Electron binary source: $Label" -ForegroundColor Gray
    if ([string]::IsNullOrWhiteSpace($Mirror)) {
        Remove-Item Env:\ELECTRON_MIRROR -ErrorAction SilentlyContinue
    } else {
        $env:ELECTRON_MIRROR = $Mirror
    }
    # Force a clean download on the fallback attempt; do not trust a partial cache file.
    $env:force_no_cache = 'true'
    & $script:NodePath $ElectronInstallScript 2>&1 | ForEach-Object { Write-Host $_ }
    $DownloadExitCode = $LASTEXITCODE
    Remove-Item Env:\force_no_cache -ErrorAction SilentlyContinue
    if ($DownloadExitCode -ne 0) {
        Write-Host "      Electron downloader exited with code $DownloadExitCode." -ForegroundColor Yellow
        return $false
    }
    $ElectronExe = Join-Path $ElectronRoot 'dist\electron.exe'
    return (Test-Path -LiteralPath $ElectronExe)
}

try {
    Set-Location -LiteralPath $ProjectRoot
    try {
        if (Test-Path -LiteralPath $LogPath) { Remove-Item -LiteralPath $LogPath -Force }
        Start-Transcript -Path $LogPath -Force | Out-Null
        $TranscriptStarted = $true
    } catch {
        Write-Host "[WARN] Could not start transcript logging: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    try { $Host.UI.RawUI.WindowTitle = 'ProxyIP Explorer - Dependency Installer' } catch { }
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host ' ProxyIP Explorer 0.1.2 - Dependency Installer' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor DarkCyan

    Write-Section '[1/5] Checking Node.js and npm...'
    $NodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if (-not $NodeCommand) { throw '未找到 Node.js。请安装 Node.js 22.12 或更高版本，然后重新打开此窗口。下载地址：https://nodejs.org/' }
    $script:NodePath = $NodeCommand.Source
    $NodeVersionText = (& $script:NodePath --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $NodeVersionText -notmatch '^v?(\d+)\.') { throw "无法读取 Node.js 版本：$NodeVersionText" }
    $NodeMajor = [int]$Matches[1]
    if ($NodeMajor -lt 22) { throw "当前 Node.js 版本为 $NodeVersionText；Electron 45 要求 Node.js 22.12 或更新版本。" }
    if ($NodeMajor -eq 22 -and $NodeVersionText -match '^v?22\.(\d+)') {
        if ([int]$Matches[1] -lt 12) { throw "当前 Node.js 版本为 $NodeVersionText；Electron 45 要求 Node.js 22.12 或更新版本。" }
    }
    Write-Host "      Node.js: $NodeVersionText" -ForegroundColor Green
    Write-Host "      Node path: $script:NodePath" -ForegroundColor Gray

    $NpmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if (-not $NpmCommand) { throw '找不到 npm.cmd。请修复或重新安装 Node.js，并确保安装了 npm。' }
    $script:NpmPath = $NpmCommand.Source
    $NpmVersionText = (& $script:NpmPath --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "无法读取 npm 版本：$NpmVersionText" }
    Write-Host "      npm: $NpmVersionText" -ForegroundColor Green

    Write-Section '[2/5] Checking project files...'
    $PackagePath = Join-Path $ProjectRoot 'package.json'
    if (-not (Test-Path -LiteralPath $PackagePath)) { throw '当前目录中没有 package.json。请先完整解压项目 ZIP。' }
    $Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    if ($Package.version -ne '0.1.2') { throw "项目版本不匹配：package.json 显示 $($Package.version)，预期为 0.1.2。" }
    if ([version]$NodeVersionText.TrimStart('v') -lt [version]'22.12.0') { throw "Node.js 版本不足：$NodeVersionText。需要 22.12.0 或更高版本。" }
    Write-Host "      Project: $($Package.name) v$($Package.version)" -ForegroundColor Green

    Write-Section '[3/5] Installing npm dependencies...'
    Write-Host '      npm install 成功不代表 Electron 主程序已下载；0.1.2 会单独执行 Electron 官方安装器。' -ForegroundColor Gray
    $InstallExitCode = Invoke-NpmInstall 'https://registry.npmmirror.com'
    if ($InstallExitCode -ne 0) {
        Write-Host "[WARN] npmmirror npm registry failed (exit $InstallExitCode); retrying npmjs.org..." -ForegroundColor Yellow
        $InstallExitCode = Invoke-NpmInstall 'https://registry.npmjs.org'
    }
    if ($InstallExitCode -ne 0) { throw "npm install 失败，最后退出代码：$InstallExitCode。请检查网络、权限及日志。" }

    Write-Section '[4/5] Downloading the Electron Windows binary...'
    $ElectronRoot = Join-Path $ProjectRoot 'node_modules\electron'
    $ElectronInstallScript = Join-Path $ElectronRoot 'install.js'
    $ElectronPackagePath = Join-Path $ElectronRoot 'package.json'
    if (-not (Test-Path -LiteralPath $ElectronInstallScript)) {
        throw '找不到 node_modules\electron\install.js。npm 依赖可能未完整安装，请删除 node_modules 后重新运行安装器。'
    }
    if (-not (Test-Path -LiteralPath $ElectronPackagePath)) {
        throw '找不到 node_modules\electron\package.json，Electron npm 包没有正确安装。'
    }
    $ElectronPackage = Get-Content -LiteralPath $ElectronPackagePath -Raw | ConvertFrom-Json
    if ($ElectronPackage.version -ne $Package.devDependencies.electron) {
        throw "Electron npm 包版本不匹配：实际 $($ElectronPackage.version)，项目要求 $($Package.devDependencies.electron)。"
    }

    $ElectronExe = Join-Path $ElectronRoot 'dist\electron.exe'
    $VersionFile = Join-Path $ElectronRoot 'dist\version'
    $PathFile = Join-Path $ElectronRoot 'path.txt'
    $ExistingBinaryReady = $false
    if ((Test-Path -LiteralPath $ElectronExe) -and (Test-Path -LiteralPath $VersionFile) -and (Test-Path -LiteralPath $PathFile)) {
        $ExistingVersion = (Get-Content -LiteralPath $VersionFile -Raw).Trim().TrimStart('v')
        $ExistingBinaryReady = ($ExistingVersion -eq $ElectronPackage.version -and (Get-Item -LiteralPath $ElectronExe).Length -ge 10MB)
    }
    if (-not $ExistingBinaryReady) {
        Remove-PartialElectronFiles $ElectronRoot
        $Downloaded = Invoke-ElectronBinaryDownload $ElectronInstallScript $ElectronRoot 'https://npmmirror.com/mirrors/electron/' 'npmmirror Electron mirror'
        if (-not $Downloaded) {
            Write-Host '[WARN] Electron mirror did not produce electron.exe; retrying official Electron release host...' -ForegroundColor Yellow
            Remove-PartialElectronFiles $ElectronRoot
            $Downloaded = Invoke-ElectronBinaryDownload $ElectronInstallScript $ElectronRoot '' 'official GitHub release (default host)'
        }
        if (-not $Downloaded) { throw 'Electron 二进制下载失败。已尝试 npmmirror 和 Electron 官方发布源，请查看日志中的下载错误（DNS、TLS、代理或连接重置等）。' }
    } else {
        Write-Host "      Existing Electron $($ElectronPackage.version) binary found; skip download." -ForegroundColor Gray
    }

    Write-Section '[5/5] Verifying Electron installation...'
    if (-not (Test-Path -LiteralPath $ElectronExe)) { throw 'Electron 安装器结束后仍未找到 dist\electron.exe。' }
    if ((Get-Item -LiteralPath $ElectronExe).Length -lt 10MB) { throw 'electron.exe 文件体积异常（小于 10 MB），可能是下载不完整。请重新安装。' }
    if (-not (Test-Path -LiteralPath $VersionFile)) { throw '缺少 Electron dist\version 文件，安装结果不完整。' }
    $InstalledElectronVersion = (Get-Content -LiteralPath $VersionFile -Raw).Trim().TrimStart('v')
    if ($InstalledElectronVersion -ne $ElectronPackage.version) { throw "Electron 二进制版本不匹配：$InstalledElectronVersion，预期 $($ElectronPackage.version)。" }
    if (-not (Test-Path -LiteralPath $PathFile)) { throw '缺少 Electron path.txt，安装结果不完整。' }

    $ElectronVersionOutput = (& $ElectronExe --version 2>&1 | Out-String).Trim()
    $ElectronExitCode = $LASTEXITCODE
    if ($ElectronExitCode -ne 0 -or $ElectronVersionOutput -notmatch [regex]::Escape($ElectronPackage.version)) {
        throw "Electron 启动自检失败，退出代码 $ElectronExitCode，输出：$ElectronVersionOutput"
    }
    Write-Host "      Electron binary: OK ($ElectronVersionOutput)" -ForegroundColor Green
    Write-Host ''
    Write-Host '安装成功。现在可以运行“启动软件.bat”。' -ForegroundColor Green
}
catch {
    $ExitCode = 1
    Write-Host ''
    Write-Host '[ERROR] 安装未完成：' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    Write-Host "详细日志：$LogPath" -ForegroundColor Yellow
}
finally {
    Remove-Item Env:\ELECTRON_MIRROR -ErrorAction SilentlyContinue
    Remove-Item Env:\force_no_cache -ErrorAction SilentlyContinue
    if ($TranscriptStarted) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}

exit $ExitCode
