# 沙盒网后端 API 接口协议

版本: v1.1
更新时间: 2025-09-19
基础路径: `/api`

> 目前更新完了 1 2 部分

## 目录

1. 通用约定  
2. 认证接口  
3. 用户接口  
4. 文章接口  
5. 图库接口  
6. 活动接口  
7. 论坛接口  
8. 搜索接口  
9. 服务器接口  

---

## 1. 通用约定

### 1.1 认证

```text
Authorization: Bearer <JWT_TOKEN>
```
访问 Token 建议 2h 过期，刷新 Token（若实现）7d。

### 1.2 时间、格式与返回结构

时间：ISO8601 UTC. 请求 application/json, 文件上传 multipart/form-data。

返回结构：

```json
{ "code": "CODE_UPPER_CASE", "message": "msg", "data": {}, "traceId": "uuid"}
```

可能出现的错误代码会在下文中列出。下文中“响应”是 `data` 字段中的内容。

特别地，当请求成功时，返回的 `code` 字段应为 `"SUCCESS"`. 下文中将不再提及。

通用地，当错误不出现在用户，即服务端错误时，返回的 `code` 字段应为 `INTERNAL_SERVER_ERROR`. 下文中将不再提及。

通用地，当用户未登录时，返回的 `code` 字段应为 `UNAUTHORIZED`. 此时应跳转登录页面。下文中将不再提及。

通用地，当用户提交的请求格式有问题导致服务器无法处理时，返回的 `code` 字段应为 `BAD_REQUEST`. 下文中将不再提及。

### 1.3 分页

Query: `page` `limit` `sort` `sortOrder`。统一响应：

```json
{ "pagination": { "page": 1, "limit": 10, "total": 0 } }
```

### 1.4 字段统一

`className` 代替 `class`；`minecraftId` 统一；布尔前缀 is。

---

## 2. 认证接口

### 2.1 用户注册

POST `/auth/register`

