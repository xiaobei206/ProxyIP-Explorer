# 测试策略与验证记录

## 当前可重复测试

在项目根目录：

~~~powershell
node --version
npm.cmd test
~~~

Node.js 内置 test runner 运行 tests/*.test.cjs。

## 已有测试覆盖

### tests/catalog.test.cjs

- 解析 JSON 的 IP、多个端口与地区信息。
- TXT IP:PORT#CC 备用数据格式。
- JSON 与 TXT 数据合并，优先保留 JSON 的城市信息。
- 已知大洲名称与旗帜转换。

### tests/probe.test.cjs

- IPv4/IPv6 探针目标的标准化。
- TLS 证书主机名与通配符匹配。
- HTTP JSON 响应解析。

### tests/version.test.cjs

- package.json 版本与 UI 版本一致。
- Windows 安装入口和诊断脚本存在。

## 已知验证记录

在本次文档初始化前，实际执行：

- Node.js：v22.16.0
- npm：10.9.2
- 命令：npm test
- 结果：9 tests、9 pass、0 fail。

这是自动测试结果，不是完整 Windows 应用验证。不要用这条记录代替以后版本的重新测试。

## 每个版本最低测试门槛

1. npm.cmd test 全部通过。
2. UI 版本与 package.json 一致，新增版本测试。
3. 资源解析器兼容当前已知 JSON / TXT 结构，并对缺失字段有测试。
4. 探针测试覆盖 TCP 失败、TLS/证书失败、HTTP 错误、JSON 无效、timeout 和 IPv4/IPv6 单路失败。
5. 安装器变更必须测试各阶段的失败返回、日志存在、窗口不闪退、Electron 实际可执行。
6. 对全球资源进行真实下载时，应记录下载时间、条目总数和解析后条目数，不提交大体积实时数据快照作为测试夹具。
7. 对 Windows EXE 打包进行实际验证，并核对输出名称、版本和 SHA256（若发布 SHA 文件）。

## 不可混淆的测试层次

- **静态检查**：源码/语法结构，没有真实执行外部服务。
- **单元测试**：使用固定样本验证函数，不要求互联网可用。
- **集成测试**：多个模块一起工作，例如从真实上游下载并解析。
- **Windows 实机测试**：在 Windows 桌面上安装、启动和使用。
- **打包测试**：实际运行 electron-builder 产物。
- **持续稳定性测试**：多轮探测后停止、切换筛选、资源刷新和错误恢复。

报告测试结果时必须点明是哪一层，不能用“测试通过”模糊概括所有层次。
