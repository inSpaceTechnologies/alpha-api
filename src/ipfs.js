/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const IPFSFactory = require('ipfsd-ctl');

const config = require('./config');

class IPFSManager {
  constructor() {
    this._ipfsd = null;
    this._path = config.ipfs.path;
    this._api = null;
  }
  ipfsd() {
    return this._ipfsd;
  }
  setAPI(api) {
    this._api = api;
  }
  api() {
    return this._api;
  }
  path() {
    return this._path;
  }
  init(done) {
    const ipfsFactory = IPFSFactory.create();

    ipfsFactory.spawn({
      disposable: false,
      repoPath: this._path,
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
        return done(err);
      }
      console.log('IPFS daemon spawned.');

      this._ipfsd = ipfsd;
      return done(null);
    });
  }
}

const ipfsManager = new IPFSManager();

module.exports = ipfsManager;
