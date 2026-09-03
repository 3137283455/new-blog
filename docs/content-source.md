# 内容源协议

本项目的书库和漫画页只提供阅读框架，作品数据由导入的内容源提供。内容源保存在 SQLite 的 `content_search_sources` 设置中，源站请求由后端发起，源文件中的请求头不会暴露给浏览器。

## 使用流程

1. 登录 `/admin`，打开「内容检索源」。
2. 导入一个 `boke-content-search-source` JSON 文件。
3. 在 `/books` 或 `/manga` 的「从源中搜索」区域搜索作品。
4. 打开源详情。配置了 `chapters` 和 `reader` 的源会在本站列出目录并阅读；只有搜索/详情接口的旧源会跳转到 `source_url`。

## 最小结构

```json
{
  "schema": "boke-content-search-source",
  "version": 1,
  "source": {
    "id": "my-source",
    "label": "我的内容源",
    "enabled": true,
    "kinds": ["book", "manga"],
    "api_base": "https://api.example.com",
    "page_base": "https://www.example.com",
    "page_path": "/work/{id}",
    "search": {
      "method": "GET",
      "path": "/search?q={query}&type={type}&limit={limit}",
      "result_path": "data.items",
      "body_type": "json"
    },
    "detail": {
      "method": "GET",
      "path": "/works/{id}",
      "result_path": "data",
      "body_type": "json"
    },
    "mapping": {
      "id": "id",
      "title": ["title", "name"],
      "original_title": "original_title",
      "author": "author",
      "cover": "cover",
      "description": "description",
      "rating": "rating",
      "publication": "date",
      "type": "type",
      "total": "chapter_count"
    }
  }
}
```

## 站内阅读接口

在 `detail` 后增加 `chapters` 和 `reader`，就能让作品在本站完成目录和阅读：

```json
{
  "chapters": {
    "method": "GET",
    "path": "/works/{id}/chapters",
    "result_path": "data",
    "body_type": "json"
  },
  "reader": {
    "method": "GET",
    "path": "/chapters/{chapter_id}",
    "result_path": "data",
    "body_type": "json"
  },
  "chapter_mapping": {
    "id": "id",
    "title": "title",
    "volume": "volume",
    "number": "number",
    "url": "url"
  },
  "reader_mapping": {
    "title": "title",
    "content_html": "content_html",
    "pages": "pages",
    "page_url": "url"
  },
  "read_mode": "auto"
}
```

小说源通常映射 `content_html`；漫画源通常映射 `pages` 数组。`pages` 可以是 URL 字符串数组，也可以是对象数组，此时使用 `page_url` 读取对象中的图片字段。支持的变量有 `{query}`、`{id}`、`{chapter_id}`、`{type}` 和 `{limit}`。

源配置最多保留 24 个源，每个源最多 12 个自定义请求头；搜索、详情、目录和阅读请求默认超时 10 秒，允许范围为 1～30 秒。
