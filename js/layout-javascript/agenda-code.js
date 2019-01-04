// Constructor
var DynamicList = function(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.agendaLayoutMapping = {
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-cards-loop',
      'detail': 'templates.build.agenda-cards-detail',
      'other-loop': 'templates.build.agenda-dates-loop'
    }
  };

  this.operators = {
    '==': function(a, b) { return a == b },
    '!=': function(a, b) { return a != b },
    '>': function(a, b) { return a > b },
    '>=': function(a, b) { return a >= b },
    '<': function(a, b) { return a < b },
    '<=': function(a, b) { return a <= b }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.queryOptions = {};

  // Other variables
  // Global variables
  this.allowClick = true;
  this.hammer;
  this.mixer= [];
  this.bookmarkButtons = [];
  this.bookmarkButtonOverlay;
  this.animatingForward = false;
  this.animatingBack = false;
  this.activeSlideIndex;
  this.sliderCount;
  this.scrollValue = 0;
  this.copyOfScrollValue = _this.scrollValue;
  this.isPanning = false;
  this.myUserData;

  this.listItems;
  this.modifiedRecords;
  this.dataSourceColumns;

  this.queryOpen = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvPreFilterQuery;
  this.pvOpenQuery;

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.agendaLayoutMapping[this.data.layout]['detail']]();

  this.detailHTML = Handlebars.compile(this.src);

  // Register handlebars helpers
  this.registerHandlebarsHelpers();
  // Get the current session data
  Fliplet.Session.get().then(function(session) {
    if (session && session.entries && session.entries.dataSource) {
      _this.myUserData = session.entries.dataSource.data;
    } else if (session && session.entries && session.entries.saml2) {
      _this.myUserData = session.entries.saml2.user;
      _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
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
  $(window).resize(function() {
    _this.centerDate();
  });

  _this.$container
    .on('touchstart', '.agenda-list-controls', function(event) {
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-controls', function(e) {
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-controls', function() {
      $(this).removeClass('hover');
    })
    .on('click', '.agenda-list-controls', function(event) {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'bookmarks_show'
      });
    })
    .on('touchstart', '.agenda-list-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-item', function(e) {
      allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        allowClick = true;
      }, 100);
    })
    .on('click', '.agenda-list-item', function(event) {
      if (_this.isPanning && !_this.allowClick && $(this).hasClass('open')) {
        return;
      }

      if ($(event.target).hasClass('agenda-item-bookmark-holder') || $(event.target).parents('.agenda-item-bookmark-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.agenda-item-title').text();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_open',
        label: entryTitle
      });

      var beforeOpen = Promise.resolve();
    
      if (typeof _this.data.beforeOpen === 'function') {
        beforeOpen = _this.data.beforeOpen({
          config: _this.data,
          entry: _.find(_this.listItems, { id: entryId }),
          entryId: entryId,
          entryTitle: entryTitle
        });
        
        if (!(beforeOpen instanceof Promise)) {
          beforeOpen = Promise.resolve(beforeOpen);
        }
      }
    
      beforeOpen.then(function () {
        if (_this.data.summaryLinkOption === 'link' && _this.data.summaryLinkAction) {
          _this.openLinkAction(entryId);
          return;
        }
        
        _this.showDetails(entryId);
      });
    })
    .on('click', '.agenda-detail-overlay-close', function() {
      var result;

      if ($(this).hasClass('go-previous-screen')) {
        if (!_this.pvPreviousScreen) {
          return;
        }

        try {
          result = (typeof _this.pvPreviousScreen === 'function') && _this.pvPreviousScreen();
        } catch (error) {
          console.error('Your custom function contains an error: ' + error);
        }

        if (!(result instanceof Promise)) {
          result = Promise.resolve();
        }

        return result.then(function () {
          return Fliplet.Navigate.back();
        }).catch(function (error) {
          console.error(error);
        });
      }

      _this.closeDetails();
    })
    .on('keydown', function(e) {
      if (e.keyCode === 39) {
        if ($('.agenda-date-selector li.active').next().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
        var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active').next());
        var indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.moveForwardDate(indexOfClickedDate, indexDifference);
        return;
      }
      if (e.keyCode === 37) {
        if ($('.agenda-date-selector li.active').prev().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
        var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active').prev());
        var indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.moveBackDate(indexOfClickedDate, indexDifference);
        return;
      }
    })
    .on('click', '.agenda-date-selector li', function() {
      // prevents clicking the active one
      // prevents clicking the placeholder
      if ($(this).hasClass('active') || $(this).hasClass('placeholder')) {
        return;
      }

      var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
      var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index(this);
      var indexDifference = indexOfClickedDate - indexOfActiveDate

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter_date',
        label: $(this).find('.week').text() + ' ' + $(this).find('.day').text() + ' ' + $(this).find('.month').text()
      });

      if (indexDifference < indexOfActiveDate) {
        _this.moveBackDate(indexOfClickedDate, indexDifference);
        return;
      }

      if (indexDifference >= indexOfActiveDate) {
        _this.moveForwardDate(indexOfClickedDate, indexDifference);
        return;
      }
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
          Fliplet.UI.Toast(options);
        }
      }
    })
    .on('click', '.dynamic-list-edit-item', function() {
      var entryID = $(this).parents('.agenda-item-inner-content').data('entry-id');
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
          Fliplet.UI.Toast(options);
        }
      }
    })
    .on('click', '.dynamic-list-delete-item', function() {
      var _that = $(this);
      var entryID = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var options = {
        title: 'Are you sure you want to delete the list entry?',
        labels: [
          {
            label: 'Delete',
            action: function (i) {
              _that.text('Deleting...').addClass('disabled');

              // Run Hook
              Fliplet.Hooks.run('flListDataBeforeDeleteEntry', {
                entryId: entryID,
                config: _this.data,
                id: _this.data.id,
                uuid: _this.data.uuid,
                container: _this.$container
              })
                .then(function() {
                  if (_this.data.deleteData && typeof _this.data.deleteData === 'function') {
                    return _this.data.deleteData(entryID);
                  }

                  return _this.deleteEntry(entryID);
                })
                .then(function onRemove(entryId) {
                  _.remove(_this.listItems, function(entry) {
                    return entry.id === parseInt(entryId, 10);
                  });

                  _this.closeDetails();

                  var selectedIndex = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
                  _this.renderDatesHTML(_this.listItems, selectedIndex);
                  _this.prepareToRenderLoop(_this.listItems);
                  _this.renderLoopHTML();

                  _that.text('Delete').removeClass('disabled');
                })
                .catch(function(error) {
                  Fliplet.UI.Toast({
                    message: 'Error deleting entry',
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
          }
        ],
        cancel: true
      }

      Fliplet.Hooks.run('flListDataBeforeDeleteConfirmation', {
        entryId: entryID,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container
      }).then(function() {
        Fliplet.UI.Actions(options);
      });
    });
}

DynamicList.prototype.deleteEntry = function(entryID) {
  var _this = this;

  return Fliplet.DataSources.connect(_this.data.dataSourceId).then(function (connection) {
    return connection.removeById(entryID);
  }).then(function () {
    return Promise.resolve(entryID);
  });
}

DynamicList.prototype.likesObservers = function() {
  var _this = this;
  
  _this.bookmarkButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      this.$btn.parents('.agenda-list-item').addClass('bookmarked');
      var entryTitle = this.$btn.parents('.agenda-item-content-holder').find('.agenda-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    button.btn.on('unliked', function(data){
      this.$btn.parents('.agenda-list-item').removeClass('bookmarked');
      var entryTitle = this.$btn.parents('.agenda-item-content-holder').find('.agenda-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });
  });
}

DynamicList.prototype.likesObserversOverlay = function(id) {
  var _this = this;

  if (_this.bookmarkButtonOverlay) {
    _this.bookmarkButtonOverlay.on('liked', function(data){
      var entryTitle = this.$btn.parents('.agenda-item-content-holder').find('.agenda-item-title').text();
      var button = _.find(_this.bookmarkButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.like();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    _this.bookmarkButtonOverlay.on('unliked', function(data){
      var entryTitle = this.$btn.parents('.agenda-item-content-holder').find('.agenda-item-title').text();
      var button = _.find(_this.bookmarkButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.unlike();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });
  }
}

DynamicList.prototype.scrollEvent = function() {
  var _this = this;
  var lastScrollTop = 0;
  var threshold = 50;

  _this.$container.find('.agenda-list-day-holder').scroll(function(event){
     var st = $(this).scrollTop();
     var scrollHeight = $(this).innerHeight();
     
     if (st > lastScrollTop && st > threshold){
        // downscroll code
        _this.$container.find('.agenda-date-selector').addClass('slim');
        _this.centerDate();
     } else if (st < lastScrollTop && st < threshold) {
        // upscroll code
        _this.$container.find('.agenda-date-selector').removeClass('slim');
        _this.centerDate();
     }
     lastScrollTop = st;
  });
}

DynamicList.prototype.filterRecords = function(records, filters) {
  var _this = this;

  return _.filter(records, function(record) {
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
        if (pattern.test(rowData)){
          matched++;
        }
        return;
      }
      if (_this.operators[condition](rowData, filter.value)) {
        matched++;
        return;
      }
    });

    return matched >= filters.length ? true : false;
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

    var mappedRecords = _.clone(records);
    mappedRecords = mappedRecords.map(function(record) {
      fields.forEach(function(field) {
        record.data['modified_' + field.column] = record.data[field.column] || '';
        record.data['modified_' + field.column] = record.data['modified_' + field.column].toString().toUpperCase();

        if (field.type === "alphabetical") {
          record.data['modified_' + field.column] = record.data['modified_' + field.column].normalize('NFD').match(/[A-Za-z]/)
            ? record.data['modified_' + field.column].normalize('NFD')
            : '{' + record.data['modified_' + field.column];
        }

        if (field.type === "numerical") {
          record.data['modified_' + field.column] = record.data['modified_' + field.column].match(/[0-9]/)
            ? parseInt(record.data['modified_' + field.column], 10)
            : record.data['modified_' + field.column];
        }

        if (field.type === "date") {
          // If an incorrect date format is used, the entry will be pushed at the end
          record.data['modified_' + field.column] = new Date(record.data['modified_' + field.column]).getTime();
        }

        if (field.type === "time") {
          record.data['modified_' + field.column] = record.data['modified_' + field.column];
        }

        columns.push('data[modified_' + field.column + ']');
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
    filtered = _this.filterRecords(records, filters);
    records = filtered;
  }

  var prefiltered;
  var prefilters = [];
  if (_this.queryPreFilter) {
    _this.pvPreFilterQuery.forEach(function(option) {
      var filter = {
        column: option.column,
        condition: option.logic,
        value: option.value
      }
      prefilters.push(filter);
    });

    // Filter data
    prefiltered = _this.filterRecords(records, prefilters);
    records = prefiltered;
  }

  return records;
}

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render list with default data
  if (_this.data.defaultData) {
    // Render Base HTML template
    _this.renderBaseHTML();

    var records = _this.prepareData(_this.data.defaultEntries);
    _this.listItems = JSON.parse(JSON.stringify(records));
    // Render dates HTML
    _this.renderDatesHTML(_this.listItems);
    _this.dataSourceColumns = _this.data.defaultColumns;
    // Render Loop HTML
    _this.prepareToRenderLoop(_this.listItems);
    _this.renderLoopHTML();
    // Listeners and Ready
    _this.setupCards();
    _this.attachObservers();
    _this.scrollEvent();
    _this.onReady();
    return;
  }

  // Check if there is a PV for search/filter queries
  _this.parsePVQueryVars()
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();
      
      return _this.connectToDataSource();
    })
    .then(function (records) {
      // Received the rows
      
      records = _this.prepareData(records);
      _this.listItems = JSON.parse(JSON.stringify(records));

      // Render dates HTML
      _this.renderDatesHTML(_this.listItems);
      
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
      _this.prepareToRenderLoop(_this.listItems);
      _this.checkIsToOpen();
      _this.renderLoopHTML();
      return
    })
    .then(function() {
      // Listeners and Ready
      _this.setupCards();
      _this.attachObservers();
      _this.scrollEvent();
      _this.onReady();
    });
}

DynamicList.prototype.checkIsToOpen = function() {
  // List of entries saved in: _this.modifiedListItems
  var _this = this;
  var entry;

  if (!_this.queryOpen) {
    return;
  }

  if (_.hasIn(_this.pvOpenQuery, 'id')) {
    entry = _(_this.modifiedRecords)
      .chain()
      .thru(function(day) {
        return _.union(day, _.map(day, 'children'));
      })
      .flatten()
      .find({ id: _this.pvOpenQuery.id })
      .value();
  }

  if (_.hasIn(_this.pvOpenQuery, 'value') && _.hasIn(_this.pvOpenQuery, 'column')) {
    var queryObject = {
      originalData: {}
    };
    queryObject.originalData[_this.pvOpenQuery.column] = _this.pvOpenQuery.value;

    entry = _(_this.modifiedRecords)
      .chain()
      .thru(function(day) {
        return _.union(day, _.map(day, 'children'));
      })
      .flatten()
      .find(queryObject)
      .value();
  }

  if (!entry) {
    return;
  }

  _this.showDetails(entry.id);
}

DynamicList.prototype.parsePVQueryVars = function() {
  var _this = this;
  var pvValue;

  return Fliplet.App.Storage.get('flDynamicListQuery:' + _this.data.layout)
    .then(function(value) {
      pvValue = value;
      console.log(pvValue);

      if (typeof value === 'undefined') {
        Fliplet.App.Storage.remove('flDynamicListQuery:' + _this.data.layout);
        return;
      }

      _this.pvPreviousScreen = value.previousScreen;

      if (_.hasIn(value, 'prefilter')) {
        _this.queryPreFilter = true;
        _this.pvPreFilterQuery = value.prefilter;
      }

      if (_.hasIn(value, 'open')) {
        _this.queryOpen = true;
        _this.pvOpenQuery = value.open;
      }

      return;
    })
    .then(function() {
      if (pvValue && !pvValue.persist) {
        Fliplet.App.Storage.remove('flDynamicListQuery:' + _this.data.layout);
      }

      return;
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
    id: _this.data.id,
    uuid: _this.data.uuid,
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

  // go to previous screen on close detail view - TRUE/FALSE
  data.previousScreen = _this.pvPreviousScreen;

  if (typeof _this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[_this.agendaLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(data));
}

DynamicList.prototype.convertTime = function(time) {
  if (!time) {
    return time = '';
  }

  var hasLetters = !!time.match(/[A-Za-z]/g);
  var format;
  
  if (hasLetters) {
    format = 'hh:mm a'; 
  } else {
    format = 'hh:mm';
  }
  
  var convertedTime = moment(time, format).format('h:mm A');
  return convertedTime;
} 

DynamicList.prototype.prepareToRenderLoop = function(rows) {
  var _this = this;
  var savedColumns = [];
  var clonedRecords = JSON.parse(JSON.stringify(rows));
  clonedRecords = _this.getPermissions(clonedRecords);

  var loopData = [];
  var foundDateField = _.find(_this.data.detailViewOptions, {type: 'date', location: 'Date'});
  var dateField = 'Full Date';
  if (foundDateField) {
    dateField = foundDateField.column;
  }
  var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return !option.editable;
  });
  var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return option.editable;
  });

  // Uses sumamry view settings set by users
  clonedRecords.forEach(function(entry) {
    var newObject = {
      id: entry.id,
      editEntry: entry.editEntry,
      deleteEntry: entry.deleteEntry,
      isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      entryDetails: [],
      originalData: entry.data
    };
    _this.data['summary-fields'].some(function(obj) {
      var content = '';
      if (obj.column === 'custom') {
        content = Handlebars.compile(obj.customField)(entry.data)
      } else {
        var content = entry.data[obj.column];
      }

      if (obj.location === "Start Time" || obj.location === "End Time") {
        content = _this.convertTime(content);
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
    clonedRecords.some(function(entryData) {
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

  // Converts date format
  loopData.forEach(function(obj, index) {
    if (_this.data.detailViewAutoUpdate) {
      var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
      if (extraColumns && extraColumns.length) {

        var entryData = _.find(clonedRecords, function(modEntry) {
          return modEntry.id === obj.id;
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

    var newDate = new Date(obj[dateField]).toUTCString();
    loopData[index][dateField] = moment(newDate).utc().format("ddd Do MMM");
  });

  var newRecords = _.values(_.groupBy(loopData, function(row) {
    return row[dateField];
  }));

  _this.modifiedRecords = newRecords;
}

DynamicList.prototype.renderLoopHTML = function() {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
  ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[_this.agendaLayoutMapping[_this.data.layout]['loop']]());

  _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').html(template(_this.modifiedRecords));
}

DynamicList.prototype.renderDatesHTML = function(rows, index) {
  // Function that renders the Dates template
  var _this = this;
  var calendarDates = [];
  var firstDate;
  var lastDate;
  var numberOfPlacholderDays = 3;
  var clonedRecords = JSON.parse(JSON.stringify(rows));
  var foundDateField = _.find(_this.data.detailViewOptions, {type: 'date', location: 'Full Date'});
  var dateField = 'Full Date';
  if (foundDateField) {
    dateField = foundDateField.column;
  }
  // set first date in agenda
  firstDate = new Date(clonedRecords[0].data[dateField]).toUTCString();

  // set last date in agenda
  lastDate = new Date(clonedRecords[clonedRecords.length - 1].data[dateField]).toUTCString();

  // Adds 5 days before the first date
  // Save them in an array
  for (var i = 0; i < numberOfPlacholderDays; i++) { 
    var newDate = {
      week: moment(firstDate).utc().subtract(i + 1, 'days').format("ddd"),
      day: moment(firstDate).utc().subtract(i + 1, 'days').format("DD"),
      month: moment(firstDate).utc().subtract(i + 1, 'days').format("MMM"),
      placeholder: true
    }
    calendarDates.unshift(newDate);
  }

  // Get only the unique dates
  var uniqueDates = _.uniqBy(clonedRecords, function(obj) {
    return moment(obj.data[dateField]).format('YYYY-MM-DD');
  });

  // Get the event dates
  // Save in an array
  uniqueDates.forEach(function(obj) {
    var newDate = new Date(obj.data[dateField]).toUTCString();
    var newDateObject = {
      week: moment(newDate).utc().format("ddd"),
      day: moment(newDate).utc().format("DD"),
      month: moment(newDate).utc().format("MMM"),
      placeholder: false
    }
    calendarDates.push(newDateObject);
  });

  // Adds 5 days after the last date
  // Save them in an array
  for (var i = 0; i < numberOfPlacholderDays; i++) { 
    var newDate = {
      week: moment(lastDate).utc().add(i + 1, 'days').format("ddd"),
      day: moment(lastDate).utc().add(i + 1, 'days').format("DD"),
      month: moment(lastDate).utc().add(i + 1, 'days').format("MMM"),
      placeholder: true
    }
    calendarDates.push(newDate);
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.otherLoopHTML
  ? Handlebars.compile(_this.data.advancedSettings.otherLoopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[_this.agendaLayoutMapping[_this.data.layout]['other-loop']]());

  _this.$container.find('.agenda-date-selector ul').html(template(calendarDates));
  // Selects the first date
  $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index ? index : 0]).addClass('active');
  _this.centerDate();
}

DynamicList.prototype.getAddPermission = function(data) {
  var _this = this;

  if (typeof data.addEntry !== 'undefined' && typeof data.addPermissions !== 'undefined') {
    if (_this.myUserData && (_this.data.addPermissions === 'admins' || _this.data.addPermissions === 'users-admins')) {
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
      if (_this.myUserData && (_this.data.editPermissions === 'admins' || _this.data.editPermissions === 'users-admins')) {
        if (_this.myUserData[_this.data.userAdminColumn] !== null && typeof _this.myUserData[_this.data.userAdminColumn] !== 'undefined' && _this.myUserData[_this.data.userAdminColumn] !== '') {
          entries[index].editEntry = _this.data.editEntry;
        }
      } else if (_this.myUserData && (_this.data.editPermissions === 'user' || _this.data.editPermissions === 'users-admins')) {
        if (_this.myUserData[_this.data.userEmailColumn] === obj.data[_this.data.userListEmailColumn]) {
          entries[index].editEntry = _this.data.editEntry;
        }
      } else if (_this.data.addPermissions === 'everyone') {
        entries[index].editEntry = _this.data.editEntry;
      }
    }
    if (typeof _this.data.deleteEntry !== 'undefined' && typeof _this.data.deletePermissions !== 'undefined') {
      if (_this.myUserData && (_this.data.deletePermissions === 'admins' || _this.data.deletePermissions === 'users-admins')) {
        if (_this.myUserData[_this.data.userAdminColumn] !== null && typeof _this.myUserData[_this.data.userAdminColumn] !== 'undefined' && _this.myUserData[_this.data.userAdminColumn] !== '') {
          entries[index].deleteEntry = _this.data.deleteEntry;
        }
      } else if (_this.myUserData && (_this.data.deletePermissions === 'user' || _this.data.deletePermissions === 'users-admins')) {
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

DynamicList.prototype.setupCards = function() {
  var _this = this;

  _this.initializeMixer();
  _this.bindTouchEvents();

  // Sets up the like and bookmark buttons
  if (_this.data.social && _this.data.social.bookmark) {
    _this.$container.find('.agenda-list-item').each(function(index, element) {
      _this.prepareSetupBookmark(element);
    });
  }
}

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  // Ready
  _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');

  // Wait for bookmark to appear on the page
  var checkTimer = 0;
  var checkInterval = setInterval(function() {
    // Check for 10 seconds
    if (checkTimer > 10) {
      clearInterval(checkInterval);
      return;
    }
    _this.checkBookmarked();
    checkTimer++;
  }, 1000);
}

/* ANIMATION FOR DATES BACK AND FORWARD */
// animates dates forward
DynamicList.prototype.animateDateForward = function(nextDateElement, nextDateElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '+=' + nextDateElementWidth 
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-date-selector li.active').removeClass('active');
      nextDateElement.addClass('active');
      resolve();
    });
  });
}

// animates cards forward
DynamicList.prototype.animateAgendaForward = function(nextAgendaElement, nextAgendaElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '+=' + nextAgendaElementWidth 
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      nextAgendaElement.addClass('active');
      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;
      resolve();
    });
  });
}

// animates dates back
DynamicList.prototype.animateDateBack = function(prevDateElement, prevDateElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '-=' + prevDateElementWidth
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-date-selector li.active').removeClass('active');
      prevDateElement.addClass('active');
      resolve();
    });
  });
}

// animate cards back
DynamicList.prototype.animateAgendaBack = function(prevAgendaElement, prevAgendaElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '-=' + prevAgendaElementWidth
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      prevAgendaElement.addClass('active');
      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;
      resolve();
    });
  });
}

// function to move forward in time
DynamicList.prototype.moveForwardDate = function(index, difference) {
  var _this = this;
  _this.centerDate();

  var nextDateElement = $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index]);
  var nextAgendaElement = $(_this.$container.find('.agenda-list-day-holder')[index]);

  if (!nextDateElement.length || !nextAgendaElement.length || _this.animatingForward) {
    return;
  }

  _this.animatingForward = true;
  var nextDateElementWidth = Math.floor(nextDateElement.outerWidth() * difference);
  var nextAgendaElementWidth = Math.floor(nextAgendaElement.outerWidth() * difference);

  if (!_this.isPanning) {
    _this.scrollValue = 0;
  }

  Promise.all([
    _this.animateDateForward(nextDateElement, nextDateElementWidth),
    _this.animateAgendaForward(nextAgendaElement, nextAgendaElementWidth - _this.scrollValue)
  ]).then(function(){
    _this.isPanning = false;
    _this.animatingForward = false;
  });
}

