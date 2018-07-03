# inspace-api

Back end server for the inSpace web client.

## Requirements

* [MongoDB](https://www.mongodb.com)
* [PM2](http://pm2.keymetrics.io)

## To build

* Clone repository.
* `npm install` to get dependencies.
* Copy the `config.js.example` file to `config.js`, and edit.

## To run

* `pm2 start ecosystem.config.js --env production`

## To stop

* `pm2 stop inspace-api`
