# 参考：使用 `pc`（PingCode Open API CLI）

配合 SKILL.md 使用。本文件自包含，**在任意仓库/目录都适用**——调用的是已安装的 `pc`。
本文件随 skill 版本分发，**只读**：不要在运行时回写或追加内容（更新 skill 会覆盖）。

## 安装与调用

- 已安装时直接用 `pc ...`。确认：`command -v pc`、`pc --version`。
- 未安装时提示用户（不要假设源码在本地）：
  - Homebrew：`brew tap shaunxu/tap && brew install pc`
  - 或 GitHub Release 的一键脚本 / 直接下载二进制（见项目 README「安装」）。
  - 有 Rust 工具链也可 `cargo install`。

## 鉴权与环境变量

三选一，`pc doctor` 用来验证是否配置成功：

| 方式 | 变量 / 参数 | 说明 |
|---|---|---|
| 直接令牌 | `PC_TOKEN` 或 `--token` | 用户令牌；可访问 `/v1/myself` 等用户级接口 |
| 客户端凭据 | `PC_CLIENT_ID` + `PC_CLIENT_SECRET`（或 `--client-id/--client-secret`） | 成对出现，缺一报错；自动换取企业令牌 |
| 地址 | `PC_OPEN_API_BASE_URL` 或 `--base-url` | 默认 `https://api.pingcode.com`；私有/alpha 环境按需覆盖 |

- **`.env` 只从当前工作目录加载**：在别的仓库运行时读不到 CLI 源码目录的 `.env`。跨仓库使用建议把凭据写进 shell profile，或在当前目录放 `.env`，或显式传 `--token/--client-id/--client-secret`。
- 全局参数（`--token`、`--dry-run`、`-v` 等）可放在子命令前或后。
- **密钥护栏**：`pc ... --help` 会把环境变量里的 client-id/secret/token 当作默认值打印出来。读取帮助后忽略这些行，回复中绝不复述。

## 模块地图（`pc <module> ...`）

- `organization` 企业/组织：企业信息、成员(users)、部门(departments)、团队(user_groups)及成员、角色(roles)、职位(jobs)。
- `pjm` 项目管理：projects、workitems（工作项）、sprints（迭代）、releases（发布）、boards（看板）、project members、各类配置（类型/状态/属性/优先级/标签）。
- `ship` 产品/反馈：products、ideas（需求）、tickets（工单）、customers、members、tags 及配置。
- `testhub` 测试管理：libraries（测试库）、testcases（用例）、testplans（计划）、testruns（执行）及配置。
- `wiki` 知识管理：spaces（空间）、pages（页面）、space members。
- 顶层通用资源：`comments`、`attachments`、`participants`（关注人）、`relations`、`reviews`、`activities`、`workload`（工时）、`entity-properties`、`permission`、`expression`、`security`（日志）。
- `doctor`：配置与连通性自检。stdout 输出结构化 JSON 报告（`ok`、`summary`、`config.credential_sources`、`identity.team/user`、`checks[]`），每项检查有稳定 `id` 与 `status`（pass/fail/warn/info/skipped），失败项带 `remediation.steps` 修复步骤；stderr 是人类可读勾叉清单。退出码：0=全部通过，1=有检查失败（读 `checks[].remediation` 修复），2=命令自身异常。`--dry-run` 只跑静态检查。常用检查 id：`credentials_present`（缺凭据）、`credential_pair`（id/secret 不成对）、`credential_conflict`（token 与 client 凭据同设，warn）、`base_url_format`、`base_url_reachable`（网络/地址不通）、`token_exchange`（client 凭据被拒）、`api_auth`（token 无效/越权）、`token_kind`（用户/企业令牌，info）。

发现具体命令一律用 `pc <module> --help` 逐级下钻，不要凭记忆拼参数。

## 输出与分页

