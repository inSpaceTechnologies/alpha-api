/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const expressjwt = require('express-jwt');

const config = require('../config');

const authenticationMiddleware = expressjwt({ secret: config.jwt.secret });

const adminCheck = (req, res, next) => {
  if (config.admins.includes(req.user.email)) {
    next();
    return;
  }
  res.status(403).send('Must be admin.');
};

module.exports = { authenticationMiddleware, adminCheck };
