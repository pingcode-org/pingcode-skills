# PingCode Skills

面向 AI 编程助手的 PingCode 技能集合，遵循 [Agent Skills](https://agentskills.io) 规范，可通过 GitHub 地址在线安装。

## 安装

使用 [Skills CLI](https://github.com/vercel-labs/skills)（需要 Node.js 18+）：

```bash
# 交互式选择要安装的 skill 和目标 agent
npx skills add pingcode-org/pingcode-skills

# 安装仓库内全部 skill 到全局，跳过交互
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
> 支持 OpenCode、Claude Code、Cursor、Codex 等 40+ agent，也可通过 `--agent` 指定。

## 可用 Skills

| Skill | 说明 |
| --- | --- |
| [`use-pingcode-cli`](skills/use-pingcode-cli/SKILL.md) | 基于 PingCode REST API v2.0，通过 `pc` 完成查询、按编号获取工作项、创建、改状态、评论等操作 |

## 目录结构

```text
.
├── skills/                     # 所有可安装的 skill 必须放在这里
│   └── <skill-name>/
│       ├── SKILL.md            # 必需，含 YAML frontmatter（name、description）
│       └── reference.md        # 可选，按需拆分的详细文档
├── templates/
│   └── SKILL.md.template       # 新建 skill 的模板（不会被安装）
├── scripts/
│   └── validate-skills.mjs     # 本地/CI 校验脚本
└── .github/workflows/
    └── validate-skills.yml     # PR / push 自动校验
```

约定：

- 一个 skill 一个目录，目录名必须与 `SKILL.md` 中的 `name` 一致（小写 kebab-case）。
- `SKILL.md` 只写核心流程，详细资料拆到同目录的其它 Markdown 文件，并在 `SKILL.md` 中链接。
- 不要在仓库根目录放 `SKILL.md`——Skills CLI 默认只识别根目录的那一个，会忽略 `skills/` 下的其它 skill。

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
