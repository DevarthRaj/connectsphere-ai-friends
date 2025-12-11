ConnectSphere 🌐

ConnectSphere is a modern, real-time chat application featuring a glassmorphism UI and a powerful integrated AI assistant. It allows users to chat with each other and interact with Google's Gemini AI seamlessly.

🚀 Features

Real-time Messaging: Powered by Supabase Realtime.

AI Assistant: Integrated Google Gemini 1.5 Flash bot for instant answers and conversations.

Modern UI: Built with shadcn-ui and Tailwind CSS, featuring a sleek glassmorphism aesthetic.

Secure Auth: Full user authentication handling via Supabase Auth.

Dockerized: Fully containerized for consistent deployment across environments.

Automated Deployment: CI/CD pipeline using GitHub Actions and Watchtower.

🛠️ Tech Stack

Frontend: React, Vite, TypeScript

Styling: Tailwind CSS, Lucide Icons, shadcn-ui

Backend/DB: Supabase (PostgreSQL, Auth, Realtime)

AI: Google Generative AI SDK (Gemini)

DevOps: Docker, Docker Compose, Nginx, AWS EC2, Watchtower

🏃‍♂️ Local Development

Prerequisites

Node.js & npm

Git

1. Clone the repository

git clone <YOUR_GIT_URL>
cd ConnectSphere


2. Configure Environment

Create a .env file in the root directory:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_google_gemini_api_key


3. Install & Run

npm install
npm run dev


The app will be available at http://localhost:5173.

🐳 Docker Setup

This project is optimized for Docker. You can build and run it locally or on a server.

Build the Image

Note: You must pass build arguments because Vite bakes environment variables into the static build.

docker build \
  --build-arg VITE_SUPABASE_URL="your_url" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="your_key" \
  --build-arg VITE_GEMINI_API_KEY="your_key" \
  -t connectsphere:latest .


Run with Docker Compose

We use Watchtower to automatically update the container whenever a new image is pushed to Docker Hub.

# docker-compose.yml
version: '3.8'
services:
  web:
    image: devarthraj/connectsphere:latest
    ports:
      - "80:80"
    restart: always

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 30
    restart: always


Run it:

docker-compose up -d


☁️ Deployment Architecture

The "Zero-Touch" Workflow

Develop: Push code changes to GitHub.

Build: GitHub Actions builds the Docker image and pushes it to Docker Hub.

Deploy: Watchtower (running on the AWS server) detects the new image within 30 seconds and automatically updates the live website.

Manual Update (Fallback)

If you need to restart the server manually:

ssh ubuntu@<YOUR_AWS_IP>
sudo docker-compose up -d --force-recreate


📄 License

This project is open source.