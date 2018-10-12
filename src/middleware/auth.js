/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const ecc = require('eosjs-ecc');
const { User } = require('../models/user');
const config = require('../config');

const authenticationMiddleware = async (req, res, next) => {
  const publicKey = req.header('public-key');
  const signature = req.header('signature');
  const expirationDate = req.header('expiration-date');

  // vetrify that the expiration date was signed by the owner of the given key
  const result = ecc.verify(signature, expirationDate, publicKey);

  if (!result || expirationDate < Date.now()) {
    res.status(403).send('Failed authentication.');
  }

  let user = await User.findOne({ publicKey });
  if (!user) {
    user = new User({ publicKey });
    await user.save();
  }

  req.user = {
    id: user.id,
    publicKey,
  };
  return next();
};

const adminCheck = (req, res, next) => {
  if (req.user && config.admins.includes(req.user.publicKey)) {
    return next();
  }
  return res.status(403).send('Must be admin.');
};

module.exports = { authenticationMiddleware, adminCheck };
