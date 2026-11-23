# 参考：工作项驱动的 Git 工作流与文档沉淀

配合 SKILL.md 使用。PingCode 命令细节以 `use-pingcode-cli` skill 为准；本文只规定流程、Git 规范与文档沉淀。

## 0. 触发与变量

仅当任务带 `#<Identifier>`（如 `#ABC-42`；Ship 产品工单形如 `#ITS-T3745`）且要求开发/修复/实现/继续/评审/合并时启用。

```bash
IDENTIFIER="ABC-42"                  # 传给 pc 时去掉 #
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/$REPO_NAME"
```

- 分支名和 PR 标题保留 `#`：`#ABC-42/(feat)user-login`、`feat: #ABC-42 user-login`。
- 当前用户从 `pc whoami --json` 读取：登录名 `identity.user.name`，用户 ID `identity.user.id`。
- 没有编号的普通任务不要套用认领、评论、编号分支命名等规则。

## 1. 取工作项详情

先判编号类型：项目工作项走 `pc pjm workitem ...`；Ship 产品工单（如 `#ITS-T3745`）走 `pc ship ticket ...`。拿不准时先试 pjm get，404 再换 ship。

项目工作项：

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

Ship 产品工单：

```bash
pc ship ticket get ITS-T3745                  # 接受 whole_identifier / short_id / id
pc ship product list --keywords "<产品名>"    # 需要 list 时先解析 product id
pc ship ticket list --product-id <产品ID> --keywords "T3745"
```

- **`ticket list` 必须带 `--product-id`**：不带时 `--keywords` 只按编号匹配，会命中其他产品的同号工单（如 `PC-T3745`）。
- 只用 `get` 不需要先解析 product id；详情里的产品/状态/类型 id 复用作法与项目工作项相同。
- 工单的评论、附件同样走 `pc comments` / `pc attachments`。
- 后续认领、评论、分支、PR、收尾流程与项目工作项完全一致，不另开一套。

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
- 无工作项编号的任务不套用上面的格式，按仓库自身约定（常见 `feat/<kebab>`、`fix/<kebab>`）；仓库没有约定时也用 `<type>/<kebab>`。

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
- 契约/代码生成变更后，重新生成并确认生成物已更新；**生成物只能由生成器产生，不手改**。
- **页面/视图改动的额外验证**：变更涉及路由页、弹层或用户可感知的交互流，且当前环境提供浏览器自动化工具（工具集含 `browser_*`，如 Playwright MCP）时，在单测之外用真实浏览器跑一遍冒烟——页面/路由可达、关键交互（编辑、保存、切换、提交）符合预期、控制台无报错；这类验证是补充，**不替代也不削减** co-located 单测。
  - 前置：先按仓库说明启动宿主应用及其依赖（纯前端改动可只起 dev server 并走其代理）；浏览器工具只驱动已运行的服务，不负责起服务。
  - 环境没有这类工具时：退化为既有自动化测试，并在 PR 描述里注明「未做真实浏览器验证」及原因；**不得声称执行过未实际运行的浏览器验证**。
- 未运行、失败或环境缺失时如实报告，不要写“已验证”。
- 全绿后再提交；只提交本任务相关文件。

## 9. PR 与合并

1. 经用户确认后 push 并开 PR：
   ```bash
   git push -u origin '#ABC-42/(feat)user-login'
   gh pr create --base <集成分支>
   ```
2. PR 描述写清：变更、原因、验证、风险与回滚。
3. PR 创建后按「询问评审通知」征询用户意见（可选：通知评审人 / 只提交不通知），等 CI 与必需审批通过；不自行合并。
4. 用户确认后 squash 合并：
   ```bash
   gh pr merge <n> --squash --delete-branch
   ```
   - 合并前先看可合并性：`gh pr view <n> --json statusCheckRollup,mergeStateStatus,reviewDecision`。
   - 不用 `--merge` / `--rebase` / `--auto`，不用 `--admin` 绕过保护。
   - 删除远端分支前确认 PR 已 MERGED；误删导致 PR 关闭时，推回分支后 `gh pr reopen` 再合并。
