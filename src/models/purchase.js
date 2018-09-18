/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema;

const bitcoinAddressSchema = mongoose.Schema({
  // index for the deterministic wallet
  index: { type: Number, unique: true, required: true },
  // don't store the xpub in the database. index into array of xpubs in config.
  xpubIndex: { type: Number, required: true },
  // whether the address is available
  available: { type: Boolean, required: true, default: true },
});

const bitcoinIscoinPurchaseTransactionSchema = mongoose.Schema({
  address: { type: ObjectId, required: true },
  eosAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  amountReceived: { type: Number, required: true, default: 0 },
  purchaseAmount: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  // becomes inactive if expires or fully paid
  active: { type: Boolean, required: true, default: false },
});

const eosIscoinPurchaseTransactionSchema = mongoose.Schema({
  eosDepositAccount: { type: String, required: true },
  memo: { type: String, required: true },
  eosAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  amountReceived: { type: Number, required: true, default: 0 },
  purchaseAmount: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  // becomes inactive if expires or fully paid
  active: { type: Boolean, required: true, default: false },
});

bitcoinAddressSchema.statics.findMaxIndex = function findMaxIndex(xpubIndex) {
  const schema = this;
  return new Promise((resolve, reject) => {
    schema.findOne({ xpubIndex })
      .sort({ index: -1 })
      .exec((err, address) => {
        if (err) {
          return reject(err);
        }
        if (address) {
          return resolve(address.index);
        }
        return resolve(-1);
      });
  });
};

bitcoinAddressSchema.statics.findFirstAvailable = function findFirstAvailable(xpubIndex) {
  return this.findOne({ xpubIndex, available: true })
    .sort({ index: 1 })
    .exec();
};

const BitcoinAddress = mongoose.model('BitcoinAddress', bitcoinAddressSchema);
const BitcoinIscoinPurchaseTransaction = mongoose.model('BitcoinIscoinPurchaseTransaction', bitcoinIscoinPurchaseTransactionSchema);
const EosIscoinPurchaseTransaction = mongoose.model('EosIscoinPurchaseTransaction', eosIscoinPurchaseTransactionSchema);

module.exports = { BitcoinAddress, BitcoinIscoinPurchaseTransaction, EosIscoinPurchaseTransaction };
