module.exports = {
  apps : [
    {
      name      : 'inspace-api',
      script    : 'app.js',
      env: {
        NODE_ENV: "development"
      },
      env_production : {
        NODE_ENV: 'production'
      }
    }
  ]
};
