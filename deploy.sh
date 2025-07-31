#!/bin/bash

# Saath Server Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting Saath Server Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the server directory."
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install git first."
    exit 1
fi

# Check if yarn is available
if ! command -v yarn &> /dev/null; then
    print_warning "Yarn not found. Installing yarn..."
    npm install -g yarn
fi

# Check if pm2 is available
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found. Installing PM2..."
    npm install -g pm2
fi

print_status "Pulling latest changes from git..."
git pull origin main

print_status "Installing dependencies..."
yarn install --production

print_status "Checking if .env file exists..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please create one with your environment variables."
    print_status "Creating .env.example..."
    cat > .env.example << EOF
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/saath
JWT_SECRET=your-super-secret-jwt-key
# Add other environment variables as needed
EOF
    print_error "Please create a .env file with your actual environment variables."
    exit 1
fi

print_status "Restarting application with PM2..."

# Check if the app is already running
if pm2 list | grep -q "saath-server"; then
    print_status "Restarting existing PM2 process..."
    pm2 restart saath-server
else
    print_status "Starting new PM2 process..."
    pm2 start index.js --name "saath-server"
fi

# Save PM2 configuration
pm2 save

print_status "Checking application status..."
sleep 2

# Check if the application is running
if pm2 list | grep -q "online.*saath-server"; then
    print_status "✅ Application deployed successfully!"
    print_status "PM2 Status:"
    pm2 status
else
    print_error "❌ Application failed to start. Check logs:"
    pm2 logs saath-server --lines 20
    exit 1
fi

print_status "🎉 Deployment completed successfully!"
print_status "You can monitor your application with: pm2 monit"
print_status "View logs with: pm2 logs saath-server" 