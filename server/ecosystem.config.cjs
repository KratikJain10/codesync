// PM2 Cluster Config — Run multiple Node.js instances to use all CPU cores.
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
    apps: [
        {
            name: 'codesync-server',
            script: 'dist/index.js',
            instances: 'max',        // One instance per CPU core
            exec_mode: 'cluster',    // Cluster mode for load balancing
            env: {
                NODE_ENV: 'production',
            },
            max_memory_restart: '512M',
            error_file: './logs/error.log',
            out_file: './logs/output.log',
            merge_logs: true,
            // Graceful restart
            kill_timeout: 5000,
            listen_timeout: 8000,
            // Watch (disabled in prod)
            watch: false,
        },
    ],
};
