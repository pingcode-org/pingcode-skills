# 字段 ID、状态流转与取值

修改状态、自定义属性或日期前读取。不同端点的请求体不同，应按 [API 文档检索](api-docs.md)核对，并读取相关字典。

## 在实际适用范围内解析字段

1. 实际写入前重新读取对象，取得所属项目、产品或测试库，以及类型和当前状态；不从列表摘要或旧缓存推断。
2. 重新核对本次写入依赖的字典，优先使用适用的 `list-for-project`、`list-for-product` 或 `list-for-library`，而非企业级全量列表。全局定义的值不一定能用于当前对象，范围参数以帮助为准。
3. 将用户提供的名称匹配为返回的 ID 或属性 key。名称重复时消除歧义，构造 JSON 前检查字段类型和可选值。

工作项的以下查询同时需要项目和工作项类型：

```sh
pc pjm workitem-state list-for-project --project-id <project-id> --workitem-type-id <type-id>
pc pjm workitem-property list-for-project --project-id <project-id> --workitem-type-id <type-id>
```

读取结果可能包含 `state: {"id": ...}` 这样的引用对象，写入却要求 `state_id`。应按写接口结构构造请求，不要把整个 GET 响应原样回写。字段显示名称不是 JSON key。

## 修改工作项状态

状态可用不代表允许从当前状态流转。查询 `pc pjm workitem-state-plan list --for-project-id <project-id>`，确定适用于当前工作项类型的方案，再查看状态和流转：

```sh
pc pjm workitem-state-plan list-states <plan-id>
pc pjm workitem-state-plan list-flows <plan-id> --from-state-id <current-state-id>
```

方案条目有自己的关联 ID：应从状态条目取 `state.id`，或从允许的流转取 `to_state.id`，不能使用条目或流转顶层的 `id`。将目标值作为 `state_id` 更新工作项，再次读取验证。不要为了修改一个工作项就更改企业状态方案；无法确定适用方案或流转不可用时，说明约束，不要猜测。

其他业务域使用不同的状态资源，例如 TestHub 执行结果使用 `status_id`，与测试用例生命周期状态不同。将工作项流程用于其他资源前，先读取对应模块资料。

需求和测试用例可分别通过 `pc ship idea-state-plan list --for-product-id <product-id>`、`pc testhub testcase-state-plan list --for-library-id <library-id>` 查找适用方案。读取方案的 `list-states` 和 `list-flows`，注意分页。这些流转列表不提供工作项专用的 `--from-state-id` 过滤，应在本地检查返回的 `from_state` 和 `to_state` 引用。创建或更新状态定义、添加或移除方案成员属于共享配置变更，与修改某条需求或用例的状态不同。

## 自定义属性与局部更新语义

- 业务自定义字段在搜索中使用 `properties.<key>`，写入时使用 `properties` 对象。工作项适用的属性方案必须包含该字段，必要时查看 `pc pjm workitem-property-plan --help`。
- 选项、引用、多值和日期字段的值结构不同。先从适用范围内的字典取得 key、选项和类型，再确认写入结构。不要用显示名称代替选项 ID，也不要假定所有多值字段接受相同结构。
- 实体扩展属性是独立能力：`pc entity-properties --help` 使用 `entity_type` 和 `entity_id` 定位对象，涉及 `property_key`、JSON `value` 和 `overwrite`。它不会更新业务自定义字段。写入前核对文档中的值大小、嵌套和覆盖规则。
- PATCH 只发送本次需要修改的字段。省略、`null`、空字符串和空数组不可互换，应核对各字段的清空语义；摘要未展示不代表应清空。数组可能整体替换，例如用例的 `steps`；写前须读取完整当前值，保留本次修改之外的条目，无法取得时不执行依赖旧值的替换。

## 日期与富文本

工作项的 `start`/`due` 使用 DateValue 对象，例如 `{"date":1730000000,"with_time":1}`；`with_time: 0` 表示仅日期、不含时刻。时间戳单位是秒，不是 JavaScript 毫秒。`created_at` 等字段则使用标量时间戳，应逐个检查结构，不要把所有日期都包装成对象。同时确认用户时区和需要的日期精度。

富文本字段与知识库正文格式不同，页面内容见[知识库空间与页面](wiki.md)。接口支持时，`--include-public-image-token` 可为指定富文本字段请求图片访问信息；仅在需要图片时使用，不能替代正文获取。

来源：https://developer.pingcode.com/restapi/pingcode/patchV2PjmWorkitemsByWorkitemId
以及 https://developer.pingcode.com/restapi/pingcode/postV2EntityProperties