请求：

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "grade": "string",
  "className": "string",
  "minecraftId": "string"
}
```

响应：

```json
{ "token": "jwt", "user": { "id": 1, "username": "alice", "minecraftId": "mcAlice" } }
```

可能的错误：

- `BAD_REQUEST`
- `USERNAME_ALREADY_EXISTS`
- `EMAIL_ALREADY_USED`

### 2.2 用户登录

POST `/auth/login` 请求：`{ "email": "string", "password": "string" }`  响应同上。

可能的错误：

- `INVALID_CREDENTIALS`
- `USER_BANNED`

### 2.3 当前用户

GET `/auth/me` -> 返回完整的，用户应可见的用户信息。

完整的，用户应可见的用户信息：

- `id`
- `username`
- `email`
- `grade`
- `className`
- `minecraftId`
- `isVerified`
- `createdAt`
- `lastLoginAt`
- `bio`

可能的错误：

- `USER_BANNED`

---

## 3. 用户接口

### 3.1 用户列表（管理员）

GET `/users`

```json
{
  "data": [ { "id": "u1", "username": "alice", "email": "a@example.com", "role": "member", "grade": "高一", "className": "1班", "minecraftId": "mcAlice", "isVerified": false, "createdAt": "2025-09-14T08:15:30Z" } ],
  "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

### 3.2 获取用户

GET `/users/{id}` -> 单个用户。

### 3.3 更新用户

PUT `/users/{id}` 请求：`{ "username":"new", "bio":"text", "minecraftId":"mcX" }`

### 3.4 更新角色

PUT `/users/{id}/role` 请求：`{ "role": "admin" }`

### 3.5 删除用户

DELETE `/users/{id}` -> `{ "message":"用户已删除" }`

### 3.6 更新当前用户资料

PUT `/users/me` 请求：`{ "username":"new", "email":"a@b.com" }`

### 3.7 更新当前用户密码

PUT `/users/me/password` 请求：`{ "currentPassword":"old", "newPassword":"new123456" }`

---

## 4. 文章接口

### 4.1 分类

GET `/posts/categories` -> `{ "categories": [ { "id":"c1", "name":"公告" } ] }`

### 4.2 列表

GET `/posts`

```json
{
  "data": [ { "id": "p1", "title": "标题", "excerpt": "摘要", "author": { "id": "u1", "username": "alice" }, "category": "c1", "tags": ["t1"], "status": "published", "views": 10, "likeCount": 2, "commentCount": 1, "createdAt": "2025-09-14T08:15:30Z" } ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### 4.3 详情

GET `/posts/{id}` -> 含 `content`, `likes`(数组), `comments`(数组)。

### 4.4 创建

POST `/posts` 请求：`{ "title":"t", "content":"正文", "category":"c1", "tags":["t1"], "status":"published" }`

### 4.5 更新

PUT `/posts/{id}` 请求：任意可选字段。

### 4.6 删除

DELETE `/posts/{id}` -> `{ "message":"文章已删除" }`

### 4.7 点赞

PUT `/posts/{id}/like` -> `["u2","u3"]`

### 4.8 评论

POST `/posts/{id}/comment` 请求：`{ "content":"评论" }` -> 返回最新评论数组。

---

## 5. 图库接口

### 5.1 分类

GET `/gallery/categories` -> `{ "categories": [ { "id":"g1", "name":"风景" } ] }`

### 5.2 列表

GET `/gallery`

```json
{
  "data": [ { "id":"img1", "title":"图1", "url":"https://...", "thumbnail":"https://.../thumb", "uploader": { "id":"u1", "username":"alice" }, "category":"g1", "tags":["t1"], "status":"approved", "isFeatured": false, "views":12, "likeCount":3, "commentCount":1, "createdAt":"2025-09-14T08:20:00Z" } ],
  "pagination": { "page":1, "limit":10, "total":1, "totalPages":1 }
}
```

### 5.3 详情

GET `/gallery/{id}` -> 单条图片（含 likes, comments）。

### 5.4 上传

POST `/gallery` (multipart) 字段：`image` `title` `description?` `category?` `tags[]?`

### 5.5 更新

PUT `/gallery/{id}`

### 5.6 删除

DELETE `/gallery/{id}` -> `{ "message":"图片已删除" }`

### 5.7 点赞

PUT `/gallery/{id}/like` -> `["u1","u2"]`

### 5.8 评论

POST `/gallery/{id}/comment` -> `{ "id":"c1", "content":"好图", "author": { "id":"u2" }, "createdAt":"2025-09-14T09:00:00Z" }`

### 5.9 审核（管理员）

PUT `/gallery/{id}/approve` -> `{ "id":"img1", "status":"approved" }`

### 5.10 精选（管理员）

PUT `/gallery/{id}/featured` -> `{ "id":"img1", "isFeatured": true }`

---

## 6. 活动接口

### 6.1 分类

GET `/events/categories` -> `{ "categories": [ { "id":"e1", "name":"竞赛" } ] }`

### 6.2 列表

GET `/events`

```json
{
  "data": [ { "id":"ev1", "title":"比赛A", "status":"upcoming", "startDate":"2025-10-01T00:00:00Z", "endDate":"2025-10-07T00:00:00Z", "signupDeadline":"2025-09-30T12:00:00Z", "maxParticipants":100, "joined":5, "category":"e1", "owner": { "id":"u1", "username":"alice" }, "createdAt":"2025-09-14T08:30:00Z" } ],
  "pagination": { "page":1, "limit":10, "total":1, "totalPages":1 }
}
```

### 6.3 详情

GET `/events/{id}` -> 含 participants（数组）。

### 6.4 创建

POST `/events` 请求：`{ "title":"比赛A", "startDate":"...", "endDate":"..." }`

### 6.5 更新

PUT `/events/{id}`

### 6.6 删除

DELETE `/events/{id}` -> `{ "message":"活动已删除" }`

### 6.7 参加

PUT `/events/{id}/join` -> `["u1","u2"]`

### 6.8 退出

PUT `/events/{id}/leave` -> `["u1"]`

---

## 7. 论坛接口

### 7.1 分类

GET `/forum/categories` -> `{ "categories": [ { "id":"fc1", "name":"综合", "topicCount":10, "postCount":120 } ] }`

### 7.2 分类主题

GET `/forum/category/{categoryId}` -> 分页 topics。

### 7.3 主题详情

GET `/forum/topic/{topicId}` -> topic + replies。

### 7.4 创建主题

POST `/forum/topic` 请求：`{ "title":"标题", "content":"正文", "categoryId":"fc1" }`

### 7.5 回复主题

POST `/forum/topic/{topicId}/reply` 请求：`{ "content":"回复" }`

### 7.6 点赞主题

POST `/forum/topic/{topicId}/like` -> `{ "likes": 3, "isLiked": true }`

---

## 8. 搜索接口

### 8.1 全局搜索

GET `/search?q=关键字&type=posts,images`

```json
{ "results": { "posts": [ { "id":"p1", "title":"标题" } ] }, "pagination": { "page":1, "limit":10, "total":1, "totalPages":1 } }
```

### 8.2 分类搜索

GET `/search/posts?q=关键字&category=c1` -> 同分页结构。
其它：`/search/events` `/search/images` `/search/users`。

---

## 9. 服务器接口

### 9.1 列表

GET `/servers`

```json
{
  "data": [ { "id":"s1", "name":"主服", "address":"mc.example.com", "port":25565, "status":"online", "onlinePlayers":12, "maxPlayers":100, "version":"1.20", "isFeatured":true, "createdAt":"2025-09-14T08:40:00Z" } ],
  "pagination": { "page":1, "limit":10, "total":1, "totalPages":1 }
}
```

### 9.2 状态统计

GET `/servers/status` -> `{ "totalServers":5, "onlineServers":4, "offlineServers":1, "totalPlayers":120 }`

### 9.3 详情

GET `/servers/{id}`

### 9.4 创建（管理员）

POST `/servers` 请求：`{ "name":"主服", "address":"mc.example.com", "port":25565, "version":"1.20", "isFeatured":true }`

### 9.5 更新（管理员）

PUT `/servers/{id}`

### 9.6 删除（管理员）

DELETE `/servers/{id}` -> `{ "message":"服务器已删除" }`

### 9.7 玩家列表

GET `/servers/{id}/players` -> `{ "data": [ { "username":"player1" } ], "pagination": { "page":1, "limit":10, "total":1, "totalPages":1 } }`

### 9.8 统计信息

GET `/servers/{id}/stats` -> `{ "serverId":"s1", "totalPlayers":500, "peakPlayers":80, "averagePlayers":25, "uptime":99.5, "lastUpdated":"2025-09-14T09:00:00Z" }`

---
**下文中为新版**
**下文中为新版**
**下文中为新版**
---
<!-- 已移除重复与旧格式的认证接口段落，统一使用前文“2. 认证接口”章节定义 -->

## 2. 用户接口

### 2.1 获取所有用户（管理员）
- **URL**: `/api/users`
- **方法**: `GET`
- **描述**: 获取所有用户列表（仅管理员可用）
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
  ```json
  {
    "users": [
      {
    "className": "string",    // 班级
      "className": "string",
      "className": "string",
    "className": "string",
        "className": "string",
    "className": "string",
    "minecraftId": "string",      // Minecraft ID（可选）
    "minecraftId": "string",      // Minecraft ID（可选）
    "className": "string",
    "className": "string",
    "minecraftId": "string"       // Minecraft ID（可选）
    "className": "string",
      "className": "string"
      "className": "string",
      "className": "string"
      "className": "string"
    "currentPage": "number",
    "totalUsers": "number"
  }
  ```

### 2.2 获取单个用户信息
- **URL**: `/api/users/:id`
- **方法**: `GET`
- **描述**: 获取指定用户的信息
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "role": "string",
    "isAdmin": "boolean",
    "isVerified": "boolean",
    "avatar": "string",
    "grade": "string",
    "class": "string",
    "minecraftId": "string",
    "joinDate": "date"
  }
  ```

### 2.3 更新用户信息
- **URL**: `/api/users/:id`
- **方法**: `PUT`
- **描述**: 更新指定用户的信息（仅管理员或用户本人可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "username": "string",         // 用户名（可选）
    "grade": "string",            // 年级（可选）
    "bio": "string",              // 个人简介（可选）
    "minecraftUsername": "string",// Minecraft用户名（可选）
    "avatar": "string"            // 头像URL（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "role": "string",
    "isAdmin": "boolean",
    "isVerified": "boolean",
    "avatar": "string",
    "grade": "string",
    "class": "string",
    "minecraftId": "string",
    "joinDate": "date"
  }
  ```

### 2.4 更新用户角色（管理员）
- **URL**: `/api/users/:id/role`
- **方法**: `PUT`
- **描述**: 更新用户角色（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "role": "string"  // 角色：admin、moderator或member
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "role": "string",
    "isAdmin": "boolean",
    "isVerified": "boolean",
    "avatar": "string",
    "grade": "string",
    "class": "string",
    "minecraftId": "string",
    "joinDate": "date"
  }
  ```

### 2.5 删除用户（管理员）
- **URL**: `/api/users/:id`
- **方法**: `DELETE`
- **描述**: 删除指定用户（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "message": "用户已删除"
  }
  ```

### 2.6 更新当前用户资料
- **URL**: `/api/users/me`
- **方法**: `PUT`
- **描述**: 更新当前登录用户的资料
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "username": "string",         // 用户名（可选）
    "email": "string",            // 邮箱（可选）
    "grade": "string",            // 年级（可选）
    "bio": "string",              // 个人简介（可选）
    "minecraftUsername": "string" // Minecraft用户名（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "role": "string",
    "isAdmin": "boolean",
    "isVerified": "boolean",
    "avatar": "string",
    "grade": "string",
    "class": "string",
    "minecraftId": "string",
    "joinDate": "date"
  }
  ```

### 2.7 更新当前用户密码
- **URL**: `/api/users/me/password`
- **方法**: `PUT`
- **描述**: 更新当前登录用户的密码
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "currentPassword": "string",  // 当前密码
    "newPassword": "string"       // 新密码，至少6个字符
  }
  ```
- **响应**:
  ```json
  {
    "message": "密码更新成功"
  }
  ```

## 3. 文章接口

### 3.1 获取文章分类
- **URL**: `/api/posts/categories`
- **方法**: `GET`
- **描述**: 获取所有文章分类
- **响应**:
  ```json
  {
    "categories": [
      {
        "_id": "string",
        "name": "string",
        "description": "string"
      }
    ]
  }
  ```

### 3.2 获取所有文章
- **URL**: `/api/posts`
- **方法**: `GET`
- **描述**: 获取所有文章列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `category`: 分类ID（可选）
  - `sort`: 排序字段（默认createdAt）
  - `search`: 搜索关键词（可选）
  - `sortOrder`: 排序顺序（asc或desc，默认desc）
- **响应**:
  ```json
  {
    "posts": [
      {
        "id": "string",
        "title": "string",
        "content": "string",
        "excerpt": "string",
        "author": {
          "id": "string",
          "username": "string",
          "avatar": "string"
        },
        "category": "string",
        "tags": ["string"],
        "featuredImage": "string",
        "status": "string",
        "views": "number",
        "likes": ["string"],
        "comments": [
          {
            "id": "string",
            "author": {
              "id": "string",
              "username": "string",
              "avatar": "string"
            },
            "content": "string",
            "createdAt": "date"
          }
        ],
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalPosts": "number"
  }
  ```

### 3.3 获取单个文章
- **URL**: `/api/posts/:id`
- **方法**: `GET`
- **描述**: 获取指定文章的详细信息
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "content": "string",
    "excerpt": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string",
      "grade": "string",
      "class": "string"
    },
    "category": "string",
    "tags": ["string"],
    "featuredImage": "string",
    "status": "string",
    "views": "number",
    "likes": ["string"],
    "comments": [
      {
        "id": "string",
        "author": {
          "id": "string",
          "username": "string",
          "avatar": "string"
        },
        "content": "string",
        "createdAt": "date"
      }
    ],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 3.4 创建文章
- **URL**: `/api/posts`
- **方法**: `POST`
- **描述**: 创建新文章
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",        // 标题
    "content": "string",      // 内容
    "excerpt": "string",      // 摘要（可选）
    "category": "string",     // 分类
    "tags": ["string"],       // 标签（可选）
    "featuredImage": "string",// 特色图片URL（可选）
    "status": "string"        // 状态（published或draft，默认published）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "content": "string",
    "excerpt": "string",
    "author": "string",
    "category": "string",
    "tags": ["string"],
    "featuredImage": "string",
    "status": "string",
    "views": "number",
    "likes": ["string"],
    "comments": [],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 3.5 更新文章
- **URL**: `/api/posts/:id`
- **方法**: `PUT`
- **描述**: 更新指定文章（仅管理员或文章作者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",        // 标题（可选）
    "content": "string",      // 内容（可选）
    "excerpt": "string",      // 摘要（可选）
    "category": "string",     // 分类（可选）
    "tags": ["string"],       // 标签（可选）
    "featuredImage": "string",// 特色图片URL（可选）
    "status": "string"        // 状态（published或draft，默认published）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "content": "string",
    "excerpt": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "category": "string",
    "tags": ["string"],
    "featuredImage": "string",
    "status": "string",
    "views": "number",
    "likes": ["string"],
    "comments": [],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 3.6 删除文章
- **URL**: `/api/posts/:id`
- **方法**: `DELETE`
- **描述**: 删除指定文章（仅管理员或文章作者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "message": "文章已删除"
  }
  ```

### 3.7 点赞文章
- **URL**: `/api/posts/:id/like`
- **方法**: `PUT`
- **描述**: 点赞或取消点赞指定文章
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  ["string"]  // 点赞用户ID列表
  ```

### 3.8 添加评论
- **URL**: `/api/posts/:id/comment`
- **方法**: `POST`
- **描述**: 为指定文章添加评论
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "content": "string"  // 评论内容
  }
  ```
- **响应**:
  ```json
  [
    {
      "id": "string",
      "author": {
        "id": "string",
        "username": "string",
        "avatar": "string"
      },
      "content": "string",
      "createdAt": "date"
    }
  ]
  ```

## 4. 图库接口

### 4.1 获取图片分类
- **URL**: `/api/gallery/categories`
- **方法**: `GET`
- **描述**: 获取所有图片分类
- **响应**:
  ```json
  {
    "categories": [
      {
        "_id": "string",
        "name": "string",
        "description": "string"
      }
    ]
  }
  ```

### 4.2 获取所有图片
- **URL**: `/api/gallery`
- **方法**: `GET`
- **描述**: 获取所有图片列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `category`: 分类ID（可选）
  - `sort`: 排序字段（默认createdAt）
  - `sortOrder`: 排序顺序（asc或desc，默认desc）
- **响应**:
  ```json
  {
    "images": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "url": "string",
        "thumbnail": "string",
        "author": {
          "id": "string",
          "username": "string",
          "avatar": "string"
        },
        "category": "string",
        "tags": ["string"],
        "likes": ["string"],
        "comments": [
          {
            "id": "string",
            "author": {
              "id": "string",
              "username": "string",
              "avatar": "string"
            },
            "content": "string",
            "createdAt": "date"
          }
        ],
        "isApproved": "boolean",
        "isFeatured": "boolean",
        "views": "number",
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalImages": "number"
  }
  ```

### 4.3 获取单个图片
- **URL**: `/api/gallery/:id`
- **方法**: `GET`
- **描述**: 获取指定图片的详细信息
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "url": "string",
    "thumbnail": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string",
      "grade": "string",
      "class": "string"
    },
    "category": "string",
    "tags": ["string"],
    "likes": ["string"],
    "comments": [
      {
        "id": "string",
        "author": {
          "id": "string",
          "username": "string",
          "avatar": "string"
        },
        "content": "string",
        "createdAt": "date"
      }
    ],
    "isApproved": "boolean",
    "isFeatured": "boolean",
    "views": "number",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 4.4 上传图片
- **URL**: `/api/gallery`
- **方法**: `POST`
- **描述**: 上传新图片
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  - `image`: 文件（支持jpeg/jpg/png/gif/webp格式，最大5MB）
  - `title`: 标题
  - `description`: 描述（可选）
  - `category`: 分类（可选）
  - `tags`: 标签数组（可选）
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "url": "string",
    "thumbnail": "string",
    "author": "string",
    "category": "string",
    "tags": ["string"],
    "likes": [],
    "comments": [],
    "isApproved": "boolean",
    "isFeatured": "boolean",
    "views": "number",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 4.5 更新图片信息
- **URL**: `/api/gallery/:id`
- **方法**: `PUT`
- **描述**: 更新指定图片信息（仅管理员或图片作者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",        // 标题（可选）
    "description": "string",  // 描述（可选）
    "category": "string",     // 分类（可选）
    "tags": ["string"]        // 标签（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "url": "string",
    "thumbnail": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "category": "string",
    "tags": ["string"],
    "likes": ["string"],
    "comments": [],
    "isApproved": "boolean",
    "isFeatured": "boolean",
    "views": "number",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 4.6 删除图片
- **URL**: `/api/gallery/:id`
- **方法**: `DELETE`
- **描述**: 删除指定图片（仅管理员或图片作者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "message": "图片已删除"
  }
  ```

### 4.7 点赞图片
- **URL**: `/api/gallery/:id/like`
- **方法**: `PUT`
- **描述**: 点赞或取消点赞指定图片
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  ["string"]  // 点赞用户ID列表
  ```

