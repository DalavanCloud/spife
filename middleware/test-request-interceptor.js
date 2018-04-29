'use strict'

module.exports = createRequestInterceptor

function createRequestInterceptor () {
  let defaultInterceptor = async (req) => {}
  let interceptor = defaultInterceptor

  return {
    async processRequest (req, next) {
      await interceptor(req)
      return next(req)
    },

    processSuite (suite, next) {
      suite.setRequestInterceptor = v => {
        interceptor = v
      }
      return next(suite)
    },

    processTestcase (suite, testcase, args, next) {
      interceptor = defaultInterceptor
      return next(suite, testcase, args)
    }
  }
}
