# Windows 源码上传到 GitHub

本指南专门用于把之前交付的 **ProxyIP-Explorer-0.1.2-source.zip** 同步到本仓库，同时保留已经提交的维护文档。无需手工逐个复制文件。

仓库：<https://github.com/xiaobei206/ProxyIP-Explorer>

## 1. 下载并解压源码 ZIP

将 ZIP 解压到本地普通文件夹。上传脚本需要你把源目录指向**直接包含 package.json 的目录**，不是外层父目录。

用 PowerShell 查找：

~~~powershell
Get-ChildItem "O:\ProxyIP-Explorer" -Filter package.json -Recurse -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName
~~~

例如结果为：

~~~text
O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2\package.json
~~~

那么源目录应当设置为：

~~~text
O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2
~~~

按你电脑实际返回路径填写，不要照抄示例路径。

## 2. 克隆维护文档仓库

如果还没有本地克隆，运行：

~~~powershell
git clone https://github.com/xiaobei206/ProxyIP-Explorer.git "O:\ProxyIP-Explorer\ProxyIP-Explorer-repo"
~~~

如果 GitHub 登录需要认证，请使用 Git Credential Manager 打开的正常登录流程，不要在命令行或聊天中粘贴 Personal Access Token。

## 3. 运行源码上传脚本

将以下命令中的源目录路径改成刚才找到的路径：

~~~powershell
Set-Location "O:\ProxyIP-Explorer\ProxyIP-Explorer-repo"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\Upload-Source-To-GitHub.ps1" -SourceDir "O:\ProxyIP-Explorer\proxyip-explorer-0.1.2\ProxyIP-Explorer-0.1.2"
~~~

这里的 ExecutionPolicy Bypass 只应用于这一次 PowerShell 进程，不会修改系统或用户的全局执行策略。若公司策略禁止该启动方式，应遵守本机策略并用已获准的 PowerShell 运行脚本。

脚本会进行以下检查：

- 当前目录确实是 Git 仓库；
- origin 指向 xiaobei206/ProxyIP-Explorer；
- 当前分支是 main；
- 工作树干净，避免把其他未提交改动混进来；
- 源目录包含预期文件；
- 只复制项目代码、脚本、测试和版本说明，保留仓库维护版 README 和 AI 开发文档；
- 执行 git diff --cached --check；
- 显示暂存变更摘要。

确认摘要正确后，在提示处**输入大写 PUSH** 才会 commit 并 push。若输入其他内容，将取消提交；复制到本地的文件会保留，用户可以查看后再决定。

## 4. 推送后核对

打开 <https://github.com/xiaobei206/ProxyIP-Explorer>，确认 main 分支中存在：

~~~text
main.cjs
preload.cjs
package.json
src/
scripts/
tests/
安装依赖.bat
启动软件.bat
打包便携版EXE.bat
版本说明.txt
~~~

然后在克隆目录执行：

~~~powershell
git status --short
git log -1 --oneline
node --version
npm.cmd test
~~~

上传脚本不安装依赖、不运行 Electron、不进行 Windows EXE 打包；这些是之后的独立验证步骤。

## 5. 常见情况

### 源目录找不到 package.json

变量 SourceDir 设错了。重新运行第 1 步的查找命令，指向 package.json 所在目录。

### 提示工作树不干净

脚本会停止，不会覆盖或自动提交其他改动。先检查：

~~~powershell
git status --short
git diff
~~~

确认原有改动应如何处理后再运行。

### git push 被拒绝

不要使用 git push --force。先查看远端是否有新的提交，再安全同步：

~~~powershell
git fetch origin
git status -sb
git pull --rebase origin main
~~~

如果 rebase 出现冲突，先解决冲突并运行测试，再 push。

### 上传完成后新对话 GPT 如何接手

将仓库地址发给新对话，要求先读根目录的 **AI_BOOTSTRAP_PROMPT.md** 和 **AI_DEVELOPMENT_PROTOCOL.md**。新 GPT 必须先检查当前 main 的实际文件和 HEAD，再读 **SESSION_HANDOFF.md** 与 **DEVELOPMENT-LOG-CN.md**；不需要用户反复上传源码 ZIP。
