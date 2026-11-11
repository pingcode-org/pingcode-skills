# PingCode Skills

面向 AI 编程助手的 PingCode Agent Skills 集合，遵循 [Agent Skills](https://agentskills.io) 规范，可通过 GitHub 地址在线安装。内置 PingCode CLI 操作与 `#工作项编号` 驱动的开发流程，兼容 OpenCode、Claude Code、Cursor 等 AI 编程助手。

## 安装

使用 [Skills CLI](https://github.com/vercel-labs/skills)（需要 Node.js 22.20+）：

```bash
# 交互式选择要安装的 skill 和目标 agent
npx skills add pingcode-org/pingcode-skills

# 安装仓库内全部 skill 到全部 Agent 的全局目录，跳过交互
npx skills add pingcode-org/pingcode-skills --all -g

# 只安装指定 skill 到全局
npx skills add pingcode-org/pingcode-skills --skill use-pingcode-cli -g

# 仅查看仓库里有哪些 skill，不安装
npx skills add pingcode-org/pingcode-skills --list
```

安装后可更新或卸载：

```bash
npx skills update -g
npx skills remove use-pingcode-cli -g
```

> 不指定 `-g` 时默认安装到当前项目（如 `.agents/skills/`、`.claude/skills/`、`.cursor/skills/` 等）。
> 支持 OpenCode、Claude Code、Cursor、Codex 等 Agent，也可通过 `--agent` 指定。

Skill 安装只提供操作指南。执行 PingCode 任务还需要安装 CLI（Node.js 22+），并在本机完成登录：

```bash
npm install -g @pingcode/cli@next
pc --version
pc login
```

私有部署先执行 `pc config set base-url <URL>`，再登录。不要在聊天里粘贴令牌或密钥。
安装后的 skill 可在任意目录使用，不需要克隆 CLI 源码或安装 Rust。
当前使用 `next` 预发布渠道；安装后以 `pc --version` 和命令帮助确认可用能力。

## 可用 Skills

| Skill | 说明 |
| --- | --- |
| [`use-pingcode-cli`](skills/use-pingcode-cli/SKILL.md) | 基于 PingCode REST API v2.0，通过 `pc` 完成查询、按编号获取工作项、创建、改状态、评论等操作；CLI 的 npm 包为 `@pingcode/cli` |
| [`workitem-driven-development`](skills/workitem-driven-development/SKILL.md) | 通过 `#工作项编号` 驱动开发任务：取工作项、认领、分支、提交、PR、合并与 `docs/` 沉淀 |

`workitem-driven-development` 依赖 `use-pingcode-cli`。按名称安装工作流时，请同时选择两者：

```bash
npx skills add pingcode-org/pingcode-skills --skill use-pingcode-cli workitem-driven-development -g
```

`use-pingcode-cli` 的入口包含核心流程，11 份主题资料和文档检索规则随 skill 一起安装，按任务读取。
Skill 与 CLI 独立更新：命令和参数以本机 `pc --help` 为准；API 细节按[文档检索规则](skills/use-pingcode-cli/references/api-docs.md)从生产官方文档核对。

## 目录结构

```text
.
├── skills/                     # 所有可安装的 skill 必须放在这里
│   └── <skill-name>/
│       ├── SKILL.md            # 必需，含 YAML frontmatter（name、description）
│       ├── reference.md        # 可选，单份详细资料（如开发工作流）
│       └── references/         # 可选，按主题拆分的资料（如 CLI 操作）
│           └── <topic>.md
├── templates/
│   └── SKILL.md.template       # 新建 skill 的模板（不会被安装）
├── scripts/
│   └── validate-skills.mjs     # 本地/CI 校验脚本
└── .github/workflows/
    └── validate-skills.yml     # PR / push 自动校验
```

约定：

- 一个 skill 一个目录，目录名必须与 `SKILL.md` 中的 `name` 一致（小写 kebab-case）。
- `SKILL.md` 只写核心流程，详细资料拆到同目录的其它 Markdown 文件或 `references/`，并在 `SKILL.md` 中链接。
- 文件链接相对于链接所在文件解析；每个 skill 的资料必须包含在自己的目录内，不能依赖相邻源码仓库、用户本机路径或目录外的符号链接。
- 不要在仓库根目录放 `SKILL.md`——Skills CLI 默认只识别根目录的那一个，会忽略 `skills/` 下的其它 skill。

## 维护 CLI Skill

公开分发的 `use-pingcode-cli` 在本仓库维护。通用操作流程放在 `SKILL.md`，业务流程和易错点放在对应主题文件；完整字段表、枚举、scope 和响应 schema 按需查官方文档，不在本地重复维护。

文档检索顺序：优先读取生产索引 `https://developer.pingcode.com/restapi/llms.txt`，未上线、不可用或未命中时回退到操作的官方 Docs 页面，再到生产官方站内检索。仅使用生产文档，不使用 alpha 或预览站点。每个任务复用索引或失败记录，避免反复请求尚未上线的入口；文档来源不改变业务 API 地址。

修改后运行下方校验，并检查入口和主题之间的相对链接。发布前在临时目录从本地仓库安装，确认参考文件随包安装，再用隔离的 `--config-dir` 检查 `--help` 和 `--dry-run`。这些检查不访问真实租户，也不代表业务请求已经验证。

## 新增 Skill

1. 复制模板：`mkdir -p skills/my-skill && cp templates/SKILL.md.template skills/my-skill/SKILL.md`。
2. 修改 frontmatter 的 `name`、`description`，并补全正文步骤。
3. 本地校验：

   ```bash
   node scripts/validate-skills.mjs
   ```

4. 提交 PR。CI 会再次执行同样的校验。

## 参考

- Agent Skills 规范：<https://agentskills.io>
- Skills CLI：<https://github.com/vercel-labs/skills>
- PingCode REST API v2 文档：<https://developer.pingcode.com/restapi/pingcode/overview>
- PingCode Open API 根地址：<https://open.pingcode.com>
