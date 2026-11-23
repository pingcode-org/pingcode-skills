---
name: workitem-driven-development
description: '当用户给出 PingCode 工作项编号（项目工作项形如 #ABC-42，Ship 产品工单形如 #ITS-T3745）并要求开发、修复、实现、继续任务，或明确要求按 #编号 走分支、提交、开 PR、合并、评审时使用。整合 PingCode 工作项驱动流程、Conventional Commits、squash 合并与 docs/ 文档沉淀，依赖 use-pingcode-cli skill。没有工作项编号的普通任务不要触发。'
---

# 工作项驱动的 Git 工作流

**触发条件**：任务带 PingCode 编号 `#<Identifier>`（项目工作项如 `#ABC-42`，Ship 产品工单如 `#ITS-T3745`），且用户要求开发、修复、实现、继续、评审或合并。没有编号的普通代码修改不要套用本 skill 的认领、评论、分支命名规则，按仓库自身规范（如 `feat/<kebab>`）执行。

PingCode 操作全部依赖 **`use-pingcode-cli` skill**：先按它预检 `pc` 与登录，再使用本流程；不要臆造 `pc` 命令或参数。本 skill 只规定流程和 Git/文档规范，API 细节以 `use-pingcode-cli` 为准。

详细子流程、Feature 拆解、提交类型和反模式见 [`reference.md`](reference.md)。

## 与仓库自身规范的关系

本 skill 是通用缺省实现：**以目标仓库的 `AGENTS.md` / `CONTRIBUTING` / CI 配置为准，冲突时仓库规范优先**。仓库没写的地方才用本 skill 的默认值。在某个仓库摸到的新经验，优先回流到该仓库的 `AGENTS.md` / `docs/`，再判断是否收敛进本 skill。

## 硬规则

- 不在集成分支（常见 `develop`/`main`，以仓库实际保护规则为准）直接改文件、提交或推送；一切变更走工作分支 + PR。
- 不主动 `commit` / `push` / 合并 PR；除非用户明确要求。
- 危险操作（`reset --hard`、`restore`、`clean -fd`、`stash drop`、对已推送历史 rebase/amend、任何 `push --force*`）执行前必须说明影响并征得确认；**任何情况下都不对集成分支强制推送**。
- **不读、不遍历、不改机器生成的目录与文件**：依赖目录、构建产物、缓存/覆盖率、生成的原生工程、`.env`/编辑器目录；判据以 `.gitignore` 为唯一基准。锁文件与 `*.log` 按需 grep，不整读。密钥不输出到对话、不写入文件、不提交。
- 不手改 codegen / 构建产物，生成物只能由生成器重新生成。
- 不声称执行过未实际运行的检查；CI 失败或缺失要如实说明。
- 每次开完 PR 都要**主动问用户是否发评论提醒评审**（「只提交、不通知」也是合法选项）。是否通知由用户定，但**不能不问**；也**不能未经确认就 @ 任何人**。用户确认通知时，优先推荐 PingCode 用户作候选，允许改选他人或只提交。
- 需要长期保留的文档统一沉淀到 `docs/`，不散落在源码目录、个人笔记或聊天记录里。

## 0. 识别编号与预检

1. 从用户消息提取 `#<Identifier>`，例如 `#ABC-42`。调用 `pc` 时去掉 `#`：`ABC-42`；分支名和 PR 标题保留 `#`。
2. 加载 `use-pingcode-cli`，按它执行 `pc doctor`；退出码非 0 时按失败项修复，不要继续。
3. 用 `pc whoami --json` 确认当前用户：登录名取 `identity.user.name`，用户 ID 取 `identity.user.id`。后续“当前用户”都以此为准。
4. 记录仓库文件夹名，供缓存和临时 worktree 使用：

   ```bash
   REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
   ```

## 1. 取工作项详情

**先判编号类型**：`#<项目前缀>-<序号>` 是项目工作项（`pc pjm workitem ...`）；`#<产品前缀>-<序号>`（如 `#ITS-T3745`）是 Ship 产品工单（`pc ship ticket ...`）。判不准时先按 pjm get，404 再换 ship，不要在同一条命令上反复试。

项目工作项：

```bash
pc pjm workitem get ABC-42
```

- **必须用完整编号 get**，不要用全局 `pc pjm workitem list --identifier <数字>` 取详情；不带 `--project-id` 时会跨项目命中同号工作项，结果有歧义。只有手里只有数字、拼不出完整编号时，才退回 `pc pjm workitem list --project-id <pid> --identifier <n>` 做项目内精确查询。
- 同时拉取评论与附件：
  ```bash
  pc comments list --principal-type workitem --principal-id <工作项id>
  ```
