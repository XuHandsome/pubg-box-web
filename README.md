# PUBG Box Web

基于 Vue 3 + TypeScript + Vite 构建的 PUBG 战绩查询与回放系统前端。

## 部署说明

项目使用 Docker 进行部署，采用 Caddy 作为 Web 服务器，并通过反向代理处理 API 请求。

### 构建镜像
```bash
docker build -t pubg-box-web .
```

### 运行容器
部署时可以通过环境变量 `BACKEND_ADDR` 动态指定后端 API 地址，无需重新构建镜像。

```bash
docker run -d \
  -p 80:80 \
  -e BACKEND_ADDR=http://your-backend-api:8080/v1 \
  pubg-box-web
```

## 开发环境配置

- **API 代理**：开发环境下，Vite 会将 `/api` 开头的请求代理到 `http://localhost:8080/v1`。
- **运行项目**：`npm run dev`
- **构建项目**：`npm run build` (包含 TypeScript 类型检查)