- 所有命令把结果 pretty-print JSON 到 stdout；没有人类文本模式，也没有 `--json` 开关。
- 列表是分页结构：`{ page_index, page_size, total, values: [ ... ] }`。
  - `page_index` 从 **0** 开始；用 `--page-index`/`--page-size` 翻页或放大页大小。
  - 取"按名字找 id"时从 `values[]` 里读 `id`（常还有 `name`/`title`/`identifier`）。
- 写操作用 `--data <JSON>`：内联 JSON、`@file.json`、或 `@-`（stdin）。请求体必须是 JSON object。字段以该操作 `--help` 里的 `Doc:` 链接页面为准。

## 常用配方

### 在某项目下创建工作项（如"项目 ABC 里建用户故事 XYZ"）
1. 解析项目 id：`pc pjm project list --keywords "ABC"` → 取 `values[].id`（多个则让用户选）。
2. 工作项类型：创建体必填 `type_id`。可用系统类型枚举（用户故事 `story`、缺陷 `bug`、
   任务 `task`、史诗 `epic` 等），或用 `pc pjm workitem-type list-for-project --project-id <pid>`
   查具体 `type_id`（9 种系统类型：史诗/特性/用户故事/阶段/里程碑/需求/任务/缺陷/事务）。
3. 创建：`pc pjm workitem create --data '{"project_id":"<pid>","type_id":"story","title":"XYZ"}'`
   （必填 `project_id`/`type_id`/`title`；可选 description、assignee_id、priority_id、sprint_id、
   parent_id 等，以 `pc pjm workitem create --help` 的 Doc 页面为准。返回含新工作项 `id`/`url`。）

### 查找/搜索工作项
- 简单过滤：`pc pjm workitem list --project-id <pid> --type-id story --assignee-id <uid>`。
- 复杂条件：`pc pjm workitem search --data '{ ...查询体... }'`（POST，字段见 Doc）。
- 按短号：`pc pjm workitem list --identifier SCR-1`。

### 名称 → ID 的一般套路
- 项目：`pjm project list --keywords <名>`；产品：`ship product list`；测试库：`testhub library list`；空间：`wiki space list`。
- 用户：`organization user list`（按姓名/邮箱在 `values[]` 里匹配）。
- 匹配到 0 或 >1 时，列候选让用户确认，不要猜。

ideas（需求）、tickets（工单）、testcases（用例）等的创建链路与工作项同构：先解析父级 id（产品/测试库），再 `create --data`，字段看各自 `--help` 的 Doc。

### 创建测试库（testhub library）
- `pc testhub library create --data '{"name":"X","identifier":"ABC","description":"..."}'`
- **`identifier` 必填**（库前缀，大写字母/数字，全企业唯一）；缺失返回 400 `code 100008 'identifier' is a required field`。
- `testhub library list` 不支持 `--page-size`/`--page-index` 参数（固定返回，实测 page_size=30）。

## HTTP 错误对照（非 2xx 时 CLI 打印 status + body）

- 排查接口问题用 `-v`/`--verbose`：每个 HTTP 请求/响应（UTC 时间戳、方法/状态码、完整 URL、Headers、Body、耗时）打到 stderr，结果 JSON 仍在 stdout 不受影响；敏感信息（Authorization、client_secret、access_token）自动脱敏。
- `401` / 鉴权失败：令牌无效/过期，或 client-id/secret 缺失。交回用户更新凭据，不要反复重试。
- `403`：权限/scope 不足。body 通常提示所需 scope（如 `pcp:write:pjm:workitem`）；告知用户该应用/令牌需要对应 scope。
- `404`：路径或 id 不存在。多半是 id 拿错、或名字→id 解析到了错误对象；回第 3 步重新解析。
- `400`/`422`：请求体字段缺失或非法。按 body 提示补/改字段（枚举值、必填项、类型），用 Doc 页核对后重试。
- `429`：限流，退避后重试。
- 网络/连接错误：检查 `--base-url` / 网络可达性。
