# 依赖与安装位置

技能提供工作说明和配套文件。团队默认采用项目入口直接读取公共仓库的方式，见 [团队加载说明](team-loading.md)。软件、插件服务、登录状态和项目私有规则分别安装或配置。

| 使用目的 | 放在哪里 | 还需要什么 |
| --- | --- | --- |
| 项目基础协作 | 各项目 `.agents/skills/` 中的五个基础技能 | 能读取本地文件的 Agent；语言绑定使用同级相对路径 |
| 只供个人跨项目使用 | Agent 支持的用户级 skills 目录，例如 Codex 的 `$CODEX_HOME/skills` | 全目录安装；同名项目副本也存在时明确实际加载路径，不依赖隐含优先级 |
| Prefab YAML 查看与修改 | `unity-prefab-source-editing` 技能目录 | Git、PowerShell、带 `py` 启动器的 Python 3.11、独立解析器虚拟环境 |
| Unity 内的可视化制作与验收 | 各电脑安装团队使用的 Unity 插件与项目桥接工具 | 目标 Unity 版本、项目导入与编译正常、对应 Editor 可连接 |
| 腾讯文档读取/更新、PM | 按任务安装对应技能 | 实际可用的腾讯文档 MCP 或技能指定接口与访问权限；更新仍需授权 |
| 游戏每日/周常自动化 | `run-stable-game-automation` | 实际游戏自动化客户端、证据日志、人工接管与并发控制；仅技能文件不能运行游戏 |
| 项目专用流程 | 对应项目自己的技能与工具 | 项目文档与环境配置；私有内容不发布到公共技能仓库 |

## Prefab 解析工具

以下命令在实际安装的技能目录执行。安装会从公开 GitHub 仓库下载解析器，在当前用户的 `.local/share/unity-yaml-parser` 建立虚拟环境并安装依赖、运行解析器测试。

```powershell
pwsh -NoProfile -File .\scripts\install-unity-yaml-parser.ps1
pwsh -NoProfile -File .\scripts\invoke-unity-prefab-yaml.ps1 --help
```

已有工具仓库时，在当前 PowerShell 进程设置 `UNITY_YAML_PARSER_REPO` 为实际目录，安装器和调用器会共用该路径。不需要迁移现有工作副本，也不需要写永久环境变量。工具无法保证任意 Prefab 重新序列化后字节一致，写入前必须执行 `roundtrip`。

## 不随公共仓库分发

不复制维护者的整个 `.codex`、插件缓存、Hook 安装状态、账号配置、私人语料、访问密钥、玩家资料或内部聊天记录。官方或第三方插件使用其支持的安装方式，不直接复制缓存冒充安装。

遇到缺少技能正文、相对引用失效或软件缺失时，分别修复对应层；不要把安装一份 `SKILL.md` 当作已安装插件或已恢复服务。
