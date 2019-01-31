/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const express = require('express');
const bitcore = require('bitcore-lib');

const {
  HDPublicKey,
  Networks,
  Address,
} = bitcore;

const config = require('../config');
const { unknownError } = require('../middleware/error');

// models
const { BitcoinAddress, BitcoinIscoinPurchaseTransaction, EosIscoinPurchaseTransaction } = require('../models/purchase');

const { timeLimit, eosDepositAccount } = config.purchase;
const xpubIndex = config.purchase.bitcoin.currentXpubIndex;
const xpub = config.purchase.bitcoin.xpubs[xpubIndex];
const hdPublicKey = new HDPublicKey(xpub);

const router = express.Router();

function deriveBitcoinAddress(index) {
  const derivedPublicKey = hdPublicKey.derive(index);
  return new Address(derivedPublicKey.publicKey, Networks.livenet).toString();
}

function getNewBitcoinAddress() {
  return new Promise((resolve, reject) => {
    let newBitcoinAddress = null;
    // check for an available address in the databae
    BitcoinAddress.findFirstAvailable(xpubIndex)
      .then((address) => {
        if (address) {
          resolve(address);
          // break chain
          return Promise.reject();
        }
        // no available address in database.
        // get highest index.
        return BitcoinAddress.findMaxIndex(xpubIndex);
      })
      .then((maxIndex) => {
        // new index
        const index = maxIndex + 1;
        // create new address entry
        newBitcoinAddress = new BitcoinAddress({
          index,
          xpubIndex,
          available: true,
        });
        return newBitcoinAddress.save();
      })
      .then(() => resolve(newBitcoinAddress))
      .catch((err) => {
        if (err) {
          reject(err);
        }
      });
  });
}

// purchase iscoin with bitcoin
router.post('/purchase/iscoin/btc', (req, res, next) => {
  const { purchaseAmount, eosAccount } = req.body;

  let address = null;
  let bitcoinAddress = null;
  let expiryDate = null;
  let amount = null;

  // check for an existing transaction for the account
  BitcoinIscoinPurchaseTransaction.findOne({ eosAccount, active: true })
    .then((transaction) => {
      if (transaction) {
        next(new Error('Transaction exists.'));
        // break chain
        return Promise.reject();
      }
      // get bitcoin address
      return getNewBitcoinAddress();
    })
    .then((addr) => {
      address = addr;

      bitcoinAddress = deriveBitcoinAddress(address.index);

      // TODO: hardcoded for now
      const exchangeRate = 2;

      // get amount
      amount = purchaseAmount / exchangeRate;

      // get expiry date
      expiryDate = Date.now() + timeLimit;

      // create and save transaction entry
      const transaction = new BitcoinIscoinPurchaseTransaction({
        address: address.id,
        eosAccount,
        amount,
        amountReceived: 0,
        purchaseAmount,
        expiryDate,
        active: true,
      });
      return transaction.save();
    })
    .then(() => {
      // set the address to unavailable
      address.available = false;
      return address.save();
    })
    .then(() => res.send({
      address: bitcoinAddress,
      expiryDate,
      amount,
      purchaseAmount,
      amountReceived: 0,
    }))
    .catch((err) => {
      if (err) {
        next(unknownError(err));
      }
    });
});

// purchase iscoin with EOS
router.post('/purchase/iscoin/eos', async (req, res, next) => {
  const { purchaseAmount, eosAccount } = req.body;

  // check for an existing transaction for the account
  const existingTransaction = await EosIscoinPurchaseTransaction.findOne({ eosAccount, active: true });
  if (existingTransaction) {
    return next(new Error('Transaction exists.'));
  }

  // TODO: hardcoded for now
  const exchangeRate = 2;

  // get amount
  const amount = purchaseAmount / exchangeRate;

  // get expiry date
  const expiryDate = Date.now() + timeLimit;

  // get memo
  const memo = eosAccount + Date.now();

  // create and save transaction entry
  const transaction = new EosIscoinPurchaseTransaction({
    eosDepositAccount,
    memo,
    eosAccount,
    amount,
    amountReceived: 0,
    purchaseAmount,
    expiryDate,
    active: true,
  });
  await transaction.save();

  return res.send({
    memo,
    eosDepositAccount,
    expiryDate,
    amount,
    purchaseAmount,
    amountReceived: 0,
  });
});

router.get('/purchase/iscoin/:eosAccount', async (req, res, next) => {
  const { eosAccount } = req.params;

  const ret = {};

  // there can be only one of each type
  const bitcoinTransaction = await BitcoinIscoinPurchaseTransaction.findOne({ eosAccount, active: true });
  const eosTransaction = await EosIscoinPurchaseTransaction.findOne({ eosAccount, active: true });

  if (bitcoinTransaction) {
    const address = await BitcoinAddress.findById(bitcoinTransaction.address);
    ret.bitcoinTransaction = {
      address: deriveBitcoinAddress(address.index),
      amount: bitcoinTransaction.amount,
      amountReceived: bitcoinTransaction.amountReceived,
      purchaseAmount: bitcoinTransaction.purchaseAmount,
      expiryDate: bitcoinTransaction.expiryDate,
    };
  }

  if (eosTransaction) {
    ret.eosTransaction = {
      memo: eosTransaction.memo,
      eosDepositAccount: eosTransaction.eosDepositAccount,
      amount: eosTransaction.amount,
      amountReceived: eosTransaction.amountReceived,
      purchaseAmount: eosTransaction.purchaseAmount,
      expiryDate: eosTransaction.expiryDate,
    };
  }

  res.send(ret);
});

module.exports = router;
