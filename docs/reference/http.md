# HTTP Module

```javascript
const http = require('knork/http')
```

Contains methods for creating and manipulating [HTTP
responses][topic-http-response].

## Types

### `Response<Any>`

A pseudo-type for the purposes of this documentation. Any `Request<Object>`
will return `Object`. [Primitive values][def-primitive], like strings, boolean
values, undefined or numbers will be cast into a `ReadableStream` yielding the
original value stringified via `toString`.

For example:

```javascript
const http = require('knork/http')
const obj = {}
const rex = /asdf/
const fn = function () {}

http.response(obj) === obj
http.response(rex) === rex
http.response(fn) === fn

// while ...
http.response('example') !== 'example'
http.response('example') instanceof require('stream').Readable
```

### `HTTPError`

A base class for all HTTP errors. 

> :warning: **Not to be instantiated directly.**
>
> This class is to be used for checked promise error handlers — not for direct
> instantiation. Use one of the [concrete error subclasses][subclasses] below.
>
> ```javascript
> someOperation().catch(http.HTTPError, err => doSomething(err))  // OK!
> throw new http.HTTPError() // not OK!
> ```

### `ServerError extends HTTPError`

A base class for `5XX` range HTTP errors. Not instantiable.

#### Concrete `ServerError` Subclasses

Concrete subclasses are automatically assigned an error code and a default
error message that may be overridden by the user.

```javascript
'use strict'

const http = require('knork/http')
const request = require('request')

module.exports = myView

function myView (req, context) {
  return someBackendOperation()
    .catch(err => {
      throw new http.NotImplementedError('optional message!')
    })
  })
}
```

Class name                              | Code
--------------------------------------- | :---------------------------
`InternalServerError`                   | 500
`NotImplementedError`                   | 501
`BadGatewayError`                       | 502
`ServiceUnavailableError`               | 503
`GatewayTimeoutError`                   | 504
`HTTPVersionNotSupportedError`          | 505
`VariantAlsoNegotiatesError`            | 506
`InsufficientStorageError`              | 507
`LoopDetectedError`                     | 508
`BandwidthLimitExceededError`           | 509
`NotExtendedError`                      | 510
`NetworkAuthenticationRequiredError`    | 511

### `ClientError`

A base class for `4XX` range HTTP errors. Not instantiable.

#### Concrete `ClientError` Subclasses

Concrete subclasses are automatically assigned an error code and a default
error message that may be overridden by the user.

```javascript
'use strict'

const http = require('knork/http')
const request = require('request')

module.exports = myView

function myView (req, context) {
  return req.body.then(body => {
    if (body.waffles && body.pancakes) {
      throw new http.ConflictError('I literally cannot decide')
    }
  })
}
```

Class name                              | Code
--------------------------------------- | :---------------------------
`BadRequestError`                       | 400
`UnauthorizedError`                     | 401
`PaymentRequiredError`                  | 402
`ForbiddenError`                        | 403
`NotFoundError`                         | 404
`MethodNotAllowedError`                 | 405
`NotAcceptableError`                    | 406
`ProxyAuthenticationRequiredError`      | 407
`RequestTimeoutError`                   | 408
`ConflictError`                         | 409
`GoneError`                             | 410
`LengthRequiredError`                   | 411
`PreconditionFailedError`               | 412
`PayloadTooLargeError`                  | 413
`URITooLongError`                       | 414
`UnsupportedMediaTypeError`             | 415
`RangeNotSatisfiableError`              | 416
`ExpectationFailedError`                | 417
`ImATeapotError`                        | 418
`UnprocessableEntityError`              | 422
`LockedError`                           | 423
`FailedDependencyError`                 | 424
`UnorderedCollectionError`              | 425
`UpgradeRequiredError`                  | 426
`PreconditionRequiredError`             | 428
`TooManyRequestsError`                  | 429
`RequestHeaderFieldsTooLargeError`      | 431
`UnavailableForLegalReasonsError`       | 451

## Methods

### `empty() → Response<''>`

A shorthand for [`raw('')`][shorthand-raw]. Useful for returning `201 Created` or
`204 No Content` responses.

```javascript
'use strict'
const http = require('knork/http')

module.exports = function myView (req, context) {
  return deleteSomeModel().then(() => {
    return http.status(
      http.empty(),
      204
    )
  })
}
```

### `link(resp) → Object | undefined`

Return a parsed [link header][def-link] from the response, if any.

### `link(resp, rel) → Object | undefined`

Return a parsed [link header][def-link] *relation* from the response, if any.

### `link(resp, rel, value) → Response<resp>`

Add a [link relation][def-link-rel] to a [`link` header][def-link] associated
with a response, returning the response.

