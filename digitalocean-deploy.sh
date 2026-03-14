#!/bin/bash

# DigitalOcean Deployment Script for VTAB Invoice App
# Run this script on your DigitalOcean droplet

# Exit on any error
set -e

echo "=== VTAB Invoice App DigitalOcean Deployment ==="
echo "This script will deploy the app without conflicting with existing applications"

# Configuration
APP_NAME="vtab-invoice"
APP_DIR="/var/www/$APP_NAME"
SERVICE_NAME="$APP_NAME"
BACKEND_PORT=5001
DOMAIN_OR_IP="your_domain_or_ip"  # CHANGE THIS

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script with sudo"
    exit 1
fi

# Check if port 5001 is available
if netstat -tuln | grep -q ":$BACKEND_PORT "; then
    print_error "Port $BACKEND_PORT is already in use!"
    echo "Please check which application is using this port:"
    echo "sudo netstat -tuln | grep :$BACKEND_PORT"
    exit 1
fi

print_status "Port $BACKEND_PORT is available"

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    print_status "Installing Nginx..."
    apt install -y nginx
fi

# Create app directory
print_status "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone the repository
print_status "Cloning the repository..."
if [ -d "$APP_DIR/.git" ]; then
    print_warning "Repository already exists, pulling latest changes..."
    git pull origin master
else
    git clone https://github.com/vtabsquare/VtabInvoiceapp.git .
fi

# Install dependencies
print_status "Installing dependencies..."
npm install
cd frontend
npm install
cd ..

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build
cd ..

# Create production environment file
print_status "Setting up production environment..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    print_warning "Please edit $APP_DIR/backend/.env with your production values!"
    print_warning "Run: nano $APP_DIR/backend/.env"
fi

# Create logs directory
mkdir -p logs

# Set proper permissions
print_status "Setting permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN_OR_IP;

    # Frontend static files
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx

# Setup UFW firewall
print_status "Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

print_status "=== Deployment Complete! ==="
echo ""
echo "Application Details:"
echo "- Backend running on port: $BACKEND_PORT"
echo "- Frontend served by Nginx on port 80"
echo "- App directory: $APP_DIR"
echo "- PM2 status: pm2 status"
echo "- Nginx config: /etc/nginx/sites-available/$APP_NAME"
echo ""
print_warning "IMPORTANT:"
echo "1. Edit the environment file: nano $APP_DIR/backend/.env"
echo "2. Update server_name in Nginx config: nano /etc/nginx/sites-available/$APP_NAME"
echo "3. Restart the app after updating .env: pm2 restart vtab-invoice-backend"
echo "4. Consider setting up SSL with Let's Encrypt: certbot --nginx -d your_domain.com"
