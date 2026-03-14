# VTAB Invoice App Deployment Guide

## Prerequisites
- Node.js (v18 or higher)
- PM2 or systemd
- Nginx (for serving frontend)
- Git

## Deployment Steps

### 1. Clone the Repository
```bash
git clone https://github.com/vtabsquare/VtabInvoiceapp.git
cd VtabInvoiceapp
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all dependencies at once
npm run install-deps
```

### 3. Configure Environment Variables
```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Edit the environment file with your production values
nano backend/.env
```

**Important:** Use a different port (e.g., 5001) to avoid conflicts with existing apps.

### 4. Build the Frontend
```bash
npm run build
```

### 5. Option A: Deploy with PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 6. Option B: Deploy with Systemd
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment script
sudo ./deploy.sh
```

### 7. Configure Nginx
Create an Nginx configuration file at `/etc/nginx/sites-available/vtab-invoice`:

```nginx
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain or IP

    # Frontend static files
    location / {
        root /path/to/VtabInvoiceapp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/vtab-invoice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Configure SSL (Optional but Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your_domain.com
```

## Port Configuration
- Frontend: Served by Nginx on port 80/443
- Backend: Running on port 5001 (configured in .env)
- Make sure port 5001 is not in use by other applications

## Monitoring
- With PM2: `pm2 monit`
- With systemd: `sudo systemctl status vtab-invoice`

## Logs
- PM2 logs: `pm2 logs`
- Systemd logs: `sudo journalctl -u vtab-invoice -f`

## Updating the Application
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm run install-deps

# Rebuild frontend
npm run build

# Restart with PM2
pm2 restart vtab-invoice-backend

# Or restart with systemd
sudo systemctl restart vtab-invoice
```

## Security Notes
- Ensure your .env file is never committed to version control
- Use strong passwords and consider using app-specific passwords for email
- Regularly update dependencies
- Configure firewall to only allow necessary ports
