/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema;

const ipfsFileSchema = mongoose.Schema({
  hash: { type: String, unique: false, required: true }, // not unique -- different people may have the same file
  user: { type: ObjectId, required: true },
  size: { type: Number, required: true },
});
const IPFSFile = mongoose.model('IPFSFile', ipfsFileSchema);

module.exports = { IPFSFile };
