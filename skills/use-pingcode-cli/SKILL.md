---
name: use-pingcode-cli
description: 通过已安装的 `pc`（PingCode Open API v2.0 命令行客户端）完成用户的自然语言任务——查项目、按编号获取工作项、创建工作项/需求/工单/用例、改状态、加成员、发评论、查报表等。当用户用中文描述想在 PingCode 里做某件事（如"看一下 ABC-42 这个工作项"、"在项目 ABC 里创建一个标题为 XYZ 的用户故事"、"查一下我负责的缺陷"、"给这个工作项加条评论"）时使用。本 skill 自包含、可在任意仓库/目录下运行，调用的是 PATH 上已安装的 `pc`，不依赖 CLI 源码。
---

# Use PingCode CLI (`pc`, REST API v2.0)

把用户的自然语言目标翻译成对已安装 `pc` 命令的调用，并验证结果。
**本 skill 可在任意目录运行**：直接调用 PATH 上的 `pc`，不要假设 CLI 源码在本地、不要用 `cargo run`。

当前 CLI 的业务命令全部调用 **PingCode REST API v2.0**，默认地址是 `https://open.pingcode.com`，路径形如 `/v2/pjm/workitems`。不要沿用 v1 的 `api.pingcode.com`、`PC_*` 环境变量或 `.env` 配置方式。

详细凭据、v2 数据结构、编号解析、搜索语法与错误对照见 [`reference.md`](reference.md)，动手前读一遍。

## 步骤

1. **预检 CLI 与鉴权。**
   - `command -v pc` 确认已安装；没有就按 `reference.md` 的安装方式提示用户（Homebrew / Release 二进制 / cargo install），不要继续。
   - 跑 `pc doctor` 验证配置与连通。它在 stdout 输出结构化 JSON：`ok` 为是否全部通过，`checks[]` 每项有稳定 `id`、`status`（pass/fail/warn/info/skipped），失败项的 `remediation.steps` 是可直接照做的修复步骤；退出码 0=通过、1=有检查失败、2=命令自身异常。
   - 退出码非 0 时，读 `checks[]` 里 `status=fail` 的项（如 `credentials_present`/`credential_pair` 缺凭据、`base_url_format`/`base_url_reachable` 地址或网络问题、`token_exchange`/`api_auth` 凭据无效），把对应 `remediation.steps` 转述给用户并停下让其处理；鉴权类问题不要反复重试。
   - 未登录时让用户自己执行 `pc login`（自动化场景用 `pc login --with-token` 从 stdin 读令牌）；企业凭据用 `pc login --method client-credentials --client-id ... --client-secret ...`。**不要让用户在聊天里粘贴密钥。**
   - 私有部署先 `pc config set base-url <URL>`；`pc config get base-url` 可查看当前生效地址。
   - 完成标准：`pc doctor` 退出码 0（`ok: true`），且 `config.base_url` 指向预期环境。

2. **理解意图并发现命令（不臆造参数）。**
   - 把目标映射到 module/resource/operation（模块见 `reference.md`）。
   - 逐级看帮助确定真实子命令与参数：`pc <module> --help` → `pc <module> <resource> --help` → `pc <module> <resource> <operation> --help`。以 help 里列出的 flags 和 `Doc:` 链接为准；`Doc:` 现在指向 v2 文档 `https://developer.pingcode.com/restapi/pingcode/...`。
   - 需要更完整的 CLI 语义时，可读 CLI 自带参考：`pc skills read pjm`、`pc skills read query`、`pc skills read fields`、`pc skills read authentication`、`pc skills read rate-limits`。
   - **密钥护栏**：help 输出可能回显凭据默认值。读取帮助时忽略 auth/token/secret 相关行，绝不在回复里复述任何密钥。
   - 完成标准：已确定要执行的确切命令行。

3. **把"名字/编号"解析成 ID。**
   - **已知工作项编号时，直接用 `get`，不要先 list。** v2 的 `GET /v2/pjm/workitems/{workitem_id}` 支持 `id`、`short_id`、`whole_identifier` 三种写法：
     - 完整编号：`pc pjm workitem get ABC-42`
     - 纯数字短号：`pc pjm workitem get 42`
     - 对象 id：`pc pjm workitem get 5e05d8448f8461dada9ba29c`
     优先用完整编号（项目前缀 + 数字），歧义最小。返回结果里同时有 `id`、`short_id`、`identifier`（数字）、`whole_identifier`（如 `ABC-42`）。
   - 项目名：`pc pjm project list --keywords "<名字>"`，取 `values[].id`。类型名：`pc pjm workitem-type list-for-project --project-id <pid>`，取真实 `type_id`。人名：`pc organization user list --keywords "<名字>"`。
   - 列表响应是分页结构 `{page_index, page_size, total, values[]}`；`page_index` 从 0 开始，每页默认 30、最大 100，必要时翻页或加大 `--page-size`。
   - 名字匹配到 0 个或多个时，列出候选项让用户确认，不要猜。
   - 完成标准：命令所需的每个 id 都有明确来源。

4. **执行。**
   - 读操作直接运行。写/删操作**也直接运行**——除非用户在本次调用里明确要求先预览（才加 `--dry-run`）。
   - 写操作用 `--data` 传 JSON：内联字符串、`@文件路径`、或 `@-`（stdin）。在其它仓库需要文件体时，写到临时目录再用 `@/tmp/xxx.json`。v2 请求体字段以该操作 `--help` 里的 `Doc:` 页面为准。
   - **创建/更新工作项时 `type_id` 必须是项目里真实的类型 id**，不能把 `story`/`bug` 这类标签当作 `type_id`；先 `workitem-type list-for-project`。
   - PATCH 只发送本次要改的字段；省略、`null`、空字符串和空数组含义不同，不要整对象回写。
   - 所有业务结果都是 stdout 上的 pretty-print JSON；`--dry-run` 的请求预览在 stderr。
   - 完成标准：命令返回（成功或报错）。

5. **验证输出。** 解析 JSON，确认拿到了预期：新建对象的 `id`/`url`/`html_url`、按编号查询到的 `identifier`/`whole_identifier`、更新后的字段值等。修改状态或属性后重新 `get` 一次对比。结果不符预期就当作问题处理，不要报喜。

6. **报错就给可操作的修正。** 非 2xx 时 CLI 会打印 HTTP status 与 v2 错误体 `{"code":"...","message":"..."}`。按 `reference.md` 的错误对照表归类（鉴权/权限 scope、id 或编号非法、请求体缺字段、分页/参数、限流），指出**具体**怎么改（缺哪个字段、该用哪个 id/编号、需要哪个 scope），修正后重试。鉴权类错误不要反复重试，交回用户。

7. **汇报。** 用中文简要给出结果：按编号查到了哪个工作项（标题/状态/负责人）、创建了什么（带 `id`/`url`）、改了什么、或报错与修正建议。不复述密钥。

**不要把运行时学到的内容写回本 skill 目录下的任何文件**（`SKILL.md` / `reference.md` 等）：skill 目录随版本分发与更新，回写内容会在更新时被覆盖，也会污染受版本管理的安装目录。
