const express = require('express');
const app = express();

const env = process.env.NODE_ENV;
console.log("Envoroment: " + env);
const config = require('./config')[env];

app.get('/', (req, res) => {
  res.send('Hello World.');
});

const port = config.server.port;
app.listen(port, () => {
  console.log('Express listening on port ' + port + '.');
});
