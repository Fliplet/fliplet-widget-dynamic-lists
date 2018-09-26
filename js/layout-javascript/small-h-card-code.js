var smallHorizontalLayoutMapping = {
  'small-h-card': {
    'base': 'templates.build.small-h-card-base',
    'loop': 'templates.build.small-h-card-loop',
    'detail': 'templates.build.small-h-card-detail',
  }
};

var operators = {
  '==': function(a, b) { return a == b },
  '!=': function(a, b) { return a != b },
  '>': function(a, b) { return a > b },
  '>=': function(a, b) { return a >= b },
  '<': function(a, b) { return a < b },
  '<=': function(a, b) { return a <= b }
};

// Constructor
var DynamicList = function(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.queryOptions = {};

  // Other variables
  // Global variables
  this.allowClick = true;

  this.emailField = 'Email';
  this.myProfileData;
  this.myUserData;

  this.listItems;
  this.dataSourceColumns;

  // Register handlebars helpers
  this.profileHTML = this.data.advancedSettings && this.data.advancedSettings.detailHTML
  ? Handlebars.compile(this.data.advancedSettings.detailHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[smallHorizontalLayoutMapping[this.data.layout]['detail']]());

  this.registerHandlebarsHelpers();
  // Get the current session data
  Fliplet.Session.get().then(function(session) {
    if (session && session.entries && session.entries.dataSource) {
      _this.myUserData = session.entries.dataSource.data;
    } else if (session && session.entries && session.entries.saml2) {
      _this.myUserData = session.entries.saml2.user;
      _this.myUserData.isSaml2 = true;
    }
    
    // Start running the Public functions
    _this.initialize();
  });
};

DynamicList.prototype.registerHandlebarsHelpers = function() {
  // Register your handlebars helpers here
  var _this = this;

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

  Handlebars.registerHelper('formatDate', function(date) {
    return moment(date).utc().format('MMM Do YYYY');
  });

  Handlebars.registerHelper('removeSpaces', function(context) {
    return context.replace(/\s+/g, '');
  });
}

