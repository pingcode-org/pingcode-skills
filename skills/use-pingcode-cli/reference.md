# 参考：使用 `pc`（PingCode REST API v2.0）

配合 SKILL.md 使用。本文件自包含，**在任意仓库/目录都适用**——调用的是已安装的 `pc`。
本文件随 skill 版本分发，**只读**：不要在运行时回写或追加内容（更新 skill 会覆盖）。

## 版本与地址

- 官方 v2 文档入口：<https://developer.pingcode.com/restapi/pingcode/overview>；API 根地址：`https://open.pingcode.com`。
- 本文以 **PingCode REST API v2.0** 为准，CLI 以 `pc` 1.0.0+（v2 版）为基准；更早的 v1 CLI 不适用。
- 业务接口路径统一为：`https://{rest_api_root}/v2[/{area}]/{resource}[/{action}]`。
  - 公有云：`rest_api_root = open.pingcode.com`，例如 `https://open.pingcode.com/v2/pjm/workitems`。
  - 私有部署：`{自定义域名}/open`，例如 `https://pingcode.example.com/open/v2/pjm/workitems`。
- CLI 默认 base URL 是 `https://open.pingcode.com`。查看：`pc config get base-url`；修改：`pc config set base-url <URL>`。
- 鉴权令牌端点仍是 `/v1/auth/token`（v2 文档中的 OAuth/企业令牌流程），但业务资源路径全部是 `/v2/...`。不要因此把业务请求改回 `/v1/`。

### v1 → v2 关键变化

| 项目 | v1（旧） | v2（当前） |
|---|---|---|
| 业务路径 | `/v1/...` | `/v2/...` |
| 默认地址 | `https://api.pingcode.com` | `https://open.pingcode.com` |
| 工作项按编号取 | 只能 list 过滤 | `GET /v2/pjm/workitems/{workitem_id}` 直接接受 `id` / `short_id` / `whole_identifier` |
| 创建工作项 `type_id` | 可用 `story`/`bug` 等标签 | **必须是项目内真实类型 id** |
| 凭据来源 | `PC_TOKEN`、`.env` 等 | 保存的登录（`pc login`）；业务命令忽略 `PC_*` 环境变量和 `.env` |
| 时间戳 | 10 位秒级 | 10 位秒级；日期字段另有 `DateValue` 对象 |
| 搜索 | 普通筛选 | `{"mode":"query","payload":{...}}` 结构化查询 |
| 限流 | 较简单 | 企业 RPM + 单接口 RPS 两层，带 `X-RateLimit-*` 响应头 |

## 安装与调用

- 已安装时直接用 `pc ...`。确认：`command -v pc`、`pc --version`。
- 未安装时提示用户（不要假设源码在本地）：
  - npm（需要 Node.js >= 22，推荐）：`npm install -g @pingcode/cli`；需要最新预发布版用 `npm install -g @pingcode/cli@next`。安装后命令是 `pc`。临时试用：`npx --yes @pingcode/cli@next --version`。
  - Homebrew：`brew tap shaunxu/tap && brew install pc`
  - 或 GitHub Release 的一键脚本 / 直接下载二进制（见项目 README「安装」）。
  - 有 Rust 工具链也可 `cargo install`。
- CLI 自带一份可读参考（不是本 skill 的替代品）：
  - `pc skills read`：工作流与 topic 索引
  - `pc skills read pjm|query|fields|authentication|rate-limits|ship|testhub|wiki|organization|common`
- **不要运行 `pc skills install` 来覆盖本 skill 目录**，除非用户明确要求安装 CLI 自带的发现技能。

## 鉴权与配置（v2 CLI）

当前 CLI 使用**保存的登录**，不再从 `PC_TOKEN` / `PC_CLIENT_ID` / `PC_CLIENT_SECRET` / `PC_OPEN_API_BASE_URL` / `.env` 读取业务凭据。

| 方式 | 命令 | 说明 |
|---|---|---|
| 个人令牌 / OAuth access token | `pc login` 或 `pc login --with-token` | 交互式不回显输入；`--with-token` 从 stdin 读，适合自动化 |
| 企业凭据 | `pc login --method client-credentials --client-id <ID> --client-secret <SECRET>` | 需显式指定 `--method` |
| 地址 | `pc config set base-url <URL>` | 私有部署先设置；`pc config unset base-url` 恢复默认 |
| 查看身份 | `pc whoami --json` | 输出企业/用户信息 |
| 退出 | `pc logout` | 只删除本地保存的登录，不吊销远端令牌 |

