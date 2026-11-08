# ProxyIP Explorer

ProxyIP Explorer 是一个面向 Windows 的桌面工具，目标是把 EdgeTunnel / CMLiu 公开 ProxyIP 资源库的获取、地区分类和延迟探测放到本机执行。

> 当前版本：**0.1.2**。仓库的实际代码状态以 \`main\` 分支当前文件和 \`package.json\` 为准；不要把历史测试记录等同于 Windows 实机验证。

## 核心目标

- 从上游 \`all.json\` 读取结构化全球 ProxyIP 资源，保留上游提供的大洲、国家、城市、IATA 和经纬度标签。
- JSON 不可用时回退 \`all.txt\`；TXT 不含城市时明确显示未标注，不凭空推测。
- 在 Windows 本机对每个 IP:Port 执行 TCP/TLS/HTTP 探针，并显示连接延迟和探针成功状态。
- 按最近一次有效测试的延迟排序，支持国家/城市筛选、持续测试、停止测试、复制和 CSV 导出。
- 安装和打包流程必须能清楚报告错误，不能让批处理窗口闪退或只给出含糊的“安装失败”。

## 当前数据源

- 结构化 JSON：<https://zip.cm.edu.kg/all.json>
- 备用 TXT：<https://zip.cm.edu.kg/all.txt>

数据源属于第三方社区服务；项目只读取其公开资源，不控制上游可用性、节点质量或地理标签准确性。详细说明见 [数据源与归属](docs/DATA-SOURCES.md)。

## 技术栈

- Electron 45.2.1
- Node.js 22.12.0+（推荐当前受支持的 Node.js LTS；具体最低要求以 \`package.json\` 为准）
- 原生 CommonJS、HTML、CSS、JavaScript
- Node.js \`net\` / \`tls\` 实现本机连接检测
- Node.js 内置测试运行器（\`node --test\`）

## Windows 快速开始

1. 下载或克隆仓库。
2. 安装 Node.js，版本须符合 \`package.json\` 的 \`engines.node\`。
3. 双击 \`安装依赖.bat\`。
4. 安装成功后双击 \`启动软件.bat\`。
5. 在软件中刷新资源，然后开始检测。

出现安装错误时，先保留并查看 \`install-dependencies.log\`，不要删除日志后反复重装。安装器为什么会显式执行 Electron 安装脚本，见 [Windows 安装、运行与打包](docs/BUILD-WINDOWS.md)。

## 开发者命令

在项目根目录打开 PowerShell：

\`\`\`powershell
node --version
npm --version
npm test
npm start
npm run dist:portable
\`\`\`

Windows PowerShell 中优先使用 \`npm.cmd\` 调用 npm，避免某些环境因执行策略而拦截 \`npm.ps1\`：

\`\`\`powershell
npm.cmd test
npm.cmd start
npm.cmd run dist:portable
\`\`\`

## 文档导航

| 文档 | 内容 |
|---|---|
| [AI 接手提示词](AI_BOOTSTRAP_PROMPT.md) | 新对话 GPT 的最短接手入口 |
| [AI 开发协议](AI_DEVELOPMENT_PROTOCOL.md) | 版本纪律、仓库操作、验证和交付规则 |
| [会话交接](SESSION_HANDOFF.md) | 当前版本、已知问题、下一步工作 |
| [累计开发日志](DEVELOPMENT-LOG-CN.md) | 按正式版本记录变化，不另发 FIX |
| [架构说明](docs/ARCHITECTURE.md) | 模块职责、数据流和 IPC 设计 |
| [Windows 构建指南](docs/BUILD-WINDOWS.md) | 安装、启动、打包、诊断和本地 Git 上传 |
| [测试策略](docs/TESTING.md) | 自动测试覆盖范围与实机验证要求 |
| [数据源说明](docs/DATA-SOURCES.md) | JSON/TXT 字段、来源边界和地理标签含义 |
| [安全与隐私](docs/SECURITY-AND-PRIVACY.md) | 本地网络行为、限制和安全边界 |
| [路线图](docs/ROADMAP.md) | 建议按优先级推进的后续任务 |
| [发布清单](docs/RELEASE-CHECKLIST.md) | 版本发布前的必查事项 |

## 关键技术说明：不是普通 ICMP Ping

当前探测器并非用 ICMP Echo 作为唯一判据。它对候选 IP:Port 建立到固定探针主机的 TCP/TLS 连接，随后发送 HTTP 请求并验证响应。显示的“TCP 延迟”主要表示 TCP 建连耗时；这不等于完整 HTTP 往返时延，也不等于 Cloudflare Worker 到该 IP 的延迟。

因此本软件的结果代表“当前 Windows 电脑 + 当前网络 + 当前候选地址”的观测结果。需要区分本机路径与 Cloudflare 边缘节点的路径，不能将本机排序直接宣称为所有 Worker 机房都适用的最优排序。

## 当前已知边界

- 当前实现依赖第三方公开资源地址，若上游调整 JSON/TXT schema，解析器和测试需要随之更新。
- \`all.json\` 提供的地区字段会被沿用；这些标签不是本机重新验证的物理机房证明。
- 某些候选端口可能拒绝 TLS 或 HTTP 探针，但不代表它在所有场景下都完全不可用。
- 目前自动测试覆盖解析、探针响应、证书主机名和版本一致性；完整 Windows 安装、真实全球资源下载和长期运行仍应在实际 Windows 电脑验证。
- 项目尚未声明开源许可证。公开可见不等于自动授予他人复制、修改和再发布的许可；许可证需由仓库所有者明确选择后添加。

## 版本与交付纪律

- 不单独发布 \`FIX\` 版本；任何需要交付的新版本都按正式版本号递增，例如 \`0.1.2 → 0.1.3\`。
- \`package.json\`、界面显示版本、版本说明、测试及交付文件名必须同步。
- 每个版本更新 [累计开发日志](DEVELOPMENT-LOG-CN.md) 和 [会话交接](SESSION_HANDOFF.md)。
- 不宣称未实际运行的 Windows 安装、打包、网络下载或端到端测试已经通过。
- 开发前先阅读 [AI 开发协议](AI_DEVELOPMENT_PROTOCOL.md)，新对话先按 [AI 接手提示词](AI_BOOTSTRAP_PROMPT.md) 恢复现场。
