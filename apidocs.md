# 沙盒网后端 API 接口协议

版本: v1.1
更新时间: 2025-09-19
基础路径: `/api`

> 目前更新完了 1 2 3 4 部分

## 目录

1. 通用约定  
1. 认证接口  
1. 用户接口
1. 活动接口  

TODO:

1. 文章接口  
1. 图库接口  
1. 论坛接口  
1. 搜索接口  
1. 服务器接口  

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
{ "code": "CODE_UPPER_CASE", "message": "msg", "data": {"...": {},"pagination"?: {"total": 1, "page": 1, "limit": 10}}, "traceId": "uuid"}
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

### 1.5 排序

本段内容应写在 query 里。

`orderBy` 排序 keyword.

`order`: `asc` or `desc`, 指代 `ascending` 和 `descending`

### 1.6 筛选器

本段内容应写在 query 里。

`filterKeyWord`: `filterValue`

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
"token": "jwt", "user": { "id": 1, "username": "alice", "minecraftId": "mcAlice" }
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

### 2.4 修改密码

POST `/api/auth/changepassword`

REQ:

```json
{"oldPassword": "", "newPassword": ""}
```

---

## 3. 用户接口

### 3.1 用户列表（管理员）

GET `/users`

```json

"users":[{"id":1,"username":"Steve","email":"example@example.com","grade":"First","className":"Zero","minecraftId":"Steve","role":"admin","isVerified":0,"createdAt":"2025-09-19T13:58:44.352Z","lastLoginAt":"2025-09-19T13:58:44.352Z","bio":"","points":0}]

```

### 3.2 获取用户

GET `/users/{id}` -> 单个用户。

```json
{"id":1,"username":"Steve","email":"example@example.com","grade":"First","className":"Zero","minecraftId":"Steve","role":"admin","isVerified":0,"createdAt":"2025-09-19T13:58:44.352Z","lastLoginAt":"2025-09-19T13:58:44.352Z","bio":"","points":0}
```

### 3.3 更新用户

PUT `/users/{id}` 请求同 3.2 中响应。points, id, isVerified, role 除外。

管理员可更新任何账户，普通用户只能更新自己。

### 3.4 更新角色

PUT `/users/{id}/role` 请求：`{ "role": "admin" }`

### 3.5 删除用户

DELETE `/users/{id}` 

### 3.6 积分记录查询

GET `/users/:id/points/record`

支持分页。

```json
"records":[{"points":10,"description":"Test2","relatedEntityType":null,"relatedEntityId":null,"createdAt":"2025-09-20T14:34:23.131Z"},{"points":-10,"description":"Test1","relatedEntityType":null,"relatedEntityId":null,"createdAt":"2025-09-20T14:34:05.073Z"}]
```

### 3.7 更改用户积分 (+delta)

POST `{"points":-10,"description":"Test1","relatedEntityType": null | string,"relatedEntityId": null | number}` -> `/api/users/:id/points/add`

仅管理员可使用。

## 4. 活动接口

**若无特殊说明，本段中所有允许的 filter 均有 category 和 status, 且普通用户只能筛选 status 为 approved 或 completed 的 activity.**

### 4.1 获取全部分类

GET `/activities/categories/all`

```json
"categories":[{"id":1,"name":"test1","description":"only a test"},{"id":2,"name":"test1","description":"only a test"},{"id":3,"name":"test1","description":"only a test"},{"id":4,"name":"test1","description":"only a test"},{"id":5,"name":"test1","description":"only a test"},{"id":6,"name":"test1","description":"only a test"},{"id":7,"name":"test1","description":"only a test"},{"id":8,"name":"test1","description":"only a test"}]
```

**这个没有分页也不需要分页**

### 4.2 新建活动分类

POST `{"name": "name", "description": "description"}` -> `/activities/categories/all`

### 4.3 获取全部活动

GET `/activities`

```json
"activities":[{"id":4,"title":"A","description":"D","location":"no","startDate":"2025-09-21T03:23:31.753Z","endDate":"2025-09-22T03:23:31.753Z","maxParticipants":null,"featuredImage":null,"status":"pending","createdAt":"2025-09-21T03:34:47.716Z","updatedAt":"2025-09-21T03:34:47.716Z","category":{"id":1,"name":"test1","description":"only a test"}},{"id":5,"title":"B","description":"D","location":"no","startDate":"2025-09-21T03:23:31.753Z","endDate":"2025-09-22T03:23:31.753Z","maxParticipants":null,"featuredImage":null,"status":"pending","createdAt":"2025-09-21T03:34:48.107Z","updatedAt":"2025-09-21T03:34:48.107Z","category":{"id":1,"name":"test1","description":"only a test"}}]
```

其中 status 可以为 `pending`, `approved`, `rejected`, `deleted`

普通用户只能获取到自己创建的全部活动和所有其他人创建的状态为 `approved` 的活动。

管理员无限制。

支持分页、排序和筛选，排序键名可选：

`title`, `startDate`, `endDate`, `createdAt`, `updatedAt`.

筛选键名额外可选: `organizerId`

### 4.4 获取单个活动

GET `/api/activities/:id`

返回内容：

```json
{"id":4,"title":"A","description":"D","location":"no","startDate":"2025-09-21T03:23:31.753Z","endDate":"2025-09-22T03:23:31.753Z","maxParticipants":null,"featuredImage":null,"status":"pending","createdAt":"2025-09-21T03:34:47.716Z","updatedAt":"2025-09-21T03:34:47.716Z","category":{"id":1,"name":"test1","description":"only a test"}}
```

普通用户可以获取自己的 `pending` 活动或任何人的 `approved` 及 `completed` 活动。


### 4.5 创建活动

POST `/api/activities`

请求 body:

```json
{"title":"title","description":"description","location":"somewhere","startDate":"2025-09-21T03:23:31.753Z","endDate":"2025-09-22T03:23:31.753Z","maxParticipants":null | 1,"featuredImage":null | "url","categoryId": 1}
```

返回该活动，内容同 4.4

### 4.6 更新活动

PUT `/api/activities/:id`

对于普通用户来说，请求 body 应等同于 4.5 的请求 body, 且只在 status=pending or rejected 的时候可以更改。此操作会将 status 设为 pending.

对于管理员则无限制，且此时可以更改 status, 也不会重设 status 为 pending.

### 4.7 删除活动

DELETE `/api/activities/:id`

普通用户只能删自己的，管理员随便。

### 4.8 获取活动参与者

GET `/api/activities/:id/participants`

```json
"participants":[{"id":1,"username":"Steve","role":"","joinedAt":"2025-09-21T05:56:43.633Z"}]
```

支持分页。

### 4.9 加入活动

POST `/api/activities/:id/join`

管理员可选 body：

```json
{"userId": 1}
```

### 4.10 退出活动

管理员可选 body:

```json
{"userId": 1}
```

### 4.11 获取用户参加的活动

用户只能看他自己的，管理员可以看所有人的。

允许排序、筛选和分页。

GET `/api/users/:userId/activities`

返回同 4.3 .