DynamicList.prototype.attachObservers = function() {
  var _this = this;
  // Attach your event listeners here
  _this.$container
    .on('click', '.small-h-card-list-detail-button a', function() {
      var _that = $(this);
       Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_buttons',
        label: _that.find('.small-h-card-list-detail-button-text').text()
      });
    })
    .on('touchstart', '.small-h-card-list-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.small-h-card-list-item', function() {
      _this.allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.small-h-card-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        _this.allowClick = true;
      }, 100);
    })
    .on('click', '.my-profile-container', function() {
      var directoryDetailWrapper = $(this).find('.small-h-card-list-detail-wrapper');
      _this.expandElement(directoryDetailWrapper);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_open'
      });
    })
    .on('click', '.small-h-card-list-item', function(event) {
      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.small-h-card-list-item-text').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_open',
        label: entryTitle
      });

      if (_this.data.summaryLinkOption === 'link' && _this.data.summaryLinkAction) {
        _this.openLinkAction(entryId);
        return;
      }
      // find the element to expand and expand it
      if (_this.allowClick) {
        var directoryDetailWrapper = $(this).find('.small-h-card-list-detail-wrapper');
        _this.expandElement(directoryDetailWrapper);
      }
    })
    .on('click', '.small-h-card-list-detail-close-btn', function(event) {
      event.stopPropagation();
      // find the element to collpase and collpase it
      var directoryDetailWrapper = $(this).parents('.small-h-card-list-detail-wrapper');
      _this.collapseElement(directoryDetailWrapper);
    })
    .on('click', '.dynamic-list-add-item', function() {
      var options = {
        title: 'Link not configured',
        message: 'Form not found. Please check the component\'s configuration.',
      };

      if (_this.data.addEntryLinkAction) {
        _this.data.addEntryLinkAction.query = '?mode=add';

        if (typeof _this.data.addEntryLinkAction.page !== 'undefined' && _this.data.addEntryLinkAction.page !== '') {
          Fliplet.Navigate.to(_this.data.addEntryLinkAction)
            .catch(function() {
              Fliplet.UI.Toast(options);
            });
        } else {
          FFliplet.UI.Toast(options);
        }
      }
    })
    .on('click', '.dynamic-list-edit-item', function() {
      var entryID = $(this).parents('.small-h-card-list-item').data('entry-id');
      var options = {
        title: 'Link not configured',
        message: 'Form not found. Please check the component\'s configuration.',
      };

      if (_this.data.editEntryLinkAction) {
        _this.data.editEntryLinkAction.query = '?dataSourceEntryId=' + entryID;

        if (typeof _this.data.editEntryLinkAction.page !== 'undefined' && _this.data.editEntryLinkAction.page !== '') {
          Fliplet.Navigate.to(_this.data.editEntryLinkAction)
            .catch(function() {
              Fliplet.UI.Toast(options);
            });
        } else {
          FFliplet.UI.Toast(options);
        }
      }
    })
    .on('click', '.dynamic-list-delete-item', function() {
      var _that = $(this);
      var entryID = $(this).parents('.small-h-card-list-item').data('entry-id');
      var options = {
        title: 'Are you sure you want to delete the list entry?',
        labels: [
          {
            label: 'Delete',
            action: function (i) {
              _that.text('Deleting...').addClass('disabled');

              Fliplet.DataSources.connect(_this.data.dataSourceId).then(function (connection) {
                return connection.removeById(entryID);
              }).then(function onRemove() {
                _.remove(_this.listItems, function(entry) {
                  return entry.id === parseInt(entryID, 10);
                });

                _that.text('Delete').removeClass('disabled');
                var $closeButton = _that.parents('.small-h-card-list-item').find('.small-h-card-list-detail-close-btn');
                _this.collapseElement($closeButton);
                _this.renderLoopHTML(_this.listItems);

                _that.text('Delete').removeClass('disabled');
              });
            }
          }
        ],
        cancel: true
      }

      Fliplet.UI.Actions(options);
    });
}

DynamicList.prototype.prepareData = function(records) {
  var _this = this;
  var sorted;
  var ordered;
  var filtered;

  // Prepare sorting
  if (_this.data.sortOptions.length) {
    var fields = [];
    var sortOrder = [];
    var columns = [];

    _this.data.sortOptions.forEach(function(option) {
      fields.push({
        column: option.column,
        type: option.sortBy
      });

      if (option.orderBy === 'ascending') {
        sortOrder.push('asc');
      }
      if (option.orderBy === 'descending') {
        sortOrder.push('desc');
      }
    });

    fields.forEach(function(field) {
      columns.push('data[' + field.column + ']');
    });

    var mappedRecords = _.clone(records);
    mappedRecords = mappedRecords.map((record) => {
      fields.forEach(function(field) {
        record.data[field.column] = record.data[field.column] || '';
        record.data[field.column].toString().toUpperCase();

        if (field.type === "alphabetical") {
          record.data[field.column] = record.data[field.column].match(/[A-Za-z]/)
          ? record.data[field.column]
          : '{' + record.data[field.column];
        }

        if (field.type === "numerical") {
          record.data[field.column] = record.data[field.column].match(/[0-9]/)
          ? parseInt(record.data[field.column], 10)
          : '{' + record.data[field.column];
        }

        if (field.type === "date") {
          record.data[field.column] = new Date(record.data[field.column]).getTime();
        }

        if (field.type === "time") {
          record.data[field.column] = record.data[field.column];
        }
      });

      return record;
    });

    // Sort data
    sorted = _.sortBy(mappedRecords, columns);
    ordered = _.orderBy(sorted, columns, sortOrder);

    records = ordered;
  }

  // Prepare filtering
  if (_this.data.filterOptions.length) {
    var filters = [];

    _this.data.filterOptions.forEach(function(option) {
      var filter = {
        column: option.column,
        condition: option.logic,
        value: option.value
      }
      filters.push(filter);
    });

    // Filter data
    filtered = _.filter(records, function(record) {
      var matched = 0;

      filters.some(function(filter) {
        var condition = filter.condition;
        var rowData;
        // Case insensitive
        if (filter.value !== null && filter.value !== '' && typeof filter.value !== 'undefined') {
          filter.value = filter.value.toLowerCase();
        }
        if (record.data[filter.column] !== null && record.data[filter.column] !== '' && typeof record.data[filter.column] !== 'undefined') {
          rowData = record.data[filter.column].toString().toLowerCase();
        }

        if (condition === 'contains') {
          if (rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) > -1) {
            matched++;
          }
          return;
        }
        if (condition === 'notcontain') {
          if (rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) === -1) {
            matched++;
          }
          return;
        }
        if (condition === 'regex') {
          var pattern = new RegExp(filter.value);
          if (patt.test(rowData)){
            matched++;
          }
          return;
        }
        if (operators[condition](rowData, filter.value)) {
          matched++;
          return;
        }
      });

      return matched >= filters.length ? true : false;
    });
    records = filtered;
  }

  return records;
}

