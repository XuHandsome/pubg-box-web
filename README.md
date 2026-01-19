# PUBG Box Web

基于 Vue 3 + TypeScript + Vite 构建的 PUBG 战绩查询与回放系统前端。

## 功能特性

- **玩家战绩查询**：输入玩家名称，实时查看最近对局记录、KDA、平均伤害等核心指标。
- **对局趋势图表**：基于 ECharts 的多维数据可视化，展示排名、击杀、伤害的变化趋势。
- **2D 对局回放**：
  - **Leaflet 地图渲染**：支持所有 PUBG 地图（Erangel/Miramar/Sanhok/Vikendi 等）。
  - **实时状态回放**：玩家位置、血量、装备、开火特效实时同步。
  - **聚焦视角跟随**：点击玩家自动锁定视角，并渲染锥形可视区域。
  - **空投、安全区、航线**：完整呈现比赛关键要素。
  - **战况播报**：实时展示击杀、击倒、扶起事件，点击即可跳转时间轴。
- **响应式设计**：适配桌面端和移动端，支持深色主题。

## 开发环境

### 依赖安装
`nodejs version v24.13.0`

```bash
npm install
```

### 本地运行
```bash
npm run dev
```

开发环境下，Vite 会自动将 `/api` 请求代理到 `http://localhost:8080/v1`。请确保后端服务已启动。

### 构建生产版本
```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## Docker 部署

### 构建镜像
```bash
docker build -t pubg-box-web:latest .
```

### 运行容器
部署时可以通过环境变量 `BACKEND_ADDR` 动态指定后端 API 地址，无需重新构建镜像。

```bash
docker run -d \
  -p 80:80 \
  -e BACKEND_ADDR=http://your-backend-api:8080 \
  pubg-box-web:latest
```

**原理说明**：
- 前端构建时将所有 API 请求统一指向 `/api` 相对路径。
- Caddy 作为 Web 服务器，在运行时根据环境变量 `BACKEND_ADDR` 动态将 `/api` 请求转发到后端。
- 这种方式实现了前后端地址的完全解耦，不同环境部署无需重新构建镜像。

### 完整部署方案

推荐使用后端项目中的 `docker-compose/docker-compose.yaml` 进行完整部署，该方案已经包含了：
- MySQL：数据库服务
- Redis：缓存服务
- pubg-box：后端 API 服务
- pubg-box-web：前端 Web 服务

详细部署步骤请参考后端项目中的 `docker-compose/README.md`。

## 技术栈

- **框架**：Vue 3 (Composition API) + TypeScript
- **构建工具**：Vite 6
- **UI 组件**：Element Plus
- **状态管理**：Vue Router 4
- **地图库**：Leaflet 1.9+
- **图表库**：Apache ECharts 5+
- **HTTP 客户端**：Axios
- **Web 服务器**：Caddy 2 (在 Docker 镜像中)
