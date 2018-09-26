// Fliplet.Analytics.trackEvent({
//   category: 'list_dynamic_' + _this.data.layout,
//   action: 'comment_save_edit'
// });

var simpleListLayoutMapping = {
  'simple-list': {
    'base': 'templates.build.simple-list-base',
    'loop': 'templates.build.simple-list-loop',
    'detail': 'templates.build.simple-list-detail',
    'filter': 'templates.build.simple-list-filters'
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

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.entryOverlay;
  this.myUserData;
  this.dataSourceColumns;
  this.filterClasses = [];

  // Register handlebars helpers
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

  Handlebars.registerHelper('plaintext', function(context) {
    result = $('<div></div>').html(context).text();
    return $('<div></div>').html(result).text();
  });

  Handlebars.registerHelper('removeSpaces', function(context) {
    return context.replace(/\s+/g, '');
  });
}

DynamicList.prototype.attachObservers = function() {
  var _this = this;

  _this.$container
    .on('click', '.hidden-filter-controls-filter', function() {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $(this).text()
      });

      $(this).toggleClass('mixitup-control-active');
      _this.filterList();
    })
    .on('click', '.simple-list-item', function(event) {
      event.stopPropagation();
      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.list-item-title').text();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_open',
        label: entryTitle
      });

      if (_this.data.summaryLinkOption === 'link' && _this.data.summaryLinkAction) {
        _this.openLinkAction(entryId);
        return;
      }

      _this.showDetails(entryId);
    })
    .on('click', '.simple-list-detail-overlay-close', function(event) {
      _this.closeDetails();
    })
    .on('click', '.list-search-icon .fa-sliders', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-container');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.simple-list-search-filter-overlay').addClass('display');

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search_filter_controls_overlay_activate'
        });
        return;
      }

      $parentElement.find('.hidden-filter-controls').addClass('active');
      $parentElement.find('.list-search-cancel').addClass('active');
      $elementClicked.addClass('active');

      _this.calculateFiltersHeight($parentElement);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search_filter_controls_activate'
      });
    })
    .on('click', '.simple-list-overlay-close', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-search-filter-overlay');
      $parentElement.removeClass('display');
    })
    .on('click', '.list-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-container');

      if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').removeClass('active');
        $elementClicked.removeClass('active');
        $parentElement.find('.list-search-icon .fa-sliders').removeClass('active');
        $parentElement.find('.hidden-filter-controls').animate({ height: 0, }, 200);
      }
    })
    .on('keydown', '.search-holder input', function(e) {
      var $inputField = $(this);
      var $parentElement = $inputField.parents('.simple-list-container');
      var value = $inputField.val();

      if (value.length) {
        $inputField.addClass('not-empty');
        value = value.toLowerCase();
      } else {
        $inputField.removeClass('not-empty');
      }

      if (e.which == 13 || e.keyCode == 13) {
        if (value === '') {
          _this.clearSearch();
          return;
        }

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search',
          label: value
        });

        if ($inputField.hasClass('from-overlay')) {
          $inputField.parents('.simple-list-search-filter-overlay').removeClass('display');
        }
        $inputField.blur();
        $parentElement.find('.hidden-filter-controls').addClass('is-searching').removeClass('no-results');
        _this.searchData(value);
      }
    })
    .on('click', '.search-holder .search-btn', function(e) {
      var $inputField = $(this).parents('.search-holder').find('.search-feed');
      var $parentElement = $inputField.parents('.simple-list-container');
      var value = $inputField.val();

      if (value.length) {
        value = value.toLowerCase();
      }

      if (value === '') {
        _this.clearSearch();
        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search',
        label: value
      });

      if ($inputField.hasClass('from-overlay')) {
        $inputField.parents('.simple-list-search-filter-overlay').removeClass('display');
      }
      $inputField.blur();
      $parentElement.find('.hidden-filter-controls').addClass('is-searching').removeClass('no-results');
      _this.searchData(value);
    })
    .on('click', '.clear-search', function() {
      _this.clearSearch();
    })
    .on('click', '.search-query span', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-container');

      _this.backToSearch();
      $parentElement.find('.search-holder input').focus();
    })
    .on('show.bs.collapse', '.simple-list-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.simple-list-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
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
      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');
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
      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');
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
                _this.closeDetails();
                _this.renderLoopHTML(_this.listItems);

                _that.text('Delete').removeClass('disabled');
              });
            }
          }
        ],
        cancel: true
      }

      _that.text('Deleting...').addClass('disabled');

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

  // Convert date and add flag for likes
  records.forEach(function(obj, i) {
    // Add likes flag
    if (_this.data.social && _this.data.social.likes) {
      records[i].likesEnabled = true;
    } else {
      records[i].likesEnabled = false;
    }

    // Add comments flag
    if (_this.data.social && _this.data.social.comments) {
      records[i].commentsEnabled = true;
    } else {
      records[i].commentsEnabled = false;
    }
  });

  return records;
}

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render Base HTML template
  _this.renderBaseHTML();

  // Render list with default data
  if (_this.data.defaultData) {
    _this.listItems = _this.prepareData(_this.data.defaultEntries);
    _this.dataSourceColumns = _this.data.defaultColumns;
    // Render Loop HTML
    _this.renderLoopHTML(_this.listItems);
    _this.addFilters(_this.modifiedListItems);
    // Listeners and Ready
    _this.attachObservers();
    _this.onReady();
    return;
  }

  _this.connectToDataSource()
    .then(function (records) {
      _this.listItems = _this.prepareData(records);
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
      _this.addFilters(_this.modifiedListItems);
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
    baseHTML = Fliplet.Widget.Templates[simpleListLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(data));
}

DynamicList.prototype.renderLoopHTML = function(records) {
  // Function that renders the List template
  var _this = this;
  var loopHTML = '';
  var modifiedData = _this.convertCategories(records);
  var loopData = [];

  // Uses sumamry view settings set by users
  modifiedData.forEach(function(entry) {
    var newObject = {
      id: entry.id,
      flClasses: entry.data['flClasses'],
      flFilters: entry.data['flFilters']
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
    loopData.push(newObject);
  });

  _this.modifiedListItems = loopData;

  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
  ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[simpleListLayoutMapping[_this.data.layout]['loop']]());

  _this.$container.find('#simple-list-wrapper-' + _this.data.id).html(template(loopData));
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

DynamicList.prototype.addFilters = function(data) {
  // Function that renders the filters
  var _this = this;
  var filters = [];
  var filtersData = {
    'filtersInOverlay': _this.data.filtersInOverlay
  };

  data.forEach(function(row) {
    row['flFilters'].forEach(function(filter) {
      filters.push(filter);
    });
  });

  var uniqueCategories = _.uniqBy(filters, function(obj) {
    return obj.data.name;
  });

  var allFilters = [];
  _this.data.filterFields.forEach(function(filter) {
    var arrangedFilters = {
      id: _this.data.id,
      name: filter,
      data: []
    };
    uniqueCategories.forEach(function(item) {
      if (item.type === filter) {
        arrangedFilters.data.push(item.data);
      }
    });

    arrangedFilters.data = _.orderBy(arrangedFilters.data, function(item) {
      return item.name;
    }, ['asc']);

    allFilters.push(arrangedFilters);
  });

  filtersData.filters = allFilters

  filtersTemplate = Fliplet.Widget.Templates[simpleListLayoutMapping[_this.data.layout]['filter']];
  var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
  ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
  : Handlebars.compile(filtersTemplate());

  _this.$container.find('.filter-holder').html(template(filtersData));
}

DynamicList.prototype.filterList = function() {
  var _this = this;
  _this.filterClasses = [];

  if (!$('.hidden-filter-controls-filter.mixitup-control-active').length) {
    var listData = _this.searchedListItems ? _this.searchedListItems : _this.listItems;
    _this.renderLoopHTML(listData);
    _this.onReady();
    return;
  }
  
  $('.hidden-filter-controls-filter.mixitup-control-active').each(function(index, element) {
    _this.filterClasses.push($(element).data('toggle'));
  });

  var filteredData = _.filter(_this.listItems, function(row) {
    var filters = [];
    row.data['flFilters'].forEach(function(obj) {
      filters.push(obj.data.class);
    });

    return _.some(_this.filterClasses, function(v) {
      return filters.indexOf(v) >= 0
    });
  });

  if (!filteredData || !filteredData.length) {
    return;
  }
  _this.renderLoopHTML(filteredData);
  _this.onReady();
}

DynamicList.prototype.convertCategories = function(data) {
  // Function that get and converts the categories for the filters to work
  var _this = this;

  data.forEach(function(element) {
    element.data['flClasses'] = '';
    element.data['flFilters'] = [];
    var lowerCaseTags = [];
    _this.data.filterFields.forEach(function(filter) {
      var arrayOfTags = [];
      if (element.data[filter] !== null && typeof element.data[filter] !== 'undefined' && element.data[filter] !== '') {
        var arrayOfTags = element.data[filter].toString().split(',').map(function(item) {
          return item.trim();
        });
      }
      arrayOfTags.forEach(function(item, index) {
        var classConverted = item.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
        if (classConverted === '') {
          return;
        }
        var newObj = {
          type: filter,
          data: {
            name: item,
            class: classConverted
          }
        }
        lowerCaseTags.push(classConverted);
        element.data['flFilters'].push(newObj);
      });
      
    });
    element.data['flClasses'] = lowerCaseTags.join(' ');
  });
  return data;
}

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  // Ready
  _this.$container.find('.simple-list-container').removeClass('loading').addClass('ready');
}

DynamicList.prototype.calculateFiltersHeight = function(element) {
  var targetHeight = element.find('.hidden-filter-controls-content').height();
  element.find('.hidden-filter-controls').animate({
    height: targetHeight,
  }, 200);
}

DynamicList.prototype.searchData = function(value) {
  // Function called when user executes a search
  var _this = this;

  // Removes cards
  _this.$container.find('#simple-list-wrapper-' + _this.data.id).html('');
  // Adds search query to HTML
  _this.$container.find('.current-query').html(value);
  
  // Search
  var searchedData = [];
  var filteredData;

  if (_this.data.searchEnabled && _this.data.searchFields.length) {
    _this.data.searchFields.forEach(function(field) {    
      filteredData = _.filter(_this.listItems, function(obj) {
        if (obj.data[field] !== null && obj.data[field] !== '' && typeof obj.data[field] !== 'undefined') {
          return obj.data[field].toLowerCase().indexOf(value) > -1;
        }
      });

      if (filteredData.length) {
        filteredData.forEach(function(item) {
          searchedData.push(item);
        });
      }
    });
  }
  
  // Simulate that search is taking half a second
  // OPTIONAL - setTimeout can be removed
  setTimeout(function() {
    _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results').addClass('search-results');
    _this.calculateFiltersHeight(_this.$container.find('.simple-list-container'));

    if (!searchedData.length) {
      _this.$container.find('.hidden-filter-controls').addClass('no-results');
      return;
    }

    // Remove duplicates
    searchedData = _.uniq(searchedData);
    _this.searchedListItems = searchedData;
    _this.renderLoopHTML(searchedData);
    _this.addFilters(_this.modifiedListItems);
    _this.onReady();
  }, 0);
}

DynamicList.prototype.backToSearch = function() {
  // Function that is called when user wants to return
  // to the search input after searching for a value first
  var _this = this;

  _this.$container.find('.hidden-filter-controls').removeClass('is-searching search-results');
  
  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.simple-list-container'));
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }
}

