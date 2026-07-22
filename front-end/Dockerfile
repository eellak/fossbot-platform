# Use a maintained Node.js runtime compatible with the v3 npm lockfile
FROM node:20-alpine AS build-stage

# Set the working directory in the container
WORKDIR /usr/src/app/front-end

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the exact dependency versions captured in package-lock.json
RUN npm ci

# Copy the rest of the application code to the working directory
COPY . .

# react-scripts automatically loads .env.production for production builds
RUN npm run build


# Stage 2: Serve the app using a lightweight server
FROM nginx:stable-alpine AS production-stage

# Copy the built assets from the build stage to the nginx server directory
COPY --from=build-stage /usr/src/app/front-end/build /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Expose the port nginx is reaching on
EXPOSE 80

# Define the command to run your application
CMD ["nginx", "-g", "daemon off;"]
