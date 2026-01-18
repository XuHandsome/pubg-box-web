FROM harbor.ohops.org/docker.io/node:24.13.0-alpine3.23 AS builder

WORKDIR /app/code

# 先只复制 package.json 相关文件，以利用 Docker 缓存层
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install

# 复制其余源代码并执行构建
COPY . .
RUN npm run build



FROM harbor.ohops.org/docker.io/caddy:2.10.2-alpine

# 从 builder 阶段复制构建好的静态资源到 Caddy 默认目录
COPY --from=builder /app/code/dist /usr/share/caddy

# 复制自定义的 Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# 设置默认后端地址（生产部署时可通过环境变量覆盖）
ENV BACKEND_ADDR=http://localhost:8080/v1

EXPOSE 80
EXPOSE 443