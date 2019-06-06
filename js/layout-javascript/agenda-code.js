// Constructor
function DynamicList(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-cards-loop',
      'detail': 'templates.build.agenda-cards-detail',
      'other-loop': 'templates.build.agenda-dates-loop'
    }
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
  this.agendaDates = [];

  this.listItems;
  this.agendasByDay;
  this.dataSourceColumns;

  this.queryOpen = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvPreFilterQuery;
  this.pvOpenQuery;

  /*
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

  this.detailHTML = Handlebars.compile(this.src);

  // Register handlebars helpers
  this.Utils.registerHandlebarsHelpers();
  // Get the current session data
  Fliplet.User.getCachedSession()
    .then(function(session) {
      if (_.get(session, 'entries.dataSource.data')) {
        _this.myUserData = _.get(session, 'entries.dataSource.data');
      } else if (_.get(session, 'entries.saml2.user')) {
        _this.myUserData = _.get(session, 'entries.saml2.user');
        _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
        _this.myUserData.isSaml2 = true;
      }

      // Start running the Public functions
      return _this.initialize();
    });
};

DynamicList.prototype.Utils = Fliplet.Registry.get('dynamicListUtils');

DynamicList.prototype.attachObservers = function() {
  var _this = this;
  // Attach your event listeners here
  $(window).resize(function() {
    _this.centerDate();
  });

  _this.$container
    .on('click', '.go-to-poll', function() {
      if (!_this.data.pollEnabled || !_this.data.pollColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entryTitle = $(this).parents('.agenda-item-inner-content').find('.agenda-item-title').text().trim();
      var data = {
        id: entryId,
        title: entryTitle
      }
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });
      var screenFromColumn = entry.data[_this.data.pollColumn];
      var screen = _.find(Fliplet.Env.get('appPages'), function(page) {
        return page.title === screenFromColumn;
      });

      if (screen) {
        Fliplet.App.Storage.set('pollSessionTitle-' + screen.id, data)
          .then(function() {
            Fliplet.Navigate.screen(screen.id, { transition: 'fade' });
          });
      }
    })
    .on('click', '.go-to-survey', function() {
      if (!_this.data.surveyEnabled || !_this.data.surveyColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entryTitle = $(this).parents('.agenda-item-inner-content').find('.agenda-item-title').text().trim();
      var data = {
        id: entryId,
        title: entryTitle
      }
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });
      var screenFromColumn = entry.data[_this.data.surveyColumn];
      var screen = _.find(Fliplet.Env.get('appPages'), function(page) {
        return page.title === screenFromColumn;
      });

      if (screen) {
        Fliplet.App.Storage.set('surveySessionTitle-' + screen.id, data)
          .then(function() {
            Fliplet.Navigate.screen(screen.id, { transition: 'fade' });
          });
      }
    })
    .on('click', '.go-to-questions', function() {
      if (!_this.data.questionsEnabled || !_this.data.questionsColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entryTitle = $(this).parents('.agenda-item-inner-content').find('.agenda-item-title').text().trim();
      var data = {
        id: entryId,
        title: entryTitle
      }
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });
      var screenFromColumn = entry.data[_this.data.questionsColumn];
      var screen = _.find(Fliplet.Env.get('appPages'), function(page) {
        return page.title === screenFromColumn;
      });

      if (screen) {
        Fliplet.App.Storage.set('questionsSessionTitle-' + screen.id, data)
          .then(function() {
            Fliplet.Navigate.screen(screen.id, { transition: 'fade' });
          });
      }
    })
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
          _this.pvPreviousScreen = eval(_this.pvPreviousScreen);
        } catch (error) {
          console.error('Your custom function contains a syntax error: ' + error);
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
        if (_this.$container.find('.agenda-date-selector li.active').next().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
        var indexOfClickedDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active').next());
        var indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.moveForwardDate(indexOfClickedDate, indexDifference);
        return;
      }
      if (e.keyCode === 37) {
        if (_this.$container.find('.agenda-date-selector li.active').prev().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
        var indexOfClickedDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active').prev());
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

      var indexOfActiveDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
      var indexOfClickedDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(this);
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

                  var selectedIndex = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
                  _this.renderDatesHTML(_this.listItems, selectedIndex);
                  _this.prepareToRenderLoop(_this.listItems);
                  _this.renderLoopHTML(function (index, $batch) {
                    if (index === 0) {
                      _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
                      _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
                    }
                  }).then(function(index, $full){
                    if (index === -1) {
                      _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
                      _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
                    }
                    _that.text('Delete').removeClass('disabled');
                  });
                })
                .catch(function(error) {
                  Fliplet.UI.Toast.error(error, {
                    message: 'Error deleting entry'
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
    return connection.removeById(entryID, { ack: true });
  }).then(function () {
    return Promise.resolve(entryID);
  });
}

DynamicList.prototype.likesObservers = function(button) {
  var _this = this;

  button.btn.on('liked', function(data){
    this.$btn.parents('.agenda-list-item').addClass('bookmarked');
    var entryTitle = this.$btn.parents('.agenda-item-content-holder').find('.agenda-item-title').text();
    Fliplet.Analytics.trackEvent({
      category: 'list_dynamic_' + _this.data.layout,
      action: 'entry_bookmark',
      label: entryTitle
    });
  });

  button.btn.on('liked.fail', function(data){
    this.$btn.parents('.agenda-list-item').removeClass('bookmarked');
    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + button.id).removeClass('bookmarked').addClass('not-bookmarked');
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

  button.btn.on('unliked.fail', function(data){
    this.$btn.parents('.agenda-list-item').addClass('bookmarked');
    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + button.id).removeClass('not-bookmarked').addClass('bookmarked');
  });
}

DynamicList.prototype.likesObserversOverlay = function(id, button, isLiked) {
  var _this = this;

  _this.$container.find('.agenda-detail-overlay .bookmark-wrapper').on('click', function() {
    if (isLiked) {
      $(this).parents('.agenda-item-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
      button.btn.unlike();
      isLiked = !isLiked;
      return;
    }

    $(this).parents('.agenda-item-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
    button.btn.like();
    isLiked = !isLiked;
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

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render list with default data
  if (_this.data.defaultData) {
    // Render Base HTML template
    _this.renderBaseHTML();

    return _this.Utils.Records.prepareData({
      records: _this.data.defaultEntries,
      config: _this.data,
      filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
    }).then(function (records) {
      _this.listItems = records;
      _this.dataSourceColumns = _this.data.defaultColumns;

      return _this.Utils.Records.updateFiles({
        records: _this.listItems,
        config: _this.data
      });
    }).then(function(response) {
      _this.listItems = _.uniqBy(response, function (item) {
        return item.id;
      });

      // Render dates HTML
      _this.renderDatesHTML(_this.listItems);

      // Render Loop HTML
      _this.prepareToRenderLoop(_this.listItems);
      _this.renderLoopHTML(function (index, $batch) {
        if (index === 0) {
          _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
          _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
        }
      }).then(function(index, $full){
        if (index === -1) {
          _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
          _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
        }

        // Listeners and Ready
        _this.initializeMixer();
        _this.bindTouchEvents();
        _this.goToToday();
        _this.setupCards();
        _this.attachObservers();
        _this.scrollEvent();
        _this.checkBookmarked();
      });
    });
  }

  var shouldInitFromQuery = _this.parseQueryVars();
  // query will always have higher priority than storage
  // if we find relevant terms in the query, delete the storage so the filters do not mix and produce side-effects
  if (shouldInitFromQuery) {
    Fliplet.App.Storage.remove('flDynamicListQuery:' + _this.data.layout);
  };

  // Check if there is a query or PV for search/filter queries
  (shouldInitFromQuery ? Promise.resolve() : _this.parsePVQueryVars())
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();

      return _this.connectToDataSource();
    })
    .then(function (records) {
      // Received the rows
      return Fliplet.Hooks.run('flListDataAfterGetData', {
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        records: records
      }).then(function () {
        return _this.Utils.Records.prepareData({
          records: records,
          config: _this.data,
          filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
        });
      });
    })
    .then(function(records) {
      _this.listItems = records;

      // Render dates HTML
      _this.renderDatesHTML(_this.listItems);

      if (!_this.data.detailViewAutoUpdate) {
        return Promise.resolve();
      }

      return _this.Utils.Records.getFields(_this.listItems, _this.data.dataSourceId).then(function (columns) {
        _this.dataSourceColumns = columns;
      });
    })
    .then(function() {
      return _this.Utils.Records.updateFiles({
        records: _this.listItems,
        config: _this.data
      });
    })
    .then(function(response) {
      _this.listItems = _.uniqBy(response, function (item) {
        return item.id;
      });
      // Render Loop HTML
      _this.prepareToRenderLoop(_this.listItems);
      _this.checkIsToOpen();
      _this.renderLoopHTML(function (index, $batch) {
        if (index === 0) {
          _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
          _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
        }
      }).then(function(index, $full){
        if (index === -1) {
          _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
          _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
        }

        _this.initializeMixer();
        _this.bindTouchEvents();
        _this.goToToday();
        _this.setupCards();
        _this.attachObservers();
        _this.scrollEvent();
        _this.checkBookmarked();
      });
    })
}

DynamicList.prototype.checkIsToOpen = function(options) {
  // List of entries saved in: _this.modifiedListItems

  options = options || {};

  var _this = this;
  var entry;

  if (!_this.queryOpen) {
    return;
  }

  if (_.hasIn(_this.pvOpenQuery, 'id')) {
    entry = _(_this.agendasByDay)
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

    entry = _(_this.agendasByDay)
      .chain()
      .thru(function(day) {
        return _.union(day, _.map(day, 'children'));
      })
      .flatten()
      .find(queryObject)
      .value();
  }

  if (!entry) {
    // Entry not found
    if (options.silent) {
      return;
    }

    Fliplet.UI.Toast('Entry not found');
    return;
  }

  _this.showDetails(entry.id);
}

DynamicList.prototype.parseQueryVars = Fliplet.Registry.get('dynamicListQueryParser');

DynamicList.prototype.parsePVQueryVars = function() {
  var _this = this;
  var pvValue;

  return Fliplet.App.Storage.get('flDynamicListQuery:' + _this.data.layout)
    .then(function(value) {
      pvValue = value;

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
    Fliplet.UI.Toast.error(error, {
      message: 'Error loading data'
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
    baseHTML = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
    ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
    : Handlebars.compile(baseHTML());

  _this.$container.html(template(data));
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

DynamicList.prototype.groupLoopDataByDate = function (loopData, dateField) {
  var _this = this;
  // Group data by date field
  var recordGroups = _.groupBy(loopData, function(row) {
    // Format date value as it could be in various formats
    return _this.Utils.Date.moment(row[dateField]).format('YYYY-MM-DD');
  });
  var recordMerges = [];

  // Prepare a merge if the date values are parsed as the same date
  _.forEach(_.keys(recordGroups), function (key, i) {
    var date = _this.Utils.Date.moment(key);
    _.forEach(_.keys(recordGroups), function (comp, j) {
      if (j >= i) {
        return false;
      }

      if (date.format('YYYY-MM-DD') !== _this.Utils.Date.moment(comp).format('YYYY-MM-DD')) {
        return;
      }

      recordMerges.push({
        from: key,
        to: comp
      });
      return false;
    });
  });

  // Merge data
  _.forEach(recordMerges, function (merge) {
    recordGroups[merge.to] = _.concat(recordGroups[merge.to], recordGroups[merge.from]);
    delete recordGroups[merge.from];
  });

  return _.values(recordGroups);
};

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
      pollButton: _this.data.pollEnabled
        && entry.data[_this.data.pollColumn]
        && entry.data[_this.data.pollColumn] !== '',
      surveyButton: _this.data.surveyEnabled
        && entry.data[_this.data.surveyColumn]
        && entry.data[_this.data.surveyColumn] !== '',
      questionsButton: _this.data.questionsEnabled
        && entry.data[_this.data.questionsColumn]
        && entry.data[_this.data.questionsColumn] !== '',
      agendaButtonsEnabled: (_this.data.pollEnabled
        && entry.data[_this.data.pollColumn]
        && entry.data[_this.data.pollColumn] !== '')
        || (_this.data.surveyEnabled
        && entry.data[_this.data.surveyColumn]
        && entry.data[_this.data.surveyColumn] !== '')
        || (_this.data.questionsEnabled
        && entry.data[_this.data.questionsColumn]
        && entry.data[_this.data.questionsColumn] !== ''),
      isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      entryDetails: [],
      originalData: entry.data
    };
    _this.data['summary-fields'].some(function(obj) {
      var content = '';
      if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
      } else {
        content = entry.data[obj.column];
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
          content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
        } else {
          content = entry.data[obj.column];
        }
        newObject[obj.location] = content;
      }
    });

    dynamicData.forEach(function(dynamicDataObj) {
      var label = '';
      var labelEnabled = true;
      var content = '';

      // Define label
      if (dynamicDataObj.fieldLabel === 'column-name' && dynamicDataObj.column !== 'custom') {
        label = dynamicDataObj.column;
      }
      if (dynamicDataObj.fieldLabel === 'custom-label') {
        label = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customFieldLabel)(entry.data));
      }
      if (dynamicDataObj.fieldLabel === 'no-label') {
        labelEnabled = false;
      }
      // Define content
      if (dynamicDataObj.customFieldEnabled) {
        content = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customField)(entry.data));
      } else {
        content = entry.data[dynamicDataObj.column];
      }
      // Define data object
      var newEntryDetail = {
        id: entry.id,
        content: content,
        label: label,
        labelEnabled: labelEnabled,
        type: dynamicDataObj.type
      }
      newObject.entryDetails.push(newEntryDetail);
  });
    loopData.push(newObject);
  });

  // Define detail view data based on user's settings

  savedColumns = dynamicData.map(function(data){
    return data.column;
  })

  // Converts date format
  var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
  if (_this.data.detailViewAutoUpdate && extraColumns.length) {
    loopData.forEach(function(obj, index) {
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
    });
  }

  _this.agendasByDay = _this.groupLoopDataByDate(loopData, dateField);;
}

DynamicList.prototype.renderLoopHTML = function(iterateeCb) {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());

  _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').empty();
  return new Promise(function(resolve){
    // here we need to loop through each agenda
    var renderLoopIndex = 0;
    var $renderFull = $([]);

    function render() {
      // get the next batch of items to render
      var nextBatch = _this.agendasByDay.slice(
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * renderLoopIndex,
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * (renderLoopIndex + 1)
      );

      if (!nextBatch.length) {
        resolve(renderLoopIndex - 1, $renderFull);
        return;
      }

      var $renderBatch = $(template(nextBatch));
      $renderFull.add($renderBatch);
      _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').append($renderBatch);

      if (iterateeCb && typeof iterateeCb === 'function') {
        iterateeCb(renderLoopIndex, $renderBatch);
      }

      renderLoopIndex++;

      // if the browser is ready, render
      requestAnimationFrame(render);
    }
    // start the initial render
    requestAnimationFrame(render);
  });
}

DynamicList.prototype.renderDatesHTML = function(rows, index) {
  // Function that renders the Dates template
  var _this = this;
  var calendarDates = [];
  var firstDate;
  var lastDate;
  var numberOfPlaceholderDays = 3;
  var clonedRecords = JSON.parse(JSON.stringify(rows));
  var foundDateField = _.find(_this.data.detailViewOptions, {type: 'date', location: 'Full Date'});
  var dateField = 'Full Date';
  var formats = {
    week: 'ddd',
    day: 'DD',
    month: 'MMM'
  };
  if (foundDateField) {
    dateField = foundDateField.column;
  }

  // Keep only records with valid dates when rendering dates selectors
  clonedRecords = _.filter(clonedRecords, function (record) {
    return _this.Utils.Date.moment(record.data[dateField]).isValid();
  });

  if (clonedRecords.length) {
    // Set first date in agenda
    firstDate = _this.Utils.Date.moment(clonedRecords[0].data[dateField]);

    // Set last date in agenda
    lastDate = _this.Utils.Date.moment(clonedRecords[clonedRecords.length - 1].data[dateField]);

    // Adds (numberOfPlaceholderDays) days before the first date
    // Save them in an array
    for (var i = 0; i < numberOfPlaceholderDays; i++) {
      firstDate.subtract(1, 'days');
      calendarDates.unshift({
        week: firstDate.format(formats.week),
        day: firstDate.format(formats.day),
        month: firstDate.format(formats.month),
        placeholder: true
      });
    }

    // Get only the unique dates
    var uniqueDates = _.map(_.uniqBy(clonedRecords, function(obj) {
      return _this.Utils.Date.moment(obj.data[dateField]).format('YYYY-MM-DD');
    }), 'data.' + dateField);

    // Get the event dates
    // Save in an array
    uniqueDates.forEach(function(date) {
      var d = _this.Utils.Date.moment(date);

      _this.agendaDates.push(d.format('YYYY-MM-DD'));

      calendarDates.push({
        week: d.format(formats.week),
        day: d.format(formats.day),
        month: d.format(formats.month),
        placeholder: false
      });
    });

    this.agendaDates = _.orderBy(this.agendaDates);

    // Adds (numberOfPlaceholderDays) days after the last date
    // Save them in an array
    for (var i = 0; i < numberOfPlaceholderDays; i++) {
      lastDate.add(1, 'days');
      calendarDates.push({
        week: lastDate.format(formats.week),
        day: lastDate.format(formats.day),
        month: lastDate.format(formats.month),
        placeholder: true
      });
    }
  }

  var template = this.data.advancedSettings && this.data.advancedSettings.otherLoopHTML
    ? Handlebars.compile(this.data.advancedSettings.otherLoopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[this.layoutMapping[this.data.layout]['other-loop']]());

  this.$container.find('.agenda-date-selector ul').html(template(calendarDates));
  // Selects the first date
  this.sliderCount = this.agendaDates.length;
  this.activeSlideIndex = typeof index === 'number' ? index : 0;
  this.$container.find('.agenda-date-selector li').not('.placeholder').eq(this.activeSlideIndex).addClass('active');
  this.centerDate();
}

DynamicList.prototype.getAddPermission = function(data) {
  data.showAddEntry = this.Utils.User.canAddRecord(this.data, this.myUserData);
  return data;
}

DynamicList.prototype.getPermissions = function(entries) {
  var _this = this;

  // Adds flag for Edit and Delete buttons
  _.forEach(entries, function (entry) {
    entry.editEntry = _this.Utils.Record.isEditable(entry, _this.data, _this.myUserData);
    entry.deleteEntry = _this.Utils.Record.isDeletable(entry, _this.data, _this.myUserData);
  });

  return entries;
}

DynamicList.prototype.setupCards = function() {
  var _this = this;

  // Sets up the like and bookmark buttons
  if (_this.data.social && _this.data.social.bookmark) {
    _this.$container.find('.agenda-list-item').each(function(index, element) {
      _this.prepareSetupBookmark(element);
    });
  }
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

  var nextDateElement = _this.$container.find('.agenda-date-selector li').not('.placeholder').eq(index);
  var nextAgendaElement = _this.$container.find('.agenda-list-day-holder').eq(index);

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

  var prevDateElement = _this.$container.find('.agenda-date-selector li').not('.placeholder').eq(index);
  var prevAgendaElement = _this.$container.find('.agenda-list-day-holder').eq(index);
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
        enable: false
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

  if (!activePosition || isNaN(activePosition.left) || isNaN(halfWindowWidth) || isNaN(halfWidth)) {
    return;
  }

  _this.$container.find('.agenda-date-selector ul').scrollLeft(activePosition.left - (halfWindowWidth - halfWidth));
}

// Functions to setup Fliplet Like
DynamicList.prototype.setupBookmarkButton = function(id, identifier, title) {
  var _this = this;
  var button = {
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
      addType: 'prepend',
      getAllCounts: false
    }),
    id: id
  };
  _this.bookmarkButtons.push(button);
  return button;
}

DynamicList.prototype.prepareSetupBookmarkOverlay = function(id) {
  var _this = this;
  var isLiked = false;
  var button = _.find(_this.bookmarkButtons, function(btn) {
    return btn.id === id;
  });

  if (button && button.btn) {
    if (button.btn.isLiked()) {
      _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + button.id).addClass('bookmarked');
      isLiked = button.btn.isLiked();
    } else {
      _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + button.id).addClass('not-bookmarked');
      isLiked = button.btn.isLiked();
    }
  } else {
    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder').addClass('not-bookmarked');
    isLiked = false;
  }

  _this.likesObserversOverlay(id, button, isLiked);
}

DynamicList.prototype.prepareSetupBookmark = function(element) {
  var _this = this;
  var cardId = $(element).data('entry-id');
  var bookmarkIndentifier = cardId + '-bookmark';
  var title = $(element).find('.agenda-item-inner-content .agenda-item-title').text();

  var button = _this.setupBookmarkButton(cardId, bookmarkIndentifier, title);
  _this.likesObservers(button);
}

// Function to add class to card marking it as bookmarked - for filtering
DynamicList.prototype.checkBookmarked = function() {
  var _this = this;
  // Wait for bookmark to appear on the page
  var checkTimer = 0;
  var checkInterval = setInterval(function() {
    // Check for 10 seconds
    if (checkTimer > 10) {
      clearInterval(checkInterval);
      return;
    }
    _this.$container.find('.btn-bookmarked').each(function(idx, element) {
      $(element).parents('.agenda-list-item').addClass('bookmarked');
    });
    checkTimer++;
  }, 1000);
}

DynamicList.prototype.bindTouchEvents = function() {
  var _this = this;
  var handle = document.getElementById('agenda-cards-wrapper-' +_this.data.id);
  _this.hammer = _this.hammer || new Hammer(handle);

  _this.hammer.on('panright panleft', function(e) {
    if (_this.checkScrollHorizontal(e)) {
      _this.isPanning = true;
      _this.sliderCount = _this.$container.find('.agenda-list-day-holder').length;
      _this.activeSlideIndex = _this.$container.find('.agenda-list-day-holder').index(_this.$container.find('.agenda-list-day-holder.active'));
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

DynamicList.prototype.getDateIndex = function (date) {
  var d = this.Utils.Date.moment(date);

  if (!d.isValid()) {
    return 0;
  }

  var formattedDate = d.format('YYYY-MM-DD');
  var index = _.indexOf(this.agendaDates, formattedDate);

  if (index !== -1) {
    return index;
  }

  if (formattedDate > this.agendaDates[this.agendaDates.length - 1]) {
    return this.agendaDates.length - 1;
  }

  return 0;
};

DynamicList.prototype.goToToday = function () {
  this.goToDate(moment().format('YYYY-MM-DD'));
};

DynamicList.prototype.goToDate = function (date) {
  if (!date) {
    return;
  }

  var d = this.Utils.Date.moment(date);

  if (!d.isValid()) {
    return;
  }

  this.sliderGoTo(this.getDateIndex(d));
};

DynamicList.prototype.sliderGoTo = function(number) {
  var _this = this;
  // Stop it from doing weird things like moving to slides that don’t exist
  if ( number < 0 ) {
    _this.activeSlideIndex = 0;
  } else if ( number > _this.sliderCount - 1 ) {
    _this.activeSlideIndex = _this.sliderCount - 1
  } else if (number === _this.activeSlideIndex) {
    return;
  } else {
    var diff = number - _this.activeSlideIndex;
    if (number > _this.activeSlideIndex) {
      _this.activeSlideIndex = number;
      _this.moveForwardDate(_this.activeSlideIndex, diff);
    } else {
      _this.activeSlideIndex = number;
      _this.moveBackDate(_this.activeSlideIndex, diff);
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

  var entryData = _(_this.agendasByDay)
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
    _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
  }, 300);
}