### 4.8 添加评论
- **URL**: `/api/gallery/:id/comment`
- **方法**: `POST`
- **描述**: 为指定图片添加评论
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "content": "string"  // 评论内容
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "content": "string",
    "createdAt": "date"
  }
  ```

### 4.9 审核图片（管理员）
- **URL**: `/api/gallery/:id/approve`
- **方法**: `PUT`
- **描述**: 审核通过指定图片（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "url": "string",
    "thumbnail": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "category": "string",
    "tags": ["string"],
    "likes": ["string"],
    "comments": [],
    "isApproved": true,
    "isFeatured": "boolean",
    "views": "number",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 4.10 设置精选图片（管理员）
- **URL**: `/api/gallery/:id/featured`
- **方法**: `PUT`
- **描述**: 设置或取消指定图片为精选（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "url": "string",
    "thumbnail": "string",
    "author": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "category": "string",
    "tags": ["string"],
    "likes": ["string"],
    "comments": [],
    "isApproved": "boolean",
    "isFeatured": "boolean",
    "views": "number",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

## 5. 活动接口

### 5.1 获取活动分类
- **URL**: `/api/events/categories`
- **方法**: `GET`
- **描述**: 获取所有活动分类
- **响应**:
  ```json
  {
    "categories": [
      {
        "_id": "string",
        "name": "string",
        "description": "string"
      }
    ]
  }
  ```

### 5.2 获取所有活动
- **URL**: `/api/events`
- **方法**: `GET`
- **描述**: 获取所有活动列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `category`: 分类ID（可选）
  - `status`: 状态（可选）
  - `sort`: 排序字段（默认startDate）
- **响应**:
  ```json
  {
    "events": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "organizer": {
          "id": "string",
          "username": "string",
          "avatar": "string"
        },
        "startDate": "date",
        "endDate": "date",
        "location": "string",
        "maxParticipants": "number",
        "category": "string",
        "featuredImage": "string",
        "status": "string",
        "rules": "string",
        "prizes": "string",
        "participants": [
          {
            "id": "string",
            "username": "string",
            "avatar": "string"
          }
        ],
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalEvents": "number"
  }
  ```

### 5.3 获取单个活动
- **URL**: `/api/events/:id`
- **方法**: `GET`
- **描述**: 获取指定活动的详细信息
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "organizer": {
      "id": "string",
      "username": "string",
      "avatar": "string",
      "grade": "string",
      "class": "string"
    },
    "startDate": "date",
    "endDate": "date",
    "location": "string",
    "maxParticipants": "number",
    "category": "string",
    "featuredImage": "string",
    "status": "string",
    "rules": "string",
    "prizes": "string",
    "participants": [
      {
        "id": "string",
        "username": "string",
        "avatar": "string"
      }
    ],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 5.4 创建活动
- **URL**: `/api/events`
- **方法**: `POST`
- **描述**: 创建新活动
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",            // 标题
    "description": "string",      // 描述
    "startDate": "date",          // 开始日期
    "endDate": "date",            // 结束日期
    "location": "string",         // 地点
    "maxParticipants": "number",  // 最大参与人数（可选）
    "category": "string",         // 分类
    "featuredImage": "string",    // 特色图片URL（可选）
    "status": "string",           // 状态（published、draft等，默认published）
    "rules": "string",            // 规则（可选）
    "prizes": "string"            // 奖品（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "organizer": "string",
    "startDate": "date",
    "endDate": "date",
    "location": "string",
    "maxParticipants": "number",
    "category": "string",
    "featuredImage": "string",
    "status": "string",
    "rules": "string",
    "prizes": "string",
    "participants": [],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 5.5 更新活动
- **URL**: `/api/events/:id`
- **方法**: `PUT`
- **描述**: 更新指定活动（仅管理员或活动组织者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",            // 标题（可选）
    "description": "string",      // 描述（可选）
    "startDate": "date",          // 开始日期（可选）
    "endDate": "date",            // 结束日期（可选）
    "location": "string",         // 地点（可选）
    "maxParticipants": "number",  // 最大参与人数（可选）
    "category": "string",         // 分类（可选）
    "featuredImage": "string",    // 特色图片URL（可选）
    "status": "string",           // 状态（published、draft等，默认published）
    "rules": "string",            // 规则（可选）
    "prizes": "string"            // 奖品（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "organizer": {
      "id": "string",
      "username": "string",
      "avatar": "string"
    },
    "startDate": "date",
    "endDate": "date",
    "location": "string",
    "maxParticipants": "number",
    "category": "string",
    "featuredImage": "string",
    "status": "string",
    "rules": "string",
    "prizes": "string",
    "participants": [],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 5.6 删除活动
- **URL**: `/api/events/:id`
- **方法**: `DELETE`
- **描述**: 删除指定活动（仅管理员或活动组织者可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "message": "活动已删除"
  }
  ```