- 默认把凭据存进系统凭据库；只有明确接受时才用 `--insecure-storage` 明文保存。不要让用户在聊天里粘贴 token/secret。
- `--config-dir <DIR>` 可隔离配置与登录；`--base-url <URL>` 可只对单次命令覆盖地址。
- `pc doctor` 的 stdout 是 JSON 诊断报告：`ok`、`summary`、`config.credential_sources`、`identity.team/user`、`checks[]`。每项有稳定 `id` 与 `status`（pass/fail/warn/info/skipped），失败项带 `remediation.steps`；退出码 0=全部通过，1=有检查失败，2=命令自身异常。`--dry-run` 只跑静态检查。
- 常见检查 id：`credentials_present`（缺凭据）、`credential_pair`（id/secret 不成对）、`base_url_format`、`base_url_reachable`（网络/地址不通）、`token_exchange`（client 凭据被拒）、`api_auth`（token 无效/越权）、`token_kind`（用户/企业令牌，info）。
- 身份查询失败或缺少 identity scope 只产生 warning，不代表令牌无效；以 `api_auth` 和业务请求的实际结果为准。

## 模块地图（`pc <module> ...`）

- `organization`：企业信息、成员（user）、部门（department）、团队（user-group）及成员、角色（role）、职位（job）。
- `pjm`：项目（project）、工作项（workitem）、工作项类型/状态/状态方案/属性/优先级/标签、迭代（sprint）、发布（release）、看板（board）、项目成员、项目模版。
- `ship`：产品（product）、需求（idea）、工单（ticket）、客户（customer）、成员、标签，以及需求/工单的状态、属性、优先级、解决方案、渠道等配置。
- `testhub`：测试库（library）、用例（testcase）、用例模块、计划（testplan）、执行（testrun）、状态/类型/重要程度等配置。
- `wiki`：空间（space）、空间成员、页面（page）、页面正文与版本。
- `nexus`：Nexus 应用平台（KVS/CES/NOS 存储、Webhook、队列、实时通道、Exposer 自定义路由）。
- `security`：登录日志、审计日志。
- `permission`：权限点、我的全局/Pilot/Principal 权限、权限检查。
- `expression`：表达式分析与计算。
- `workload` / `workload-type`：工时与工时类型。
- 通用资源：`comments`、`attachments`、`entity-properties`、`participants`、`relations`、`activities`、`reviews`、`sections`、`categories`。
- 本地/诊断命令：`login`、`logout`、`whoami`、`config`、`doctor`、`skills`。

发现具体命令一律用 `pc <module> --help` 逐级下钻，不要凭记忆拼参数。

## v2 数据结构与分页

- 资源有两种结构：
  - **全量结构**：包含资源全部属性；获取单个资源或分页列表时返回。
  - **引用结构**：只含 `id`、`url`、`name` 等必要字段；其它资源引用它时返回。
- 时间统一是 **10 位 Unix 秒**。日期字段（如工作项 `start`/`due`）可能是 `DateValue`：
  `{"date":1730000000,"with_time":1}`；`with_time: 0` 表示只到日期。不要把毫秒时间戳直接传进去。
- 列表是分页结构：

  ```json
  {
    "page_size": 30,
    "page_index": 0,
    "total": 100,
    "values": []
  }
  ```

  - `page_index` 从 **0** 开始；默认每页 30 条，最大 100 条。
  - 用 `--page-index` / `--page-size` 翻页或放大页大小；增量遍历时保持过滤条件不变。
  - 读取完整结果时要翻完所有页，并按 `id` 去重后再统计；不要把第一页数量当成总数。
- 写操作用 `--data <JSON>`：内联 JSON、`@file.json`、或 `@-`（stdin）。请求体必须是 JSON object；字段以该操作 `--help` 里的 `Doc:` 页面为准。
- `PATCH` 只提交要改的字段；`null`、空字符串、空数组的清除语义不同，不要整对象回写。

## 工作项：按编号直接 get（v2 重点）

接口：`GET /v2/pjm/workitems/{workitem_id}`
文档：<https://developer.pingcode.com/restapi/pingcode/getV2PjmWorkitemsByWorkitemId>

`workitem_id` 路径参数支持三种写法：

| 写法 | 含义 | 示例 |
|---|---|---|
| `id` | 工作项对象 id | `pc pjm workitem get 5e05d8448f8461dada9ba29c` |
| `short_id` | 数字短号 | `pc pjm workitem get 42` |
| `whole_identifier` | 完整编号（项目前缀-数字） | `pc pjm workitem get ABC-42` |

