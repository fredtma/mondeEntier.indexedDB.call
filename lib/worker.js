/* global self, init */
self.importScripts('schema.js', 'methods.js', 'factory.iAmDB.js')
self.addEventListener('message', function onMessage (e) {
  let iAmDB;
  switch(e.data.type) {
    case 'setup':
      iAmDB = iAmDB(e.data.name, e.data.version, e.data.options);
      break;
    case 'transaction':
      try {
        const crud = iAmDB.initTransaction(e.data.stores, e.data.mode)
        crud[e.data.method](...e.data.params)
          .then((result) => self.postMessage({...result, timestamp: e.data.timestamp, method: e.data.method}))
          .catch((error) => {
            console.error(error)
            self.postMessage({message: error.message, timestamp: e.data.timestamp, type: 'error'})
          })
      } catch (err) {
        console.error(err.message)
        self.postMessage({message: error.message, type: 'error'})
      }
      break;
  }
})
// @todo: bulk array insert/update
