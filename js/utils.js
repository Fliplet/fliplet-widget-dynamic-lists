Fliplet.Registry.set('dynamicListUtils', (function () {
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
    },
    refArraySeparator: '.$.'
  };
  var computedFieldClashes = [];

  function isValidImageUrl(str) {
    return Static.RegExp.httpUrl.test(str)
      || Static.RegExp.base64Image.test(str)
      || Static.RegExp.dataSourcesPath.test(str);
  }

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

  function registerHandlebarsHelpers() {
    Handlebars.registerHelper('plaintext', function(context) {
      if (typeof context === 'object' && typeof context.toString === 'function') {
        context = context.toString();
      }

      return $('<div></div>').html(context).text();
    });

    Handlebars.registerHelper('removeSpaces', function (context) {
      return context.replace(/\s+/g, '');
    });

    Handlebars.registerHelper('formatDate', function (date) {
      if (!date) {
        return;
      }

      return getMomentDate(date).format('DD MMMM YYYY');
    });

    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) // eslint-disable-line eqeqeq
            ? options.fn(this)
            : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) // eslint-disable-line eqeqeq
            ? options.fn(this)
            : options.inverse(this);
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

    Handlebars.registerHelper('validateImage', function (image) {
      var validatedImage = image;

      if (!validatedImage) {
        return '';
      }

      if (_.isArray(validatedImage) && !validatedImage.length) {
        return '';
      }

      // Validate thumbnail against URL and Base64 patterns
      if (!Static.RegExp.httpUrl.test(validatedImage) && !Static.RegExp.base64Image.test(validatedImage)) {
        return '';
      }

      return Fliplet.Media.authenticate(validatedImage);
    });

    Handlebars.registerHelper('formatComment', function(text) {
      var res = text;

      /* capture email addresses and turn into mailto links */
      res = res.replace(Static.RegExp.email, '<a href="mailto:$&">$&</a>');

      /* capture phone numbers and turn into tel links */
      res = res.replace(Static.RegExp.phone, '<a href="tel:$&">$&</a>');

      /* capture URLs and turn into links */
      res = res.replace(Static.RegExp.url, function(match, p1, p2, p3, p4, p5, offset, string) {
        return Static.RegExp.linebreak.test(string) ? ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a><br>' :
          ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a>';
      });

      res = res.replace(Static.RegExp.mention, '<strong>$&</strong>');

      /* capture line break and turn into <br> */
      res = res.replace(Static.RegExp.linebreak, '<br>');

      return new Handlebars.SafeString(res);
    });
  }

  function splitByCommas(str) {
    if (str === undefined || str === null) {
      return [];
    }

    if (_.isArray(str)) {
      return _.flatten(_.map(str, splitByCommas));
    }

    if (typeof str !== 'string') {
      return [str];
    }

    // Split a string by commas but ignore commas within double-quotes using Javascript
    // https://stackoverflow.com/questions/11456850/split-a-string-by-commas-but-ignore-commas-within-double-quotes-using-javascript
    var regexp = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
    var arr = [];
    var res = regexp.exec(str);
    while (res !== null) {
      arr.push(res[0].replace(/(?:^")|(?:"$)/g, '').trim());
      res = regexp.exec(str);
    }

    return _.filter(_.map(arr, function (s) {
      return ('' + s).trim();
    }), function (value) {
      return [undefined, null, '', NaN].indexOf(value) === -1;
    });
  }

  function getMomentDate(date) {
    if (!date) {
      return moment();
    }

    if (_.get(date, '_isAMomentObject') === true) {
      // Moment object
      return date;
    }

    if (date.constructor.name === 'Date') {
      // Date object
      return moment(date);
    }

    if (typeof date === 'number') {
      // Number
      return moment(date);
    }

    if (date.string) {
      // Handlebars variable
      date = date.string;
    }

    if (date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return moment(new Date(date.substr(0, 10))).utc();
    } else if (!isoDateWarningIssued) {
      console.warn('Date input is not provided in ISO format. This may create inconsistency in the app. We recommend ensuring the date is formatted in ISO format, e.g. ' + new Date().toISOString().substr(0, 10));
      isoDateWarningIssued = true;
    }

    return moment(new Date(date));
  }

  function getFilterQuerySelectors(options) {
    options = options || {};

    var query = options.query || {};

    if (!_.get(query, 'value', []).length) {
      return [];
    }

    var selectors = [];

    if (!Array.isArray(query.value)) {
      query.value = [query.value];
    }

    // Select filters using on legacy class-based methods
    query.value.forEach(function(values, index) {
      if (!Array.isArray(values)) {
        query.value[index] = [values];
      }

      query.value[index].forEach(function (value) {
        var className = value.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
        selectors.push('[data-toggle="' + className + '"]');
      });
    });

    if (_.get(query, 'column', []).length) {
      // Select filters using on legacy column-specific methods
      query.column.forEach(function (field, index) {
        query.value[index].forEach(function (value) {
          selectors.push('[data-field="' + field + '"][data-value="' + value + '"]');
        });
      });
    }

    return selectors;
  }

  function removeSymbols(str) {
    return ('' + str).replace(/[&\/\\#,+()$~%.`'‘’"“”:*?<>{}]+/g, '');
  }

  function recordContains(record, value) {
    if (_.isNil(record)) {
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
    if (!filters || _.isEmpty(filters)) {
      return records;
    }

    var operators = {
      '==': function (a, b) { return a == b }, // eslint-disable-line eqeqeq
      '!=': function (a, b) { return a != b }, // eslint-disable-line eqeqeq
      '>': function (a, b) { return smartParseFloat(a) > smartParseFloat(b) },
      '>=': function (a, b) { return smartParseFloat(a) >= smartParseFloat(b) },
      '<': function (a, b) { return smartParseFloat(a) < smartParseFloat(b) },
      '<=': function (a, b) { return smartParseFloat(a) <= smartParseFloat(b) }
    };

    return _.filter(records, function (record) {
      return _.every(filters, function (filter) {
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

  function runActiveFilters(options) {
    options = options || {};

    var records = options.records || [];
    var filters = options.filters;
    var config = options.config;
    var showBookmarks = _.get(config, 'social.bookmark') && options.showBookmarks;

    if (_.isEmpty(filters)) {
      if (!showBookmarks) {
        return records;
      }

      return _.filter(records, { bookmarked: true });
    }

    var filteredData = [];

    return _.filter(records, function (record) {
      return (!showBookmarks || record.bookmarked) && recordMatchesFilters({
        record: record,
        filters: filters,
        config: config
      });
    });
  }

  function runRecordSearch(options) {
    options = options || {};

    var value = options.value || '';
    var records = options.records || [];
    var fields = options.fields || [];
    var config = options.config || {};
    var activeFilters = options.activeFilters || {};
    var showBookmarks = _.get(config, 'social.bookmark') && options.showBookmarks;
    var limit = _.get(options, 'limit', -1);

    if (!Array.isArray(fields)) {
      fields = _.compact([fields]);
    }

    if (typeof config.searchData === 'function') {
      var runSearch = config.searchData({
        config: config,
        query: value,
        activeFilters: activeFilters,
        records: records,
        showBookmarks: showBookmarks,
        limit: limit
      });

      if (!(runSearch instanceof Promise)) {
        runSearch = Promise.resolve(runSearch);
      }

      return runSearch;
    }

    var searchResults = [];
    var truncated = _.some(records, function (record) {
      // Check for bookmark status
      if (showBookmarks && !record.bookmarked) {
        return false;
      }

      // Check against filters
      if (!recordMatchesFilters({
        record: record,
        filters: activeFilters,
        config: config
      })) {
        return false;
      }

      // No string
      if (value === '') {
        searchResults.push(record);
        return limit > -1 && searchResults.length >= limit;
      }

      // Use custom string match function
      if (typeof config.searchMatch === 'function') {
        var matchesSearch = config.searchMatch({
          record: record,
          value: value,
          fields: fields
        });

        if (!matchesSearch) {
          return false;
        }

        searchResults.push(record);
        return limit > -1 && searchResults.length >= limit;
      }

      // Check if record contains value in the search fields
      var containsSearch = _.some(fields, function (field) {
        return recordContains(record.data[field], value);
      });

      if (!containsSearch) {
        return false;
      }

      searchResults.push(record);
      return limit > -1 && searchResults.length >= limit;
    });

    return Promise.resolve({
      records: searchResults,
      truncated: truncated
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

  function convertData(data) {
    // Converts data as jQuery.data() does when reading data attributes
    // Source: https://github.com/jquery/jquery/blob/master/src/data.js
    var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;

    if (data === 'true') {
      return true;
    }

    if (data === 'false') {
      return false;
    }

    if (data === 'null') {
      return null;
    }

    // Only convert to a number if it doesn't change the string
    if (data === +data + '') {
      return +data;
    }

    if (rbrace.test(data)) {
      // Returned parsed object/array if it starts with { or [
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }

    return data;
  }

  function recordMatchesFilters(options) {
    options = options || {};

    var record = options.record;
    var filters = options.filters;
    var config = options.config;

    var recordFieldValues = _.zipObject(_.keys(filters), _.map(_.keys(filters), function (field) {
      return _.map(_.uniq(getRecordField({
        record: record,
        field: field,
        useData: true
      })), convertData);
    }));

    // Returns true if record matches all of provided filters and values
    return _.every(_.keys(filters), function (field) {
      return _.every(filters[field], function (value) {
        if (field === 'undefined') {
          // Legacy class-based filters
          return _.includes(_.map(_.get(record, 'data.flFilters'), 'data.class'), value);
        }

        // Filter UI contains data-field, i.e. uses new field-based filters
        return _.some(_.get(recordFieldValues, field), function (recordFieldValue) {
          // Loosely typed comparison is used to make filtering more predictable for users
          return recordFieldValue == value;
        });
      });
    });
  }

  function getRecordFieldValues(records, fields) {
    // Extract a list of filter values based on a list of records and filter fields
    if (_.isUndefined(fields) || _.isNull(fields)) {
      return [];
    }

    if (!_.isArray(fields)) {
      fields = [fields];
    }

    return _.zipObject(fields, _.map(fields, function (field) {
      return _.sortBy(_.uniq(splitByCommas(_.map(records, 'data.' + field))));
    }));
  }

  function parseRecordFilters(options) {
    options = options || {};

    var records = options.records || [];
    var filters = options.filters || [];
    var id = options.id;

    // Parse legacy flFilters from records to generate a list of filter values
    return _.orderBy(_.map(
      _.groupBy(_.orderBy(_.uniqBy(_.flatten(_.map(records, 'flFilters')), function (filter) {
        // _.uniqBy iteratee
        return JSON.stringify(filter);
      }), 'data.name'), 'type'),
      function (values, field) {
        // _.map iteratee for defining of each filter value
        return {
          id: id,
          name: field,
          data: _.map(values, 'data')
        };
      }),
      function (filter) {
        // _.orderBy iteratee
        return _.indexOf(filters, filter.name);
      });
  }

  function getRecordField(options) {
    options = options || {};

    var record = options.record;
    var field = options.field;
    var useData = options.useData;

    if (!field) {
      return [];
    }

    if (typeof field === 'function') {
      return field(record);
    }

    if (Array.isArray(field)) {
      var path = field.shift();

      if (field.length) {
        var arr = _.get(record, (useData ? 'data.' : '') + path);
        return _.map(arr, function (item) {
          return getRecordField({
            record: item,
            field: _.clone(field),
            useData: false
          });
        });
      }

      return getRecordField({
        record: record,
        field: path,
        useData: useData
      });
    }

    if (typeof field === 'string') {
      return splitByCommas(_.get(record, (useData ? 'data.' : '') + field));
    }

    return [];
  }

  function addRecordFilterProperties(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};

    // Function that get and converts the categories for the filters to work
    records.forEach(function (record) {
      var classes = [];
      record.data['flFilters'] = [];
      _.forEach(config.filterFields, function (field) {
        _.forEach(getRecordField({
          record: record,
          field: field,
          useData: true
        }), function (item, index) {
          var classConverted = ('' + item).toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
          var newObj = {
            type: field,
            data: {
              name: item,
              class: classConverted
            }
          };

          classes.push(classConverted);
          record.data['flFilters'].push(newObj);
        });
      });
      record.data['flClasses'] = _.compact(_.uniq(classes)).join(' ');
    });

    return records;
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
        .catch(function (error) {
          console.warn('Error retrieving files', error, data);
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

  function prepareRecordsData(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};

    if (!_.isArray(config.filterOptions) && _.isObject(config.filterOptions)) {
      config.filterOptions = [config.filterOptions];
    }

    // Filter data based on filter options, filter queries and PV storage values (deprecated)
    var filters = _.compact(_.concat(config.filterOptions, options.filterQueries));
    records = runRecordFilters(records, _.map(filters, function(option) {
      return {
        column: option.column,
        condition: option.logic,
        value: option.value
      };
    }));

    if (config.sortOptions.length) {
      var sortFields = _.map(config.sortOptions, function(option) {
        return {
          column: option.column,
          type: option.sortBy
        };
      });

      // Modify a clone of the records for sorting
      var modifiedRecords = _.map(_.clone(records), function(record) {
        sortFields.forEach(function(field) {
          var sortField = 'modified_' + field.column;
          record.data[sortField] = (record.data[field.column] || '').toString().toUpperCase();

          // Modify field values based on sort types
          switch (field.type) {
            case 'alphabetical':
              record.data[sortField] = record.data[sortField].normalize('NFD').match(/[A-Za-z]/)
                ? record.data[sortField].normalize('NFD')
                : '{' + record.data[sortField];
              break;
            case 'numerical':
              record.data[sortField] = record.data[sortField].match(/[0-9]/)
                ? parseInt(record.data[sortField], 10)
                : record.data[sortField];
              break;
            case 'date':
              // If an incorrect date format is used, the entry will be pushed at the end
              record.data[sortField] = getMomentDate(record.data[sortField]).format('YYYY-MM-DD');
              break;
            case 'time':
              record.data[sortField] = record.data[sortField];
              break;
          }
        });

        return record;
      });

      var sortColumns = _.map(sortFields, function (field) {
        return 'data[modified_' + field.column + ']';
      });

      var sortOrders = _.map(config.sortOptions, function (option) {
        switch (option.orderBy) {
          case 'descending':
            return 'desc';
          case 'ascending':
          default:
            return 'asc';
        }
      });

      // Sort data
      records = _.orderBy(modifiedRecords, sortColumns, sortOrders);
    }

    // Add flag for social features
    records.forEach(function(record) {
      // Add likes flag
      record.likesEnabled = config.social && config.social.likes;

      // Add bookmarks flag
      record.bookmarksEnabled = config.social && config.social.bookmark;

      // Add comments flag
      record.commentsEnabled = config.social && config.social.comments;
    });

    return records;
  }

  function addRecordComputedFields(options) {
    options = options || {};

    var record = options.record || {};
    var computedFields = options.computedFields || {};

    _.forIn(computedFields, function (getter, field) {
      if (_.has(record, ['data', field]) && computedFieldClashes.indexOf(field) === -1) {
        computedFieldClashes.push(field);
      }

      _.set(record, ['data', field], getRecordField({
        record: record,
        field: typeof getter === 'string' ? getter.split(Static.refArraySeparator) : getter,
        useData: true
      }));
    });
  }

  function addRecordsComputedFields(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config;

    _.forEach(records, function (record) {
      addRecordComputedFields({
        record: record,
        computedFields: config.computedFields
      })
    });

    if (computedFieldClashes.length) {
      var clashedFields = computedFieldClashes.sort().join(', ');
      console.warn('Computed field(s) "' + clashedFields + '" are already defined as a property for one or more records. All computed fields will overwrite existing properties. Use a different computed field name if you want to prevent the data from being overwritten.');
    }
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

  function getjQueryObjects(target) {
    if (target instanceof jQuery) {
      return target;
    }

    var $target = $();

    // target is a DOM element or a selector string
    if (target.tagName || typeof target === 'string') {
      $target = $(target);
    }

    // target is expected as an array of DOM elements
    if (target instanceof NodeList || target instanceof Array) {
      // Non-DOM elements in the array are removed
      target = _.filter(target, function (element) {
        return element.tagName;
      });

      $target = $(target);
    }

    return $target;
  }

  function getUsersToMention(options) {
    options = options || {};

    var allUsers = options.allUsers;
    var config = options.config;

    return _.map(allUsers, function(user) {
      var userName = '';
      var userNickname = '';
      var counter = 1;

      if (config.userNameFields && config.userNameFields.length > 1) {
        config.userNameFields.forEach(function(name, i) {
          userName += user.data[name] + ' ';
          userNickname += counter === 1
            ? (user.data[name] || '').toLowerCase().charAt(0) + ' '
            : (user.data[name] || '').toLowerCase().replace(/\s/g, '') + ' ';
        });
        userName = userName.trim();
        userNickname = userNickname.trim();

        counter++;
      } else {
        userName = user.data[config.userNameFields[0]] || '';
        userNickname = (user.data[config.userNameFields[0]] || '').toLowerCase().replace(/\s/g, '')
      }

      return {
        id: user.id,
        username: userNickname,
        name: userName,
        image: user.data[config.userPhotoColumn] || ''
      };
    });
  }

  return {
    registerHandlebarsHelpers: registerHandlebarsHelpers,
    DOM: {
      $: getjQueryObjects
    },
    String: {
      splitByCommas: splitByCommas
    },
    Date: {
      moment: getMomentDate
    },
    Query: {
      getFilterSelectors: getFilterQuerySelectors,
    },
    Record: {
      contains: recordContains,
      isEditable: recordIsEditable,
      isDeletable: recordIsDeletable,
      isCurrentUser: recordIsCurrentUser,
      matchesFilters: recordMatchesFilters
    },
    Records: {
      runFilters: runRecordFilters,
      runActiveFilters: runActiveFilters,
      runSearch: runRecordSearch,
      getFields: getRecordFields,
      getFieldValues: getRecordFieldValues,
      parseFilters: parseRecordFilters,
      addFilterProperties: addRecordFilterProperties,
      updateFiles: updateRecordFiles,
      prepareData: prepareRecordsData,
      addComputedFields: addRecordsComputedFields
    },
    User: {
      isAdmin: userIsAdmin,
      canAddRecord: userCanAddRecord
    },
    Users: {
      getUsersToMention: getUsersToMention
    }
  };
}()));