5. **已 Approve 的 PR 不为非阻塞建议追加动工**：Approve（含带建议通过）、CI 全绿且 `mergeStateStatus` 可合并时，P1/P2、「建议修改后合入」等非阻塞意见不阻塞合并；除非用户明确要求处理，直接进入合并确认，不为这些建议另开提交或重跑评审。只有 Request Changes / REQUEST_CHANGES、P0 阻断问题或 CI 失败才必须先修并重新请求评审。
6. 合并后切回集成分支、`git pull --ff-only`、删除本地工作分支。

### 询问评审通知（开 PR 后必做）

开完 PR 后**必须主动问用户是否发评论提醒评审**。是否通知不是必须的，但每次都得问；未得到答复前不发评论、不分配 reviewer。

1. **准备候选**：从工作项负责人/参与人、项目成员、仓库协作者中挑 1~3 人，尽量标出 GitHub 账号，若找不到就写“未找到”。
   ```bash
   pc pjm workitem get <工作项id>        # 负责人、参与人
   pc organization user list --keywords "<姓名或登录名>"   # 拿到用户 ID、登录名、邮箱

   gh api users/<github-login> --jq '{login,name,email}'
   gh api orgs/<github-org>/members --paginate --jq '.[].login'
   ```
   - GitHub 映射优先同名 login，其次邮箱前缀、组织成员名单、`git log` 提交作者或姓名比对。
   - 映射不确定就标“未确认”，不要凭昵称猜。
2. **向用户提问**：把候选（含 GitHub 映射）和三个选项一并给出：
   - 选候选中的某人；
   - 指定其他人（姓名或登录名，再由你解析成 `pc` 用户 ID）；
   - 只提交、不通知（不发评论、不加 reviewer）。
3. **用户选「通知」时**：只 @ 用户指定的人，不擅自多 @。
   - PingCode 工作项评论（mention 格式）：
     ```bash
     COMMENT="[@<用户ID>|<登录名>] 麻烦评审 PR：<PR URL>

     变更概要……"
     jq -n --arg content "$COMMENT" \
       '{principal_type:"workitem", principal_id:"<工作项id>", content:$content}' \
       | pc comments create --data @- --dry-run   # 先 dry-run 核对 content，去掉 --dry-run 再发
     ```
     避免手拼 JSON；手工构造时 `\n` 才是换行，`\\n` 会留下字面量。
     提及语法只认 `[@<用户ID>|<登录名>]`，只写 `@登录名` 不触发通知；遵守链接 / 引用边界规则（URL、分支名、`#编号` 后必须换行或空格）。
   - GitHub（尽力而为，仅当账号已确认）：
     ```bash
     gh api -X POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
       -f 'reviewers[]=<github-login>'
     gh pr comment <n> --body '@<github-login> 麻烦评审一下，谢谢'
     ```
     部分仓库用 `gh pr edit --add-reviewer` 会因 Projects (classic) 弃用报 GraphQL 错误，改用上面的 REST API；只加 requested reviewer 不会在 PR 时间线产生 @ 通知，评论 @ 必须单独发送。找不到账号就跳过并告知用户。
4. **用户选「只提交」时**：不发评论、不加 reviewer，也不要“顺手”@ 一下；后续用户要求补发再补。
5. **汇报结果**：明确告诉用户本次是否通知、通知了谁、走了哪些通道（PingCode / GitHub 做了或未做及原因）、PR 当前状态（等待评审 / CI 失败 / 可合并）；任务收尾时再提醒一次，评审未通过前不合并。

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
2. 追加一条**纯文本**总结评论：交付内容、验证结果、评审通知情况（已通知谁 / 用户选择不通知）、后续衔接。

   ```bash
   COMMENT="交付内容……
   - 验证：……
   - 评审：……"
   jq -n --arg content "$COMMENT" \
     '{principal_type:"workitem", principal_id:"<工作项id>", content:$content}' \
     | pc comments create --data @-
   ```
   正文含换行时优先这种 `jq -n --arg` + `--data @-` 写法，必要时先加 `--dry-run` 核对。
