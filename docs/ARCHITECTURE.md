# 架构说明

## 总体结构

ProxyIP Explorer 是单机 Windows Electron 桌面应用。渲染层只负责 UI，主进程负责网络资源获取、文件缓存、探测任务管理与 IPC 事件转发。渲染进程不直接获得 Node.js API。

~~~text
Electron BrowserWindow
  └─ src/index.html + src/style.css + src/renderer.js
        │ window.proxyApp（仅开放的 preload API）
        ▼
     preload.cjs
        │ ipcRenderer.invoke / ipcRenderer.on
        ▼
     main.cjs
        ├─ 获取 all.json / all.txt
        ├─ 保存和读取本地 catalog 缓存
        ├─ 管理并发、超时、取消、持续检测循环
        └─ src/probe.cjs
              └─ TCP → TLS/SNI → HTTP 探针 → JSON 检查

src/catalog.cjs：数据解析、标准化、合并（由主进程使用）
tests/：不依赖真实上游服务的单元测试
scripts/install-deps.ps1：Windows 依赖安装及 Electron 二进制下载
~~~

## 文件职责

### main.cjs

- 创建 BrowserWindow，并加载本地 src/index.html。
- 设置 Electron 的安全窗口选项。
- 访问数据源：all.json 优先，资源无效时回退 all.txt。
- 限制资源响应体大小和请求时间。
- 使用 Electron userData 路径保存 catalog-cache.json，上游不可用时尝试读取缓存。
- 验证探测请求参数范围；调度有限并发的 worker；给每次运行分配 run ID。
- 把每个探测结果、进度、持续检测周期、等待、停止与错误通过 IPC 发送给渲染层。

### preload.cjs

通过 contextBridge 暴露窄接口，例如资源读取/刷新、启动/停止探测、版本查询、打开已验证外部地址和监听探测事件。新增 IPC 时应遵循最小授权原则，不要向 renderer 暴露整个 ipcRenderer 或 Node.js 环境。

### src/catalog.cjs

数据处理层不应依赖 DOM 或 Electron：
- 解析 JSON 的 data 记录。
- 读取 ip、port 和 locations 中的 region、cca2、city、iata、lat、lon。
- 把多端口展开为独立 IP:Port 项目并去重。
- 规范国家名称、洲别和旗帜。
- 对 TXT 的 IP:PORT#CC 行做宽容解析；TXT 不含城市时标记“城市未标注”。
- 合并数据时优先保留结构更完整的 JSON 地理信息。

### src/probe.cjs

探针对每个目标 IP:Port 并行发起两路探测：
- SNI / Host 探针主机：ipv4.090227.xyz
- SNI / Host 探针主机：ipv6.090227.xyz

探针流程包括 TCP 建连、TLS 握手、HTTP GET、HTTP 响应解析、JSON 和出口 IP 字段检查。结果包含单路状态、连接耗时、总成功状态、平均连接时间与检测时间。请以当前源文件作为精确实现依据；若改变上游 API 或响应字段，必须增加测试。

该指标不是 ICMP Echo RTT。响应时间指标主要是 TCP 连接耗时均值；两条探针路径具有各自的连接结果，失败样本怎样计入均值应按源码和测试核实，不能在文档中自行改口径。

### src/renderer.js

- 维护资源列表、探测结果和过滤状态。
- 按洲 / 国家 / 城市构造左侧树。
- 处理搜索、分页或当前页范围、筛选、延迟排序、开始/停止、持续检测参数。
- 更新实时进度和表格状态。
- 导出 CSV、复制 IP:Port。

### scripts/install-deps.ps1 与 .bat

安装流程必须拆清楚：
1. 检查 Node/npm。
2. 运行 npm 依赖安装。
3. 通过 Electron 包的安装脚本获取 Electron 的平台二进制。
4. 检查 electron.exe、版本/路径标记和实际版本输出。
5. 失败保留详细日志，并暂停给用户查看。

不能因为 npm install 退出码为 0 就推断桌面程序可以启动。

## 主要数据流

### 资源读取

1. 点击更新资源时请求 all.json。
2. 解析结构化数据，过滤掉无效 IP/端口。
3. 若 JSON 获取/解析失败，尝试 all.txt。
4. 成功时合并有用记录并写入缓存。
5. 上游不可用时尝试读本地缓存，并显式显示来源和警告。
6. 渲染层按已有 region、cca2、city、iata 字段分组。

### 探测

1. 用户选择当前页或当前筛选目标，设定并发和超时。
2. 主进程验证输入并启动有上限的 worker 池。
3. 每个 IP:Port 运行双探针流程，主进程发出单项结果和进度。
4. 渲染层记录最近结果并按成功状态、连接耗时排序。
5. 循环模式在设定周期后开始下一轮，停止时取消后续工作并发出停止事件。

## 架构原则

- UI 不负责原始网络 socket；探测由主进程执行。
- renderer 不接触任意 IPC 通道，也不直接使用 Node API。
- 所有网络请求要有 timeout、错误分类和可理解的用户提示。
- 持续监控要可停止、限制并发和目标数量，不能无边界创建连接。
- 对外显示的延迟应明确命名为 TCP 延迟/连接时间，而非含糊标成 Ping。
