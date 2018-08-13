/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const express = require('express');
const hash = require('pbkdf2-password')();
const jwt = require('jsonwebtoken');

const config = require('../config');
const { unknownError } = require('../middleware/error');

// middleware
const { authenticationMiddleware } = require('../middleware/auth');

// models
const { User } = require('../models/user');

const router = express.Router();

router.post('/auth/register', (req, res, next) => {
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

router.post('/auth/login', (req, res, next) => {
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

router.get('/auth/user', authenticationMiddleware, (req, res) => {
  res.json({
    status: 'success',
    data: req.user,
  });
});

router.get('/auth/refresh', authenticationMiddleware, (req, res) => {
  const token = jwt.sign(payload(req.user), config.jwt.secret, { expiresIn: '1h' });

  res.set({
    'access-control-expose-headers': 'Authorization',
    authorization: token,
  });

  res.json({
    status: 'success',
  });
});

module.exports = router;
