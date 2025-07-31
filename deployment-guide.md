# Deployment Guide for Saath Server

## Prerequisites
- Ubuntu 22.04 LTS server on AWS EC2
- Domain name (optional but recommended)
- Git repository with your code

## Step 1: Server Setup

### 1.1 Connect to your Ubuntu server
```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

### 1.2 Update system
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Node.js and npm
```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.4 Install Yarn (since your project uses Yarn)
```bash
npm install -g yarn
```

### 1.5 Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### 1.6 Install Nginx (Reverse Proxy)
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.7 Install MongoDB (if not using cloud MongoDB)
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

## Step 2: Application Deployment

### 2.1 Clone your repository
```bash
cd /home/ubuntu
git clone https://github.com/your-username/your-repo.git saath-server
cd saath-server/server
```

### 2.2 Install dependencies
```bash
yarn install --production
```

### 2.3 Create environment file
```bash
nano .env
```

Add your environment variables:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/saath
JWT_SECRET=your-super-secret-jwt-key
# Add other environment variables as needed
```

### 2.4 Start application with PM2
```bash
pm2 start index.js --name "saath-server"
pm2 save
pm2 startup
```

## Step 3: Nginx Configuration

### 3.1 Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/saath-server
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com; # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Handle file uploads
    client_max_body_size 50M;
}
```

### 3.2 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/saath-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4: SSL Certificate (Optional but Recommended)

### 4.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 4.2 Get SSL certificate
```bash
sudo certbot --nginx -d your-domain.com
```

## Step 5: Firewall Configuration

### 5.1 Configure UFW firewall
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 6: Monitoring and Logs

### 6.1 PM2 monitoring
```bash
pm2 monit
pm2 logs saath-server
```

### 6.2 Nginx logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Step 7: Automated Deployment Script

Create a deployment script for future updates:

```bash
nano deploy.sh
```

```bash
#!/bin/bash
echo "Starting deployment..."

# Pull latest changes
git pull origin main

# Install dependencies
yarn install --production

# Restart application
pm2 restart saath-server

echo "Deployment completed!"
```

Make it executable:
```bash
chmod +x deploy.sh
```

## Step 8: Environment Variables Checklist

Make sure these are set in your `.env` file:
- `NODE_ENV=production`
- `PORT=3000`
- `MONGODB_URI`
- `JWT_SECRET`
- Any API keys for external services
- Email configuration (if using email features)
- File upload paths

## Troubleshooting

### Check if application is running
```bash
pm2 status
pm2 logs saath-server
```

### Check Nginx status
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Check MongoDB status
```bash
sudo systemctl status mongod
```

### View real-time logs
```bash
pm2 logs saath-server --lines 100
```

## Security Best Practices

1. **Keep system updated**: `sudo apt update && sudo apt upgrade`
2. **Use strong passwords**: Change default passwords
3. **Regular backups**: Set up automated backups
4. **Monitor logs**: Check logs regularly for issues
5. **Firewall**: Only open necessary ports
6. **SSL**: Always use HTTPS in production

## Next Steps

1. Set up automated backups
2. Configure monitoring (like New Relic or DataDog)
3. Set up CI/CD pipeline
4. Configure log rotation
5. Set up health checks

Your server should now be running at `http://your-domain.com` (or your server IP if no domain). 