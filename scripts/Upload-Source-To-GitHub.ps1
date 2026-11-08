[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDir
)

$ErrorActionPreference = "Stop"

function Assert-GitSuccess {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed (exit code $LASTEXITCODE)."
    }
}

try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null).Trim()
    Assert-GitSuccess "Detect Git repository"
    if (-not $repoRoot) { throw "Run this script from inside the cloned ProxyIP-Explorer repository." }

    $branch = (git branch --show-current).Trim()
    Assert-GitSuccess "Detect current branch"
    if ($branch -ne "main") {
        throw "Current branch is '$branch', not 'main'. Stop and inspect the branch before uploading."
    }

    $origin = (git remote get-url origin 2>$null).Trim()
    Assert-GitSuccess "Read origin URL"
    if ($origin -notmatch "github\.com[:/]xiaobei206/ProxyIP-Explorer(?:\.git)?$") {
        throw "Origin does not look like xiaobei206/ProxyIP-Explorer: $origin"
    }

    $sourceRoot = (Resolve-Path -LiteralPath $SourceDir).Path
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "package.json"))) {
        throw "SourceDir does not contain package.json: $sourceRoot"
    }

    $dirty = @(git status --porcelain)
    Assert-GitSuccess "Check working tree"
    if ($dirty.Count -gt 0) {
        $dirty | ForEach-Object { Write-Host $_ }
        throw "Working tree is not clean. Commit or safely resolve these changes before running the uploader."
    }

    $package = Get-Content -LiteralPath (Join-Path $sourceRoot "package.json") -Raw | ConvertFrom-Json
    $version = [string]$package.version
    if (-not $version) { throw "Could not read version from source package.json." }

    $requiredFiles = @(
        "main.cjs",
        "preload.cjs",
        "package.json",
        "安装依赖.bat",
        "启动软件.bat",
        "打包便携版EXE.bat",
        "版本说明.txt"
    )

    foreach ($name in $requiredFiles) {
        $sourceFile = Join-Path $sourceRoot $name
        if (-not (Test-Path -LiteralPath $sourceFile)) {
            throw "Required source file is missing: $sourceFile"
        }
        Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $repoRoot $name) -Force
    }

    foreach ($folder in @("src", "scripts", "tests")) {
        $sourceFolder = Join-Path $sourceRoot $folder
        if (-not (Test-Path -LiteralPath $sourceFolder)) {
            throw "Required source folder is missing: $sourceFolder"
        }
        $destinationFolder = Join-Path $repoRoot $folder
        New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
        Copy-Item -Path (Join-Path $sourceFolder "*") -Destination $destinationFolder -Recurse -Force
    }

    # Keep this repository's hardened ignore rules instead of copying an older source ZIP's file.
    @'
node_modules/
dist/
.DS_Store
*.log
.env
.env.*
!.env.example
npm-debug.log*
'@ | Set-Content -LiteralPath (Join-Path $repoRoot ".gitignore") -Encoding utf8

    Push-Location $repoRoot
    try {
        git add .gitignore main.cjs preload.cjs package.json src scripts tests 安装依赖.bat 启动软件.bat 打包便携版EXE.bat 版本说明.txt
        Assert-GitSuccess "Stage source files"

        git diff --cached --check
        Assert-GitSuccess "Check staged diff"

        Write-Host ""
        Write-Host "Repository: $repoRoot"
        Write-Host "Source version: $version"
        Write-Host "Staged changes:"
        git diff --cached --stat
        Write-Host ""
        $answer = Read-Host "Type PUSH to commit and push these source files to origin/main"
        if ($answer -cne "PUSH") {
            Write-Host "Cancelled. Files remain copied locally; nothing was committed or pushed."
            exit 0
        }

        git commit -m "feat: add ProxyIP Explorer $version source"
        Assert-GitSuccess "Commit source files"

        git push origin main
        Assert-GitSuccess "Push main"

        Write-Host ""
        Write-Host "Push completed. Verify the repository page and confirm main.cjs, package.json, src/, scripts/ and tests/ are visible."
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "No force-push was attempted. Review the message above and the current Git status."
    exit 1
}
