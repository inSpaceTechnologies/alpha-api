/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
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

const unknownError = (err) => {
  err.sendMessage = 'Unknown error';
  err.logStack = true;
  err.status = 500;
  return err;
};

module.exports = { errorHandler, unknownError };
