# 产品、需求与工单

该模块覆盖产品、需求、工单、客户、成员、标签及配置资源。已知操作直接查看或复用其帮助；资源不明确时查 `pc ship --help`。请求体和 scope 按 [API 文档检索](api-docs.md)核对。

上下文未明确业务域时，先确认用户指的是产品需求、工单还是项目工作项。产品、产品成员、外部产品用户和客户是不同资源，应解析所选操作真正需要的 ID，不要直接复用组织用户 ID。

## 创建或更新需求、工单

1. 查看 `pc ship product list --help`，通过对应列表调用解析产品。已有对象使用 `pc ship idea get` 或 `pc ship ticket get` 读取，并确认所属产品；两者都接受 `id`、`short_id` 或 `whole_identifier`。筛选、结构化搜索和分页见[查询与分页](query.md)。
2. 查看资源帮助，例如 `pc ship idea create --help` 或 `pc ship ticket update --help`，并按 Docs 页面核对 JSON 请求体。
3. 解析任务需要的产品内状态、优先级、类型、渠道和属性值。参考[字段 ID、状态流转与取值](fields.md)，不同字典的范围和参数可能不同。流转规则可通过 `pc ship idea-state-plan --help` 或 `pc ship ticket-state-plan --help` 查看；产品可用需求标签通过 `pc ship idea-tag list-for-product --product-id <product-id>` 查询。
4. 只提交用户要求的字段，再次读取验证。修改某个业务对象的状态不代表允许修改共享状态配置。

## 将产品诉求转为项目工作

1. 读取来源需求或工单，确定目标项目。通过 `pc relations list --help` 检查已有关联，避免重复创建。
2. 读取[项目管理](pjm.md)，解析目标项目内的工作项类型，并携带相关来源信息创建用户要求的工作项。
3. 读取[共享资源与错误处理](common.md)，使用来源对象的实际 ID 和新工作项 ID 建立受支持的跨资源关联。创建工作项本身不会建立关联，也不会改变来源对象状态。
4. 分别验证工作项和关联。如果创建成功但关联失败，保留并汇报已创建的 ID；检查结果后只重试失败步骤。不要再建一个工作项，也不要把删除第一个工作项当成默认回滚。

## 状态配置与能力限制

`pc ship idea-state create` / `update` 维护企业级状态定义，仅在用户要求配置变更时使用。创建定义并不会让所有产品自动可用。通过 `pc ship idea-state-plan list --for-product-id <product-id>` 查找适用方案，再根据方案 ID 查看 `list-states` 和 `list-flows`。修改方案成员或流转时，核对所选操作的请求体，并区分状态 ID 与关联 ID；配置变更后重新读取验证。API 不提供方案创建、方案删除或状态定义删除。

产品、需求、工单和客户没有删除命令，不要假定增删改查总是对称，也不要承诺自动清理创建的对象。

评论和附件见[共享资源与错误处理](common.md)。
