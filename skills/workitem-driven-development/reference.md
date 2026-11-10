# 参考：工作项驱动的 Git 工作流与文档沉淀

配合 SKILL.md 使用。PingCode 命令细节以 `use-pingcode-cli` skill 为准；本文只规定流程、Git 规范与文档沉淀。

## 0. 触发与变量

仅当任务带 `#<Identifier>`（如 `#ABC-42`）且要求开发/修复/实现/继续/评审/合并时启用。

```bash
IDENTIFIER="ABC-42"                  # 传给 pc 时去掉 #
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/$REPO_NAME"
```

- 分支名和 PR 标题保留 `#`：`#ABC-42/(feat)user-login`、`feat: #ABC-42 user-login`。
- 当前用户从 `pc whoami --json` 读取：登录名 `identity.user.name`，用户 ID `identity.user.id`。
- 没有编号的普通任务不要套用认领、评论、编号分支命名等规则。

## 1. 取工作项详情

```bash
pc pjm workitem get ABC-42
pc comments list --principal-type workitem --principal-id <工作项id>
```

要点：

- **用完整编号 get**，不要用全局 `pc pjm workitem list --identifier <数字>` 取详情。后者不带 `--project-id` 时会跨项目命中同号工作项，结果有歧义。
- `get` 的位置参数支持完整编号、short id、24 位对象 id；优先完整编号。纯数字序号可能 404，不要传。
- 返回体里记录：`id`、`project.id`、`type.id`、`state.id`、`assignee.id`、`parent_id`、`short_id`、`whole_identifier`。
- 只有手里只有数字、拼不出完整编号时，才退回：
  ```bash
  pc pjm workitem list --project-id <项目ID> --identifier <数字>
  ```
  项目 ID 先经 `pc pjm project list --keywords <项目名>` 解析。
- `parent_id` 非空时，拉父工作项标题和描述，理解上层背景。
- 子工作项：
  ```bash
  pc pjm workitem list --project-id <项目ID> --parent-id <工作项ID>
  ```
  先只读各子项标题掌握全貌，再按需读完整内容。
- Feature 拆解时用：
  ```bash
  pc pjm workitem-relation list <工作项ID>
  ```
  按需读取关联需求、设计稿等。

## 2. 类型判断

```bash
pc pjm workitem-type list-for-project --project-id <项目ID>
```

- 按类型名称匹配，不硬编码类型 id，也不要把 `story`/`bug` 当类型 id。
- **Feature / 产品需求**：不认领、不改状态、不建开发分支、不写代码；转入「Feature 拆解流程」。
- 其它执行类工作项（用户故事、任务、缺陷等）：继续。

## 3. 状态与负责人

```bash
pc pjm workitem-state list-for-project --project-id <项目ID> --workitem-type-id <类型ID>
```

- 状态不是“打开/待处理”类初始状态时，提示用户并询问是否继续。
- 负责人已设置且不是当前用户时，提示用户并询问是否继续。
- 状态 id 按名称从项目实际配置解析，不硬编码；不同项目状态名可能不同。

## 4. 认领（幂等）

```bash
# 负责人不是当前用户时
pc pjm workitem update <工作项id> --data '{"assignee_id":"<当前用户ID>"}'

# 状态不在进行中时
pc pjm workitem update <工作项id> --data '{"state_id":"<进行中状态ID>"}'
```

- 目标值已就位就跳过对应写入。
- 不要对当前状态重复发起流转，否则会报“工作项状态不能流转到当前状态”。
- 写后重新 `get` 验证。
- 403/scope 不足时停下交用户处理，不要反复重试。

## 5. Feature 拆解流程

仅适用于类型为 Feature / 产品需求的工作项。