### 5.7 参加活动
- **URL**: `/api/events/:id/join`
- **方法**: `PUT`
- **描述**: 参加指定活动
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  [
    "string"  // 参与者用户ID列表
  ]
  ```

### 5.8 退出活动
- **URL**: `/api/events/:id/leave`
- **方法**: `PUT`
- **描述**: 退出指定活动
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  [
    "string"  // 参与者用户ID列表
  ]
  ```

## 6. 论坛接口

### 6.1 获取论坛分类
- **URL**: `/api/forum/categories`
- **方法**: `GET`
- **描述**: 获取所有论坛分类
- **响应**:
  ```json
  {
    "categories": [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "tags": ["string"],
        "topicCount": "number",
        "postCount": "number",
        "lastPost": {
          "_id": "string",
          "title": "string",
          "createdAt": "date",
          "author": {
            "_id": "string",
            "username": "string",
            "avatar": "string"
          }
        }
      }
    ],
    "totalPages": "number"
  }
  ```

### 6.2 获取分类下的主题
- **URL**: `/api/forum/category/:categoryId`
- **方法**: `GET`
- **描述**: 获取指定分类下的主题列表
- **请求参数**:
  - `page`: 页码（默认1）
- **响应**:
  ```json
  {
    "topics": [
      {
        "_id": "string",
        "title": "string",
        "content": "string",
        "author": {
          "_id": "string",
          "username": "string",
          "avatar": "string"
        },
        "categoryId": "string",
        "views": "number",
        "replies": "number",
        "createdAt": "date",
        "updatedAt": "date",
        "isPinned": "boolean",
        "isLocked": "boolean",
        "lastReply": {
          "author": {
            "_id": "string",
            "username": "string",
            "avatar": "string"
          },
          "createdAt": "date"
        }
      }
    ],
    "totalPages": "number"
  }
  ```

