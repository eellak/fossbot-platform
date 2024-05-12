# Use an official Node.js runtime as a base image
FROM node:14-alpine as build-stage

# Set the working directory in the container
WORKDIR /usr/src/app/front-end

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Install env-cmd globally
RUN npm install -g env-cmd

# Build the React app
RUN env-cmd -f .env.production npm run build


# Stage 2: Serve the app using a lightweight server
FROM nginx:stable-alpine as production-stage

# Copy the built assets from the build stage to the nginx server directory
COPY --from=build-stage /usr/src/app/front-end/build /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Expose the port nginx is reaching on
EXPOSE 80

# Define the command to run your application
CMD ["nginx", "-g", "daemon off;"]
