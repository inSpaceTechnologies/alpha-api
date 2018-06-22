/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
/* eslint no-shadow: ["error", { "allow": ["err"] }] */

const express = require('express');
const mongoose = require('mongoose');
const hash = require('pbkdf2-password')();
const jwt = require('jsonwebtoken');
const expressjwt = require('express-jwt');
const cors = require('cors');
const bodyParser = require('body-parser');
const IPFSFactory = require('ipfsd-ctl');
const Busboy = require('busboy');

const env = process.env.NODE_ENV;
console.log(`Enviroment: ${env}`);
const config = require('./config')[env];

const app = express();

const authenticationMiddleware = expressjwt({ secret: config.jwt.secret });

const adminCheck = (req, res, next) => {
  if (config.admins.includes(req.user.email)) {
    next();
    return;
  }
  res.status(403).send('Must be admin.');
};

const errorHandler = (err, req, res, next) => {
  if (!err.status) {
    err.status = 400;
  }
  if (!err.sendMessage) {
    err.sendMessage = err.message;
  }
  if (err.log) {
    console.error(err.message);
  }
  if (err.logStack) {
    console.error(err.stack);
  }
  res.status(err.status).send(err.sendMessage);
};

function unknownError(err) {
  err.sendMessage = 'Unknown error';
  err.logStack = true;
  err.status = 500;
  return err;
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World.');
});

mongoose.connect(config.mongo.uri);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to database.');

  const userSchema = mongoose.Schema({
    email: { type: String, unique: true },
    salt: String,
    passwordHash: String,
  });
  const User = mongoose.model('User', userSchema);

  app.post('/auth/register', (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
      next(new Error('You must supply an email address.'));
      return;
    }

    User.findOne({ email }, (err, user) => {
      if (err) {
        next(unknownError(err));
        return;
      }
      if (user) {
        next(new Error('Email address in use.'));
        return;
      }

      hash({ password }, (err, pass, salt, passwordHash) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        // store the salt & hash in the database
        const userEntry = new User({
          email,
          salt,
          passwordHash,
        });
        userEntry.save((err) => {
          if (err) {
            next(unknownError(err));
            return;
          }
          res.sendStatus(200);
        });
      });
    });
  });

  function payload(user) {
    const roles = [];
    if (config.admins.includes(user.email)) {
      roles.push('admin');
    }
    return {
      id: user.id,
      email: user.email,
      roles,
    };
  }

  app.post('/auth/login', (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
      next(new Error('You must supply an email address.'));
      return;
    }

    User.findOne({ email }, (err, user) => {
      if (err) {
        next(unknownError(err));
        return;
      }
      if (!user) {
        next(new Error('Email address not found.'));
        return;
      }

      hash({ password, salt: user.salt }, (err, pass, salt, passwordHash) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        if (passwordHash !== user.passwordHash) {
          next(new Error('Wrong password.'));
          return;
        }
        const token = jwt.sign(payload(user), config.jwt.secret, { expiresIn: '1h' });

        res.set({
          'access-control-expose-headers': 'Authorization',
          authorization: token,
        });

        res.json({
          status: 'success',
        });
      });
    });
  });

  app.get('/auth/user', authenticationMiddleware, (req, res) => {
    res.json({
      status: 'success',
      data: req.user,
    });
  });

  app.get('/auth/refresh', authenticationMiddleware, (req, res) => {
    const token = jwt.sign(payload(req.user), config.jwt.secret, { expiresIn: '1h' });

    res.set({
      'access-control-expose-headers': 'Authorization',
      authorization: token,
    });

    res.json({
      status: 'success',
    });
  });

  app.get('/restricted', authenticationMiddleware, (req, res) => {
    res.send(`You have passed authentication. User id: ${req.user.id} Email: ${req.user.email}`);
  });

  app.get('/admin', authenticationMiddleware, adminCheck, (req, res) => {
    res.send(`You are an admin. User id: ${req.user.id} Email: ${req.user.email}`);
  });

  const ipfsFactory = IPFSFactory.create();
  const { path } = config.ipfs;

  ipfsFactory.spawn({
    disposable: false,
    repoPath: path,
    init: false,
    start: false,
    config: {
      API: {
        HTTPHeaders: {
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Credentials': ['true'],
          'Access-Control-Allow-Methods': ['PUT', 'POST', 'GET'],
        },
      },
      Addresses: {
        Swarm: ['/ip4/0.0.0.0/tcp/4002'],
        API: '/ip4/0.0.0.0/tcp/5002',
        Gateway: '/ip4/0.0.0.0/tcp/8081',
      },
    },
  }, (err, ipfsd) => {
    if (err) {
      console.log('IPFS daemon spawn error');
      console.log(err);
      return;
    }
    console.log('IPFS daemon spawned.');

    let ipfsAPI = null;

    app.put('/ipfs/init', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsd.init({
        keysize: 2048,
        path,
      }, (err) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        res.sendStatus(200);
      });
    });

    app.put('/ipfs/delete', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsd.cleanup((err) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        res.sendStatus(200);
      });
    });

    app.get('/ipfs/started', authenticationMiddleware, adminCheck, (req, res, next) => {
      res.json(ipfsd.started);
    });

    app.put('/ipfs/start', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsd.start([], (err, api) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        ipfsAPI = api;
        res.sendStatus(200);
      });
    });

    app.put('/ipfs/stop', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsd.stop((err) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        res.sendStatus(200);
      });
    });

    app.get('/ipfs/config', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsd.getConfig((err, conf) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        res.json(conf);
      });
    });

    app.post('/ipfs/upload', authenticationMiddleware, (req, res, next) => {
      const busboy = new Busboy({ headers: req.headers });

      busboy.on('file', (fieldname, file /* ,filename, encoding, mimetype */) => {
        ipfsAPI.files.add(file, (err, data) => {
          if (err) {
            next(unknownError(err));
            return;
          }
          res.send({ hash: data[0].hash });
        });
      });
      return req.pipe(busboy);
    });

    app.get('/ipfs/pin/ls', authenticationMiddleware, adminCheck, (req, res, next) => {
      ipfsAPI.pin.ls((err, pinset) => {
        if (err) {
          throw err;
        }
        res.json({ pinset });
      });
    });

    app.use(errorHandler);

    const { port } = config.server;
    app.listen(port, () => {
      console.log(`Express listening on port ${port}.`);
    });
  });
});