// function to move back in time
DynamicList.prototype.moveBackDate = function(index, difference) {
  var _this = this;
  _this.centerDate();

  var prevDateElement = $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index])
  var prevAgendaElement = $(_this.$container.find('.agenda-list-day-holder')[index]);
  var positiveDifference = difference *= -1;
  
  if (!prevDateElement.length || !prevAgendaElement.length || _this.animatingBack) {
    return;
  }

  _this.animatingBack = true;
  var prevDateElementWidth = Math.floor(prevDateElement.outerWidth() * positiveDifference);
  var prevAgendaElementWidth = Math.floor(prevAgendaElement.outerWidth() * positiveDifference);

  if (!_this.isPanning) {
    _this.scrollValue = 0;
  }
  
  Promise.all([
    _this.animateDateBack(prevDateElement, prevDateElementWidth),
    _this.animateAgendaBack(prevAgendaElement, prevAgendaElementWidth + _this.scrollValue)
  ]).then(function(){
    _this.isPanning = false;
    _this.animatingBack = false;
  });
}

DynamicList.prototype.initializeMixer = function() {
  // Function that initializes MixItUP
  // Plugin used for filtering
  var _this = this;
  var agendaLists = document.getElementsByClassName('agenda-list-card-holder');

  for (var i = 0; i < agendaLists.length; i++) {
    var newMixer = mixitup(agendaLists[i], {
      selectors: {
        control: '[data-mixitup-control="' + _this.data.id + '"]',
        target: '.agenda-list-item'
      },
      layout: {
        allowNestedTargets: false
      },
      animation: {
        "duration": 250,
        "nudge": true,
        "reverseOut": false,
        "effects": "fade scale(0.45) translateZ(-100px)"
      },
      callbacks: {
        onMixEnd: function(state) {
          if (!state.show.length) {
            $(state.container).addClass('empty');
          } else {
            $(state.container).removeClass('empty');
          }
          $(state.container).removeClass('mixing');
        },
        onMixStart: function(state, originalEvent) {
          $(state.container).addClass('mixing');
        }
      }
    });

    _this.mixer.push(newMixer);
  }
}

