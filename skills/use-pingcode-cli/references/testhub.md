# 测试管理

该模块覆盖测试库、套件、用例、计划、执行和配置。已知操作直接查看或复用其帮助；资源不明确时查 `pc testhub --help`。操作子资源前确定所属测试库或计划，请求体、响应结构和 scope 按 [API 文档检索](api-docs.md)核对。

适用范围内的字典值见[字段 ID、状态流转与取值](fields.md)，过滤、搜索和分页见[查询与分页](query.md)。

`pc testhub testcase get` 接受 `id`、`short_id` 或 `whole_identifier`；`pc testhub testplan get` 和 `pc testhub testrun get` 接受 `id` 或 `short_id`。

测试库、执行、历史和配置列表支持 `--page-index` 与 `--page-size`，应根据返回的分页信息收集完整结果。用例所在测试库的可用套件通过 `pc testhub testcase-suite list-for-library --library-id <library-id>` 查询；通用套件管理使用 `list --library-id`、`create`、`get` 和 `delete`。

## 从用例到执行结果记录

1. 解析测试库和已有用例，或通过 `pc testhub testcase create --help` 及对应文档创建用户要求的用例。核对必填字段，并在该测试库范围内解析类型、状态和属性值。更新用例时 `steps` 会整体替换，应保留未修改的步骤。
2. 确定目标测试计划。如果任务包括新建计划，查看 `pc testhub testplan create --help` 及对应文档。用户意图不明确时，不要为了凑齐必填字段而编造排期或负责人。
3. 通过 `pc testhub testrun list --help` 查找该计划和用例的已有执行。将用例加入计划时，查看 `pc testhub testrun create --help`，按文档请求体使用已解析的测试库、计划和用例 ID 创建执行，避免重复。
4. 通过 `pc testhub testrun-status list-for-library --library-id <library-id>` 解析执行结果字典。查看 `pc testhub testrun update --help`，按文档请求体使用返回的状态 ID 记录用户提供的测试结果。用例生命周期状态、计划状态和执行的 `status_id` 不同。创建执行记录不会实际执行测试，也不能证明测试通过。提交步骤结果或选择 `replace` 而非 `update` 前，先核对 Docs 页面。
5. GET 执行记录，验证计划、用例和结果。需要执行历史时查看 `pc testhub testrun histories --help`。用例历史通过 `pc testhub testcase histories <case-id>` 查询，再通过 `pc testhub testcase get-history <case-id> <history-id>` 查看某个历史版本。

失败执行需要关联缺陷时，读取[项目管理](pjm.md)和[共享资源与错误处理](common.md)：解析或创建用户要求的缺陷，再通过 `relations` 将执行关联到工作项。分别验证两个步骤，部分成功时保留已取得的 ID。附件和评论同样参考 `common` 主题。

## 状态配置与能力限制

`pc testhub testcase-state create` / `update` 维护企业级定义；修改某个用例的状态应使用用例更新操作。通过 `pc testhub testcase-state-plan list --for-library-id <library-id>` 查找测试库适用的方案，查看其状态和流转，区分关联 ID 与状态 ID。修改方案前核对所选操作的文档。仅在用户要求时修改共享配置，并在修改后读取验证。

这些状态方案不提供方案创建、方案删除或状态定义删除操作。测试库和测试计划没有删除命令；执行删除使用 `pc testhub testrun bulk-delete --help`。

来源：https://developer.pingcode.com/restapi/pingcode/postV2TesthubTestruns
以及 https://developer.pingcode.com/restapi/pingcode/patchV2TesthubTestrunsByTestrunId
