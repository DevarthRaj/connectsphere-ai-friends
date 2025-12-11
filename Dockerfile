# Stage 1: Build the React application
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
# using 'ci' (clean install) is faster and more reliable for builds
RUN npm ci

# Copy the rest of your application code
COPY . .

# --- FIX START ---
# We must declare the ARGs here so they are available during the build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_GEMINI_API_KEY

# We then set them as ENV variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
# --- FIX END ---

# Build the application
# This creates the 'dist' folder with your static files
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine as production

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the builder stage to Nginx's serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]