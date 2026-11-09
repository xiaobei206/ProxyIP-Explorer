# ProxyIP Explorer 0.1.2

独立 Windows Electron 工具：获取 CMLiu / CF 中转 IP 打包服务的全球 ProxyIP 数据，在本机对 IP:Port 执行 TCP、TLS、HTTP 探针，并按最近检测延迟排序。

## 0.1.2 更新

- 修正 Electron 45 的安装流程：`npm install` 完成后，显式执行 `node_modules/electron/install.js` 下载 Windows Electron 二进制。
- 下载 Electron 二进制时先尝试 npmmirror；失败后清理不完整文件，再使用 Electron 官方 GitHub Release 源重试。
- 安装完成后检查 `electron.exe`、`dist/version`、`path.txt`，并实际运行 `electron.exe --version`。
- 修正 0.1.1 的错误判断：Electron 42 起不再依靠 npm `postinstall` 自动下载主程序，因此 npm 显示 `info ok` 并不代表 `electron.exe` 已经存在。
- 最低 Node.js 版本更新为 22.12.0，与 Electron 45.2.1 的运行要求一致。
- 保留 0.1.1 的全球资源获取、地理分类、探测、排序、持续检测和导出功能。

## 功能

- 首选 `https://zip.cm.edu.kg/all.json`，沿用上游 `region / cca2 / city / iata / lat / lon`，直接按大洲、国家、城市分类。
- JSON 失败时回退 `https://zip.cm.edu.kg/all.txt`。TXT 只有国家代码，城市可能显示“城市未标注”。
- 自动把数据中的多个端口展开成独立 `IP:Port` 节点，并去重。
- 资源库成功获取后写入本地缓存，网络不可用时可读取上一次缓存。
- 本机原生 TCP + TLS + HTTP 探针：分别使用 SNI `ipv4.090227.xyz` 和 `ipv6.090227.xyz` 连接每个候选 IP:Port，发起 HTTP GET，并检查探针 JSON 中是否有出口 IP。
- 表格显示 TCP 建连平均延迟、IPv4/IPv6 探针结果、可用/失败状态；智能排序将通过探针的节点按延迟排前面。
- 当前页检测（默认 100 个）或当前筛选全部检测；支持并发、超时、持续检测间隔设置。
- 支持 CSV 导出、复制 IP:Port。

## Windows 运行

要求：Windows 10/11 x64、Node.js 22.12.0+（建议 Node 24）、系统自带 Windows PowerShell 5.1 或 PowerShell 7。

1. 将 ZIP 完整解压到普通可写目录（不要直接在压缩包内运行）。
2. 双击 `安装依赖.bat`。安装过程会显示在窗口内，日志保存为 `install-dependencies.log`。
3. 安装成功后双击 `启动软件.bat`。
4. 点击“更新资源”，再点击“开始检测”。

安装器分两步：先从 npm registry 安装 JavaScript 依赖，再显式下载 Electron Windows 主程序。Electron 42 及更高版本的二进制下载行为已经改变，不再依靠传统 `postinstall` 自动安装。`npm warn install-scripts` 是 npm 对依赖安装脚本审核状态的提示；本项目不会为了消除提示而批准所有第三方脚本，而是调用 Electron 包自身提供的 `install.js` 完成必要的二进制下载。

若安装失败，不要关闭或删除日志，直接把 `install-dependencies.log` 发回。日志会包含镜像下载和官方源重试的具体错误。

## 打包便携版 EXE

在 Windows 上双击 `打包便携版EXE.bat`。若依赖尚未安装，脚本会先调用同一安装器；生成文件位于 `dist` 目录。

命令行方式：

```powershell
npm install
node .\node_modules\electron\install.js
npm start
npm test
npm run dist:portable
```

## 重要说明：这不是 ICMP Ping

EdgeTunnel 配套的 CheckProxyIP 页面调用 `/check`，检测逻辑在 Cloudflare Worker 中执行。Worker 会对候选地址建立 TCP 连接，使用 `ipv4.090227.xyz` / `ipv6.090227.xyz` 作 SNI，完成 TLS 握手后再发送 HTTP 探针。它显示的 `responseTime` 是两路 TCP `connect_ms` 的平均值，而不是 ICMP Ping，也不是 HTTP 总耗时。

本软件将相同的探针流程放到 Windows 本机执行。因此测得的是“当前电脑到候选 ProxyIP 的路径”，不等于 Cloudflare Worker 机房到候选 ProxyIP 的路径。首版把这个数值标为“TCP 延迟”，避免混淆。

## 默认保护

- 默认只检测当前页（100 个地址），不会打开软件就对整个全球列表发起大量连接。
- “当前筛选全部”超过 1,000 个时会弹出确认；单轮上限 12,000 个。
- 并发默认 16，用户可调整 8–64；连续检测默认关闭。
- 每个节点会分别连接 IPv4 与 IPv6 两个探针，因此一次检测会产生两条网络连接。

## 数据说明

国家、大洲、城市和 IATA 来自上游 JSON，不在本机重新推算。若只有 TXT，软件只按国家代码推导大洲；不会伪造城市信息。

上游资源由第三方社区维护，节点是否在线、服务是否稳定、地理标签是否精确均不作保证。检测结果只代表该次、该本机网络路径的观测。

## 项目结构

```text
ProxyIP-Explorer/
├─ main.cjs
├─ preload.cjs
├─ src/
│  ├─ catalog.cjs
│  ├─ probe.cjs
│  ├─ index.html
│  ├─ style.css
│  └─ renderer.js
├─ scripts/
│  └─ install-deps.ps1
├─ tests/
├─ 安装依赖.bat
├─ 启动软件.bat
└─ 打包便携版EXE.bat
```
