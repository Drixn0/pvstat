# PV Stat

一个用于记录户用光伏发电量、自动计算每 kW 发电量和收益的前后端分离项目。

当前项目由两个子应用组成：

- `server/`: Express + better-sqlite3 的轻量后端
- `web/`: Vue 3 + Vite + Element Plus 的前端界面

## 项目现状

这套项目目前已经完成了基础可用性和一轮结构化优化，适合作为日常录入和继续迭代的版本：

- 支持用户管理：新增、编辑、删除
- 支持按月份录入每日电量
- 自动计算每户月总发电量、每 kW 发电量、收益
- 支持总计卡片按日汇总所有用户
- 前端包含服务健康状态监控小组件
- 后端使用 SQLite 持久化数据

## 目录结构

```text
pvstat/
├── server/
│   ├── index.js
│   ├── index.test.js
│   ├── package.json
│   └── package-lock.json
├── web/
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── router/
│   │   └── views/Dashboard.vue
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
└── README.md
```

## 环境要求

- Node.js 18+
- npm 9+

## 安装依赖

分别安装前后端依赖：

```bash
cd server && npm install
cd ../web && npm install
```

## 启动方式

1. 启动后端

```bash
cd server
npm run dev
```

默认监听：

- `http://localhost:3000`

2. 启动前端

```bash
cd web
npm run dev
```

默认监听：

- `http://localhost:5173`

前端通过 `Vite proxy` 代理后端接口：

- `/api` -> `http://localhost:3000`
- `/health` -> `http://localhost:3000`

## Docker 部署

项目现在已经支持 Docker Compose 一键部署。

### 构建并启动

```bash
docker compose up -d --build
```

启动后访问：

- 前端页面: `http://localhost:8080`
- 后端健康检查: `http://localhost:8080/health`

### 停止服务

```bash
docker compose down
```

### 数据持久化

SQLite 数据已挂载到 Docker volume：

- `pvstat-data`

容器重建后，数据库内容会保留。

### 可选环境变量

后端支持以下环境变量：

- `PORT`: 服务监听端口，默认 `3000`
- `DB_PATH`: SQLite 数据库路径，默认 `pv.db`
- `APP_VERSION`: 健康检查返回的版本号
- `HEALTHCHECK_DB`: 是否执行数据库健康检查，默认 `true`
- `ALLOWED_ORIGIN`: CORS 允许来源，默认 `*`
- `JSON_BODY_LIMIT`: JSON 请求体大小限制，默认 `256kb`
- `DB_BUSY_TIMEOUT_MS`: SQLite 锁等待时间，默认 `5000`
- `DB_JOURNAL_MODE`: SQLite 日志模式，默认 `WAL`

参考示例：

- [.env.example](/Users/drixn/Dev/pvstat/.env.example)

### 生产部署结构

- `web` 容器：使用 `nginx` 提供静态页面，并代理 `/api` 与 `/health`
- `server` 容器：运行 Express + SQLite 服务
- `server` 与 `web` 均已配置容器级健康检查
- `server` 提供 `/live` 与 `/ready`，分别用于存活检查和就绪检查

### 相关文件

- [docker-compose.yml](/Users/drixn/Dev/pvstat/docker-compose.yml)
- [server/Dockerfile](/Users/drixn/Dev/pvstat/server/Dockerfile)
- [web/Dockerfile](/Users/drixn/Dev/pvstat/web/Dockerfile)
- [web/nginx.conf](/Users/drixn/Dev/pvstat/web/nginx.conf)
- [.env.example](/Users/drixn/Dev/pvstat/.env.example)

## 构建与预览

前端生产构建：

```bash
cd web
npm run build
```

前端本地预览：

```bash
cd web
npm run preview
```

## 测试方式

后端测试使用 Node.js 内置测试运行器：

```bash
cd server
npm test
```

当前已覆盖的基础场景：

- 月份格式校验
- 日期格式校验
- 删除用户时发电数据级联删除

## 数据存储

后端默认使用 SQLite，本地数据库文件为：

- `server/pv.db`

主要表：

- `households`: 用户基础信息
- `generation`: 每户每日发电量

`generation.household_id` 已启用外键约束，并配置了 `ON DELETE CASCADE`。

## 主要接口

后端核心接口如下：

- `GET /health`: 服务健康检查
- `GET /households`: 获取用户列表
- `POST /households`: 新增用户
- `PUT /households/:id`: 编辑用户
- `DELETE /households/:id`: 删除用户
- `GET /generation?month=YYYY-MM`: 获取当月发电数据
- `POST /generation`: 新增或更新某一天的发电量

接口错误返回已统一为 JSON 结构：

```json
{
  "success": false,
  "error": "错误说明"
}
```

## 本轮已完成的优化

### 1. 构建与包体积

- 修正了 `vite.config.js` 中重复的 `build` 配置覆盖问题
- Element Plus 从全量注册改成了按需引入
- 移除了未使用依赖 `xlsx`、`file-saver`
- 增加了 Docker 与 Docker Compose 部署支持

### 2. 后端稳定性

- 补充了参数校验
- 增加了统一错误处理中间件
- 增加了未知路由和非法 JSON 的友好返回
- 删除用户时联动清理发电数据
- `/health` 版本号与项目版本保持一致

### 3. 前端性能与可维护性

- 将月统计、日统计、总计改为 `computed` 缓存
- 优化了按月加载发电数据时的映射方式，减少不必要遍历
- 整理了 `Dashboard.vue` 中混乱的模板结构

### 4. 用户体验

- 增加了页面级 loading 和操作级 loading
- 增加了接口失败时的统一错误提示
- 增加了空状态和无数据状态视觉引导
- 总览卡片在空状态下使用更自然的提示文案，而不是直接显示 `0.00`

## 后续建议

如果继续迭代，建议优先考虑：

- 为后端接口补更多边界测试
- 为前端补“保存成功/失败”的更细颗粒反馈
- 抽离 API 层和通用状态管理，进一步降低 `Dashboard.vue` 复杂度
- 增加导出报表、筛选、历史月份对比等业务能力