- 记录返回体的 `id`、`project.id`、`type.id`、`state.id`、`assignee.id`、`parent_id`；后续类型/状态解析和写操作都用这些 id。
- `parent_id` 非空时，拉父工作项的标题和描述，理解上层背景。
- 用 `pc pjm workitem list --project-id <项目ID> --parent-id <工作项ID>` 查子项：**先只读标题**掌握全貌，再按需读相关子项详情，不要一次拉全部。
- Feature 拆解时，用 `pc pjm workitem-relation list <工作项ID>` 查关联工作项，按需读取。

Ship 产品工单：

```bash
pc ship ticket get ITS-T3745                 # 支持 whole_identifier / short_id / id
pc ship product list --keywords "<产品名>"   # 需要 list 时先解析 product id
pc ship ticket list --product-id <产品ID> --keywords "T3745"
```

- **`ticket list` 必须带 `--product-id`**：不带时 `--keywords` 只按编号匹配，会命中其他产品的同号工单。只用 `get` 时不需先解析 product id。
- 工单详情里拿到的产品、状态、类型 id 复用方式与项目工作项一致；后续认领、评论、分支、PR 流程相同。

## 2. 判断工作项类型

用 `pc pjm workitem-type list-for-project --project-id <项目ID>` 解析项目内真实类型，按名称匹配，不要硬编码类型 id 或 `story`/`bug` 标签。

- **是 Feature / 产品需求**：不要直接认领或开发，转入 [`reference.md`](reference.md) 的「Feature 拆解流程」，先拆出可独立交付的用户故事。
- **不是 Feature**（用户故事、任务、缺陷等执行类工作项）：继续第 3 步。

## 3. 状态与负责人检查

- 状态不是“打开/待处理”类初始状态时，向用户提示并询问是否继续，不自行继续。状态 id 用 `pc pjm workitem-state list-for-project --project-id <pid> --workitem-type-id <type-id>` 解析，按名称识别，不硬编码。
- 已设置负责人且不是当前用户时，向用户提示并询问是否继续。
- 需求、方案、验收标准不明确时**不猜测**，向用户提问直到明确。

## 4. 认领（幂等）

负责人不是当前用户时，把负责人设为当前用户；状态不在“进行中”时，把状态置为进行中。目标值已就位就跳过对应写入，不要对当前状态重复发起流转（会报“工作项状态不能流转到当前状态”）。

```bash
pc pjm workitem update <工作项id> --data '{"assignee_id":"<当前用户ID>"}'
pc pjm workitem update <工作项id> --data '{"state_id":"<进行中状态ID>"}'
```

- 写操作前先读工作项；写后重新 `get` 验证。
- 403/scope 不足时停下交用户处理，不要反复重试。

## 5. 理解、拆分与方案先行

1. 读标题、描述、评论、附件，结合父/子/关联工作项理解验收意图。
2. 工作量较大（跨模块、多阶段、可并行）时，先提示用户是否创建子工作项（类型为任务），用户同意后再创建；再询问是否按顺序逐个领取执行。每个子任务仍各自走认领 → 分支 → PR 全流程。此步只适用于非 Feature 的执行类工作项，Feature 走拆解流程，Code Review 不受此约束。
3. 先把方案与要改的文件告知用户，**不要落盘**；用户确认后才开始改代码。
4. 沟通中明确的关键结论、范围边界、实施进展、完成总结，及时以**纯文本**评论发到工作项：
   - 用换行分段、`-`/`1.` 列点，不要写 HTML 标签。
   - **评论正文用 JSON 序列化生成，不要手拼**：正文含换行/引号/反斜杠时，用 `jq -n --arg content "$COMMENT"`（或等价方式）生成请求体，经 `--data @-` 或 `--data @文件` 传入。手写 JSON 时只有 `\n` 表示换行，写成 `\\n` 会在正文留下字面量 `\n`；发送前用 `--dry-run` 核对 `content` 原样正确。
   - **链接 / 引用边界（PingCode 自动链接规则，实测）**：评论里的裸链接（GitHub PR、文件 URL 等）、分支名（如 `#REP-1088/(feat)project-loading-skeleton`）与 `#编号` 引用后若紧跟全角标点（`（）：，。；！？`），PingCode 不会把它识别为链接终止，会把后面的文字一并吞进超链接导致链接失效或变形。典型症状：`- 分支：#REP-1088/(feat)project-loading-skeleton（commit 7b4d5c94，已推送）` 里的 `（commit…）` 被并入分支链接。规则：
     - 任何 URL、分支名、`#编号` 之后必须接**空格或换行**，再接说明文字或全角标点；禁止 `https://x.com/639（base: develop）`、`#REP-1088/(feat)xxx（commit abc，已推送）` 这类写法。
     - 推荐把补充信息另起一行或用半角括号并与片段之间留空格，例如：`PR：https://github.com/atinc/reping/pull/639 （base: develop）`、`- 分支：#REP-1088/(feat)project-loading-skeleton （commit 7b4d5c94，已推送）`。
     - 半角 `)`/`]`、空格、换行是安全边界；全角括号/冒号/逗号不是。发送前逐条检查含链接或分支号的评论。
   - 需要 @ 人时用 `[@<用户ID>|<登录名>]`（用户 ID 经 `pc organization user list` 解析）；只写 `@登录名` 不会触发提及。
   - 过程信息只留在工作项评论，不在本地另存副本。

