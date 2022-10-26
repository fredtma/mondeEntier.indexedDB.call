/* global self */
/* eslint-disable  no-multi-spaces */
(function moduleDefinition (window, self, module) {
  const XMLHttpRequest = window ? window.XMLHttpRequest : self.XMLHttpRequest
  // @deprecated - use fetch
  function aSync (url, data, settings, callback) { // settings: {url, withCredentials, format, method, data, callback}
    var xhr = new XMLHttpRequest()
    var defaults = {
      callback: callback,
      format: 'json',
      method: 'post',
      url: url,
      withCredentials: true,
      headers: {'content-type': 'application/json', accept: 'application/json'}// application/x-www-form-urlencoded
    }
    Object.assign(settings, defaults)

    xhr.open(settings.method, settings.url, true)
    xhr.withCredentials     = settings.withCredentials
    xhr.responseType        = settings.format
    xhr.onreadystatechange  = readyStateChange
    xhr.onerror             = onError
    xhr.setRequestHeader('Content-Type', settings.headers['content-type'])
    xhr.setRequestHeader('Accept', settings.headers.accept)
    xhr.send(data || settings.data)

    function onError (e) {
      console.error('Ajax ERROR:: ', e)
    }

    function readyStateChange (/* e */) {
      var response
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status <= 300) {
        response = xhr.response || '{}' // @fix:empty object so as to not cause an error
        if (typeof response === 'string' && settings.format === 'json') {
          response = JSON.parse(response)
        }
        if (typeof settings.callback === 'function') {
          settings.callback(response)
        }
      }
    }
  }
  // ============================================================================//
  /*
   * Used to retrieve the value of a variable that is not an object
   */
  function isempty (val) {
    if (val !== 0 && val !== '0' && typeof val !== 'undefined' && val !== null && val !== '' && val !== false) {
      return false
    }
    return true
  }
  // ============================================================================//
  /**
   * similar to PHP issset function, it will test if a variable is empty
   * @author fredtma
   * @version 0.8
   * @category variable
   * @return bool
   */
  function isset () {
    var a = arguments
    var l = a.length
    var i = 0
    if (l === 0) {
      return false
    }// end if
    while (i !== l) {
      if (a[i] === null || typeof (a[i]) === 'undefined') {
        return false
      }
      i++
    }
    return true
  }// end function
  // ============================================================================//
  /**
  * validate a sets of value againt the first object
  * @returns {Boolean}
  */
  function issets (original, uri) {
    var path = uri.split('.')
    var key
    var obj
    if (isset(original) === false) {
      return false
    }

    while (path.length > 1) {
      key = path.shift()
      if (parseInt(key, 10)) {
        key = parseInt(key, 10)
      }
      obj = obj ? obj[key] : original[key]
    }
    if (typeof obj === 'undefined') {
      obj = {}
    }
    return obj[path.shift()]
  }
  // ============================================================================//
  /**
   * use prototype to add a function that searches an object value
   * @author fredtma
   * @version 2.3
   * @category search, object
   * @param array </var>value</var> the value to search in the object
   * @return bool
   */
  function objSearch (ele, value, field) {
    var key
    var l
    var found = false
    var obj
    if (ele instanceof Array) {
      l = ele.length
      for (key = 0; key < l; key++) {
        obj = ele[key]
        found = search(obj, key)
        if (found) {
          return found
        }
      }
    }
    if (field && isset(ele)) {
      obj = ele[field]
      found = search(obj, field)
      if (found) {
        return found
      }
    }
    for (key in ele) {
      if (ele.hasOwnProperty(key) === false) {
        continue
      }
      obj = ele[key]
      found = search(obj, key)
      if (found) {
        return found
      }
    }
    function search (obj, key) {
      if (typeof obj === 'object') {
        found = objSearch(obj, value, field)
      }
      if (found !== false) {
        return [found, key]
      }
      if (typeof obj === 'string' && obj.indexOf(value) !== -1) {
        return [ele, key]
      }
      if (typeof obj === 'number' && obj === value) {
        return [ele, key]
      }
      return false
    }
    return false
  }
  // ============================================================================//
  if (window) {
    window.aSync      = aSync
    window.objSearch  = objSearch
    window.isempty    = isempty
    window.issetS     = issets
    window.isset      = isset
  }

  if (self) {
    self.aSync      = aSync
    self.objSearch  = objSearch
    self.isempty    = isempty
    self.issetS     = issets
    self.isset      = isset
  }

  if (module) {
    module.exports = {
      aSync: aSync,
      objSearch: objSearch,
      isempty: isempty,
      issets: issets,
      isset: isset
    }
  }
}(window, self, module))
