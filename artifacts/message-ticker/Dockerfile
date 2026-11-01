FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV PORT=4173
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @workspace/message-ticker... \
  && pnpm --filter @workspace/message-ticker run build

FROM nginx:stable-alpine AS runtime

COPY artifacts/message-ticker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/message-ticker/dist/public /usr/share/nginx/html

EXPOSE 80
