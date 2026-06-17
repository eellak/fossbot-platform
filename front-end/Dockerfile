# Warning: This dockerfile will not include the external `sim` dependency from the root
# of the project. As of writing this, the "correct" way to run containerized development
# is to run `docker compose -f docker-compose.dev.yml up` from the root.
FROM node:18-alpine

WORKDIR /usr/src/app/front-end

COPY package*.json ./

RUN npm install

ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

EXPOSE 3000

CMD ["npm", "start"]