## 6. 创建工作分支

按顺序执行，任一步不满足就停下问用户：

```bash
git rev-parse --abbrev-ref HEAD     # 应在集成分支
git status --porcelain              # 应为空
git fetch origin
git pull --ff-only                  # 落后时
git checkout -b '#ABC-42/(feat)user-login'
```

- 分支名格式：`#<Identifier>/(<type>)<kebab-简述>`，如 `#ABC-42/(feat)user-login`、`#ABC-42/(fix)retry-timeout`。
- Identifier 与分支名之间用 `/`，不要用冒号；`#` 可以出现在分支名中。
- 分支名先给用户确认；拿不准时 `git check-ref-format --branch '<name>'` 验证。
- 不在集成分支时不要自行切换；工作区不干净时让用户决定提交、stash 或丢弃。
- 所有修改与提交都在工作分支进行；切换分支需用户确认。
- 无工作项编号的任务按仓库自身分支规范命名（如 `feat/<kebab>`）；有编号时统一用上面的 `#<Identifier>/(<type>)<kebab>`。

## 7. 提交与 PR

- 提交前运行仓库文档或 CI 定义的验证；按受影响包/模块跑 lint、typecheck、test、build；不能运行要说明原因。
- 涉及页面/视图改动，且当前环境提供浏览器自动化工具（`browser_*`，如 Playwright MCP）时，在单测之外用真实浏览器做一次冒烟：页面可达、关键交互（编辑/保存/切换/提交）符合预期、控制台无报错。没有这类工具时退化为既有自动化测试，并在 PR 描述注明「未做真实浏览器验证」及原因；不得声称跑过未执行的浏览器验证。
- 契约/代码生成变更后重新生成并确认生成物已更新；**不手改生成物**。
- 只暂存本任务相关文件；提交前看 `git status`、`git diff`。
- commit message 用 Conventional Commits：`<type>[optional scope]: <description>`，如 `feat: #ABC-42 user-login` 的拆分提交可写 `feat(auth): add login form`。
- PR 标题格式：`<type>: #<Identifier> <简述>`，如 `feat: #ABC-42 user-login`。
- 经用户确认再 `git push -u origin <branch>` 并开 PR 到集成分支；PR 描述写清变更、原因、验证、风险与回滚。
- 开 PR 后执行「询问评审通知」，**先问再动**，不要默认发评论：
  1. 从工作项负责人/参与人、项目成员与仓库协作者中挑 1~3 名候选，并尽力标出各自的 GitHub 账号（能核实就写，核不实就写“未找到”）；
  2. 明确告知用户选项：**选用候选** / **指定其他人**（可给姓名或登录名）/ **只提交、不通知**；
  3. 用户确认前不发任何评论、不分配 reviewer。
- 用户选「只提交」：不再发提醒评论，也不要自行 @ 或加 reviewer；后续用户要求补发时再补。
- 用户选「通知」时按用户指定的对象做，不擅自多 @：
  - **PingCode**：用 `[@<用户ID>|<登录名>]` 在工作项评论 @ 用户选的成员，附 PR 地址；
  - **GitHub（尽力而为）**：能核实到对方的 GitHub login 就一并加 requested reviewers 并评论 `@<github-login>`；核实不到就跳过并说明，不要臆造 login 或 @ 错人。