DynamicList.prototype.initialize = function() {
  var _this = this;
  // Render Base HTML template
  _this.renderBaseHTML();

  // Render list with default data
  if (_this.data.defaultData) {
    var records = _this.prepareData(_this.data.defaultEntries);
    _this.listItems = _this.getPermissions(records);
    // Get user profile
    if (_this.myUserData) {
      // Create flag for current user
      _this.listItems.forEach(function(el, idx) {
        if (el.data[_this.emailField] === (_this.myUserData[_this.emailField] || _this.myUserData['email'])) {
          _this.listItems[idx].isCurrentUser = true;
        }
      });

      _this.myProfileData = _.filter(_this.listItems, function(row) {
        return row.isCurrentUser;
      });
    }
    _this.dataSourceColumns = _this.data.defaultColumns;
    // Render Loop HTML
    _this.renderLoopHTML(_this.listItems);
    // Listeners and Ready
    _this.attachObservers();
    _this.onReady();
    return;
  }

  // Connect to data source to get rows
  _this.connectToDataSource()
    .then(function (records) {
      records = _this.prepareData(records);
      records = _this.getPermissions(records);
      // Make rows available Globally
      _this.listItems = records;

      // Get user profile
      if (_this.myUserData) {
        // Create flag for current user
        records.forEach(function(el, idx) {
          if (el.data[_this.emailField] === (_this.myUserData[_this.emailField] || _this.myUserData['email'])) {
            records[idx].isCurrentUser = true;
          }
        });

        _this.myProfileData = _.filter(records, function(row) {
          return row.isCurrentUser;
        });
      }
      
      return;
    })
    .then(function() {
      return Fliplet.DataSources.getById(_this.data.dataSourceId);
    })
    .then(function(dataSource) {
      _this.dataSourceColumns = dataSource.columns;
      return
    })
    .then(function() {
      // Render Loop HTML
      _this.renderLoopHTML(_this.listItems);
      return
    })
    .then(function() {
      // Listeners and Ready
      _this.attachObservers();
      _this.onReady();
    });
}

DynamicList.prototype.connectToDataSource = function() {
  var _this = this;
  var cache = { offline: true };

  function getData (options) {
    options = options || cache;
    return Fliplet.DataSources.connect(_this.data.dataSourceId, options)
      .then(function (connection) {
        // If you want to do specific queries to return your rows
        // See the documentation here: https://developers.fliplet.com/API/fliplet-datasources.html
        return connection.find(_this.queryOptions);
      });
  }

  return Fliplet.Hooks.run('flListDataBeforeGetData', {
    config: _this.data,
    container: _this.$container
  }).then(function() {
    if (_this.data.getData) {
      getData = _this.data.getData;

      if (_this.data.hasOwnProperty('cache')) {
        cache.offline = _this.data.cache;
      }
    }

    return getData(cache);
  }).catch(function (error) {
    Fliplet.UI.Toast({
      message: 'Error loading data',
      actions: [
        {
          label: 'Details',
          action: function () {
            Fliplet.UI.Toast({
              html: error.message || error
            });
          }
        }
      ]
    });
  });
}

