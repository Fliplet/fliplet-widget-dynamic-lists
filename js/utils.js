Fliplet.Registry.set('dynamicListUtils', function() {
  var isoDateWarningIssued = false;
  var cachedFiles = {};
  var Static = {
    RegExp: {
      httpUrl: /^https?:\/\//i,
      base64Image: /^data:image\/[^;]+;base64,/i,
      dataSourcesPath: /^datasources\//i,
      number: /^\d+$/i,
      linebreak: /(\r\n|\n|\r)/gm,
      email: /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/gm,
      phone: /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,8}/gm,
      url: /(?:^|[^@\.\w-])([a-z0-9]+:\/\/)?(\w(?!ailto:)\w+:\w+@)?([\w.-]+\.[a-z]{2,4})(:[0-9]+)?(\/.*)?(?=$|[^@\.\w-])/ig,
      mention: /\B@[a-z0-9_-]+/ig
    }
  };

  function isValidImageUrl(str) {
    return Static.RegExp.httpUrl.test(str)
      || Static.RegExp.base64Image.test(str)
      || Static.RegExp.dataSourcesPath.test(str);
  }

  function registerHandlebarsHelpers() {
    Handlebars.registerHelper('plaintext', function(context) {
      result = $('<div></div>').html(context).text();
      return $('<div></div>').html(result).text();
    });

    Handlebars.registerHelper('removeSpaces', function(context) {
      return context.replace(/\s+/g, '');
    });

    Handlebars.registerHelper('formatDate', function(date) {
      if (!date) {
        return;
      }

      return getMomentDate(date).format('DD MMMM YYYY');
    });

    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    Handlebars.registerHelper('validateImage', function(image) {
      var validatedImage = image;

      if (!validatedImage) {
        return '';
      }

      if (Array.isArray(validatedImage) && !validatedImage.length) {
        return '';
      }

      // Validate thumbnail against URL and Base64 patterns
      if (!Static.RegExp.httpUrl.test(validatedImage) && !Static.RegExp.base64Image.test(validatedImage)) {
        return '';
      }

      if (/api\.fliplet\.(com|local)/.test(validatedImage)) {
        // attach auth token
        validatedImage += (validatedImage.indexOf('?') === -1 ? '?' : '&') + 'auth_token=' + Fliplet.User.getAuthToken();
      }

      return validatedImage;
    });

    Handlebars.registerHelper('formatComment', function(text) {
      /* capture email addresses and turn into mailto links */
      text = text.replace(Static.RegExp.email, '<a href="mailto:$&">$&</a>');

      /* capture phone numbers and turn into tel links */
      text = text.replace(Static.RegExp.phone, '<a href="tel:$&">$&</a>');

      /* capture URLs and turn into links */
      text = text.replace(Static.RegExp.url, function(match, p1, p2, p3, p4, p5, offset, string) {
        return Static.RegExp.linebreak.test(string) ? ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a><br>' :
          ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a>';
      });

      text = text.replace(Static.RegExp.mention, '<strong>$&</strong>');

      /* capture line break and turn into <br> */
      text = text.replace(Static.RegExp.linebreak, '<br>');

      return new Handlebars.SafeString(text);
    });
  }

  function getMomentDate(date) {
    if (!date) {
      return moment();
    }

    if (_.get(date, '_isAMomentObject') === true) {
      return date;
    }

    if (date.constructor.name === 'Date') {
      return moment(date);
    }

    if (typeof date === 'number') {
      return moment(date);
    }

    if (date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return moment(new Date(date.substr(0, 10))).utc();
    } else if (!isoDateWarningIssued) {
      console.warn('Date input is not provided in ISO format. This may create inconsistency in the app. We recommend ensuring the date is formatted in ISO format, e.g. ' + new Date().toISOString().substr(0, 10));
      isoDateWarningIssued = true;
    }

    return moment(new Date(date));
  }

  function removeSymbols(str) {
    return ('' + str).replace(/[&\/\\#,+()$~%.`'‘’"“”:*?<>{}]+/g, '');
  }

  function recordContains(record, value) {
    if (!record) {
      return false;
    }

    if (_.isArray(record)) {
      return _.some(record, function (el) {
        return recordContains(el, value);
      });
    }

    if (_.isObject(record)) {
      return _.some(_.values(record), function (el) {
        return recordContains(el, value);
      });
    }

    record = removeSymbols(record).toLowerCase();
    value = removeSymbols(value).toLowerCase().trim();

    return record.indexOf(value) > -1;
  }

  function recordIsEditable(record, config, userData) {
    if (_.isNil(config.editEntry) || _.isNil(config.editPermissions)) {
      return false;
    }

    if (!config.editEntry) {
      return false;
    }

    switch (config.editPermissions) {
      case 'everyone':
        return true;
      case 'user':
        return recordIsCurrentUser(record, config, userData);
      case 'users-admins':
        return recordIsCurrentUser(record, config, userData) || userIsAdmin(config, userData);
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  function recordIsDeletable(record, config, userData) {
    if (_.isNil(config.deleteEntry) || _.isNil(config.deletePermissions)) {
      return false;
    }

    if (!config.deleteEntry) {
      return false;
    }

    switch (config.deletePermissions) {
      case 'everyone':
        return true;
      case 'user':
        return recordIsCurrentUser(record, config, userData);
      case 'users-admins':
        return recordIsCurrentUser(record, config, userData) || userIsAdmin(config, userData);
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  function runRecordFilters(records, filters) {
    var operators = {
      '==': function(a, b) { return a == b },
      '!=': function(a, b) { return a != b },
      '>': function(a, b) { return smartParseFloat(a) > smartParseFloat(b) },
      '>=': function(a, b) { return smartParseFloat(a) >= smartParseFloat(b) },
      '<': function(a, b) { return smartParseFloat(a) < smartParseFloat(b) },
      '<=': function(a, b) { return smartParseFloat(a) <= smartParseFloat(b) }
    };

    function smartParseFloat(value) {
      // Convert strings to numbers where possible so that
      // strings that reprepsent numbers are compared as numbers
      if (!_.isString(value)) {
        return value;
      }

      if (isNaN(parseFloat(value.trim()))) {
        return value;
      }

      if (parseFloat(value.trim()).toString() !== value.trim()) {
        return value;
      }

      return parseFloat(value);
    }

    return _.filter(records, function(record) {
      return _.every(filters, function(filter) {
        if (!filter.condition === 'none' || filter.column === 'none' || !filter.value) {
          // Filter isn't configured correctly
          return true;
        }

        var condition = filter.condition;
        var rowData;

        // Case insensitive
        if (typeof filter.value === 'string') {
          filter.value = filter.value.toLowerCase();
        }

        if (!_.isNull(_.get(record, 'data.' + filter.column, null))) {
          rowData = record.data[filter.column].toString().toLowerCase();
        }

        switch (condition) {
          case 'contains':
            return rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) > -1;
          case 'notcontain':
            return rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) === -1;
          case 'regex':
            var pattern = new RegExp(filter.value, 'gi');
            return pattern.test(rowData);
          default:
            return _.isFunction(operators[condition])
              ? operators[condition](rowData, filter.value)
              : true;
        }
      });
    });
  }

  function getRecordFields(records, key) {
    records = records || [];

    var cachedFields = {};
    var fields;

    if (key && cachedFields[key]) {
      return Promise.resolve(cachedFields[key]);
    }

    records.unshift({});
    fields = _.keys(_.extend.apply({}, _.map(records, 'data')));
    records.shift();

    if (key) {
      cachedFields[key] = fields;
    }

    return Promise.resolve(fields);
  }

  function getFiles(data) {
    var cacheKey = JSON.stringify(data.query);

    if (!cachedFiles[cacheKey]) {
      cachedFiles[cacheKey] = Fliplet.Media.Folders.get(data.query)
        .then(function (response) {
          response.files.forEach(function (file) {
            if (file.isEncrypted) {
              file.url = Fliplet.Media.authenticate(file.url);
            }
          });

          return response;
        })
        .catch(function () {
          return Promise.resolve({ files: [], folders: [] });
        });
    }

    return cachedFiles[cacheKey]
      .then(function(response) {
        if (!data.field) {
          return data.record;
        }

        var entryData = data.record.data;
        var column = data.field.column;

        if (isValidImageUrl(entryData[column])) {
          // Record data doesn't need updating
          return data.record;
        }

        var urlEdited = _.some(response.files, function(file) {
          if (!_.compact(entryData[column]).length) {
            return;
          }

          if (entryData[column] && file.name.indexOf(entryData[column]) !== -1) {
            // File found
            entryData[column] = file.url;
            return true;
          } else if (Static.RegExp.number.test(entryData[column])
            && parseInt(entryData[column], 10) === file.id) {
            entryData[column] = file.url;
            return true;
          }
        });

        if (!urlEdited) {
          entryData[column] = '';
        }

        return data.record;
      });
  }

  function updateRecordFiles(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};
    var forComments = !!options.forComments;

    if (forComments && !config.userPhotoColumn) {
      return Promise.resolve(records);
    }

    var filePromises = [];

    _.forEach(records, function(record) {
      var defaultData = {
        query: {},
        record: record,
        field: undefined
      };

      if (!forComments) {
        _.forEach([config['summary-fields'], config.detailViewOptions], function (fields) {
          _.forEach(fields, function(field) {
            if (field.type !== 'image') {
              return;
            }

            switch (field.imageField) {
              case 'app':
                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    appId: field.appFolderId
                  },
                  field: field
                })));
                break;
              case 'organization':
                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    organizationId: field.organizationFolderId
                  },
                  field: field
                })));
                break;
              case 'all-folders':
                var folderId = _.get(field, 'folder.selectFiles.0.id');
                if (!folderId) {
                  return;
                }

                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    folderId: folderId
                  },
                  field: field
                })));
                break;
              case 'url':
                if (!isValidImageUrl(record.data[field.column])) {
                  record.data[field.column] = '';
                }
                break;
              default:
                break;
            }
          });
        });
      } else {
        switch (config.userFolderOption) {
          case 'app':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                appId: config.userAppFolder
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'organization':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                organizationId: config.userOrgFolder
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'all-folders':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                folderId: _.get(config, 'userFolder.folder.selectFiles.0.id')
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'url':
            if (!isValidImageUrl(record.data[config.userPhotoColumn])) {
              record.data[config.userPhotoColumn] = '';
            }
            break;
          default:
            break;
        }
      }
    });

    if (filePromises.length) {
      return Promise.all(filePromises);
    }

    return Promise.resolve(records);
  }

  function userIsAdmin(config, userData) {
    var adminValue = _.get(userData, config.userAdminColumn);

    if (_.isNil(config.userAdminValue) || config.userAdminValue === '') {
      // No valid comparison value is given
      // User is admin if adminValue is truthy
      return !!adminValue;
    }

    // User is admin if adminValue matches comparison value
    if (_.isArray(adminValue)) {
      return adminValue.indexOf(config.userAdminValue) > -1;
    }

    return adminValue === config.userAdminValue;
  }

  function recordIsCurrentUser(record, config, userData) {
    return config.userEmailColumn !== 'none'
      && !_.isEmpty(_.get(userData, config.userEmailColumn))
      && !_.isEmpty(_.get(record, ['data', config.userListEmailColumn]))
      && _.get(userData, config.userEmailColumn) === _.get(record, ['data', config.userListEmailColumn]);
  }

  function userCanAddRecord(config, userData) {
    if (_.isNil(config.addEntry) || _.isNil(config.addPermissions)) {
      return false;
    }

    if (!config.addEntry) {
      return false;
    }

    switch (config.addPermissions) {
      case 'everyone':
        return true;
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  return {
    registerHandlebarsHelpers: registerHandlebarsHelpers,
    Date: {
      moment: getMomentDate
    },
    Record: {
      contains: recordContains,
      isEditable: recordIsEditable,
      isDeletable: recordIsDeletable,
      isCurrentUser: recordIsCurrentUser
    },
    Records: {
      runFilters: runRecordFilters,
      getFields: getRecordFields,
      updateFiles: updateRecordFiles
    },
    User: {
      isAdmin: userIsAdmin,
      canAddRecord: userCanAddRecord
    }
  };
}());
