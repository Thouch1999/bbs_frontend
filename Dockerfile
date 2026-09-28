# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Uploaded media (apps.core.factories.paid_booking-style licence documents,
# bus photos) is bind-mounted here from the shared bbms_media_data volume —
# see docker-compose.prod.yml. Created so nginx doesn't 404 the whole
# /media/ location before the volume is ever mounted (e.g. `docker build`
# alone, without compose).
RUN mkdir -p /usr/share/nginx/media /usr/share/nginx/static

EXPOSE 80
