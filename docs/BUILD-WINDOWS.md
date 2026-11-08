# Windows 安装、运行、打包与源码上传

## 环境要求

- Windows 10/11 x64。
- Node.js 至少达到根目录 package.json 声明的版本，目前是 >=22.12.0。
- Windows PowerShell 5.1 或 PowerShell 7。
- Git for Windows（用于 clone / commit / push）。
- 网络可以访问 npm registry，并能下载 Electron 平台二进制。网络环境会影响选择的下载源。

检查：

~~~powershell
node --version
npm.cmd --version
git --version
~~~

Windows PowerShell 里优先使用 npm.cmd，因为在某些配置下 npm 会调用 npm.ps1 并触发 ExecutionPolicy 限制。不要为一个项目默认修改全局执行策略。

## 安装和启动

1. 将源代码 ZIP 解压到有写入权限的普通目录。
2. 双击 安装依赖.bat。
3. 观察安装器各阶段；日志写到项目根目录的 install-dependencies.log。
4. 只有脚本明确报告完成后，才双击 启动软件.bat。
5. 首次打开后刷新资源，再开始检测。

命令行等价操作：

~~~powershell
npm.cmd install
node .\node_modules\electron\install.js
npm.cmd test
npm.cmd start
~~~

如依赖安装器已自动调用 Electron 安装脚本，不要不加判断地并行启动多个 npm install 进程。

## 为什么要单独下载 Electron

npm install 成功，只能证明 npm 认为 JavaScript 包安装阶段成功。较新 Electron 版本不一定会通过过去的默认生命周期脚本自动落下 Windows electron.exe。当前安装器因此显式执行 Electron 包内 install.js，再验证：
- node_modules\electron\dist\electron.exe 存在并非空文件；
- Electron 安装生成的版本和路径标记合理；
- 运行 electron.exe --version 能返回版本。

如果失败：
1. 保留 install-dependencies.log。
2. 不要先删 node_modules 或关闭终端后丢失错误上下文。
3. 查看错误是在 npm registry 包安装、npmmirror 二进制下载、GitHub 官方源回退，还是 electron.exe 启动阶段。
4. 将完整日志交给开发者；日志中不要包含 API Key 或其他秘密。

## 打包

运行：

~~~powershell
npm.cmd run dist:portable
~~~

或双击 打包便携版EXE.bat。便携版输出在 dist\。打包前必须安装完整依赖和 Electron 二进制。若打包报错，应保留完整控制台输出和日志，不要只反馈最后一行。

首发交付文件建议命名：

- ProxyIP-Explorer-0.1.3-source.zip
- ProxyIP-Explorer-0.1.3-portable.exe
- ProxyIP-Explorer-0.1.3-build-report.md
- ProxyIP-Explorer-0.1.3-SHA256.txt

只有实际生成并验证后才提供对应文件或 SHA。

## 本地自动测试

~~~powershell
npm.cmd test
~~~

当前测试不需要先启动 Electron，也不要求访问真实上游服务。它们覆盖目录数据解析、探针响应解析、主机名匹配和版本/安装器入口。真实 Windows 安装、上游网络、长期运行和 EXE 打包还必须单独检查。

## 将 0.1.2 源码上传到此仓库（初次同步）

本仓库先初始化了维护文档；如 GitHub 文件树还没有 main.cjs、preload.cjs、package.json、src/、scripts/ 和 tests/，按以下步骤把 0.1.2 源码复制到已克隆的仓库中。请先下载并解压之前交付的 ProxyIP-Explorer-0.1.2-source.zip。解压后设置 $SourceDir 为**包含 package.json 的目录**。

### 第一步：找出源码目录

~~~powershell
Get-ChildItem "O:\ProxyIP-Explorer" -Filter package.json -Recurse -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName
~~~

假如显示类似 O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2\package.json，那么 $SourceDir 就设置为 O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2。以你电脑实际结果为准。

### 第二步：复制源码并推送

