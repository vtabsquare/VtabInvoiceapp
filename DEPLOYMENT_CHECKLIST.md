# VTAB Invoice App Deployment Checklist

## Pre-Deployment ✅
- [x] .gitignore created and includes .env files
- [x] .env.example created for backend configuration
- [x] Backend port set to 5001 (to avoid conflicts)
- [x] Production scripts added to package.json
- [x] PM2 configuration created
- [x] Nginx configuration template created
- [x] Deployment scripts created

## GitHub Repository Setup
- [ ] Configure GitHub credentials on your machine
- [ ] Push the repository to GitHub
  ```bash
  git push -u origin master
  ```

## DigitalOcean Deployment

### 1. Connect to your droplet
```bash
ssh root@your_droplet_ip
```

### 2. Download and run the deployment script
```bash
# Download the script
wget https://raw.githubusercontent.com/vtabsquare/VtabInvoiceapp/master/digitalocean-deploy.sh

# Make it executable
chmod +x digitalocean-deploy.sh

# Run the script
sudo ./digitalocean-deploy.sh
```

### 3. Post-Deployment Configuration
- [ ] Edit the environment file with actual values:
  ```bash
  nano /var/www/vtab-invoice/backend/.env
  ```
- [ ] Update server_name in Nginx configuration:
  ```bash
  nano /etc/nginx/sites-available/vtab-invoice
  ```
- [ ] Restart the application:
  ```bash
  pm2 restart vtab-invoice-backend
  ```

### 4. Verify Deployment
- [ ] Check if backend is running: `curl http://localhost:5001`
- [ ] Check if frontend is accessible: `curl http://your_droplet_ip`
- [ ] Check PM2 status: `pm2 status`
- [ ] Check Nginx status: `systemctl status nginx`

### 5. Optional: Setup SSL
- [ ] Install Certbot: `apt install certbot python3-certbot-nginx`
- [ ] Get SSL certificate: `certbot --nginx -d your_domain.com`

## Important Notes
1. **Port Configuration**: The app uses port 5001 for backend to avoid conflicts with existing apps
2. **Environment Variables**: Never commit actual .env file to Git
3. **Security**: 
   - Use strong passwords
   - Keep Node.js and dependencies updated
   - Configure firewall properly
4. **Monitoring**: Use `pm2 monit` to monitor the application
5. **Logs**: Check logs in `/var/www/vtab-invoice/logs/` or use `pm2 logs`

## Troubleshooting
- If port 5001 is in use, edit ecosystem.config.js and nginx config to use another port
- Check logs: `pm2 logs vtab-invoice-backend`
- Restart services: `pm2 restart all` and `systemctl reload nginx`
- Check permissions: `chown -R www-data:www-data /var/www/vtab-invoice`