```bash
# 推荐：用完整编号，歧义最小
pc pjm workitem get ABC-42

# 纯数字短号（只在能确定项目/编号唯一时使用）
pc pjm workitem get 42
```

- 不需要先 `list` 再过滤；只要用户给的是编号，直接 `get`。
- CLI help 把参数描述为 “Work item id or short id”，但 v2 接口文档明确还支持 `whole_identifier`，所以 `ABC-42` 这种完整编号可直接用。用 `--dry-run` 可先确认 URL：`pc pjm workitem get ABC-42 --dry-run`。
- 返回对象关键字段：
  - `id`：对象 id，后续 update/delete 用它最稳。
  - `short_id`：数字短号。
  - `identifier`：数字编号。
  - `whole_identifier`：完整编号，如 `ABC-42`。
  - `title`、`type`、`state`、`assignee`、`project`、`url`、`html_url`。
- **写操作不要直接传编号**：`pc pjm workitem update <WORKITEM_ID> --data ...` 的 help 只承诺 `id`；先 `get` 拿到 `id`，再 update/delete。
- 若编号不存在或不属于当前企业，通常返回 404；不要反复猜编号，让用户确认项目前缀和数字。

## 常用配方

### 1. 在某项目下创建工作项（如“项目 ABC 里建用户故事 XYZ”）

1. 解析项目 id：`pc pjm project list --keywords "ABC"` → 取 `values[].id`（多个则让用户选）。
2. 解析项目内真实类型 id：

   ```bash
   pc pjm workitem-type list-for-project --project-id <pid>
   ```

   从 `values[]` 里按名称找“用户故事/缺陷/任务”等，取 `id` 作为 `type_id`。
3. 创建（最小请求体）：

   ```bash
   pc pjm workitem create --data '{"project_id":"<pid>","type_id":"<type-id>","title":"XYZ"}'
   ```

   - 必填：`project_id`、`type_id`、`title`。
   - 可选：`description`、`assignee_id`、`priority_id`、`state_id`、`parent_id`、`sprint_id`、`release_ids`、`board_id`/`entry_id`/`swimlane_id`、`properties` 等，字段与生效条件看 Doc 页。
   - **不要把 `story`/`bug` 当 `type_id`**；v2 需要项目内实际类型 id。
   - 返回含新工作项 `id`、`url`、`html_url`、`short_id`、`whole_identifier`；汇报时带上 `whole_identifier` 和 `html_url`。

### 2. 查找/搜索工作项

- 简单过滤：

  ```bash
  pc pjm workitem list --project-id <pid> --type-id <type-id> --assignee-id <uid>
  ```

  常用过滤：`--keywords`、`--state-id`、`--priority-id`、`--sprint-id`、`--board-id`、`--tag-id`、`--created-between`、`--updated-between`、`--include-deleted`、`--include-archived`。
- 按数字编号过滤：`pc pjm workitem list --identifier 42`（只接受数字；完整编号用 `get`）。
- 结构化搜索：

  ```bash
  pc pjm workitem search --data '{"mode":"query","payload":{"filter":{"project.id":{"in":["<pid>"]},"title":{"contains":"login"}},"page_size":100,"page_index":0}}'
  ```

  - 外层必须是 `{"mode":"query","payload":{...}}`；过滤条件在 `payload.filter`，分页在 `payload` 里，**不要**用 CLI 的 `--page-index/--page-size` 给 search 翻页。
  - 支持的过滤形式：
    - 引用/引用数组：`project.id`、`assignee.id`、`tags.id`，操作符 `exists`、`in`、`nin`。
    - 文本：`title`、`description`，操作符 `exists`、`contains`。
    - 数字：`exists`、`eq`、`ne`、`gt`、`lt`、`gte`、`lte`。
    - 日期：`exists`、`gt`、`lt`、`gte`、`lte`、`between`（用 `between` 表示区间，不要对同一字段叠加两个操作符）。
    - 选项/自定义属性：`properties.<key>`，按字段类型使用对应操作符。
  - 不支持 `$and`/`$or`/`$in`；每个字段只放一个操作符。
  - `id`、`short_id`、`whole_identifier` **不是**可过滤字段；已知编号就用 `get`，模糊匹配用 `payload.keywords`。
  - 默认不含已删除/已归档项；需要时在 `payload` 里用对应开关，不要臆造 `is_deleted`/`is_archived` 过滤条件。

### 3. 修改工作项状态

1. 先读工作项，拿到 `id`、`project.id`、`type.id`、当前 `state.id`：

   ```bash
   pc pjm workitem get ABC-42
   ```

