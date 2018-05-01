const express = require('express');
const mongoose = require('mongoose');

const env = process.env.NODE_ENV;
console.log("Envoroment: " + env);
const config = require('./config')[env];

const app = express();

app.get('/', (req, res) => {
  res.send('Hello World.');
});



mongoose.connect(config.mongo.uri);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {

  console.log("Connected to database.");

  const port = config.server.port;
  app.listen(port, () => {
  console.log('Express listening on port ' + port + '.');
  });

});
