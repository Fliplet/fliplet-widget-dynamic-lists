Fliplet.Registry.set('dynamicListUtils', function() {
  var isoDateWarningIssued = false;

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
      var urlPattern = /^https?:\/\//i;
      var base64Pattern = /^data:image\/[^;]+;base64,/i;
      if (!urlPattern.test(validatedImage) && !base64Pattern.test(validatedImage)) {
        return '';
      }

      if (/api\.fliplet\.(com|local)/.test(validatedImage)) {
        // attach auth token
        validatedImage += (validatedImage.indexOf('?') === -1 ? '?' : '&') + 'auth_token=' + Fliplet.User.getAuthToken();
      }

      return validatedImage;
    });

    Handlebars.registerHelper('formatComment', function(text) {
      var breakRegExp = /(\r\n|\n|\r)/gm,
        emailRegExp = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/gm,
        numberRegExp = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,8}/gm,
        urlRegExp = /(?:^|[^@\.\w-])([a-z0-9]+:\/\/)?(\w(?!ailto:)\w+:\w+@)?([\w.-]+\.[a-z]{2,4})(:[0-9]+)?(\/.*)?(?=$|[^@\.\w-])/ig,
        mentionRegExp = /\B@[a-z0-9_-]+/ig;

      /* capture email addresses and turn into mailto links */
      text = text.replace(emailRegExp, '<a href="mailto:$&">$&</a>');

      /* capture phone numbers and turn into tel links */
      text = text.replace(numberRegExp, '<a href="tel:$&">$&</a>');

      /* capture URLs and turn into links */
      text = text.replace(urlRegExp, function(match, p1, p2, p3, p4, p5, offset, string) {
        return breakRegExp.test(string) ? ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a><br>' :
          ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a>';
      });

      text = text.replace(mentionRegExp, '<strong>$&</strong>');

      /* capture line break and turn into <br> */
      text = text.replace(breakRegExp, '<br>');

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
    return !_.isEmpty(userData)
      && userData[config.userEmailColumn] === record.data[config.userListEmailColumn];
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
      getFields: getRecordFields
    },
    User: {
      isAdmin: userIsAdmin,
      canAddRecord: userCanAddRecord
    }
  };
}());
