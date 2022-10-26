/* global self */
/* eslint-disable  no-multi-spaces */
(function moduleDefinition (window, self, module) {
  function appConfig () {
    return {
      defaults: {
        views: {
          details: {modules: ['action', 'initForm', 'getPicture'], action: []},
          list: {modules: ['action'], action: []}
        }
      },
      lists: {
        view: {
          details: {title: 'Group details'},
          list: {title: 'Group list'}
        }
      },
      users: {
        view: {
          details: {title: 'User details'},
          list: {title: 'Users list'}
        }
      }
    }
  }

  function appSchema () {
    return {
      config: {
        name: 'config',
        title: 'Configuration store',
        description: 'Contains the setting for the application',
        properties: {
          name: {type: 'string', pk: true},
          type: {type: 'string'},
          description: {type: 'string'},
          value: {type: ['array', 'object', 'string']},
          createdAt: {type: 'datetime'},
          updatedAt: {type: 'datetime'}
        },
        required: ['name'],
        additionalProperties: true
      },
      offline: {
        name: 'offline',
        title: 'Offline schemae',
        properties: {
          key: {type: 'string', pk: true},
          value: {type: ['string', 'number', 'object']},
          createdAt: {type: 'datetime'},
          updatedAt: {type: 'datetime'}
        },
        required: ['key'],
        additionalProperties: false,
        definitions: {}
      },
      users: {
        name: 'users',
        title: 'Users schema',
        description: 'The schema description for the users store',
        properties: {
          firstname: {type: 'string', key: 'indexFirsrame'},
          surname: {type: 'string', key: 'indexLastame'},
          title: {
            type: 'array', ndx: 'refTitle', multiEntry: true
          }, // @e.g ['Mr', 'Mrs', 'Doc', 'etc...']
          position: {
            type: 'object', unique: 'positionName', keyPath: 'position.name', multiEntry: true
          }, // @e,g {name, desc, etc...}
          contact: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                email: {type: 'string'},
                number: {type: 'string'},
                type: {$ref: '#/definitions/contactType'}
              }
            }, // @e.g. [{email, number, type}]
            indexes: [
              {unique: 'uniqEmail', keyPath: 'contact.email'},
              {unique: 'uniqContact', keyPath: 'contact.number'}
            ]
          },
          createdAt: {type: 'datetime'},
          updatedAt: {type: 'datetime'}
        },
        additionalProperties: true,
        required: ['firstname', 'lastname', 'email'],
        definitions: {contactType: {type: 'string', enum: ['personal', 'work', 'secondary', 'other']}}
      }
    }
  }

  function dataSchema () {
    return {
      config: {
        data: [
          {
            name: 'BrowserSupport', type: 'config', description: 'Enabled for the following browser', value: ['Chrome', 'FireFox']
          }
        ],
        found: true
      }
    }
  }

  if (window) {
    window.appConfig   = appConfig
    window.appSchema   = appSchema
    window.dataSchema  = dataSchema
  }

  if (self) {
    self.appConfig  = appConfig
    self.appSchema  = appSchema
    self.dataSchema = dataSchema
  }

  if (module) {
    module.exports = {
      appConfig: appConfig,
      appSchema: appSchema,
      dataSchema: dataSchema
    }
  }
}(window, self, module))