DynamicList.prototype.renderBaseHTML = function() {
  // Function that renders the List container
  var _this = this;
  var baseHTML = '';

  var data = _this.getAddPermission(_this.data);

  if (typeof _this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[smallHorizontalLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(data));
}

DynamicList.prototype.renderLoopHTML = function(records) {
  // Function that renders the List template
  var _this = this;

  var savedColumns = [];

  var loopData = [];
  var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return !option.editable;
  });
  var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return option.editable;
  });
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
  ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[smallHorizontalLayoutMapping[_this.data.layout]['loop']]());

  // IF STATEMENT FOR BACKWARDS COMPATABILITY
  if (!_this.data.detailViewOptions) {
    records.forEach(function(entry) {
      var newObject = {
        id: entry.id,
        editEntry: entry.editEntry,
        deleteEntry: entry.deleteEntry,
        isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      };

      $.extend(true, newObject, entry.data);

      loopData.push(newObject);
    });

    loopData.forEach(function(obj, index) {
      loopData[index].profileHTML = _this.profileHTML(loopData[index]);
    });

    _this.$container.find('#small-h-card-list-wrapper-' + _this.data.id).html(template(loopData));
    return;
  }

  // Uses sumamry view settings set by users
  records.forEach(function(entry) {
    var newObject = {
      id: entry.id,
      editEntry: entry.editEntry,
      deleteEntry: entry.deleteEntry,
      isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      entryDetails: []
    };
    _this.data['summary-fields'].some(function(obj) {
      var content = '';
      if (obj.column === 'custom') {
        content = Handlebars.compile(obj.customField)(entry.data)
      } else {
        var content = entry.data[obj.column];
      }
      newObject[obj.location] = content;
    });

    notDynamicData.some(function(obj) {
      if (!newObject[obj.location]) {
        var content = '';
        if (obj.column === 'custom') {
          content = Handlebars.compile(obj.customField)(entry.data)
        } else {
          var content = entry.data[obj.column];
        }
        newObject[obj.location] = content;
      }
    });

    loopData.push(newObject);
  });

  // Define detail view data based on user's settings
  var detailData = [];

  dynamicData.forEach(function(obj) {
    records.some(function(entryData) {
      var label = '';
      var labelEnabled = true;
      var content = '';

      // Define label
      if (obj.fieldLabel === 'column-name' && obj.column !== 'custom') {
        label = obj.column;
      }
      if (obj.fieldLabel === 'custom-label') {
        label = Handlebars.compile(obj.customFieldLabel)(entryData.data);
      }
      if (obj.fieldLabel === 'no-label') {
        labelEnabled = false;
      }
      // Define content
      if (obj.customFieldEnabled) {
        content = Handlebars.compile(obj.customField)(entryData.data);
      } else {
        content = entryData.data[obj.column];
      }
      // Define data object
      var newObject = {
        id: entryData.id,
        content: content,
        label: label,
        labelEnabled: labelEnabled,
        type: obj.type
      }

      var matchingEntry = _.find(loopData, function(entry) {
        return entry.id === newObject.id;
      });
      matchingEntry.entryDetails.push(newObject);
      savedColumns.push(obj.column);
    });
  });

  loopData.forEach(function(obj, index) {
    if (_this.data.detailViewAutoUpdate) {
      var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
      if (extraColumns && extraColumns.length) {

        var entryData = _.find(records, function(modEntry) {
          return modEntry.id = obj.id;
        });

        extraColumns.forEach(function(column) {
          var newColumnData = {
            id: entryData.id,
            content: entryData.data[column],
            label: column,
            labelEnabled: true,
            type: 'text'
          };

          obj.entryDetails.push(newColumnData);
        });
      }
    }

    obj.profileHTML = _this.profileHTML(obj);
  });

  _this.$container.find('#small-h-card-list-wrapper-' + _this.data.id).html(template(loopData));
}