```javascript
header(link(resp, [{
  rel: 'next',
  url: 'some/url'
}, {
  rel: 'prev',
  url: 'another/url'
}]), 'link') // <some/url>; rel="next", <another/url>; rel="prev"
```

> :rotating_light: **See [a note on headers](#a-note-on-headers).**

### `header(resp, header) → String | undefined`

Returns the current value of the header associated with `resp`, if any.

### `header(resp, header, string) → Response<resp>`

Associates a response with a header and a value. Replaces an existing header
by the given name, other headers are left intact.

```
'use strict'
const http = require('knork/http')

module.exports = function myView (req, context) {
  return http.header(
    'cool text!'
    'content-type'
    'text/plain'
  )
}
```

<a id="a-note-on-headers"></a>

> :rotating_light: **Header keys and values are interpreted as
> [ISO-8859-1][def-latin-1].**
>
> Because of this behavior in the underlying HTTP specification, knork does not
> allow non-[ASCII][def-ascii] characters to be passed in as header keys or
> values, throwing an error if it detects non-ASCII characters. Malicious clients
> could otherwise insert UTF8 values that will decompose to newlines, which
> allows for an attack known as [response splitting][def-response-splitting].

### `headers(resp) → Object | undefined`

Return an object representing all headers associated with the response, if
any. Returns `undefined` if no headers are associated with the response.

### `headers(resp, headers) → Response<resp>`

Replace all headers associated with the response with those given by `headers`.

```javascript
'use strict'
const http = require('knork/http')

module.exports = function myView (req, context) {
  return http.headers(
    'cool text!'
    {'content-type': 'text/plain'}
  )
}
```

> :rotating_light: **See [a note on headers](#a-note-on-headers).**

### `raw(resp) → Response<resp>`

A shorthand for [`response(resp)`][shorthand-response]. Often used with strings
or other primitive data, when associating headers or status information with
such a response is desired. Returns a [`stream.Readable`][stream-readable] for
[primitive values][def-primitive].

```javascript
'use strict'
const http = require('knork/http')

module.exports = function myView (req, context) {
  return http.status(
    http.raw('aw dang I could not find that for you'),
    404
  )
}
```

### `redirect([resp = empty(), ]url[, code = 302]) → Response<resp>`

A shorthand for [`header(status(empty(), 302), 'location',
url)`][shorthand-header]. Handy for redirecting clients after the success of an
operation, or when a resource exists elsewhere. Combine with
[`reverse.reverse`][reverse-reverse] for best results:

```javascript
'use strict'
const http = require('knork/http')
const myUrls = require('../urls/path/to/my/urls')

module.exports = function myView (req, context) {
  return createSomeModel().then(instance => {
    return http.redirect(
      myUrls.reverse('somemodel.view', {slug: instance.slug})
    )
  })
}
```

* **See also**: [The `Location` header][def-location].

### `response(resp[, code][, headers]) → Response<resp>`

Create a `Response<T>` from `resp`, optionally associating a status code
and a set of headers. When given, the `code` and `headers` parameters will
replace any corresponding values associated with `resp`.

```javascript
'use strict'
const http = require('knork/http')

module.exports = function myView (req, context) {
  return http.response(
    'dogs are just small bears',
    203,
    {'content-type': text/plain+lies'}
  )
}
```

> :rotating_light: **See [a note on headers](#a-note-on-headers).**

### `status(resp) → Number | undefined`

Given a potential response object, return the status code
associated with the response, if any.

```javascript
'use strict'
const http = require('knork/http')
http.status(new http.NotFound())    // 404
http.status({})                     // undefined
```

### `status(resp, code) → Response<resp>`

Associate a status code with the potential response. If the response is
[primitive][def-primitive], upcast it to a [`stream.Readable`][stream-readable]
and associate the status with that object.

```javascript
'use strict'
const http = require('knork/http')
const resp = {}
http.status(resp, 204)              // === resp, w/ 204 status
http.status('', 204)                // === stream.Readable w/ 204 status
```

[reverse-reverse]: https://github.com/chrisdickinson/reverse#routerreversenamestring-argsobject--string--null
[def-latin-1]: https://en.wikipedia.org/wiki/ISO/IEC_8859-1
[def-ascii]: https://en.wikipedia.org/wiki/ASCII
[def-location]: https://en.wikipedia.org/wiki/HTTP_location
[def-link]: https://tools.ietf.org/html/rfc5988
[def-link-rel]: https://tools.ietf.org/html/rfc5988#section-4
[def-response-splitting]: https://en.wikipedia.org/wiki/HTTP_response_splitting
[def-primitive]: https://developer.mozilla.org/en-US/docs/Glossary/Primitive