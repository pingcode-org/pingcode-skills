# Nexus 平台与 Exposer

Nexus 有两类调用入口，鉴权规则不同。凭据通过常规 `pc login --token` / `--with-token` 流程保存，选择命令前先确定令牌用途。

| 凭据 | 典型用途 |
| --- | --- |
| PAT / 用户 OAuth | PingCode 业务 API |
| 企业 client-credentials | 以企业应用身份调用 PingCode 业务 API |
| 含 `installation_id` 的 Nexus 应用令牌 | 固定 Nexus 平台 API（`pc nexus kvs\|ces\|nos\|webhook\|queue\|realtime`） |
| 目标 Exposer 授权器接受的令牌 | 仅用于 `pc nexus api request`，见下文 |

## 选择调用入口

固定平台操作应先确定目标应用安装，再调用 `pc nexus kvs|ces|nos|webhook|queue|realtime`。普通业务 API 登录成功不代表有权访问该安装。按 [API 文档检索](api-docs.md)核对操作当前要求的令牌类别、安装上下文、scope 和请求字段。

Exposer（`pc nexus api request`）调用应用自定义路由。先解析应用、环境和路由，再按应用文档约定确认鉴权和请求体。官方平台索引无法枚举所有自定义路由；不要假定 Exposer 与固定平台操作使用相同令牌要求，也不要因 CLI 接受路由字符串就认定该路由存在。

鉴权失败时使用 `pc doctor` / `pc whoami`，并参考[鉴权与配置](authentication.md)。保留实际 HTTP 状态和业务码，查阅相关生产文档，不要用本地固定错误码表解释所有失败。

```sh
pc nexus api request --app-id <app> --env-id <env> --method GET --route /hello
```

语义未知的 Exposer 写方法不会因 429 自动重试；GET 可以使用 CLI 的安全读重试，详见[限流与重试](rate-limits.md)。

## 平台操作与结果验证

| 分组 | 命令 | 验证方式 |
| --- | --- | --- |
| KVS | `set` / `get` / `delete` | `get` 返回目标值；`delete` 后再次 `get`，应按应用规则失败或返回空 |
| CES | `insert` / `update` / `find` / `count` / `delete` | `find`/`count` 反映写入结果，删除后再次查询确认 |
| NOS | `create-upload-url` / `create-download-url` / `get-metadata` / `delete` | 签名 URL 响应不代表已传输文件；需要在 `pc` 之外使用 URL 上传或下载字节，再通过元数据或删除结果确认对象状态 |
| Webhook | `get-url` / `query-urls` / `delete-url` | `get-url` 可能创建 URL，按写操作处理；`query-urls` 查询列表，删除后再次查询 |
| Queue | `push` | 返回 `job_id` 仅表示入队，不代表消费完成 |
| Realtime | `publish` / `sign-token` | 发布返回 `message_id`，签名返回令牌及过期时间 |

请求体字段按 [API 文档检索](api-docs.md)确认。Nexus 真实环境验证需要专用测试应用和安装上下文，本地 HTTP 模拟不能替代。
