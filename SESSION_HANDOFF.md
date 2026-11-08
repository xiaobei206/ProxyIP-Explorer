# Session Handoff — ProxyIP Explorer

> 本文是交接摘要，不是事实的唯一来源。每次开工必须检查 main 最新文件和提交；若仓库当前源码与本文冲突，以当前代码为准并更新本文。

## 项目目标

一个 Windows Electron 桌面工具：读取公开全球 ProxyIP 资源，保留上游按大洲、国家和城市整理的标签，在本机执行 TCP/TLS/HTTP 探测，显示延迟、成功状态、支持持续检测、复制和 CSV 导出。

仓库：<https://github.com/xiaobei206/ProxyIP-Explorer>

## 当前已知版本

- 当前交接基线：0.1.2。
- Electron：45.2.1。
- Node 引擎要求：>=22.12.0。
- 技术栈：Electron + CommonJS + HTML/CSS/JavaScript；不使用 React/Vite。
- 当前测试命令：npm test。
- 初始验证记录：在 Node.js v22.16.0、npm 10.9.2 环境执行 npm test，9 项测试通过，0 失败。这验证的是当前容器中的自动化测试，并不代表 Windows 安装器、EXE 打包或真实全球数据下载已经通过。

## 0.1.2 解决的问题

0.1.1 的安装脚本把 npm install 返回成功误当作 Electron 可运行，但日志中明确报错：

~~~text
npm install 返回成功，但没有找到 node_modules\electron\dist\electron.exe
~~~

0.1.2 安装器因此把流程分为 JavaScript 依赖安装和 Electron 二进制下载，并调用 Electron 包内的安装脚本，优先尝试 npmmirror，失败后切换官方发布源；安装后检查文件和版本。必须以 scripts/install-deps.ps1 当前实现为准，不要凭这段说明假设实机安装已成功。

## 关键模块

- main.cjs：Electron 主进程、资源获取、缓存、并发探测调度、事件发送。
- preload.cjs：安全地桥接 IPC API。
- src/catalog.cjs：JSON/TXT 解析、标准化、去重与合并。
- src/probe.cjs：对候选 IP:Port 执行双探针 TCP/TLS/HTTP 检测。
- src/renderer.js：页面交互、树形分类、过滤、排序、表格、持续检测 UI 和 CSV。
- src/index.html、src/style.css：界面结构和样式。
- scripts/install-deps.ps1 和根目录三个 .bat：依赖安装、启动、便携版打包。
- tests/：解析、探针解析和版本/安装器入口测试。

完整说明见 docs/ARCHITECTURE.md、docs/BUILD-WINDOWS.md 和 docs/TESTING.md。

## 重要技术约定

- 结构化资源：https://zip.cm.edu.kg/all.json；回退：https://zip.cm.edu.kg/all.txt。
- JSON 地理标签源自上游字段；TXT 只有国家代码时不能凭空补城市。
- 测速不是 ICMP Ping。主指标是本机到候选 IP:Port 的 TCP 建连耗时；后续通过 TLS/HTTP 探针检查功能性。
- 本机连接结果不等于 Cloudflare Worker 到 ProxyIP 的连接结果。
- 默认只检测当前页范围，控制并发、超时和整批规模；保留停止功能。

## 本文撰写时的 GitHub 同步状态

最初初始化仓库时，先将这组维护文档直接提交到 GitHub；0.1.2 源码 ZIP 仍需由项目所有者按 docs/BUILD-WINDOWS.md 中的 PowerShell 步骤复制并 push。每次接手时必须检查仓库文件树：
- 如果 main.cjs、preload.cjs、package.json、src/、tests/ 已存在，则源码已经同步，不要重复执行初次上传。
- 如果仍然只有文档，则先提醒源码尚未入库，并依照构建文档完成源文件同步，不要假称已经能够运行或构建。

## 下一步优先级

1. 确认完整源码已在 main。
2. 用户 Windows 端运行 0.1.2 安装脚本，检查 Electron 二进制是否成功下载，并实际启动 Electron。
3. 确认真实 all.json 下载、分类和 TXT 回退行为；保存不含凭据的日志。
4. 执行测试、便携版构建，确认文件名和版本信息一致。
5. 收集实际问题后直接迭代 0.1.3，不要发布 FIX。
6. 逐步补充稳定性、速率控制、地理分类显示和真实网络探测的回归测试。

## 下一次交接必须更新

在源码同步或新版本发布后，补充实际 main HEAD/commit、源码是否齐全、测试环境和输出、未完成问题。不要把“待 Windows 实测”改写为“已验证”，除非确实执行过。