2. 查该项目 + 类型下可用状态：

   ```bash
   pc pjm workitem-state list-for-project --project-id <pid> --workitem-type-id <type-id>
   ```

3. 查适用的状态方案与允许流转：

   ```bash
   pc pjm workitem-state-plan list --for-project-id <pid>
   pc pjm workitem-state-plan list-states <plan-id>
   pc pjm workitem-state-plan list-flows <plan-id> --from-state-id <current-state-id>
   ```

4. 从状态条目取 `state.id`，或从流转取 `to_state.id`，作为 `state_id` 更新：

   ```bash
   pc pjm workitem update <workitem-id> --data '{"state_id":"<target-state-id>"}'
   ```

5. 再 `get` 一次确认状态已变。状态可用不代表流转允许；流转不允许时报告约束，不要硬改状态定义。

### 4. 名称 → ID 的一般套路

- 项目：`pc pjm project list --keywords <名>`。
- 工作项类型：`pc pjm workitem-type list-for-project --project-id <pid>`。
- 工作项状态：`pc pjm workitem-state list-for-project --project-id <pid> --workitem-type-id <type-id>`。
- 工作项优先级：`pc pjm workitem-priority list-for-project --project-id <pid>`。
- 用户：`pc organization user list --keywords <姓名或邮箱>`。
- 产品：`pc ship product list`；测试库：`pc testhub library list`；空间：`pc wiki space list`。
- 匹配到 0 或 >1 时，列候选让用户确认，不要猜。

### 5. 其他资源

- ideas（需求）、tickets（工单）、testcases（用例）等的创建链路与工作项同构：先解析父级 id（产品/测试库），再 `create --data`，字段看各自 `--help` 的 Doc。
- 创建测试库：

  ```bash
  pc testhub library create --data '{"name":"X","identifier":"ABC","description":"..."}'
  ```

  - `identifier` 必填，企业内唯一，只允许大写英文字母/数字/下划线/连接线，长度不超过 15。
  - 可选 `scope_type`（`organization`/`user_group`）、`scope_id`、`visibility`（`public`/`private`）、`members` 等，看 Doc。

## HTTP 错误对照（非 2xx 时 CLI 打印 status + body）

v2 错误体通常是：

```json
{"code":"100038","message":"请求频率过高"}
```

`code` 可能是字符串；汇报时保留 HTTP status 和业务 `code`，不要自行改写成泛化结论。

- 排查接口问题用 `-v`/`--verbose`：每个 HTTP 请求/响应（UTC 时间戳、方法/状态码、完整 URL、Headers、Body、耗时）打到 stderr，结果 JSON 仍在 stdout 不受影响；敏感信息（Authorization、client_secret、access_token）自动脱敏。
- `401`：令牌无效/过期，或未登录。让用户重新 `pc login`，不要反复重试。
- `403`：权限/scope 不足。body 通常提示所需 scope（如 `pcp:read:pjm:workitem`、`pcp:write:pjm:workitem`）；也可能是用户不是项目/产品/测试库成员。指出具体缺什么，不要自动要求管理员权限。
- `404`：路径或 id/编号不存在。多半是 id 拿错、编号前缀不对、或对象已删除/归档（需要 `--include-deleted` / `--include-archived`）；重新解析。
- `400`/`422`：请求体字段缺失或非法。常见：`type_id` 用了标签而不是真实 id、测试库缺 `identifier`、日期传了毫秒、PATCH 字段类型不对。按 body 提示和 Doc 页修正。
- `429`：触发限流。按响应头等待后重试；CLI 对安全读请求默认 `--retries 3`、`--max-retry-wait 60`，不要在同一请求上再叠加一层 Agent 退避。
  - 公有云响应头：`X-RateLimit-Team-Limit`、`X-RateLimit-Team-Remaining`、`X-RateLimit-Team-Reset`、`X-RateLimit-Burst-Limit`、`X-RateLimit-Burst-Remaining`、`X-RateLimit-Burst-Reset`。
  - 429 额外返回：`X-RateLimit-Retry-After`（建议等待秒数）、`X-RateLimit-Reason`（`pingcode-team` 或 `pingcode-burst`）。
  - 私有部署 429 只返回 `X-PC-Retry-After`。
  - 公有云配额：免费版 200 RPM；付费版 `500 + 用户数 × 20` RPM；单接口默认 30 RPS。批量操作优先，缓存不常变的数据。
- `5xx`：服务端错误。读操作可有限重试；写操作先确认是否已成功，避免重复创建。
- 网络/连接错误：检查 `pc config get base-url`、私有部署地址是否带 `/open`、网络是否可达。