// Function to center date
DynamicList.prototype.centerDate = function() {
  // resets position - this will only be used when resizing
  var _this = this;
  _this.$container.find('.agenda-date-selector ul').scrollLeft(0);
  var halfWindowWidth = $(window).width() / 2;
  var activePosition = _this.$container.find('.agenda-date-selector li.active').position();
  var activeWidth = _this.$container.find('.agenda-date-selector li.active').outerWidth();
  var halfWidth = activeWidth / 2;

  _this.$container.find('.agenda-date-selector ul').scrollLeft(activePosition.left - (halfWindowWidth - halfWidth));
}

// Functions to setup Fliplet Like
DynamicList.prototype.setupBookmarkButton = function(id, identifier, title) {
  var _this = this;

  _this.bookmarkButtons.push({
    btn: LikeButton({
      target: '.new-agenda-list-container .agenda-item-bookmark-holder-' + id,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: {
        entryId: identifier,
        pageId: Fliplet.Env.get('pageId')
      },
      allowAnonymous: true,
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<span class="fa fa-bookmark-o"></span>', 
      likedLabel: '<span class="fa fa-bookmark"></span>',
      likeWrapper: '<div class="bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="bookmark-wrapper btn-bookmarked"></div>',
      addType: 'prepend'
    }),
    id: id
  });
}