### 6.3 获取主题详情
- **URL**: `/api/forum/topic/:topicId`
- **方法**: `GET`
- **描述**: 获取指定主题的详细信息和回复
- **响应**:
  ```json
  {
    "topic": {
      "_id": "string",
      "title": "string",
      "content": "string",
      "author": {
        "_id": "string",
        "username": "string",
        "avatar": "string",
        "joinDate": "date",
        "postCount": "number"
      },
      "categoryId": "string",
      "views": "number",
      "replies": "number",
      "createdAt": "date",
      "updatedAt": "date",
      "isPinned": "boolean",
      "isLocked": "boolean"
    },
    "replies": [
      {
        "_id": "string",
        "content": "string",
        "author": {
          "_id": "string",
          "username": "string",
          "avatar": "string",
          "joinDate": "date",
          "postCount": "number"
        },
        "createdAt": "date",
        "updatedAt": "date"
      }
    ]
  }
  ```

### 6.4 创建新主题
- **URL**: `/api/forum/topic`
- **方法**: `POST`
- **描述**: 创建新主题
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "title": "string",      // 标题
    "content": "string",    // 内容
    "categoryId": "string"  // 分类ID
  }
  ```
- **响应**:
  ```json
  {
    "_id": "string",
    "title": "string",
    "content": "string",
    "author": {
      "_id": "string",
      "username": "string",
      "avatar": "string"
    },
    "categoryId": "string",
    "views": "number",
    "replies": "number",
    "createdAt": "date",
    "updatedAt": "date",
    "isPinned": "boolean",
    "isLocked": "boolean"
  }
  ```

### 6.5 回复主题
- **URL**: `/api/forum/topic/:topicId/reply`
- **方法**: `POST`
- **描述**: 回复指定主题
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "content": "string"  // 回复内容
  }
  ```