DynamicList.prototype.getAddPermission = function(data) {
  var _this = this;

  if (typeof data.addEntry !== 'undefined' && typeof data.addPermissions !== 'undefined') {
    if (_this.myUserData && _this.data.addPermissions === 'admins') {
      if (_this.myUserData[_this.data.userAdminColumn] !== null && typeof _this.myUserData[_this.data.userAdminColumn] !== 'undefined' && _this.myUserData[_this.data.userAdminColumn] !== '') {
        data.showAddEntry = data.addEntry;
      }
    } else if (_this.data.addPermissions === 'everyone') {
      data.showAddEntry = data.addEntry;
    }
  }

  return data;
}

DynamicList.prototype.getPermissions = function(entries) {
  var _this = this;

  // Adds flag for Edit and Delete buttons
  entries.forEach(function(obj, index) {
    if (typeof _this.data.editEntry !== 'undefined' && typeof _this.data.editPermissions !== 'undefined') {
      if (_this.myUserData && _this.data.editPermissions === 'admins') {
        if (_this.myUserData[_this.data.userAdminColumn] !== null && typeof _this.myUserData[_this.data.userAdminColumn] !== 'undefined' && _this.myUserData[_this.data.userAdminColumn] !== '') {
          entries[index].editEntry = _this.data.editEntry;
        }
      } else if (_this.myUserData && _this.data.editPermissions === 'user') {
        if (_this.myUserData[_this.data.userEmailColumn] === obj.data[_this.data.userListEmailColumn]) {
          entries[index].editEntry = _this.data.editEntry;
        }
      } else if (_this.data.addPermissions === 'everyone') {
        entries[index].editEntry = _this.data.editEntry;
      }
    }
    if (typeof _this.data.deleteEntry !== 'undefined' && typeof _this.data.deletePermissions !== 'undefined') {
      if (_this.myUserData && _this.data.deletePermissions === 'admins') {
        if (_this.myUserData[_this.data.userAdminColumn] !== null && typeof _this.myUserData[_this.data.userAdminColumn] !== 'undefined' && _this.myUserData[_this.data.userAdminColumn] !== '') {
          entries[index].deleteEntry = _this.data.deleteEntry;
        }
      } else if (_this.myUserData && _this.data.deletePermissions === 'user') {
        if (_this.myUserData[_this.data.userEmailColumn] === obj.data[_this.data.userListEmailColumn]) {
          entries[index].deleteEntry = _this.data.deleteEntry;
        }
      } else if (_this.data.deletePermissions === 'everyone') {
        entries[index].deleteEntry = _this.data.deleteEntry;
      }
    }
  });

  return entries;
}

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  // Ready
  _this.$container.find('.new-small-h-card-list-container').addClass('ready');
}

DynamicList.prototype.openLinkAction = function(entryId) {
  var _this = this;
  var entry = _.find(_this.listItems, function(entry) {
    return entry.id === entryId;
  });

  if (!entry) {
    return;
  }

  var value = entry.data[_this.data.summaryLinkAction.column];
  
  if (_this.data.summaryLinkAction.type === 'url') {
    Fliplet.Navigate.url(value);
  } else {
    Fliplet.Navigate.screen(parseInt(value, 10), { transition: 'fade' });
  }
}