- 无论用户选择哪种，都告知「本次是否通知、通知了谁、PR 当前状态」；任务结束时再提醒一次，评审未通过前不合并。
- 默认 squash 合并：`gh pr merge <n> --squash --delete-branch`；不用 `--merge`/`--rebase`/`--auto`，不用 `--admin` 绕过保护。
- 合并前先确认可合并：`gh pr view <n> --json statusCheckRollup,mergeStateStatus,reviewDecision`；CI 失败或必需审批未满足就等，不要绕过。
- **已 Approve 的 PR 不为非阻塞建议追加动工**：Approve + CI 全绿 + 可合并时，P1/P2、「建议修改后合入」这类非阻塞意见不阻塞合并，除非用户明确要求处理，否则直接进入合并确认；只有 REQUEST_CHANGES、P0 阻断问题或 CI 失败才必须先修并重新请求评审。
- PR 落后 base（BEHIND）时：`git fetch origin` 后 rebase 到 `origin/<集成分支>`；不要用 `--admin`，也不要把集成分支 merge 进工作分支。rebase 后复跑验证，经用户确认再 `git push --force-with-lease`。
- 合并后确认 PR 为 MERGED，再切回集成分支 `git pull --ff-only` 并删除本地工作分支。

## 8. 合并后收尾

1. 复查工作项状态：**已是完成态（如“已修复”/“已完成”，常由 PR 合并自动化流转）则不要重复设置**，仅核对结果；否则才把状态置为完成态。
2. 复查评审状态：列出本次是否发了评审通知、通知了谁、走的是哪些通道（用户可选“只提交不通知”），以及当前是否已通过；未通过时提醒用户等待评审，不要自行绕过。
3. 无论是否改状态，都追加一条纯文本总结评论：交付内容、验证结果、评审通知情况（已通知谁 / 用户选择不通知）、后续衔接。
4. 不把过程信息另存本地；需要长期保留的经验按第 10 节沉淀。

## 9. Code Review（按需）

对 `#<Identifier>` 或指定 PR 做评审时：

1. 先查工作项状态与评论，确认没有进行中的评审或已有结论；有则停下告知用户，除非用户明确要求重新评审。
2. 先发一条纯文本评论，注明当前用户开始 Code Review 与 PR 地址，作为占用标记；**先留痕再看代码**。
3. 在系统临时目录建独立只读 worktree，例如 `<临时目录>/${REPO_NAME}-pr<n>`；不要在当前工作区执行 git 或构建操作。
4. 只做代码与规范检查；**默认不跑 lint / typecheck / test / 构建**，CI 结果直接引用 `gh pr view <n> --json statusCheckRollup`；仓库明确要求本地跑时才跑，并说明跑了什么。未运行不要声称运行过。
5. 结论只用「通过 / 拒绝 / 不确定」并附理由，交用户选择。
6. PR 侧用 `gh pr review` 提交 APPROVE / REQUEST_CHANGES / COMMENT，不合并、不推送、不改作者分支；工作项侧只评论，不认领、不改状态、不改负责人。
7. 结束移除 worktree 和临时分支。

可借助仓库自带的 code-review skill 或双轴检查，但不作为强制要求。

## 10. 文档分层与信息沉淀

**`docs/` 是默认的长期文档根目录**，但仓库已有文档约定时（根 `AGENTS.md` / `CONTRIBUTING` / 既有目录结构）从其约定。没有约定时按主题建子目录：

| 目录 | 内容 |
|---|---|
| `docs/product/` | 产品目标、用户与场景、需求与交互决策 |
| `docs/tech/` | 跨包/跨组件的架构与技术决策，建议 `DESIGN_<主题>.md` |
| `docs/guide/` | 新人上手指南、操作手册、排障手册 |
| `docs/decisions/` | 需要长期保留的决策记录（ADR） |

- 文档解释 why，不复制接口 schema、字段表或代码可推导的事实；接口事实保持单一事实源。
- 每篇设计文档标注状态、上游文档与修订记录；推翻旧结论时追加修订记录，不静默改写。
- 包/模块 `README.md` 只保留最小入口与用法并链接 `docs/`；不要在 `src/` 下建深层 docs 目录。
- 代码行为变化时，同 PR 更新受影响的 `docs/`；文档未同步视为任务未完成。

信息分三类：

| 类型 | 去向 | 是否提交 |
|---|---|---|
| 可再发现的引用数据（ID、名称映射、状态值） | 本机缓存，仅作提示 | 否 |
| 有团队价值的经验、结论、排障套路 | 询问用户确认后写入 `docs/`，走 PR | 是 |
| 任务过程信息（澄清、进展、总结） | 工作项评论 | 否 |

缓存目录**动态使用当前仓库文件夹名**，不要写死：

```bash
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/$REPO_NAME"
```

- 按 host 分文件，条目带 `fetchedAt`；默认 TTL 7 天。
- API 实时结果永远优先；引用失效、状态不能流转、ID 找不到时，丢弃条目重新拉取并重试一次。
- 缓存损坏（非法 JSON）时忽略并重建；token、密钥、个人隐私不得写入。
- 收尾时主动盘点是否产生可复用知识，但**写入前必须询问用户**；用户拒绝则不保存，不得静默落盘。
