# Use an official Node.js runtime as a base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /usr/src/app/front-end

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./



# Copy the rest of the application code to the working directory
COPY . .

# Install dependencies
RUN npm install

# # Build the React app
# RUN npm run build

# Expose the port that the app will run on
EXPOSE 3000

# Define the command to run your application
CMD ["npm", "run", "dev"]