- **响应**:
  ```json
  {
    "_id": "string",
    "content": "string",
    "author": {
      "_id": "string",
      "username": "string",
      "avatar": "string"
    },
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 6.6 点赞主题
- **URL**: `/api/forum/topic/:topicId/like`
- **方法**: `POST`
- **描述**: 点赞指定主题
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "likes": "number",   // 点赞数
    "isLiked": "boolean" // 当前用户是否已点赞
  }
  ```

## 7. 搜索接口

### 7.1 全局搜索
- **URL**: `/api/search`
- **方法**: `GET`
- **描述**: 在所有内容中进行搜索
- **请求参数**:
  - `q`: 搜索关键词
  - `type`: 搜索类型（posts、events、images、users，默认全部）
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "results": {
      "posts": [...],
      "events": [...],
      "images": [...],
      "users": [...]
    },
    "totalPages": "number",
    "currentPage": "number"
  }
  ```

### 7.2 搜索文章
- **URL**: `/api/search/posts`
- **方法**: `GET`
- **描述**: 搜索文章
- **请求参数**:
  - `q`: 搜索关键词
  - `category`: 分类ID（可选）
  - `sort`: 排序字段（默认createdAt）
  - `sortOrder`: 排序顺序（asc或desc，默认desc）
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "posts": [...],
    "totalPages": "number",
    "currentPage": "number",
    "totalPosts": "number"
  }
  ```

