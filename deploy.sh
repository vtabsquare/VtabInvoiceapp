#!/bin/bash

# VTAB Invoice App Deployment Script for DigitalOcean

# Exit on any error
set -e

echo "Starting VTAB Invoice App deployment..."

# Set variables
APP_NAME="vtab-invoice"
APP_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
SERVICE_NAME="$APP_NAME"
FRONTEND_PORT=3000
BACKEND_PORT=5001

# Create app directory if it doesn't exist
sudo mkdir -p $APP_DIR
sudo mkdir -p $BACKUP_DIR

# Copy files to app directory
echo "Copying application files..."
sudo cp -r . $APP_DIR/
cd $APP_DIR

# Install dependencies
echo "Installing dependencies..."
sudo npm install
cd frontend
sudo npm install
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
sudo npm run build
cd ..

# Create production environment file
echo "Setting up production environment..."
if [ ! -f backend/.env ]; then
    sudo cp backend/.env.example backend/.env
    echo "Please edit backend/.env with your production values"
fi

# Set proper permissions
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR

# Create systemd service for backend
echo "Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=VTAB Invoice Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create nginx configuration
echo "Configuring nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain or IP

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

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo nginx -t

# Reload and start services
echo "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME
sudo systemctl reload nginx

echo "Deployment completed successfully!"
echo "Backend running on port: $BACKEND_PORT"
echo "Frontend served by nginx on port 80"
echo "Please configure your domain name in /etc/nginx/sites-available/$APP_NAME"
