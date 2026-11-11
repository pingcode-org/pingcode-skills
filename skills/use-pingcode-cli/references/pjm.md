# 项目管理

该模块覆盖项目、工作项、迭代、看板、发布、项目成员及配置字典。已知操作直接查看或复用其帮助；资源不明确时查 `pc pjm --help`。构造 JSON 请求体前按 [API 文档检索](api-docs.md)核对。

## 根据用户描述创建工作项

1. 通过 `pc pjm project list --keywords "<project name>"` 解析项目，查看 `values[]`，处理分页和同名歧义。
2. 查找该项目可用的类型：`pc pjm workitem-type list-for-project --project-id <project-id>`。使用返回的类型 ID 表示用户要求的故事、缺陷或其他类型。
3. 查看 `pc pjm workitem create --help` 及其 `Docs:` 页面。替换为真实 ID 后的最小示例：

   ```sh
   pc pjm workitem create --data '{"project_id":"<project-id>","type_id":"<type-id>","title":"Example"}'
   ```

   创建必须使用实际类型 ID，不能用 `bug` 等标签代替。
4. 读取返回的 ID，并验证创建的工作项。

官方创建文档：
https://developer.pingcode.com/restapi/pingcode/postV2PjmWorkitems

## 查找和更新工作项

通过 `pc pjm workitem get ABC-42` 按完整编号（`whole_identifier`）读取工作项，该参数也接受 `id` 或 `short_id`。已知完整编号时直接 `get`，不要扫描列表。后续写入保留并使用返回的对象 `id`；存在 `whole_identifier` 和 `html_url` 时一并汇报。列表过滤和结构化搜索见[查询与分页](query.md)，负责人通过组织命令解析。

更新前先读取工作项。修改状态或自定义属性时，按[字段 ID、状态流转与取值](fields.md)解析适用的字典和允许的流转。查看 `pc pjm workitem update --help`，只构造本次要求的修改，再 GET 对比字段。企业级状态名称相符，并不足以证明工作项可以进入该状态。

## 安排迭代、发布或看板

1. 获取工作项所属项目及项目模板类型。
2. 查看 `pc pjm sprint list --help`、`pc pjm release list --help` 或 `pc pjm board list --help`，使用支持的项目过滤定位目标。移入看板时还要解析看板栏和可选泳道。
3. 核对工作项更新文档：迭代归属适用于 scrum 和 hybrid 项目，看板归属适用于 kanban 和 hybrid 项目。`release_ids` 是集合，用户要求添加发布时应保留已有发布。确认解析出的父资源 ID 属于目标项目。
4. 更新后重新读取，验证归属。创建迭代、发布或看板是独立操作，仅在用户要求时执行。

## 关联与交付

工作项之间的关联使用 `pc pjm workitem-relation --help`，关联类型通过 `pc pjm workitem-relation-type list` 解析。按接口请求体保留关联方向。父子层级使用工作项的 `parent_id` 和类型约束，不能与通用关联混用。

跨模块关联、评论、附件、关注人和工时见[共享资源与错误处理](common.md)。交付目标定义预期交付内容，`pc pjm deliverable --help` 用于提交或读取实际交付物。提交前解析目标，提交后验证返回的目标关系。项目模板和克隆操作可通过 `pc pjm project-template --help`、`pc pjm project clone --help` 查找。

## 配置范围与能力限制

`pc pjm project-state list`、`pc pjm workitem-state list` 和 `pc pjm release-stage list` 读取企业配置。查询具体项目可用值时，使用其 `list-for-project` 操作，并按帮助传入范围参数；工作项状态还需要类型 ID。这些列表支持 `--page-index` 和 `--page-size`，应遍历所需页面。

项目和迭代没有删除操作，不要承诺创建后的自动回滚。