1. **通读需求**：标题、描述、评论、附件，结合父/子工作项和 `workitem-relation list` 的关联项，掌握完整背景与验收意图。
2. **澄清疑问**：不明确、缺失、矛盾的地方不猜测，汇总后向用户提问，直到全部澄清。
3. **拆解用户故事**：
   - 在该 Feature 下创建用户故事，`parent_id` 指向 Feature。
   - 类型 id 经 `pc pjm workitem-type list-for-project` 解析，不硬编码。
   - 每个用户故事必须是**完整、可独立交付**的内容，范围与验收标准闭环；允许只覆盖前端或只覆盖服务端。
   - **先给出待创建列表（标题 + 描述），用户确认后才创建**；细节写进描述与验收标准，不要堆在标题。
4. **下一步选择**：创建完成后询问用户：直接认领第一个用户故事开始开发，还是等待后续指令；不自行决定。

## 6. 分支工作流

开工前按顺序检查：

```bash
git rev-parse --abbrev-ref HEAD     # 应在集成分支
git status --porcelain              # 应为空
git fetch origin
git pull --ff-only                  # 落后时
```

- 集成分支常见为 `develop` 或 `main`，以仓库实际保护规则为准；不要假设。
- 不在集成分支时不要自行切换，先说明并等待用户确认。
- 工作区不干净时让用户决定提交、stash 或丢弃；不要擅自处置。
- 同步失败（非 ff）时停下问用户，不要自行 merge/rebase。
- 创建分支前先给用户确认分支名：

  ```bash
  git checkout -b '#ABC-42/(feat)user-login'
  git check-ref-format --branch '#ABC-42/(feat)user-login'
  ```

分支名格式：

```text
#<Identifier>/(<type>)<kebab-简述>
```

示例：

```text
#ABC-42/(feat)user-login
#ABC-42/(fix)retry-timeout
#ABC-42/(docs)git-workflow
```

- `<type>` 使用 Conventional Commits 类型（feat/fix/docs/refactor/test/chore 等）。
- 用 `/` 分隔 Identifier 与分支名，不要用冒号；`#` 可以出现在分支名中。
- 分支名用英文小写、数字、`-`，不要用空格或中文。

工作期间：

- 所有修改与提交都在工作分支进行，任务完成前不要切回集成分支。
- 任何切换分支（`checkout` / `switch`）都先征得用户确认。
- 需要暂存时先说明，再 `git stash push -m "<说明>"`；不要直接丢弃。
- 只暂存本任务相关文件；提交前看 `git status`、`git diff`。
- 不主动 `commit` / `push`；用户明确要求后再执行。

## 7. 提交信息规范

Conventional Commits：

```text
<type>[optional scope]: <description>
```

| type | 用途 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(auth): add token refresh` |
| `fix` | 修复缺陷 | `fix(api): handle empty page` |
| `docs` | 仅文档 | `docs(workflow): document branch rules` |
| `style` | 格式、空白，不改变逻辑 | `style(ui): format button styles` |
| `refactor` | 重构，不新增功能也不修缺陷 | `refactor(parser): extract tokenizer` |
| `perf` | 性能优化 | `perf(query): add index for status` |
| `test` | 测试相关 | `test(auth): cover expired token` |
| `build` | 构建系统、依赖 | `build(deps): bump vite` |
| `ci` | CI 配置 | `ci: run tests on pull request` |
| `chore` | 杂项，不涉及源码/测试 | `chore: update editorconfig` |
| `revert` | 回滚提交 | `revert: feat(auth): add token refresh` |

- `scope` 用受影响的包/模块名；不确定时省略。
- 描述用祈使句，简洁说明做了什么；一个提交只做一件事。
- 破坏性变更按规范用 `!` 或 `BREAKING CHANGE:`。
- PR 标题：`<type>: #<Identifier> <简述>`，如 `feat: #ABC-42 user-login`；PR 内各 commit 仍用普通 Conventional Commits。
- 仓库若有 commitlint、commit-msg 钩子或 PR 校验，以仓库配置为准。

## 8. 提交前验证

