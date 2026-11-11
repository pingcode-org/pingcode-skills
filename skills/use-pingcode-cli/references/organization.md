# 组织数据

该模块覆盖企业信息、用户、部门、团队、角色和职位。已知操作直接查看或复用其帮助；资源不明确时查 `pc organization --help`。按 `pc organization user list --help` 支持的条件定位人员，遍历相关页面；有多个匹配时向用户确认。成员和角色结构按 [API 文档检索](api-docs.md)核对。

完整人员查询见[查询与分页](query.md)。CLI 资源名称如下：

| 用户意图 | CLI 资源 |
| --- | --- |
| 企业信息 | `pc organization team`，表示企业这一单一对象，不是协作团队 |
| 协作团队或用户组 | `pc organization group` 和 `pc organization group-member` |
| 部门 | `pc organization department` |
| 企业用户、角色或职位 | `pc organization user`、`pc organization role`、`pc organization job` |

## 修改成员关系或角色

1. 解析已有用户，以及目标团队、部门、项目、产品或空间。
2. 读取目标的成员列表和操作帮助。项目、产品、测试库、空间的成员关系属于各业务模块，不能与组织团队混用。区分用户 ID 和返回的成员关系 ID。
3. 按该操作的结构解析允许使用的角色。企业角色与资源内角色的 ID 和值格式不一定相同。
4. 执行授权变更，再次读取成员关系验证。个人令牌的 scope 不会授予其所有者管理员角色；操作被拒绝时按[鉴权与配置](authentication.md)排查，不要默认通过提升用户角色解决。

创建用户可能发送真实邀请。仅在用户要求创建时执行，不能用它来查找已有人员。成员变更应限定在用户要求的团队、部门或项目内，执行后验证结果。

CLI 登录身份和可选身份 scope 警告见[鉴权与配置](authentication.md)。

当前版本没有组织团队删除或团队成员更新命令。未经确认这是用户要求的变更，不要通过移除再添加来模拟成员更新。
