const express = require('express');
const mongoose = require('mongoose');

const env = process.env.NODE_ENV;
console.log("Envoroment: " + env);
const config = require('./config')[env];

const app = express();

function errorHandler(err, req, res, next) {
  if (!err.status) {
    err.status = 500;
  }
  if (err.log) {
    console.error(err.message)
  }
  if (err.logStack) {
    console.error(err.stack)
  }
  res.status(err.status).send(err.message);
}

app.get('/', (req, res, next) => {
  var err = new Error("This is the error message");
  err.status = 404;
  err.log = true;
  err.logStack = false;
  next(err);
  //res.send('Hello World.');
});



mongoose.connect(config.mongo.uri);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {

  console.log("Connected to database.");

  app.use(errorHandler);


  const port = config.server.port;
  app.listen(port, () => {
    console.log('Express listening on port ' + port + '.');
  });

});
