# 知识库空间与页面

已知操作直接查看或复用其帮助；不确定时查 `pc wiki space --help` 或 `pc wiki page --help`，资源不明确再查 `pc wiki --help`。通过列表或详情解析目标空间和页面，标题不一定唯一。判断页面不存在前检查过滤条件和分页。字段及正文格式按 [API 文档检索](api-docs.md)核对。

分页见[查询与分页](query.md)。页面列表中的 `parent_id` 选择直接子页面，`ancestor_id` 选择所有后代页面，两者互斥。

## 修改页面信息或正文

- `pc wiki page get` 按 `id` 或 `short_id` 读取页面信息；`pc wiki page update` 修改 `name`、`parent_id`、`is_locked` 等字段。
- `pc wiki page get-content` / `update-content` 操作正文。通过 `get-content --help` 查看本机 CLI 的 `--format-type` 取值，再按 `update-content --help` 中的 Docs 链接确认可写格式及对应请求结构。

编辑正文时，应选择读命令支持、写 API 接受且能保留内容的格式。例如读取 Markdown：

```sh
pc wiki page get-content <page-id> --format-type markdown
```

更新会替换正文，应保留本次修改范围之外的内容，通过 `--data @file.json` 或 stdin 传入完整的目标正文。Markdown 请求体示例为 `{"content":"...","format_type":"markdown"}`。用户内容先做 JSON 编码再交给 CLI；转换格式可能丢失相关内容时，先解决该限制再写入。写后以相同格式读取正文验证。

创建带初始正文的页面时，通过 `pc wiki page create --help` 的 Docs 链接核对必填字段和支持格式；结果中存在 `html_url` 时返回给用户。

## 查看或恢复版本

通过 `pc wiki page list-versions --help` 和 `pc wiki page get-version --help` 确定版本，历史正文通过 `get-content --version-id` 读取。仅在用户要求恢复时使用 `pc wiki page restore-version --help`，读取历史不需要先恢复。恢复后验证当前内容。需要读取图片时，可在 markdown/html/block 正文读取中使用 `--include-public-image-token content`。

空间成员操作先通过 `pc wiki --help` 查找对应成员资源，再使用组织命令解析用户。通用评论和附件见[共享资源与错误处理](common.md)。

来源：https://developer.pingcode.com/restapi/pingcode/putV2WikiPagesByPageIdContent
