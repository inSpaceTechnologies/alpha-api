/*
Copyright (c) 2018 inSpace Technologies Ltd
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
const express = require('express');
const Busboy = require('busboy');
const DigestStream = require('digest-stream');

const { authenticationMiddleware, adminCheck } = require('../middleware/auth');
const ipfsManager = require('../ipfs');

// models
const { IPFSFile } = require('../models/ipfs');

const { unknownError } = require('../middleware/error');

const router = express.Router();

router.put('/ipfs/init', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.ipfsd().init({
    keysize: 2048,
    path: ipfsManager.path(),
  }, (err) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    res.sendStatus(200);
  });
});

router.put('/ipfs/cleanup', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.ipfsd().cleanup((err) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    res.sendStatus(200);
  });
});

router.get('/ipfs/started', authenticationMiddleware, adminCheck, (req, res, next) => {
  res.json(ipfsManager.ipfsd().started);
});

router.put('/ipfs/start', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.ipfsd().start([], (err, api) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    ipfsManager.setAPI(api);
    res.sendStatus(200);
  });
});

router.put('/ipfs/stop', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.ipfsd().stop((err) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    res.sendStatus(200);
  });
});

router.get('/ipfs/config', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.ipfsd().getConfig((err, conf) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    res.json(conf);
  });
});

router.post('/ipfs/upload', authenticationMiddleware, (req, res, next) => {
  let busboy;

  try {
    busboy = new Busboy({ headers: req.headers });
  } catch (err) {
    return next(unknownError(err));
  }

  busboy.on('file', (fieldname, file /* ,filename, encoding, mimetype */) => {
    // use digestStream to get the size and SHA256 hash
    let sha256 = null;
    let size = null;
    function digest(resultDigest, resultSize) {
      sha256 = resultDigest;
      size = resultSize;
    }
    const digestStream = DigestStream('sha256', 'hex', digest);
    file.pipe(digestStream);

    // this pins it too
    ipfsManager.api().files.add(digestStream, (err, data) => {
      if (err) {
        next(unknownError(err));
        return;
      }

      const { hash } = data[0];
      const ret = {
        ipfsHash: hash,
        sha256,
        size,
      };

      // keep a record of whose file it is in our database.
      // do not store multiple records for the same user and file.
      IPFSFile.findOne({ hash, user: req.user.id }, (err, entry) => {
        if (entry) {
          res.send(ret);
          return;
        }
        const ipfsFileEntry = new IPFSFile({
          hash,
          user: req.user.id,
          size,
        });
        ipfsFileEntry.save((err) => {
          if (err) {
            next(unknownError(err));
            return;
          }
          res.send(ret);
        });
      });
    });
  });

  busboy.on('error', (err) => {
    next(unknownError(err));
  });

  return req.pipe(busboy);
});

router.put('/ipfs/unpin/:hash', authenticationMiddleware, (req, res, next) => {
  const { hash } = req.params;
  // multiple users might have uploaded this file.
  // only unpin if the requester is the only user.

  // delete the record for this user.
  IPFSFile.remove({ hash, user: req.user.id }, (err) => {
    if (err) {
      next(unknownError(err));
      return;
    }

    // check for others (from any user)
    IPFSFile.findOne({ hash }, (err, row) => {
      if (err) {
        next(unknownError(err));
        return;
      }
      if (row) {
        // there are others, so do not unpin
        res.json({ pinset: [] });
        return;
      }
      // unpin
      ipfsManager.api().pin.rm(hash, (err, pinset) => {
        if (err) {
          next(unknownError(err));
          return;
        }
        res.json({ pinset });
      });
    });
  });
});

router.get('/ipfs/pin/ls', authenticationMiddleware, adminCheck, (req, res, next) => {
  ipfsManager.api().pin.ls((err, pinset) => {
    if (err) {
      next(unknownError(err));
      return;
    }
    res.json({ pinset });
  });
});

module.exports = router;