- 运行仓库文档、根脚本或 CI 定义的验证命令；本 skill 不假定固定命令。
- 没有统一入口时，按受影响包/模块运行 lint、typecheck、test、build。
- 契约/代码生成变更后，重新生成并确认生成物已更新。
- 未运行、失败或环境缺失时如实报告，不要写“已验证”。
- 全绿后再提交；只提交本任务相关文件。

## 9. PR 与合并

1. 经用户确认后 push 并开 PR：
   ```bash
   git push -u origin '#ABC-42/(feat)user-login'
   gh pr create --base <集成分支>
   ```
2. PR 描述写清：变更、原因、验证、风险与回滚。
3. 等 CI 与必需审批通过；不自行合并。
4. 用户确认后 squash 合并：
   ```bash
   gh pr merge <n> --squash --delete-branch
   ```
   - 不用 `--merge` / `--rebase` / `--auto`，不用 `--admin` 绕过保护。
   - 删除远端分支前确认 PR 已 MERGED；误删导致 PR 关闭时，推回分支后 `gh pr reopen` 再合并。
5. 合并后切回集成分支、`git pull --ff-only`、删除本地工作分支。

### PR 落后于 base（BEHIND）

```bash
git fetch origin
git rebase origin/<集成分支>
# 解决冲突并复跑验证
git push --force-with-lease
```

- 不要用 `--admin` 强合。
- 不要把集成分支 merge 进工作分支（会留下无意义的 merge commit）。
- `--force-with-lease` 前必须征得用户确认；冲突无法解决时停下说明。

## 10. 合并后收尾

1. 复查工作项状态：
   - 已是完成态（如“已修复”/“已完成”，常由 PR 合并自动化流转）则不再重复设置，仅核对结果。
   - 否则才把状态置为完成态，状态 id 按项目实际配置解析。
2. 追加一条**纯文本**总结评论：交付内容、验证结果、后续衔接。

   ```bash
   pc comments create --data '{"principal_type":"workitem","principal_id":"<工作项id>","content":"..."}'
   ```
3. 需要 @ 人时用 `[@<用户ID>|<登录名>]`；用户 ID 经 `pc organization user list` 解析。只写 `@登录名` 不会触发提及。
4. 评论换行分段、用 `-`/`1.` 列点，不写 HTML 标签。
5. 过程信息只留在工作项评论，不在本地另存副本。

## 11. Code Review 流程

对指定工作项 / PR 做评审时走本节；**不认领、不改状态、不写代码、不合并 PR**。

1. **防重复评审**：按完整编号查详情与评论，确认状态，并检查是否已有进行中标记或评审结论。已在评审中或已有结论时停下告知用户，除非用户明确要求重新评审。
2. **立即评论留痕**：确认无重复后，先发纯文本评论，注明当前用户开始 Code Review 与 PR 地址，作为占用标记。
3. **取 PR 与代码（只在临时目录）**：
   ```bash
   git fetch origin
   git fetch origin pull/<n>/head:pr-<n>-review
   git worktree add --detach "<临时目录>/${REPO_NAME}-pr<n>" pr-<n>-review
   ```
   所有代码阅读、评论、分支/提交查看都在该 worktree 内完成；不切换当前工作分支、不改动当前工作区。
4. **只做代码检查**：以仓库规范与设计文档为依据，检查规范性（风格、分层、依赖方向、测试约定）与需求符合性（是否实现工作项/PR 描述要求，有无遗漏或范围蔓延），问题引用具体文件与规则出处。
5. **是否运行检查以仓库评审策略为准**；未运行 lint/typecheck/test/构建就不要声称运行过，CI 结果直接引用 PR status checks。
6. **给结论**：只允许「通过 / 拒绝 / 不确定」三选一并附理由，提交用户选择。
7. **PR 侧只发评审意见**：按用户选择用 `gh pr review` 提交 APPROVE / REQUEST_CHANGES / COMMENT；不合并、不推送、不改作者分支。
8. **工作项侧只评论**：结论与依据以纯文本评论发到工作项，与开始标记对应；不改状态、不认领、不改负责人。
9. 结束移除 worktree 和临时分支：
   ```bash
   git worktree remove "<临时目录>/${REPO_NAME}-pr<n>"
   git branch -D pr-<n>-review
   ```