DynamicList.prototype.expandElement = function(elementToExpand) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
  if (elementToExpand.parents('.panel-group').length) {
    elementToExpand.parents('.panel-group').addClass('remove-transform');
  }

  //check to see if element is already expanded
  if (!elementToExpand.hasClass('open')) {
    // freeze the current scroll position of the background content
    $('html, body').addClass('lock');
    
    var currentPosition = elementToExpand.offset();
    var elementScrollTop = $(window).scrollTop();
    var netOffset = currentPosition.top - elementScrollTop;

    var expandPosition = $('body').offset();
    var expandTop = expandPosition.top;
    var expandLeft = expandPosition.left;
    var expandWidth = $('body').outerWidth();
    var expandHeight = $('html').outerHeight();

    var directoryDetailImageWrapper = elementToExpand.find('.small-h-card-list-detail-image-wrapper');
    var directoryDetailImage = elementToExpand.find('.small-h-card-list-detail-image');

    // convert the expand-item to fixed position with a high z-index without moving it 
    elementToExpand.css({
      'top': netOffset,
      'left': currentPosition.left,
      'height': elementToExpand.height(),
      'width': elementToExpand.width(),
      'max-width': expandWidth,
      'position': 'fixed',
      'z-index': 11,
    });

    elementToExpand.animate({
      'left': expandLeft,
      'top': expandTop,
      'height': expandHeight,
      'width': expandWidth,
      'max-width': expandWidth
    }, 200, 'swing');

    elementToExpand.addClass('open');
    elementToExpand.find('.small-h-card-list-detail-close-btn').addClass('open');
    elementToExpand.find('.small-h-card-list-detail-content-scroll-wrapper').addClass('open');

    directoryDetailImageWrapper.css({
      height: directoryDetailImageWrapper.outerHeight(),
      'z-index': 12
    });

    directoryDetailImageWrapper.animate({
      height: '100vw'
    },
    200,
    'swing'
    );

    directoryDetailImage.css({
      height: directoryDetailImage.outerHeight(),
      'z-index': 12
    });

    directoryDetailImage.animate({
      height: '100vw'
    }, 200, 'swing');
  }
}

DynamicList.prototype.collapseElement = function(elementToCollapse) {
  // Function called when a list item is tapped to close
  var _this = this;

  $('html, body').removeClass('lock');

  var directoryDetailImageWrapper = elementToCollapse.find('.small-h-card-list-detail-image-wrapper');
  var directoryDetailImage = elementToCollapse.find('.small-h-card-list-detail-image');

  var collapseTarget = elementToCollapse.parent();
  var elementScrollTop = $(window).scrollTop();
  var targetCollpsePlaceholderTop = collapseTarget.offset().top - elementScrollTop;
  var targetCollpsePlaceholderLeft = collapseTarget.offset().left;
  var targetCollapseHeight = collapseTarget.outerHeight();
  var targetCollapseWidth = collapseTarget.outerWidth();

  elementToCollapse.animate({
    top: targetCollpsePlaceholderTop,
    left: targetCollpsePlaceholderLeft,
    height: targetCollapseHeight,
    width: targetCollapseWidth
  }, 200, 'linear',
  function() {
    elementToCollapse.css({
      // after animating convert the collpase item to position absolute with a low z-index without moving it 
      'position': 'absolute',
      'z-index': '1',
      'top': 0,
      'left': 0,
      'height': '100%',
      'width': '100%',
    });
  });

  directoryDetailImageWrapper.animate({
    height: targetCollapseHeight
  }, 200, 'linear');

  directoryDetailImage.animate({
    height: targetCollapseHeight
  }, 200, 'linear',
  function() {
    elementToCollapse.css({ height: '100%', });

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    // Only happens when the closing animation finishes
    if (elementToCollapse.parents('.panel-group').length) {
      elementToCollapse.parents('.panel-group').removeClass('remove-transform');
    }
  });

  elementToCollapse.removeClass('open');
  elementToCollapse.find('.small-h-card-list-detail-close-btn').removeClass('open');
  elementToCollapse.find('.small-h-card-list-detail-content-scroll-wrapper').removeClass('open');
}