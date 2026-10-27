# Multi-stage build — context PHẢI là gốc repo (docker-compose.yml build.context: .), vì stage 1
# cần client/ và stage 2 cần server/. Layout trong image CỐ Ý giữ nguyên "server/ + client/dist là
# sibling" giống hệt lúc chạy thật trên máy thường (build client rồi NODE_ENV=production node
# server.js từ server/) — app.js dùng path.join(__dirname, '..', 'client', 'dist'), không cần biết
# gì khác khi chạy trong Docker.

# ---- Stage 1: build client (Vite) ----
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# '/api' khớp đúng default mới của client/src/api/apiClient.js (đường dẫn tương đối, cùng origin —
# server/app.js phục vụ cả client/dist lẫn /api/* trên CÙNG 1 server khi NODE_ENV=production). Khai
# ARG để build-arg ngoài có thể override nếu triển khai tách origin (API/CDN riêng) — mặc định không
# cần set gì thêm. client/.env (dev, bị .dockerignore loại khỏi build context) không ảnh hưởng ở đây.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- Stage 2: server runtime (Express phục vụ luôn client/dist khi NODE_ENV=production) ----
FROM node:24-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
