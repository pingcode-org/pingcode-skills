# 共享资源与错误处理

这些资源位于 CLI 顶层。通过帮助查找操作和 Docs 链接，再按 [API 文档检索](api-docs.md)核对。不要自行拼出嵌套在父模块下的路由。

| 资源 | 入口 |
| --- | --- |
| 评论与附件 | `pc comments --help`、`pc attachments --help` |
| 跨资源关联与关注人 | `pc relations --help`、`pc participants --help` |
| 工时与工时类型 | `pc workload --help`、`pc workload-type --help` |
| 类别与分组 | `pc categories --help`、`pc sections --help` |
| 评审 | `pc reviews --help` |
| 活动记录与实体扩展属性 | `pc activities --help`、`pc entity-properties --help` |
| 权限、表达式与安全日志 | `pc permission --help`、`pc expression --help`、`pc security --help` |

## 确定对象及其范围

从资源 GET 响应取得对象实际 ID。以下字段含义不同，应查看所选操作的帮助，不能共用一套参数：

| 资源 | 需要确认的范围 |
| --- | --- |
| 评论、附件、关注人、活动记录 | `principal_type` + `principal_id`，允许的类型随资源和操作而变化 |
| 跨资源关联的列表与创建 | 主体类型、主体 ID 和目标类型；创建还需要目标 ID |
| 关联的读取与删除 | 关联 ID，不需要主体参数 |
| 评审 | `principal_type` + `pilot_id`（项目、产品或测试库）；详情操作还需要评审 ID |
| 实体扩展属性 | `entity_type` + `entity_id`，见[字段 ID、状态流转与取值](fields.md) |
| 类别与分组 | `entity_type`；`pilot_id` 是否必填取决于操作 |

不要根据其他资源的枚举或界面名称推断合法类型。例如 `workitem` 是 API 类型，工作项标题或 `bug` 不能代替它。

## 关联两个资源

工作项之间的关联使用 `pc pjm workitem-relation --help` 及其关联类型字典；跨模块关联使用 `pc relations --help`。按操作的 Docs 页面核对支持的主体、目标组合及方向，两个类型都出现在枚举中不代表任意组合都允许。

页面关联还需确认创建操作是否允许页面处于目标角色；页面出现在读取结果中，不能证明创建时支持相同方向。

解析两侧对象后，先检查已有关系，再创建关联。例如，受支持的执行到缺陷关联请求体为：

```sh
pc relations create --data '{"principal_type":"testrun","principal_id":"<run-id>","target_type":"workitem","target_id":"<workitem-id>"}'
```

验证返回关系中的主体和目标 ID。关联授权涉及两侧，能读取其中一个对象不代表有权创建关联。如果目标对象创建成功而关联失败，汇报目标 ID 和失败步骤，不要重跑整个流程。

来源：https://developer.pingcode.com/restapi/pingcode/postV2Relations

## 评论、文件与工时

评论先解析主体，查看 `pc comments create --help` 及 Docs 页面，再提交用户要求的内容并验证返回评论。评论没有更新命令，除非用户明确要求替换，否则不要通过删除再发布模拟编辑。

文件上传查看 `pc attachments upload-file --help` 及文件参数。JSON 代码段上传是另一个操作，不能把它当作文件字节的替代编码。验证附件元数据及其主体，不打印二进制内容。

记录工时时，先解析目标、用户，并按需通过 `pc workload-type list --help` 查询工时类型；再查看 `pc workload create --help` 及 Docs 页面，确认单位和必填字段。不要将工时记录与工作项的预估或剩余工时属性混淆。

## 部分成功与服务端约束

批量结果即使 HTTP 成功，也要检查每项的 `state`。退出码 2 与 stdout 中的成功项可以同时存在；重试部分成功的整个批次可能重复创建，必须先确认每项结果。结果不确定的写操作和语义未知的 Exposer 路由不会因 429 自动重放，手动重试前先读取确认，详见[限流与重试](rate-limits.md)。

异步副作用，例如 Nexus `queue push`、Webhook 投递和后台任务，需要各自的完成检查；入队成功不等于已被消费，详见 [Nexus 平台与 Exposer](nexus.md)。

某些服务端操作存在租户特有的前置条件。评审等操作因未公开条件而被拒绝时，汇报实际错误和所需配置，不要编造请求字段绕过约束。

不同资源的删除语义不同，应验证文档约定的结果状态或确认对象已从相关列表消失，不能一律要求详情接口返回 404。破坏性操作只作用于用户授权的资源范围。
