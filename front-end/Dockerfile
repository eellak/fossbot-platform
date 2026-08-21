FROM node:20-alpine AS build-stage

WORKDIR /usr/src/app

COPY front-end/package*.json ./front-end/

WORKDIR /usr/src/app/front-end
RUN npm ci

WORKDIR /usr/src/app
COPY sim ./sim
COPY front-end ./front-end

RUN cd sim && npm run sync:frontend

WORKDIR /usr/src/app/front-end
RUN npm run build

FROM nginx:stable-alpine AS production-stage

COPY --from=build-stage /usr/src/app/front-end/build /usr/share/nginx/html
COPY front-end/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