DynamicList.prototype.setupBookmarkButtonOverlay = function(id, identifier, title) {
  var _this = this;

  _this.bookmarkButtonOverlay = LikeButton({
    target: '.agenda-detail-overlay .agenda-item-bookmark-holder-' + id,
    dataSourceId: _this.data.bookmarkDataSourceId,
    content: {
      entryId: identifier,
      pageId: Fliplet.Env.get('pageId')
    },
    allowAnonymous: true,
    name: Fliplet.Env.get('pageTitle') + '/' + title,
    likeLabel: '<span class="fa fa-bookmark-o"></span>', 
    likedLabel: '<span class="fa fa-bookmark"></span>',
    likeWrapper: '<div class="bookmark-wrapper btn-bookmark"></div>',
    likedWrapper: '<div class="bookmark-wrapper btn-bookmarked"></div>',
    addType: 'prepend'
  });
}

DynamicList.prototype.prepareSetupBookmarkOverlay = function(id) {
  var _this = this;
  var bookmarkIndentifier = id + '-bookmark';
  var title = $('.agenda-detail-overlay').find('.agenda-item-inner-content .agenda-item-title').text();

  _this.setupBookmarkButtonOverlay(id, bookmarkIndentifier, title);
  _this.likesObserversOverlay(id);
}

