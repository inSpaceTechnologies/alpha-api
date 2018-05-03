const express = require('express');
const mongoose = require('mongoose');
const hash = require('pbkdf2-password')();
const jwt = require('jsonwebtoken');
const expressjwt = require('express-jwt');
const cors = require('cors');

const env = process.env.NODE_ENV;
console.log("Envoroment: " + env);
const config = require('./config')[env];

const app = express();

var authenticationMiddleware = expressjwt({secret: config.jwt.secret});

function errorHandler(err, req, res, next) {
  if (!err.status) {
    err.status = 400;
  }
  if (!err.sendMessage) {
    err.sendMessage = err.message;
  }
  if (err.log) {
    console.error(err.message)
  }
  if (err.logStack) {
    console.error(err.stack)
  }
  res.status(err.status).send(err.sendMessage);
}

function unknownError(err) {
  err.sendMessage = "Unknown error";
  err.logStack = true;
  err.status = 500;
  return err;
}

// so we don't have to use body-parser to get req.body
app.use(express.urlencoded({ extended: false }));

app.use(cors());

app.get('/', (req, res, next) => {
  res.send('Hello World.');
});

mongoose.connect(config.mongo.uri);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {

  console.log("Connected to database.");

  var userSchema = mongoose.Schema({
    email: { type: String, unique: true },
    salt: String,
    passwordHash: String,
  });
  var User = mongoose.model('User', userSchema);

  app.post('/signup', (req, res, next) => {

    var email = req.body.email,
        password = req.body.password;

    if (!email) {
      return next(new Error("You must supply an email address."));
    }

    User.findOne({ email: email}, (err, user) => {
      if (err) {
        return next(unknownError(err));
      }
      if (user) {
        return next(new Error("Email address in use."));
      }

      hash({ password: password }, (err, pass, salt, passwordHash) => {
        if (err) {
          return next(unknownError(err));
        }
        // store the salt & hash in the database
        var user = new User({
          email: email,
          salt: salt,
          passwordHash: passwordHash
        });
        user.save((err, user) => {
          if (err) {
            return next(unknownError(err));
          }
          res.sendStatus(200);
        });
      });
    });
  });

  app.post('/login', (req, res, next) => {

    var email = req.body.email,
        password = req.body.password;

    if (!email) {
      return next(new Error("You must supply an email address."));
    }

    User.findOne({ email: email}, (err, user) => {
      if (err) {
        return next(unknownError(err));
      }
      if (!user) {
        return next(new Error("Email address not found."));
      }

      hash({ password: password, salt: user.salt }, (err, pass, salt, passwordHash) => {
        if (err) {
          return next(unknownError(err));
        }
        if (passwordHash !== user.passwordHash) {
          return next(new Error("Wrong password."));
        }
        const payload = {
          id: user._id,
          email: user.email
        };
        var token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });

        res.json({
          success: true,
          token: token
        });
      });
    });
  });

  app.get('/restricted', authenticationMiddleware, (req, res, next) => {
      res.send("You have passed authentication. User id: " + req.user.id + " Email: " + req.user.email);
  });

  app.use(errorHandler);

  const port = config.server.port;
  app.listen(port, () => {
    console.log('Express listening on port ' + port + '.');
  });

});
