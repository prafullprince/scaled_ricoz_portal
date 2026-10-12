module.exports = {
  apps: [
    {
      name: "ricoz-api",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "750M",
      kill_timeout: 15000,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
  ],
};