DynamicList.prototype.prepareSetupBookmark = function(element) {
  var _this = this;
  var cardId = $(element).data('entry-id');
  var bookmarkIndentifier = cardId + '-bookmark';
  var title = $(element).find('.agenda-item-inner-content .agenda-item-title').text();

  _this.setupBookmarkButton(cardId, bookmarkIndentifier, title);
  _this.likesObservers();
}

// Function to add class to card marking it as bookmarked - for filtering
DynamicList.prototype.checkBookmarked = function() {
  var _this = this;

  _this.$container.find('.btn-bookmarked').each(function(idx, element) {
    $(element).parents('.agenda-list-item').addClass('bookmarked');
  });
}

DynamicList.prototype.bindTouchEvents = function() {
  var _this = this;
  var handle = document.getElementById('agenda-cards-wrapper-' +_this.data.id);
  _this.hammer = _this.hammer || new Hammer(handle);

  _this.hammer.on('panright panleft', function(e) {
    if (_this.checkScrollHorizontal(e)) {
      _this.isPanning = true;
      _this.sliderCount = _this.$container.find('.agenda-list-day-holder').length;
      _this.activeSlideIndex = _this.$container.find('.agenda-list-day-holder').index($('.agenda-list-day-holder.active'));
      _this.$container.find('.agenda-date-selector ul').addClass('is-panning');

      var reverse = e.deltaX - (e.deltaX * 2);
      _this.scrollValue = reverse;
      _this.$container.find('.agenda-cards-wrapper').scrollLeft(_this.copyOfScrollValue + _this.scrollValue);
    }
  });

  _this.hammer.on('panend', function(e) {
    _this.$container.find('.agenda-date-selector ul').removeClass('is-panning');
    if (_this.checkScrollHorizontal(e)) {
      if ( _this.scrollValue > 0 ) {
        _this.sliderGoTo( _this.activeSlideIndex + 1 );
      } else if ( _this.scrollValue < 0 ) {
        _this.sliderGoTo( _this.activeSlideIndex - 1 );
      }
    }
  });
}

