var config = {
  development: {
      //server details
      server: {
          port: '3000'
      }
  }
};

// same for now
config.production = config.development;

module.exports = config;