3. 需要 @ 人时用 `[@<用户ID>|<登录名>]`；用户 ID 经 `pc organization user list` 解析。只写 `@登录名` 不会触发提及。
4. 评论换行分段、用 `-`/`1.` 列点，不写 HTML 标签。
5. **链接 / 引用边界（PingCode 自动链接规则，实测）**：裸链接、分支名（如 `#REP-1088/(feat)project-loading-skeleton`）与 `#编号` 引用后紧跟全角标点（`（）：，。；！？`）时，PingCode 不把全角字符识别为链接终止，会把后续文字吞进超链接：`.../pull/639（base: develop）` 的链接会变成 `.../639（base: develop）` 而失效，`#REP-1088/(feat)project-loading-skeleton（commit 7b4d5c94，已推送）` 会把 `（commit…）` 并入分支链接。因此：
   - 链接、分支名、`#编号` 后只接**空格或换行**，再写补充说明；禁止与全角括号/冒号/逗号直接相连。
   - 安全写法：分行（片段独占一行），或片段后留空格再接半角括号/全角说明，如 `PR：https://github.com/atinc/reping/pull/639 (base: develop)`、`- 分支：#REP-1088/(feat)project-loading-skeleton （commit 7b4d5c94，已推送）`。
   - 半角 `)`/`]`、空格、换行是安全边界；全角标点不是。发送前检查每条含链接或分支号的评论。
6. 过程信息只留在工作项评论，不在本地另存副本。

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
4. **只做代码检查，不跑 Lint / Test / 构建**：以仓库规范与设计文档（各级 `AGENTS.md`、`docs/`）为规范与需求依据，检查规范性（风格、分层、依赖方向、测试约定）与需求符合性（是否实现工作项/PR 描述要求，有无遗漏或范围蔓延），问题引用具体文件与规则出处。
5. **默认不在本地跑任何检查命令**；CI 结果直接查 PR 的 status checks（`gh pr view <n> --json statusCheckRollup`）并引用到结论里，CI 失败或缺失如实说明，不得声称跑过未执行的检查。仓库流程明确要求本地跑时才跑，并说明跑了哪些。
6. **给结论**：只允许「通过 / 拒绝 / 不确定」三选一并附理由，提交用户选择。
7. **PR 侧只发评审意见**：按用户选择用 `gh pr review <n> --approve|--request-changes|--comment` 提交；不合并、不推送、不改作者分支（合并是作者/负责人的动作）。
8. **工作项侧只评论**：结论与依据以纯文本评论发到工作项，与开始标记对应；不改状态、不认领、不改负责人。
9. 结束移除 worktree 和临时分支：
   ```bash
   git worktree remove "<临时目录>/${REPO_NAME}-pr<n>"
   git branch -D pr-<n>-review
   ```

## 12. 文档分层

`docs/` 是默认的长期文档根目录；**仓库已有文档约定时从仓库**（根 `AGENTS.md` / `CONTRIBUTING` / 既有目录结构优先）。没有约定时建议：

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
- b) 是否产生有团队价值的经验？询问用户确认后写入 **该仓库** 的 `AGENTS.md` 或 `docs/`（仓库有既定沉淀位置时从仓库），走正常 PR。
- c) 只有确实是跨仓库通用的结论，才另外提议回流到本 skill；不要只写进 skill 而漏掉仓库侧文档。
- 用户拒绝则不保存；不得静默落盘，也不要把运行时笔记写回 skill 目录。

## 14. 文件访问纪律

探索仓库时默认**不读取、不遍历、不修改**机器生成的大目录/大文件：体积大、内容重复且非事实源，浪费上下文也容易被误导。

