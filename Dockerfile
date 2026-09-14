# DEFAULT Docker image = Vite game (tranquil-comfort / roguepiece.freakydev.com)
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public

ARG VITE_API_URL=https://api.roguepiece.freakydev.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve@14.2.6
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
