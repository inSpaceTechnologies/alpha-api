/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const axios = require('axios');
const bitcore = require('bitcore-lib');
const Eos = require('eosjs');

const config = require('./config');

const {
  HDPublicKey,
  Networks,
  Address,
} = bitcore;

const xpubIndex = config.purchase.bitcoin.currentXpubIndex;
const xpub = config.purchase.bitcoin.xpubs[xpubIndex];
const hdPublicKey = new HDPublicKey(xpub);

const eos = Eos({
  keyProvider: config.eos.iscoin.issuer.privateKey,
  httpEndpoint: config.eos.host,
  chainId: config.eos.chainID,
});

// models
const {
  BitcoinAddress, BitcoinIscoinPurchaseTransaction, EosIscoinPurchaseTransaction, EosTransfer,
} = require('./models/purchase');

async function updateCommon(transaction, address) {
  // check whether it has been fully paid
  if (transaction.amountReceived >= transaction.amount) {
    transaction.active = false;
    await transaction.save();

    // send the iscoins
    await eos.transaction({
      actions: [
        {
          account: config.eos.iscoin.account,
          name: 'transfer',
          authorization: [{
            actor: config.eos.iscoin.issuer.account,
            permission: 'active',
          }],
          data: {
            from: config.eos.iscoin.issuer.account,
            to: transaction.eosAccount,
            quantity: `${transaction.purchaseAmount.toFixed(config.eos.iscoin.decimalPlaces)} ${config.eos.iscoin.code}`,
            memo: '',
          },
        },
      ],
    });
    return;
  }

  // check whether it has expired
  if (transaction.expiryDate < Date.now()) {
    // it has expired.
    // set it to inactive.
    transaction.active = false;
    await transaction.save();
    if (address) {
      // if nothing has been received, set the address as available
      // TODO: otherwise refund?
      if (transaction.amountReceived === 0) {
        address.available = true;
        await address.save();
      }
    }
  }
}
async function updateBitcoin() {
  // iterate over active transactions
  const activeTransactions = await BitcoinIscoinPurchaseTransaction.find({ active: true });

  await Promise.all(activeTransactions.map(async (transaction) => {
    const address = await BitcoinAddress.findById(transaction.address);

    // update balance
    const derivedPublicKey = hdPublicKey.derive(address.index);
    const bitcoinAddress = new Address(derivedPublicKey.publicKey, Networks.livenet).toString();
    const response = await axios.get(`${config.purchase.bitcoin.insightAPI}/addr/${bitcoinAddress}`);
    const balance = parseInt(response.data.balance, 10) / 100000000;
    transaction.amountReceived = balance;
    await transaction.save();

    await updateCommon(transaction, address);
  }));
}

async function updateEos() {
  // iterate over active transactions
  const activeTransactions = await EosIscoinPurchaseTransaction.find({ active: true });

  await Promise.all(activeTransactions.map(async (transaction) => {
    // update amount
    let amountReceived = 0;
    const transfers = await EosTransfer.find({
      to: transaction.eosDepositAccount,
      memo: transaction.memo,
      symbol: 'EOS',
    });
    transfers.forEach((transfer) => {
      amountReceived += transfer.amount;
    });

    transaction.amountReceived = amountReceived;
    await transaction.save();

    await updateCommon(transaction, null);
  }));
}

async function update() {
  await updateBitcoin();
  await updateEos();
}

function init() {
  setInterval(update, config.purchase.updateInterval);
}

module.exports = { init };
