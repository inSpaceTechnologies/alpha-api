/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const config = require('./config');
const error = require('./middleware/error');
const purchaseManager = require('./purchase');

// routes
const purchaseRouter = require('./routes/purchase');

// middleware
const { authenticationMiddleware, adminCheck } = require('./middleware/auth');

const app = express();

app.use(morgan(config.morgan.format));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.use(cors());

// test route
app.get('/', (req, res) => {
  res.send(`Enviroment: ${process.env.NODE_ENV}`);
});

// connect to mongoose
mongoose.Promise = global.Promise;
mongoose.connect(config.mongo.uri, { useNewUrlParser: true, useCreateIndex: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to database.');

  // add purchase routes
  app.use(purchaseRouter);
  purchaseManager.init();

  // test routes
  app.get('/restricted', authenticationMiddleware, (req, res) => {
    res.send(`You have passed authentication. User id: ${req.user.id}`);
  });
  app.get('/admin', authenticationMiddleware, adminCheck, (req, res) => {
    res.send(`You are an admin. User id: ${req.user.id}`);
  });

  app.use(error.errorHandler);

  const { port } = config.server;
  app.listen(port, () => {
    console.log(`Express listening on port ${port}.`);
  });
});
