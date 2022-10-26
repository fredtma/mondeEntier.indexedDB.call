const Blob = window.Blob
const Worker = window.Worker

class AngularIDB {
  self = this

  constructor(files) {
    this.worker = this.#setupWorker(files)
  }

  createTransaction () {
      return {
        clear: this.call('clear'),
        delete: this.call('erase'),
        get: this.call('read', 'readonly'),
        set: this.call('write'),
        update: this.call('modify')
      }
  }

  call (method, mode = 'readwrite') {
    return function inner (stores, ...params) {
      return new Promise((resolve, reject) => {
        var timestamp = (new Date()).getTime()

        worker.postMessage({
          type: 'transaction',
          method,
          stores,
          params,
          mode,
          timestamp,
        })
        worker.addEventListener(method, listening(timestamp), {once: true});
        worker.addEventListener(error, reject, {once: true});

        function listening (stamp) {
          return (e, data) => {
            const detail = e.detail || data;
            if (detail.timestamp === stamp) {
              resolve(detail)
            }
          }
        }
      });
    }
  }

  init (name = 'localIDB', version = 1, options = {}) {
    if (this.worker) {
      worker.postMessage({name, version, options, type: 'setup'})
      worker.addEventListener('message', this.#onWorkerMessage.bind(this), false)
      worker.addEventListener('error', (e) => console.error('Worker return error:: ' + e.message, e), false)
    }
  }

  #onWorkerMessage (e) {
    switch (key) {
    case 'error':
      worker.dispatchEvent(new CustomEvent('error', {detail: e.data}))
      break
    case 'close':
      worker.terminate()
      break
    default:
      worker.dispatchEvent(new CustomEvent(e.data.method, {detail: e.data}))
      break;
    }
  }

  #setupWorker (files = ['schema.js', 'methods.js', 'factory.iAmDB.js']) {
    let aWorker
    let blob
    const hasWebWorker = typeof Worker !== 'undefined'
    const content = `
    self.importScripts('${files.split(', ')}')
    self.addEventListener('message', function onMessage (e) {
      let iAmDB;
      switch(e.data.type) {
        case 'setup':
          iAmDB = iAmDB(e.data.name, e.data.version, e.data.options);
          break;
        case 'transaction':
          try {
            const crud = iAmDB.initTransaction(e.data.stores, e.data.readWrite)
            crud[e.data.action](...e.data.params)
              .then((result) => self.postMessage(result))
              .catch(console.error)
          } catch (err) {
            console.error(err.message)
          }
          break;
      }
    })
`
    if (hasWebWorker) {
      try {
        blob = new Blob([content], {type: 'text/javascript'})
        aWorker = new Worker(window.URL.createObjectURL(blob))
      } catch (err) {
        console.warn(err.message)
        try {
          aWorker = new Worker('worker.js')
        } catch (err) {
          hasWebWorker = false
          console.error(err.message)
        }
      }
    }
    return aWorker
  }
}
