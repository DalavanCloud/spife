'use strict'

const routes = require('@npm/knork/routing')

module.exports = routes`
  GET / index
`(require('./views'))