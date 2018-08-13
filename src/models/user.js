/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  email: { type: String, unique: true, required: true },
  salt: { type: String, required: true },
  passwordHash: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

module.exports = { User };