- **判据以 `.gitignore` 为唯一基准**（根与各成员自己的 `.gitignore`），下面是类别不是穷举。
- **依赖目录**：包管理器安装目录，如 `node_modules/`（含 `.pnpm/`、`node_modules/.vite/`）。
- **构建产物**：`dist/`、`dist-test/`、`out/`、`storybook-static/`、`.prerender/`、`*.tsbuildinfo`、`*.test` 等可重建产物。
- **生成的原生/脚手架工程**：代码生成器产出的整棵目录树。
- **工具缓存与覆盖率**：`.expo/`、`coverage/`、`*.lcov` 等删掉即可重建的中间态。
- **本地环境与编辑器目录**：`.env`、`.env.*`、`.idea/`、`.vscode/`、`.claude/`、`.cursor/` —— 不主动访问；其中密钥**不得输出到对话、不得写入任何文件、不得提交**。
- 锁文件与 `*.log` 体积大但不是目录：按需 grep 取命中片段，**不整读**。

## 15. 常见反模式

- 没有 `#工作项编号` 却套用认领、评论、编号分支命名规则；或反过来，有编号却用仓库的 `feat/` 格式。
- 把 Ship 产品工单（`#ITS-xxx`）当项目工作项去 `pc pjm workitem get`，或不带 `--product-id` 就 `ticket list`。
- 手拼含换行的评论 JSON，导致正文出现字面量 `\n`；发送前不做 `--dry-run` 核对。
- 用 `workitem list --identifier <数字>` 取详情，跨项目命中同号工作项。
- 直接开发 Feature，不先拆用户故事。
- 不检查状态/负责人就认领，或对当前状态重复发起流转。
- 不澄清需求、不先给方案就落盘改代码。
- 直接在集成分支改代码并提交。
- 未确认就创建分支、推送、开 PR 或合并。
- 开 PR 后不问用户就直接发 @ 评论、加 reviewer，或相反——不问就默默跳过。
- 用户明确选了「只提交」还强行 @ 人或加 reviewer，或擅自多 @ 用户没指定的人。
- 用户指定了人，却只加 GitHub reviewer 没在工作项评论里 @。
- 未核实 PingCode 用户与 GitHub 帐户的映射就 @ 错人，或把猜测的 login 当真。
- 开 PR 后不告诉用户本次是否通知、通知了谁、PR 处于什么状态。
- 把无关改动混进一个提交，或提交生成物/依赖目录。
- 没跑验证却说“测试通过”；或环境没有浏览器自动化工具却声称做过真实浏览器验证。
- 手改 codegen / 构建产物，而不是重新生成。
- 主动读取或改动 `node_modules/`、`dist/`、`coverage/`、生成的原生工程等 `.gitignore` 覆盖的目录；把密钥/`.env` 内容贴进对话或写进文件。
- 把本 skill 当唯一事实源，忽略仓库自己的 `AGENTS.md` / `CONTRIBUTING` / CI 配置。
- 用 merge commit 同步 base，或 `--admin` 绕过保护。
- 评审时在当前工作区切分支、跑构建，影响他人未提交改动。
- 把设计文档写在源码目录、个人笔记或聊天记录里。
- 文档复制 schema 字段，形成第二事实源。
- 把 token、密钥、个人信息写入缓存或提交历史。

## 16. 与仓库自身规范的关系

本 skill 是通用缺省实现，不是唯一事实源：

- **仓库规范优先**：目标仓库的 `AGENTS.md` / `CONTRIBUTING` / CI 配置与本文冲突时，以仓库为准；仓库未写的地方才用本文默认值。
- **新经验先进仓库**：在某仓库摸到的结论（scope 要求、链接 / 引用边界、命令参数变化等）先回流到该仓库的 `AGENTS.md` / `docs/`，只有确属跨仓库通用的部分才提议改本 skill。
- 反向也成立：发现本 skill 与新版本 CLI 行为不一致时，以 `pc --help` 与实测为准，并把差异记进仓库文档。