DynamicList.prototype.clearSearch = function() {
  // Function called when user clears the search field
  var _this = this;

  // Removes value from search box
  _this.$container.find('.search-holder').find('input').val('').blur().removeClass('not-empty');
  // Resets all classes related to search
  _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results search-results searching');

  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.simple-list-container'));
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }

  // Resets list
  _this.searchedListItems = undefined;
  _this.renderLoopHTML(_this.listItems);
  _this.addFilters(_this.modifiedListItems);
  _this.onReady();
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

DynamicList.prototype.showDetails = function(id) {
  // Function that loads the selected entry data into an overlay for more details
  var _this = this;

  var savedColumns = [];

  var modifiedData = _this.getPermissions(_this.listItems);
  var entryData = _.find(modifiedData, function(entry) {
    return entry.id === id;
  });

  // Define detail view data based on user's settings
  var newData = {
    id: entryData.id,
    editEntry: entryData.editEntry,
    deleteEntry: entryData.deleteEntry,
    data: []
  };

  _this.data.detailViewOptions.forEach(function(obj) {
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
      content: content,
      label: label,
      labelEnabled: labelEnabled,
      type: obj.type
    }
    newData.data.push(newObject);
    savedColumns.push(obj.column);
  });

  if (_this.data.detailViewAutoUpdate) {
    var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
    if (extraColumns && extraColumns.length) {
      extraColumns.forEach(function(column) {
        var newColumnData = {
          content: entryData.data[column],
          label: column,
          labelEnabled: true,
          type: 'text'
        };

        newData.data.push(newColumnData);
      });
    }
  }

  // Process template with data
  var entryId = {
    id: id
  };
  var wrapper = '<div class="simple-list-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = _this.$container.find('#simple-list-detail-overlay-' + _this.data.id);

  var template = _this.data.advancedSettings && _this.data.advancedSettings.detailHTML
  ? Handlebars.compile(_this.data.advancedSettings.detailHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[simpleListLayoutMapping[_this.data.layout]['detail']]());

  var wrapperTemplate = Handlebars.compile(wrapper);

  // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
  if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
    _this.$container.parents('.panel-group').not('.filter-overlay').addClass('remove-transform');
  }

  // Adds content to overlay
  $overlay.find('.simple-list-detail-overlay-content-holder').html(wrapperTemplate(entryId));
  $overlay.find('.simple-list-detail-wrapper').append(template(newData));

  // Trigger animations
  $('body').addClass('lock');
  _this.$container.find('.simple-list-container').addClass('overlay-open');
  $overlay.addClass('open');
}

DynamicList.prototype.closeDetails = function() {
  // Function that closes the overlay
  var _this = this;

  var $overlay = _this.$container.find('#simple-list-detail-overlay-' + _this.data.id);
  $('body').removeClass('lock');
  $overlay.removeClass('open');
  _this.$container.find('.simple-list-container').removeClass('overlay-open');

  setTimeout(function() {
    // Clears overlay
    $overlay.find('.simple-list-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }
  }, 300);
}