## 12. 文档分层

`docs/` 是长期文档的唯一根目录。

```text
docs/
├── product/          # 产品目标、需求、交互决策
├── tech/             # 架构、技术方案、跨组件设计
├── guide/            # 上手指南、操作手册、排障手册
└── decisions/        # ADR 或长期决策记录
```

命名建议：

- 技术设计：`docs/tech/DESIGN_<主题>.md`，如 `DESIGN_AUTH.md`。
- 指南：`docs/guide/<主题>.md`，如 `LOCAL_DEV.md`。
- 决策：`docs/decisions/<日期>-<主题>.md` 或 `ADR-0001-<主题>.md`，以仓库既有约定为准。
- 每篇设计文档建议包含：状态、背景、目标/非目标、方案、备选方案、影响、修订记录。

规则：

- 文档解释 why 和取舍，不复制 schema 字段、接口表或代码可推导的事实。
- 接口/契约事实保持单一事实源；文档链接过去，不另存一份。
- 包/模块 `README.md` 只保留最小入口和用法，并链接 `docs/`；不要建 `src/**/docs` 深层目录。
- 代码行为变化时，同 PR 更新对应 `docs/`；文档未同步视为任务未完成。
- 推翻旧结论时追加修订记录（日期 + 决策 + 被推翻项），不要静默改写历史。

## 13. 信息沉淀与缓存

| 类型 | 例子 | 去向 |
|---|---|---|
| 可再发现的引用数据 | PingCode 状态 ID、项目/用户 ID 映射、状态值 | 本机缓存，仅作 hint |
| 经验性知识 | scope 要求、行为规律、踩坑结论、排障套路 | 用户确认后写入 `docs/`，走 PR |
| 任务过程信息 | 澄清结论、实施进展、完成总结 | 工作项评论，不另存本地副本 |

缓存约定：

```bash
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/$REPO_NAME"
```

- 目录名**动态取当前仓库文件夹名**：在仓库 `a` 中运行时是 `~/.cache/a/`，在仓库 `b` 中运行时是 `~/.cache/b/`，不要写死。
- 按 host 分文件，如 `$CACHE_DIR/open.pingcode.com.json`；条目带 `fetchedAt`。
- 默认 TTL 7 天；过期后重新拉取。
- API 实时结果优先：引用失效、状态不能流转、ID 找不到时，丢弃条目重新拉取并重试一次。
- 缓存损坏（非法 JSON）时忽略并重建，不中断任务。
- token、密钥、个人隐私不得写入缓存，也不得提交。
- 管理员可能修改工作流配置；拿不准时以实时查询为准。

收尾沉淀：

- a) 是否产生可复用的引用数据？询问用户确认后写入本地缓存。
- b) 是否产生有团队价值的经验？询问用户确认后写入 `docs/`，走正常 PR。
- 用户拒绝则不保存；不得静默落盘，也不要把运行时笔记写回 skill 目录。

## 14. 常见反模式

- 没有 `#工作项编号` 却套用认领、评论、编号分支命名规则。
- 用 `workitem list --identifier <数字>` 取详情，跨项目命中同号工作项。
- 直接开发 Feature，不先拆用户故事。
- 不检查状态/负责人就认领，或对当前状态重复发起流转。
- 不澄清需求、不先给方案就落盘改代码。
- 直接在集成分支改代码并提交。
- 未确认就创建分支、推送、开 PR 或合并。
- 把无关改动混进一个提交，或提交生成物/依赖目录。
- 没跑验证却说“测试通过”。
- 用 merge commit 同步 base，或 `--admin` 绕过保护。
- 评审时在当前工作区切分支、跑构建，影响他人未提交改动。
- 把设计文档写在源码目录、个人笔记或聊天记录里。
- 文档复制 schema 字段，形成第二事实源。
- 把 token、密钥、个人信息写入缓存或提交历史。