DynamicList.prototype.checkScrollHorizontal = function(e) {
  var _this = this;
  var deltaY = e.deltaY;
  var positiveDeltaY = deltaY < 0 ? deltaY *= -1 : deltaY;
  var deltaX = e.deltaX;
  var positiveDeltaX = deltaX < 0 ? deltaX *= -1 : deltaX;
  var distanceY = e.distance - positiveDeltaY;
  var distanceX = e.distance - positiveDeltaX;

  return distanceX < distanceY
}

DynamicList.prototype.sliderGoTo = function(number) {
  var _this = this;
  // Stop it from doing weird things like moving to slides that don’t exist
  if ( number < 0 ) {
    _this.activeSlideIndex = 0;
  } else if ( number > _this.sliderCount - 1 ) {
    _this.activeSlideIndex = _this.sliderCount - 1
  } else {
    if (number > _this.activeSlideIndex) {
      _this.activeSlideIndex = number;
      _this.moveForwardDate(_this.activeSlideIndex, 1);
    } else {
      _this.activeSlideIndex = number;
      _this.moveBackDate(_this.activeSlideIndex, -1);
    }
  }
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

  var entryData = _(_this.modifiedRecords)
    .chain()
    .thru(function(coll) {
      return _.union(coll, _.map(coll, 'children'));
    })
    .flatten()
    .find({
      id: id
    })
    .value();

  var entryId = {
    id: id
  };

  var wrapper = '<div class="agenda-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = _this.$container.find('#agenda-detail-overlay-' + _this.data.id);

  var src = _this.src;
  var beforeShowDetails = Promise.resolve({
    src: src,
    data: entryData
  });

  if (typeof _this.data.beforeShowDetails === 'function') {
    beforeShowDetails = _this.data.beforeShowDetails({
      config: _this.data,
      src: src,
      data: entryData
    });
    
    if (!(beforeShowDetails instanceof Promise)) {
      beforeShowDetails = Promise.resolve(beforeShowDetails);
    }
  }

  beforeShowDetails.then(function (data) {
    data = data || {};
    var template = Handlebars.compile(data.src || src);
    var wrapperTemplate = Handlebars.compile(wrapper);

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').addClass('remove-transform');
    }

    // Adds content to overlay
    $overlay.find('.agenda-detail-overlay-content-holder').html(wrapperTemplate(entryId));
    $overlay.find('.agenda-detail-wrapper').append(template(data.data || entryData));


    // Sets up the like and bookmark buttons
    if (_this.data.social && _this.data.social.bookmark) {
      _this.prepareSetupBookmarkOverlay(id);
    }

    // Trigger animations
    $('body').addClass('lock');
    _this.$container.find('.agenda-feed-list-container').addClass('overlay-open');
    $overlay.addClass('open');
    setTimeout(function() {
      $overlay.addClass('ready');

      if (typeof _this.data.afterShowDetails === 'function') {
        _this.data.afterShowDetails({
          config: _this.data,
          src: data.src || src,
          data: data.data || entryData
        });
      }
    }, 0);
  });
}

DynamicList.prototype.closeDetails = function() {
  // Function that closes the overlay
  var _this = this;

  var $overlay = _this.$container.find('#agenda-detail-overlay-' + _this.data.id);
  $overlay.removeClass('open');
  _this.$container.find('.agenda-feed-list-container').removeClass('overlay-open');
  $('body').removeClass('lock');

  // Sets up the like and bookmark buttons
  if (_this.data.social && _this.data.social.bookmark) {
    _this.bookmarkButtonOverlay = undefined;
  }

  setTimeout(function() {
    $overlay.removeClass('ready');
    // Clears overlay
    $overlay.find('.agenda-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }
  }, 300);
}