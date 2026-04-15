module.exports = {
  apps: [
    {
      name: 'zephyrcloud-metrics-bridge',
      cwd: __dirname,
      script: './server.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 40177,
      },
    },
  ],
};
