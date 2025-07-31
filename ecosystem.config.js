module.exports = {
  apps: [{
    name: 'saath-server',
    script: 'index.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging configuration
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart configuration
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Watch configuration (for development)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    
    // Environment variables
    env_file: '.env',
    
    // Health check
    health_check_grace_period: 3000,
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Listen timeout
    listen_timeout: 8000,
    
    // PM2 specific
    pmx: true,
    source_map_support: true,
    
    // Node.js specific
    node_args: '--max-old-space-size=1024'
  }]
}; 