以下命令保留仓库中已经提交的 README 和开发文档；不要将源码 ZIP 内的旧 README 覆盖本仓库维护版 README。

~~~powershell
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/xiaobei206/ProxyIP-Explorer.git"
$RepoDir = "O:\ProxyIP-Explorer\ProxyIP-Explorer-repo"
$SourceDir = "O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2" # 修改成实际目录

if (-not (Test-Path (Join-Path $SourceDir "package.json"))) {
  throw "SourceDir 中找不到 package.json。请把 SourceDir 改成包含 package.json 的源码目录。"
}

if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
  if (Test-Path $RepoDir) {
    throw "RepoDir 已存在但不是 Git 仓库。请选择一个不存在的新目录，或先备份并整理该目录。"
  }
  git clone $RepoUrl $RepoDir
  if ($LASTEXITCODE -ne 0) { throw "git clone 失败，请检查网络和 GitHub 登录状态。" }
}

Set-Location $RepoDir
$branch = git branch --show-current
if ($branch -ne "main") { throw "当前分支不是 main（实际：$branch）。请先核对分支，不要盲目推送。" }

$topFiles = @(
  "main.cjs",
  "preload.cjs",
  "package.json",
  "安装依赖.bat",
  "启动软件.bat",
  "打包便携版EXE.bat",
  "版本说明.txt"
)

foreach ($name in $topFiles) {
  $from = Join-Path $SourceDir $name
  if (-not (Test-Path $from)) { throw "源码缺少必需文件：$from" }
  Copy-Item $from -Destination (Join-Path $RepoDir $name) -Force
}

foreach ($dirName in @("src", "scripts", "tests")) {
  $from = Join-Path $SourceDir $dirName
  if (-not (Test-Path $from)) { throw "源码缺少必需目录：$from" }
  $to = Join-Path $RepoDir $dirName
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  Copy-Item (Join-Path $from "*") -Destination $to -Recurse -Force
}

@'
node_modules/
dist/
.DS_Store
*.log
.env
.env.*
!.env.example
npm-debug.log*
'@ | Set-Content -Encoding utf8 (Join-Path $RepoDir ".gitignore")

git status --short
git add main.cjs preload.cjs package.json src scripts tests 安装依赖.bat 启动软件.bat 打包便携版EXE.bat 版本说明.txt .gitignore
git diff --cached --stat
git commit -m "feat: add ProxyIP Explorer 0.1.2 source"
if ($LASTEXITCODE -ne 0) { throw "git commit 失败。请检查 git user.name / git user.email 和暂存区。" }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push 失败。确认 GitHub 登录、仓库写权限及远端是否有新提交；不要强推覆盖远端。" }

Write-Host "源码已推送。请打开 https://github.com/xiaobei206/ProxyIP-Explorer 并确认 main.cjs、package.json、src、scripts、tests 均可见。"
~~~

如果 git 提示未配置身份，请按需设置本机提交身份（不是账号密码）：

~~~powershell
git config --global user.name "你的 GitHub 显示名称"
git config --global user.email "与你 GitHub 提交关联的邮箱"
~~~

**不要把 Personal Access Token 粘贴到脚本或发到聊天中。** 使用 Git Credential Manager 的浏览器登录流程。

如果仓库在你执行命令前已经新增了源码或别人的提交，不要使用 --force；先 git status、git pull --rebase origin main 并解决冲突。

## 后续版本如何提交

推荐先从 GitHub 拉取 main 最新状态，再把更新后的文件覆盖到克隆目录，运行测试、查看 diff 后提交：

~~~powershell
Set-Location "O:\ProxyIP-Explorer\ProxyIP-Explorer-repo"
git pull --rebase origin main
npm.cmd test
git status --short
git diff
git add .
git commit -m "feat: describe the actual change"
git push origin main
~~~

提交信息必须描述实际改动；不要把未验证内容写成已验证，也不要使用强制推送作为常规冲突处理方式。
