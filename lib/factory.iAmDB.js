/* global self, fetch, webkitIDBTransaction,  msIDBTransaction, webkitIDBKeyRange, msIDBKeyRange, webkitIndexedDB, mozIndexedDB, msIndexedDB */
/* eslint-disable  no-multi-spaces */
// TODO : add ability to start close transaction
(function moduleDefinition (window, self, module) {
  const IDBTransaction        = self.IDBTransaction || webkitIDBTransaction || msIDBTransaction || {READ_WRITE: 'readwrite'} // eslint-disable-line no-unused-vars
  const IDBKeyRange           = self.IDBKeyRange || webkitIDBKeyRange || msIDBKeyRange

  /**
   * @example
   * const deferred = defer();
   * deferred.promise.then(function(data) {
   *  document.body.innerHTML += '<p>Resolved: ' + data + '</p>';
   * });
   * document.body.innerHTML = '<p>Deferred created.</p>';
   *
   * setTimeout(function() {
   *  deferred.resolve(123);
   * }, 2000);
   * @return {Promise} -
   */
  function defer () {
    const deferred = {}
    const promise = new Promise(function promise (resolve, reject) {
      deferred.resolve = resolve
      deferred.reject = reject
    })
    deferred.promise = promise
    return deferred
  }

  /**
   * iAmDB - Description
   *
   * @param {String} dbName     Description
   * @param {Number} dbVersion  Description
   * @param {Object | Function} dataSource Description
   * @param {Object} options    viewWrite, viewRead, reset, appSchema, dataSource   *
   * @param {Function|Object} options.schema
   * @param {Function|Object|String} options.source
   * @param {Boolean} options.reset
   * @param {Object} options.console
   * @param {Boolean} options.console.viewRead
   * @param {Boolean} options.console.viewWrite
   * @return {type} Description
   */
  function iAmDB (dbName, dbVersion, options) {
    const $promise    = defer()
    const $db         = $promise.promise
    const indexedDB   = self.indexedDB || webkitIndexedDB || mozIndexedDB || msIndexedDB
    let $upgrading    = false
    const $iDBOpenDBRequest = indexedDB.open(dbName, parseInt(dbVersion, 10))
    $iDBOpenDBRequest.onblocked       = _blocked
    $iDBOpenDBRequest.onerror         = _error
    $iDBOpenDBRequest.onsuccess       = _success // data can be added on success
    $iDBOpenDBRequest.onupgradeneeded = _upgrade // stores are created on upgrade

    options = _assignDefaultOptions(options)
    _resetDatabase(options, dbName)
    return {
      iDBDatabase: $db,
      initTransaction,
      setupTransaction
    }

    function _assignDefaultOptions (opt) {
      return Object.assign({}, {
        console: {
          viewWrite: false,
          viewRead: false
        }
      }, opt)
    }

    function _appSchema () {
      return (options.schema instanceof Function) ? options.schema() : options.schema || {} // define in schema.js
    }

    function _blocked (e) {
      console.info('Closing worker::Please close all other tabs with that application', e)
      // eslint-disable-next-line no-invalid-this
      try {
        this.close()
      } catch {
        try {
          self.close()
        } catch {}
      }
    }

    function _dataSchema (dataSource = options.source) {
      if (typeof dataSource === 'string') {
        return fetch(dataSource).then(response => response.json())
      } else if (typeof dataSource === 'object') {
        return Promise.resolve(dataSource)
      } else if (dataSource instanceof Function) {
        return Promise.resolve(dataSource()) // define in schema.js
      }
      return Promise.resolve()
    }

    function _error (e) {
      $promise.reject(e)
      console.error('Database error code: ' + e.target.error.message, e)
      // eslint-disable-next-line no-invalid-this
      this.close()
    }

    function _resetDatabase({reset}, name) {
      if (reset) {
        indexedDB.deleteDatabase(name)
        console.info('Dropping iDB')
      }
    }

    /**
    * The on success is used to get the all schema's name and insert in each the data found
    */
    function _success (e) {
      let iDBDatabase = e.target.result || $iDBOpenDBRequest.result
      let iDBTransaction

      console.info('Worker iDB Ready/Success')
      $promise.resolve(iDBDatabase)

      // place the addition of data in seperate loop, in order to prevent `transaction running`
      if ($upgrading) {
        iDBTransaction = $upgrading
        _dataSchema().then(insertData)
      }

      function insertData (source) {
        const storeNames = Object.keys(_appSchema())
        if (!source) {
          return false
        }
        storeNames.forEach(eachStore(source))
        $upgrading = false
        return true
      }// insertData

      function eachStore (source) {
        return (name) => {
          const data = source[name]
          const iDBObjectStore = iDBTransaction.objectStore(name)
          if (!data || data instanceof Array === false) {
            return false
          }
          data.forEach(function eachDataSource (content) {
            content.createdAt = content.createdAt || new Date()
            content.updatedAt = content.updatedAt || new Date()
            iDBObjectStore.add(content)
          })
          return true
        };
      }
    }// end success

    function _upgrade (e) {
      const iDBDatabase = e.target.result || $iDBOpenDBRequest.result
      const fullSchema = _appSchema()
      const storeNames = Object.keys(fullSchema)
      const iDBTransaction = setupTransaction(iDBDatabase, 'readWrite', storeNames)

      $promise.resolve(iDBDatabase)
      $upgrading  = iDBTransaction // the upgrading to the transaction and use it in the success method
      console.info('Worker $iDB Upgrading')

      storeNames.forEach(processSchema)

      function processSchema (storeName) {
        const schema = fullSchema[storeName]

        if (iDBDatabase.objectStoreNames.contains(storeName) !== true) { // NEW iDBObjectStore schema
          createStore(iDBDatabase, storeName, schema)
        } else {
          modifyStore(storeName, schema, iDBTransaction, true)
        }
      }// createStore func
    }// upgrade func

    function initTransaction (storeNames, readWrite) {
      return $db.then(function transactionReady (iDBDatabase) {
        const iDBTransaction  = setupTransaction(iDBDatabase, readWrite, storeNames)
        const crud            = iAmCrud(iDBDatabase, iDBTransaction, options)
        crud.iDBDatabase      = iDBDatabase
        crud.iDBTransaction   = iDBTransaction
        return crud
      })
    }

    function createStore (iDBDatabase, storeName, schema) {
      let properties
      let iDBObjectStore
      console.info('Creating store:', storeName)
      Object.keys(schema.properties).forEach(function eachProperties (propertyName) {
        properties = schema.properties[propertyName]
        iDBObjectStore = createPrimaryKey(iDBDatabase, iDBObjectStore, storeName, properties, propertyName) // TODO: what if there is no pk, then store is empty
        createIndexKey(iDBObjectStore, properties, propertyName)
      })
    }

    function createPrimaryKey (iDBDatabase, iDBObjectStore, storeName, properties, propertyName) {
      const pk = properties.pk || properties.primary || properties.key
      if (pk && !iDBObjectStore)  {
        iDBObjectStore = iDBDatabase.createObjectStore(storeName, {keyPath: propertyName})
      } else if (!iDBObjectStore) {
        iDBObjectStore = iDBDatabase.createObjectStore(storeName, {autoIncrement: true})
      }
      return iDBObjectStore
    }

    function createIndexKey (iDBObjectStore, properties, propertyName) {
      let indexName = properties.ndx || properties.index || properties.key
      const multiEntry  = properties.multiEntry || false
      if (properties.unique && !iDBObjectStore.indexNames.includes(properties.unique) && !iDBObjectStore.indexNames.includes('uniq_' + propertyName)) {
        indexName = typeof properties.unique === 'string' ? properties.unique : 'uniq_' + propertyName
        iDBObjectStore.createIndex(indexName, properties.keyPath || propertyName, {unique: true, multiEntry})
      }
      if (indexName && !iDBObjectStore.indexNames.includes(indexName)) {
        iDBObjectStore.createIndex(indexName, properties.keyPath || propertyName, {multiEntry})
      }
    }

    function deleteStoreIndexes (iDBObjectStore) {
      iDBObjectStore.indexNames.forEach(function eachIndex (indexName) {
        iDBObjectStore.deleteIndex(indexName)
      })
    }

    function modifyStore (storeName, schema, iDBTransaction, clear) {
      const iDBObjectStore = iDBTransaction.objectStore(storeName)
      console.log('Updating store:', storeName)

      // removing all records from the object store
      if (clear) {
        iDBObjectStore.clear()
      }
      // removing all records in indexes that reference the object store
      // @todo - Check that this does not delete px & autoincrement
      deleteStoreIndexes(iDBObjectStore)
      Object.keys(schema.properties).forEach(function eachProperties (propertyName) {
        let properties = schema.properties[propertyName]
        createIndexKey(iDBObjectStore, properties, propertyName)
      })
    }

    /**
    * @params {IDBDatabase} iDBDatabase - Database instance
    * @params {String} readWrite - default readonly
    * @params {String[]} storeNames - Array storeNames - List of stores names for the transaction
    */
    function setupTransaction (iDBDatabase, readWrite, storeNames) {
      let transaction

      storeNames = (typeof storeNames === 'undefined') ? iDBDatabase.objectStoreNames : (storeNames instanceof Array) ? storeNames : [storeNames]
      storeNames.forEach(function eachStoreNames (name) {
        if (iDBDatabase.objectStoreNames.includes(name) === false) {
          console.warn('No store ' + name + 'found ')
        }
      })

      transaction = iDBDatabase.transaction(storeNames, readWrite) // @instanceof IDBTransaction

      transaction.onabort     = _transactionListener('Aborted', false)
      transaction.oncomplete  = _transactionListener('Completed')
      transaction.onclose     = _transactionListener('Closed')
      transaction.onerror     = _transactionListener('Error', false)
      transaction.onsuccess   = _transactionListener('Successful')
      return transaction
    }

    function _transactionListener (name, success = true) {
      return function inner (e) {
        if (success) {
          if (options.console.viewTrans) {
            console.info(name + ' transaction ', e)
          }
        } else if (success === false) {
          console.error(name + ' on transaction ', e)
        } else if (options.console.viewTrans) {
          console.info(name + ' transaction ', e)
        }
      }
    }
  }
// ================================================================================================================================== //
  function iAmCrud (iDBDatabase, iDBTransaction, options) {
    return {
      clear,
      iDBDatabase,
      drop,
      modify,
      query,
      read,
      iDBTransaction,
      write
    }

    function clear (storeName) {
      const iDBObjectStore   = iDBTransaction.objectStore(storeName)
      const iDBRequest = iDBObjectStore.clear()
      return new Promise(function promise (resolve, reject) {
        iDBRequest.addEventListener('success', _success(storeName, 'clear', resolve, true))
        iDBRequest.addEventListener('error', _error(storeName, 'clear', reject, true))
      })
    }

    function drop (storeName, index) {
      const iDBObjectStore   = iDBTransaction.objectStore(storeName)
      const iDBRequest = iDBObjectStore.delete(index)
      return new Promise(function promise (resolve, reject) {
        iDBRequest.addEventListener('success', _success(storeName, 'erased', resolve, true))
        iDBRequest.addEventListener('error', _error(storeName, 'erased', reject, true))
      })
    }

    function modify (...args) {
      return write([args[0], args[1], true])
    }

    function query (storeName, index) {
      let iDBRequest
      let iDBIndex    = null
      let order       = 'next'
      let iDBKeyRange = null
      const iDBObjectStore = iDBTransaction.objectStore(storeName)

      if ((typeof index === 'number' || typeof index === 'string')) { // FOR PK Index
        iDBRequest   = iDBObjectStore.get(index)
      } else if (typeof index === 'object') { // For search
        [iDBRequest, iDBKeyRange, iDBIndex] = objectSearch(index)
      }

      if (iDBIndex && iDBKeyRange) {
        iDBRequest   = iDBIndex.openCursor(iDBKeyRange, order)
      } else if (!iDBRequest) {
        if (iDBObjectStore.getAll) {
          iDBRequest = iDBObjectStore.getAll()
        } else {
          iDBRequest = iDBObjectStore.openCursor(iDBKeyRange, order)
        }
      }
      return iDBRequest

      // $where is used to search via the index name
      function objectSearch (index) {
        const firstProperty = filterSearchKey(index)
        const $where        = (index.hasOwnProperty('$where')) ? index.$where : firstProperty
        // gives it the function to search via the object key or if the $where & $eq is specify
        if (index.hasOwnProperty(firstProperty) && typeof index[firstProperty] !== 'object') {
          index.$eq = index[firstProperty]
        }
        // search via indexName
        if ($where) {
          iDBIndex = iDBObjectStore.index($where)
        }

        order = setOrder()
        iDBKeyRange = searchViaInequality()
        iDBKeyRange = searchViaInequalityRange()
        iDBKeyRange = searchViaEqualityCursor()
        iDBRequest  = searchViaEquality()
        return [iDBRequest, iDBKeyRange, iDBIndex]

        function filterSearchKey (i) {
          const reserved  = ['$where', '$orderby', '$gt', '$gte', '$lt', '$lte', '$between', '$within', '$eq', '$is', '$like']
          const keys = Object.keys(i).filter(function filter (key) {
            return reserved.includes(key) === false
          })
          return (keys.length) ? keys[0] : null // currently onlySearch by single index, use compound index to query multiple field
        }

        function setOrder () {
          if (index.hasOwnProperty('$orderby')) {
            return (index.$orderby.search(/desc/i) !== -1 || index.order === -1) ? 'prev' : 'next'
          }
          return order
        }

        function searchViaInequality () {
          if (!iDBIndex) {
            return
          }
          // limit top | higher than | equal to higher then | gte
          if (index.hasOwnProperty('$gte')) {
            iDBKeyRange  = IDBKeyRange.lowerBound(index.$gte)
          } else if (index.hasOwnProperty('$gt')) { // limit top | higher then | gt
            iDBKeyRange  = IDBKeyRange.lowerBound(index.$gt, true)
          } else if (index.hasOwnProperty('$lte')) { // limit bottom | lower than | equal to lower then | lte
            iDBKeyRange  = IDBKeyRange.upperBound(index.$lte)
          } else if (index.hasOwnProperty('$lt')) { // limit bottom | lower than
            iDBKeyRange  = IDBKeyRange.upperBound(index.$lt, true)
          }
          return iDBKeyRange
        }

        // eslint-disable-next-line complexity
        function searchViaInequalityRange () {
          let range1
          let range2
          if (!iDBIndex) {
            return
          }

          if (index.hasOwnProperty('$between') || (index.hasOwnProperty('$gt') && index.hasOwnProperty('$lt'))) {
            range1    = index.$between[0] || index.$gt
            range2    = index.$between[1] || index.$lt
            iDBKeyRange  = IDBKeyRange.bound(range1, range2, true, true)// exclusive
          } else if (index.hasOwnProperty('$within') || (index.hasOwnProperty('$gte') && index.hasOwnProperty('$lte'))) {
            range1    = index.$within[0] || index.$gte
            range2    = index.$within[1] || index.$lte
            iDBKeyRange  = IDBKeyRange.bound(range1, range2)// inclusive
          } else if (index.hasOwnProperty('$gt') && index.hasOwnProperty('$lte')) {
            iDBKeyRange  = IDBKeyRange.bound(index.$gt, index.$lte, true, false)
          } else if (index.hasOwnProperty('$gte') && index.hasOwnProperty('$lt')) {
            iDBKeyRange  = IDBKeyRange.bound(index.$gte, index.$lt, false, true)
          }
          return iDBKeyRange
        }

        function searchViaEqualityCursor () {
          if (!iDBIndex) {
            return
          }

          // FIRST GET INDEX:: where field1=value |conbination where+is=cursor
          if (index.hasOwnProperty('$is')) {
            iDBKeyRange = IDBKeyRange.only(index.$is)
          }
          // where like...
          if (index.hasOwnProperty('$like')) {
            iDBKeyRange = IDBKeyRange.bound(index.like, index.like + '\uffff')
          }
          return iDBKeyRange
        }

        function searchViaEquality () {
          if (!iDBIndex) {
            return
          }
          // FIRST GET INDEX:: where field1=value |combination where+equals=single
          if (index.hasOwnProperty('$eq')) {
            return iDBIndex.get(index.$eq)
          }
          return iDBRequest
        }
      }
    }

    function read (storeName, index) {
      const result  = []
      const iDBRequest = query(storeName, index)
      return new Promise(function promise (resolve, reject) {
        iDBRequest.addEventListener('success', onSuccess)
        iDBRequest.addEventListener('error', onComplete)
        iDBRequest.addEventListener('complete', _success(storeName, 'read', resolve, true, result))

        function onSuccess (e) {
          const cursor = e.target.result || iDBRequest.result
          if (cursor && cursor.value) {
            result.push(cursor.value)
            cursor.continue()
          } else if (cursor) {
            result.push(cursor)
          }
        }
        function onComplete (e) {
          console.info('Failed to read:: ' + storeName)
          reject({event: e, result: result})
        }
      })
    }

    function write (storeName, data, update = false) {
      let crud
      let iDBRequest
      const iDBObjectStore = iDBTransaction.objectStore(storeName)

      if (typeof data !== 'object') {
        console.error('The data passed is not an object:', data)
        return Promise.reject(false) // eslint-disable-line prefer-promise-reject-errors
      }

      if (!update) {
        iDBRequest = iDBObjectStore.add(data) // TODO: this return a promise
        crud = 'write'
      } else {
        iDBRequest = iDBObjectStore.put(data)
        crud = 'modified'
      }
      return new Promise(function promise (resolve, reject) {
        iDBRequest.addEventListener('success', _success(storeName, crud, resolve, options.console.write.success))
        iDBRequest.addEventListener('error', _error(storeName, crud, reject, true))
      })
    }

    function _anonymous () {}

    function _success (storeName, action, resolve, display) {
      resolve = resolve instanceof Function === false ? _anonymous : resolve
      return function inner (e) {
        if (display) {
          console.info('Successful ' + action + ' ' + storeName)
        }
        resolve(e)
      }
    }

    function _error (storeName, action, reject, display) {
      reject = reject instanceof Function === false ? _anonymous : reject
      return function inner (e) {
        let msg
        if (display) {
          msg = (e.target.error && e.target.error.message) ? e.target.error.message : ''
          console.error('Error on while trying to ' + action + ' on ' + storeName, msg)
        }
        reject(e)
      }
    }
  }

  if (window && 'noModule' in HTMLScriptElement.prototype) {
    export = {iAmDB, iAmCrud};
  }

  if (self) {
    self.iAmDB    = iAmDB
    self.iAmCrud  = iAmCrud
  }

  if (module) {
    module.exports = {iAmDB: iAmDB, iAmCrud: iAmCrud}
  }
}(window, self, module))
