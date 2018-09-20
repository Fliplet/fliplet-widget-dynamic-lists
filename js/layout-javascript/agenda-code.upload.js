Fliplet.Registry.set('dynamic-list:1.3.0:agenda', (function () {
  var agendaLayoutMapping = {
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-cards-loop',
      'other-loop': 'templates.build.agenda-dates-loop'
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
    this.$container = $('[data-dynamic-lists-1-3-0-id="' + id + '"]');
    this.queryOptions = {};

    // Other variables
    // Global variables
    this.allowClick = true;
    this.hammer;
    this.mixer= [];
    this.bookmarkButtons = [];
    this.animatingForward = false;
    this.animatingBack = false;
    this.activeSlideIndex;
    this.sliderCount;
    this.scrollValue = 0;
    this.copyOfScrollValue = _this.scrollValue;
    this.isPanning = false;
    this.myUserData;

    this.listItems;
    this.dataSourceColumns;

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

    Handlebars.registerHelper('removeSpaces', function(context) {
      return context.replace(/\s+/g, '');
    });
  }

  DynamicList.prototype.attachObservers = function() {
    var _this = this;
    // Attach your event listeners here
    $(window).resize(function() {
      _this.setCardHeight();
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
        event.stopPropagation();
        var elementToExpand = $(this).find('.agenda-list-item-content');
        var entryId = $(this).data('entry-id');
        var entryTitle = $(this).find('.agenda-item-title').text();
        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'entry_open',
          label: entryTitle
        });

        if (_this.data.summaryLinkOption === 'link' && _this.data.summaryLinkAction) {
          _this.openLinkAction(entryId);
          return;
        }
        
        _this.expandElement(elementToExpand);
      })
      .on('click', '.agenda-list-item .agenda-item-close-btn', function(event) {
        event.stopPropagation();
        _this.collapseElement($(this));
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
            FFliplet.UI.Toast(options);
          }
        }
      })
      .on('click', '.dynamic-list-edit-item', function() {
        var entryID = $(this).parents('.agenda-list-item').data('entry-id');
        var options = {
          title: 'Link not configured',
          message: 'Form not found. Please check the component\'s configuration.',
        };

        if (_this.data.editEntryLinkAction) {
          _this.data.editEntryLinkAction.query = '?dataSourceEntryId=';

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
        var entryID = $(this).parents('.agenda-list-item').data('entry-id');
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

                  var $closeButton = _that.parents('.agenda-list-item').find('.agenda-list-item .agenda-item-close-btn');
                  _this.collapseElement($closeButton);

                  var selectedIndex = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
                  _this.renderDatesHTML(_this.listItems, selectedIndex);
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
          // Case insensitive
          if (filter.value !== null && filter.value !== '' && typeof filter.value !== 'undefined') {
            filter.value = filter.value.toLowerCase();
          }
          if (record.data[filter.column] !== null && record.data[filter.column] !== '' && typeof record.data[filter.column] !== 'undefined') {
            record.data[filter.column] = record.data[filter.column].toString().toLowerCase();
          }

          if (condition === 'contains') {
            if (record.data[filter.column] !== null && typeof record.data[filter.column] !== 'undefined' && record.data[filter.column].indexOf(filter.value) > -1) {
              matched++;
            }
            return;
          }
          if (condition === 'notcontain') {
            if (record.data[filter.column] !== null && typeof record.data[filter.column] !== 'undefined' && record.data[filter.column].indexOf(filter.value) === -1) {
              matched++;
            }
            return;
          }
          if (condition === 'regex') {
            var pattern = new RegExp(filter.value);
            if (patt.test(record.data[filter.column])){
              matched++;
            }
            return;
          }
          if (operators[condition](record.data[filter.column], filter.value)) {
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

    // Connect to data source to get rows
    _this.connectToDataSource()
      .then(function (records) {
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
        _this.renderLoopHTML(_this.listItems);
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
      baseHTML = Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['base']];
    }

    var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
    ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
    : Handlebars.compile(baseHTML());

    $('[data-dynamic-lists-1-3-0-id="' + _this.data.id + '"]').html(template(data));
  }

  DynamicList.prototype.renderLoopHTML = function(rows) {
    // Function that renders the List template
    var _this = this;

    var savedColumns = [];

    var clonedRecords = JSON.parse(JSON.stringify(rows));
    clonedRecords = _this.getPermissions(clonedRecords);

    var loopData = [];
    var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
      return !option.editable;
    });
    var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
      return option.editable;
    });
    var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['loop']]());

    // IF STATEMENT FOR BACKWARDS COMPATABILITY
    if (!_this.data.detailViewOptions) {
      clonedRecords.forEach(function(entry) {
        var newObject = {
          id: entry.id,
          flClasses: entry.data['flClasses'],
          flFilters: entry.data['flFilters'],
          editEntry: entry.editEntry,
          deleteEntry: entry.deleteEntry,
          likesEnabled: entry.likesEnabled,
          bookmarksEnabled: entry.bookmarksEnabled,
          commentsEnabled: entry.commentsEnabled
        };

        $.extend(true, newObject, entry.data);

        loopData.push(newObject);
      });
      
      // Converts date format
      loopData.forEach(function(obj, index) {
        var newDate = new Date(obj['Date']).toUTCString();
        loopData[index]['Date'] = moment(newDate).utc().format("ddd Do MMM");
      });

      var newRecords = _.values(_.groupBy(loopData, function(row) {
        return row['Date'];
      }));

      _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').html(template(newRecords));
      return;
    }

    // Uses sumamry view settings set by users
    clonedRecords.forEach(function(entry) {
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

    clonedRecords.forEach(function(entry, index) {
      
    });

    // Converts date format
    loopData.forEach(function(obj, index) {
      if (_this.data.detailViewAutoUpdate) {
        var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
        if (extraColumns && extraColumns.length) {

          var entryData = _.find(clonedRecords, function(modEntry) {
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

      var newDate = new Date(obj['Date']).toUTCString();
      loopData[index]['Date'] = moment(newDate).utc().format("ddd Do MMM");
    });

    var newRecords = _.values(_.groupBy(loopData, function(row) {
      return row['Date'];
    }));

    _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').html(template(newRecords));
  }

  DynamicList.prototype.renderDatesHTML = function(rows, index) {
    // Function that renders the Dates template
    var _this = this;
    var calendarDates = [];
    var firstDate;
    var lastDate;
    var numberOfPlacholderDays = 3;
    var clonedRecords = JSON.parse(JSON.stringify(rows));

    // set first date in agenda
    firstDate = new Date(clonedRecords[0].data['Date']).toUTCString();

    // set last date in agenda
    lastDate = new Date(clonedRecords[clonedRecords.length - 1].data['Date']).toUTCString();

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
      return obj.data['Date'];
    });

    // Get the event dates
    // Save in an array
    uniqueDates.forEach(function(obj) {
      var newDate = new Date(obj.data['Date']).toUTCString();
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
    : Handlebars.compile(Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['other-loop']]());

    _this.$container.find('.agenda-date-selector ul').html(template(calendarDates));
    // Selects the first date
    $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index ? index : 0]).addClass('active');
    _this.centerDate();
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
    _this.setCardHeight();
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

  // Function to set the height of cards
  DynamicList.prototype.setCardHeight = function() {
    var _this = this;

    _this.$container.find('.agenda-list-item').each(function(index, element) {
      var containerHeight = $(element).find('.agenda-item-inner-content').outerHeight();

      $(element).css({
        height: containerHeight
      });
    });
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
        target: '.agenda-item-bookmark-holder-' + id,
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

  DynamicList.prototype.prepareSetupBookmark = function(element) {
    var _this = this;
    var cardId = $(element).data('entry-id');
    var bookmarkIndentifier = cardId + '-bookmark';
    var title = $(element).find('.agenda-item-inner-content .agenda-item-title').text();

    _this.setupBookmarkButton(cardId, bookmarkIndentifier, title);
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

  DynamicList.prototype.expandElement = function(elementToExpand) {
    // Function called when a list item is tapped to expand
    var _this = this;

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (elementToExpand.parents('.panel-group').length) {
      elementToExpand.parents('.panel-group').addClass('remove-transform');
    }

    // Adds class 'open' to help with styling
    elementToExpand.parents('.agenda-list-item').addClass('open');

    // Prevents 'body' scroll
    _this.$container.find('.agenda-list-day-holder').addClass('lock');
    $('html, body').addClass('lock');
    
    // freeze the current scroll position of the background page expand-wrapper
    var elementOffset = _this.$container.find('.new-agenda-list-container').offset();
    var elementScrollTop = $('body').scrollTop();
    var netOffset = elementOffset.top - elementScrollTop;
    var expandPosition = _this.$container.find('.new-agenda-list-container').offset();
    var expandTop = expandPosition.top;
    var expandLeft = expandPosition.left;
    var expandWidth = _this.$container.find('.new-agenda-list-container').outerWidth();
    var expandHeight = _this.$container.find('.new-agenda-list-container').outerHeight();

    _this.$container.find('.new-agenda-list-container').css({
      'top': netOffset,
      'position': 'fixed',
      'z-index': '13'
    });

    _this.$container.find('.agenda-cards-wrapper').css({
      'z-index': '13'
    });

    // convert the expand-item to fixed position without moving it
    elementToExpand.css({
      'top' : elementToExpand.offset().top - $('body').scrollTop(),
      'left' : elementToExpand.offset().left,
      'height' : elementToExpand.height(),
      'width' : elementToExpand.width(),
      'max-width': expandWidth,
      'position' : 'fixed'
    });

    // start expand-item animation to the expand wrapper
    // expand the element with class .about-tile-bg-image
    elementToExpand.animate(
      {
        'left': expandLeft,
        'top': expandTop,
        'height': expandHeight,
        'width': expandWidth,
        'max-width': expandWidth
      },
      200, // animation timing in millisecs
      'swing',  //animation easing
      function() {
        elementToExpand.css({
          'right': 0,
          'bottom': 0,
          'width': 'auto',
          'height': 'auto'
        });

        elementToExpand.find('.slide-under').css({
          position: 'fixed'
        });
      }
    );
  }

  DynamicList.prototype.collapseElement = function(collapseButton) {
    // Function called when a list item is tapped to close
    var _this = this;

    // find the element to collapse 
    var elementToCollapseParent = collapseButton.parents('.agenda-list-item');
    var elementToCollapse = elementToCollapseParent.find('.agenda-list-item-content');
    // find the location of the placeholder
    var elementToCollapsePlaceholder = elementToCollapse.parents('.agenda-list-item');
    var elementToCollapsePlaceholderTop = elementToCollapsePlaceholder.offset().top - $('body').scrollTop();
    var elementToCollapsePlaceholderLeft = elementToCollapsePlaceholder.offset().left;
    var elementToCollapsePlaceholderHeight = elementToCollapsePlaceholder.outerHeight();
    var elementToCollapsePlaceholderWidth = elementToCollapsePlaceholder.outerWidth();

    elementToCollapse.find('.slide-under').css({
      position: 'absolute'
    });

    // convert the width and height to numeric values
    elementToCollapse.css({
      'right': 'auto',
      'bottom': 'auto',
      'width': elementToCollapse.outerWidth(),
      'height': elementToCollapse.outerHeight(),
    });

    _this.$container.find('.new-agenda-list-container').css({
      'top': 0,
      'top': 'env(safe-area-inset-top)',
      'position': 'fixed',
      'z-index': '1'
    });

    _this.$container.find('.agenda-cards-wrapper').css({
      'z-index': '1'
    });
       
    elementToCollapse.animate(
      {
        'left': elementToCollapsePlaceholderLeft,
        'top': elementToCollapsePlaceholderTop,
        'height': elementToCollapsePlaceholderHeight,
        'width': elementToCollapsePlaceholderWidth
      },
      200, // animation timing in millisecs
      'linear',  //animation easing
      function() {
        // Removes class 'open'
        elementToCollapseParent.removeClass('open');

        elementToCollapse.css({
          'position': 'relative',
          'top': 'auto',
          'left': 'auto',
          'width': '100%',
          'height': '100%'
        });

        // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
        // Only happens when the closing animation finishes
        if (elementToCollapse.parents('.panel-group').length) {
          elementToCollapse.parents('.panel-group').removeClass('remove-transform');
        }
      }
    );

    _this.$container.find('.agenda-list-item').removeClass('open');
    // Stops preventing 'body' scroll
    _this.$container.find('.agenda-list-day-holder').removeClass('lock');
    $('body').removeClass('lock');
  }

  return DynamicList;
})());