### 7.3 搜索活动
- **URL**: `/api/search/events`
- **方法**: `GET`
- **描述**: 搜索活动
- **请求参数**:
  - `q`: 搜索关键词
  - `category`: 分类ID（可选）
  - `status`: 状态（可选）
  - `sort`: 排序字段（默认startDate）
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "events": [...],
    "totalPages": "number",
    "currentPage": "number",
    "totalEvents": "number"
  }
  ```

### 7.4 搜索图片
- **URL**: `/api/search/images`
- **方法**: `GET`
- **描述**: 搜索图片
- **请求参数**:
  - `q`: 搜索关键词
  - `category`: 分类ID（可选）
  - `sort`: 排序字段（默认createdAt）
  - `sortOrder`: 排序顺序（asc或desc，默认desc）
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "images": [...],
    "totalPages": "number",
    "currentPage": "number",
    "totalImages": "number"
  }
  ```

### 7.5 搜索用户
- **URL**: `/api/search/users`
- **方法**: `GET`
- **描述**: 搜索用户
- **请求参数**:
  - `q`: 搜索关键词
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "users": [...],
    "totalPages": "number",
    "currentPage": "number",
    "totalUsers": "number"
  }
  ```

## 8. 服务器接口

### 8.1 获取服务器列表
- **URL**: `/api/servers`
- **方法**: `GET`
- **描述**: 获取服务器列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `sort`: 排序字段（默认createdAt）
  - `sortOrder`: 排序顺序（asc或desc，默认desc）
  - `category`: 分类（可选）
  - `status`: 状态（online、offline等，可选）
  - `search`: 搜索关键词（可选）
- **响应**:
  ```json
  {
    "servers": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "address": "string",
        "port": "number",
        "category": "string",
        "status": "string",
        "onlinePlayers": "number",
        "maxPlayers": "number",
        "version": "string",
        "isFeatured": "boolean",
        "createdAt": "date",
        "updatedAt": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalServers": "number"
  }
  ```

### 8.2 获取服务器状态
- **URL**: `/api/servers/status`
- **方法**: `GET`
- **描述**: 获取服务器状态统计
- **响应**:
  ```json
  {
    "totalServers": "number",
    "onlineServers": "number",
    "offlineServers": "number",
    "totalPlayers": "number",
    "categories": [
      {
        "name": "string",
        "count": "number"
      }
    ]
  }
  ```

### 8.3 获取服务器信息
- **URL**: `/api/servers/info`
- **方法**: `GET`
- **描述**: 获取服务器详细信息
- **响应**:
  ```json
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "address": "string",
    "port": "number",
    "category": "string",
    "status": "string",
    "onlinePlayers": "number",
    "maxPlayers": "number",
    "version": "string",
    "isFeatured": "boolean",
    "motd": "string",
    "plugins": ["string"],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 8.4 获取服务器玩家列表
- **URL**: `/api/servers/players`
- **方法**: `GET`
- **描述**: 获取服务器玩家列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "players": [
      {
        "id": "string",
        "username": "string",
        "avatar": "string",
        "joinTime": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalPlayers": "number"
  }
  ```

### 8.5 获取特色服务器
- **URL**: `/api/servers/featured`
- **方法**: `GET`
- **描述**: 获取特色服务器列表
- **响应**:
  ```json
  {
    "servers": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "address": "string",
        "port": "number",
        "category": "string",
        "status": "string",
        "onlinePlayers": "number",
        "maxPlayers": "number",
        "version": "string",
        "isFeatured": true,
        "createdAt": "date",
        "updatedAt": "date"
      }
    ]
  }
  ```

### 8.6 获取服务器统计信息
- **URL**: `/api/servers/stats`
- **方法**: `GET`
- **描述**: 获取服务器统计信息
- **响应**:
  ```json
  {
    "totalServers": "number",
    "onlineServers": "number",
    "offlineServers": "number",
    "totalPlayers": "number",
    "peakPlayers": "number",
    "categories": [
      {
        "name": "string",
        "serverCount": "number",
        "playerCount": "number"
      }
    ]
  }
  ```

### 8.7 获取单个服务器详情
- **URL**: `/api/servers/:id`
- **方法**: `GET`
- **描述**: 获取指定服务器的详细信息
- **响应**:
  ```json
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "address": "string",
    "port": "number",
    "category": "string",
    "status": "string",
    "onlinePlayers": "number",
    "maxPlayers": "number",
    "version": "string",
    "isFeatured": "boolean",
    "motd": "string",
    "plugins": ["string"],
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 8.8 创建服务器
- **URL**: `/api/servers`
- **方法**: `POST`
- **描述**: 创建新服务器（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "name": "string",         // 服务器名称
    "description": "string",  // 描述
    "address": "string",      // 地址
    "port": "number",         // 端口
    "category": "string",     // 分类
    "version": "string",      // 版本
    "isFeatured": "boolean"   // 是否为特色服务器
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "address": "string",
    "port": "number",
    "category": "string",
    "status": "string",
    "onlinePlayers": "number",
    "maxPlayers": "number",
    "version": "string",
    "isFeatured": "boolean",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 8.9 更新服务器
- **URL**: `/api/servers/:id`
- **方法**: `PUT`
- **描述**: 更新指定服务器信息（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **请求参数**:
  ```json
  {
    "name": "string",         // 服务器名称（可选）
    "description": "string",  // 描述（可选）
    "address": "string",      // 地址（可选）
    "port": "number",         // 端口（可选）
    "category": "string",     // 分类（可选）
    "version": "string",      // 版本（可选）
    "isFeatured": "boolean"   // 是否为特色服务器（可选）
  }
  ```
- **响应**:
  ```json
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "address": "string",
    "port": "number",
    "category": "string",
    "status": "string",
    "onlinePlayers": "number",
    "maxPlayers": "number",
    "version": "string",
    "isFeatured": "boolean",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### 8.10 删除服务器
- **URL**: `/api/servers/:id`
- **方法**: `DELETE`
- **描述**: 删除指定服务器（仅管理员可用）
- **请求头**: 
  ```json
  {
    "Authorization": "Bearer [token]"
  }
  ```
- **响应**:
  ```json
  {
    "message": "服务器已删除"
  }
  ```

### 8.11 获取单个服务器玩家列表
- **URL**: `/api/servers/:id/players`
- **方法**: `GET`
- **描述**: 获取指定服务器的玩家列表
- **请求参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**:
  ```json
  {
    "players": [
      {
        "id": "string",
        "username": "string",
        "avatar": "string",
        "joinTime": "date"
      }
    ],
    "totalPages": "number",
    "currentPage": "number",
    "totalPlayers": "number"
  }
  ```

### 8.12 获取单个服务器统计信息
- **URL**: `/api/servers/:id/stats`
- **方法**: `GET`
- **描述**: 获取指定服务器的统计信息
- **响应**:
  ```json
  {
    "serverId": "string",
    "totalPlayers": "number",
    "peakPlayers": "number",
    "averagePlayers": "number",
    "uptime": "number",
    "lastUpdated": "date"
  }
  ```