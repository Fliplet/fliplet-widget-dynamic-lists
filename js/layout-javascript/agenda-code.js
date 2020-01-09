// Constructor
function DynamicList(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-cards-loop',
      'detail': 'templates.build.agenda-cards-detail',
      'filter': 'templates.build.agenda-filters',
      'other-loop': 'templates.build.agenda-dates-loop'
    }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.data.computedFields = this.data.computedFields || {};
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');

  // Other variables
  // Global variables
  this.allowClick = true;
  this.hammer;
  this.animatingForward = false;
  this.animatingBack = false;
  this.activeSlideIndex;
  this.sliderCount;
  this.scrollValue = 0;
  this.copyOfScrollValue = _this.scrollValue;
  this.isPanning = false;
  this.myUserData;
  this.agendaDates = [];
  this.showBookmarks;
  this.fetchedAllBookmarks = false;

  this.listItems;
  this.agendasByDay;
  this.searchedListItems;
  this.dataSourceColumns;
  this.dateFieldLocation = 'Full Date';

  this.queryOpen = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvPreFilterQuery;
  this.pvOpenQuery;
  this.openedEntryOnQuery = false;

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
    })
    .catch(function (error) {
      Fliplet.UI.Toast.error(error, {
        message: 'Error loading agenda'
      });
    });
};

DynamicList.prototype.Utils = Fliplet.Registry.get('dynamicListUtils');

DynamicList.prototype.attachObservers = function() {
  var _this = this;

  // Attach your event listeners here
  $(window).resize(function() {
    _this.centerDate();
  });

  Fliplet.Hooks.on('beforePageView', function (options) {
    if (options.addToHistory === false) {
      _this.closeDetails();
    }
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
      var entryTitle = $(this).find('.agenda-item-title').text().trim();
      var beforeOpen = Promise.resolve();

      if (typeof _this.data.beforeOpen === 'function') {
        beforeOpen = _this.data.beforeOpen({
          config: _this.data,
          entry: _.find(_this.listItems, { id: entryId }),
          entryId: entryId,
          entryTitle: entryTitle,
          event: event
        });

        if (!(beforeOpen instanceof Promise)) {
          beforeOpen = Promise.resolve(beforeOpen);
        }
      }

      beforeOpen.then(function () {
        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'entry_open',
          label: entryTitle
        });

        if (_this.data.summaryLinkOption === 'link' && _this.data.summaryLinkAction) {
          _this.Utils.Navigate.openLinkAction({
            records: _this.listItems,
            recordId: entryId,
            summaryLinkAction: _this.data.summaryLinkAction
          });

          return;
        }

        _this.showDetails(entryId);
        Fliplet.Page.Context.update({
          dynamicListOpenId: entryId
        });
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

        _this.updateDateIndexContext(indexOfClickedDate);

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

        _this.updateDateIndexContext(indexOfClickedDate);

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
      var indexDifference = indexOfClickedDate - indexOfActiveDate;

      _this.updateDateIndexContext(indexOfClickedDate);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter_date',
        label: $(this).find('.week').text().trim() + ' ' + $(this).find('.day').text().trim() + ' ' + $(this).find('.month').text().trim()
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
      if (!_this.data.addEntryLinkAction) {
        return;
      }

      if (!_.get(_this, 'data.addEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: 'Link not configured',
          message: 'Form not found. Please check the component\'s configuration.',
        });
        return;
      }

      _this.data.addEntryLinkAction.query = '?mode=add';

      try {
        var navigate = Fliplet.Navigate.to(_this.data.addEntryLinkAction);

        if (navigate instanceof Promise) {
          navigate
            .catch(function(error) {
              Fliplet.UI.Toast(error, {
                message: 'Error adding entry'
              });
            });
        }
      } catch (error) {
        Fliplet.UI.Toast(error, {
          message: 'Error adding entry'
        });
      }
    })
    .on('click', '.dynamic-list-edit-item', function() {
      if (!_this.data.editEntryLinkAction) {
        return;
      }

      if (!_.get(_this, 'data.editEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: 'Link not configured',
          message: 'Form not found. Please check the component\'s configuration.',
        });
        return;
      }

      var entryID = $(this).parents('.agenda-item-inner-content').data('entry-id');

      _this.data.editEntryLinkAction.query = '?dataSourceEntryId=' + entryID;

      try {
        var navigate = Fliplet.Navigate.to(_this.data.editEntryLinkAction);

        if (navigate instanceof Promise) {
          navigate
            .catch(function(error) {
              Fliplet.UI.Toast(error, {
                message: 'Error editing entry'
              });
            });
        }
      } catch (error) {
        Fliplet.UI.Toast(error, {
          message: 'Error editing entry'
        });
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

                  _that.text('Delete').removeClass('disabled');
                  _this.closeDetails();

                  var selectedIndex = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
                  _this.removeListItemHTML({
                    id: entryId
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
    })
    .on('click', '.toggle-agenda', function () {
      var $toggle = $(this);

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();
    })
    .on('click', '.agenda-detail-overlay .bookmark-wrapper', function() {
      var id = $(this).parents('.agenda-detail-wrapper').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $(this).parents('.agenda-item-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
        record.bookmarkButton.unlike();
        return;
      }

      $(this).parents('.agenda-item-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
      record.bookmarkButton.like();
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

DynamicList.prototype.removeListItemHTML = function (options) {
  options = options || {};

  var id = options.id;

  if (!id) {
    return;
  }

  this.$container.find('.agenda-list-item[data-entry-id="' + id + '"]').remove();
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

DynamicList.prototype.updateDateIndexContext = function(indexOfClickedDate) {
  var defaultDateIndex = this.getDateIndex(this.Utils.Date.moment());

  if (defaultDateIndex === indexOfClickedDate) {
    Fliplet.Page.Context.remove('dateIndex');
  } else {
    Fliplet.Page.Context.update({
      dateIndex: indexOfClickedDate
    });
  }
};

DynamicList.prototype.initialize = function() {
  var _this = this;
  var shouldInitFromQuery = _this.parseQueryVars();

  // query will always have higher priority than storage
  // if we find relevant terms in the query, delete the storage so the filters do not mix and produce side-effects
  if (shouldInitFromQuery) {
    Fliplet.App.Storage.remove('flDynamicListQuery:' + _this.data.layout);
  };

  _this.attachObservers();
  // Check if there is a query or PV for search/filter queries
  return (shouldInitFromQuery ? Promise.resolve() : _this.parsePVQueryVars())
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();
      return _this.connectToDataSource();
    })
    .then(function (records) {
      _this.Utils.Records.addComputedFields({
        records: records,
        config: _this.data
      });

      return Fliplet.Hooks.run('flListDataAfterGetData', {
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        records: records
      }).then(function () {
        if (records && !Array.isArray(records)) {
          records = [records];
        }

        return _this.Utils.Records.prepareData({
          records: records,
          config: _this.data,
          filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
        });
      });
    })
    .then(function(records) {
      _this.listItems = records;

      return _this.Utils.Records.getFields(_this.listItems, _this.data.dataSourceId).then(function (columns) {
        _this.dataSourceColumns = columns;
      });
    })
    .then(function () {
      // Render dates HTML
      _this.renderDatesHTML(_this.listItems);
      _this.scrollEvent();
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
      _this.searchData({
        render: true,
        goToToday: true
      });
    });
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

  _this.showDetails(entry.id).then(function () {
    _this.openedEntryOnQuery = true;
  });
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
    if (_this.data.defaultData && !_this.data.dataSourceId) {
      return Promise.resolve(_this.data.defaultEntries);
    }

    options = options || cache;
    return Fliplet.DataSources.connect(_this.data.dataSourceId, options)
      .then(function (connection) {
        // If you want to do specific queries to return your rows
        // See the documentation here: https://developers.fliplet.com/API/fliplet-datasources.html
        var query = {};

        if (typeof _this.data.dataQuery === 'function') {
          query = _this.data.dataQuery({
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container
          });
        } else if (typeof _this.data.dataQuery === 'object') {
          query = _this.data.dataQuery;
        }

        return connection.find(query);
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
  _this.bindTouchEvents();
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
  var recordDates = _.orderBy(_.keys(recordGroups));

  // Prepare a merge if the date values are parsed as the same date
  _.forEach(recordDates, function (key, i) {
    var date = _this.Utils.Date.moment(key);
    _.forEach(recordDates, function (comp, j) {
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

  return _.map(_.sortBy(_.toPairs(recordGroups), 0), 1);
};

DynamicList.prototype.prepareToRenderLoop = function(rows) {
  var _this = this;
  var savedColumns = [];
  var clonedRecords = _.clone(rows);
  clonedRecords = _this.getPermissions(clonedRecords);

  var loopData = [];
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

      if (obj.location === 'Start Time' || obj.location === 'End Time') {
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

  _this.agendasByDay = _this.groupLoopDataByDate(loopData, _this.dateFieldLocation);
}

DynamicList.prototype.renderLoopHTML = function (iterateeCb) {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());

  $('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').empty();

  var renderLoopIndex = 0;
  var $renderFull = $([]);

  return new Promise(function (resolve) {
    function render() {
      // get the next batch of items to render
      var nextBatch = _this.agendasByDay.slice(
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * renderLoopIndex,
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * (renderLoopIndex + 1)
      );

      if (!nextBatch.length) {
        Fliplet.Hooks.run('flListDataAfterRenderList', {
          records: _this.agendasByDay,
          config: _this.data
        });
        resolve(renderLoopIndex - 1, $renderFull);
        return;
      }

      var $renderBatch = $(template(nextBatch));
      $renderFull.add($renderBatch);
      $('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').append($renderBatch);

      if (renderLoopIndex === 0 || renderLoopIndex === -1) {
        _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');
        _this.$container.find('.agenda-list-day-holder').eq(0).addClass('active');
      }

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
  var formats = {
    week: 'ddd',
    day: 'DD',
    month: 'MMM'
  };
  var foundDateField = _.find(_this.data.detailViewOptions, { location: _this.dateFieldLocation });
  var dateField = _.get(foundDateField, 'column');

  if (!dateField
    || _this.dataSourceColumns.indexOf(dateField) === -1) {
    throw new Error('Date field is misconfigured. Please check your component settings.');
  }

  var clonedRecords = _.clone(rows);

  // Keep only records with valid dates when rendering dates selectors
  clonedRecords = _.orderBy(_.filter(clonedRecords, function (record) {
    return _this.Utils.Date.moment(record.data[dateField]).isValid();
  }), 'data.' + dateField);

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

DynamicList.prototype.getAllBookmarks = function () {
  var _this = this;

  if (_this.fetchedAllBookmarks || !_.get(_this.data, 'social.bookmark') || !_this.data.bookmarkDataSourceId) {
    return Promise.resolve();
  }

  return _this.Utils.Query.fetchAndCache({
    key: 'bookmarks-' + _this.data.bookmarkDataSourceId,
    waitFor: 400,
    request: Fliplet.Profile.Content(_this.data.bookmarkDataSourceId).then(function (instance) {
      return instance.query({
        where: {
          content: { entryId: { $regex: '\\d-bookmark' } }
        },
        exact: false
      });
    })
  }).then(function (results) {
    var bookmarkedIds = _.compact(_.map(results.data, function (record) {
      var match = _.get(record, 'data.content.entryId', '').match(/(\d*)-bookmark/);
      return match ? parseInt(match[1], 10) : '';
    }));

    if (results.fromCache) {
      _.forEach(_this.listItems, function (record) {
        if (bookmarkedIds.indexOf(record.id) === -1) {
          return;
        }

        record.bookmarked = true;
      });
    } else {
      _.forEach(_this.listItems, function (record) {
        record.bookmarked = bookmarkedIds.indexOf(record.id) > -1;
      });
    }

    _this.fetchedAllBookmarks = true;
  });
};

DynamicList.prototype.initializeSocials = function() {
  var _this = this;

  return _this.getAllBookmarks().then(function () {
    return Promise.all(_.map(_.flatten(_this.agendasByDay), function (record) {
      var title = _this.$container.find('.agenda-list-item[data-entry-id="' + record.id + '"] .small-card-list-name').text().trim();
      var masterRecord = _.find(_this.listItems, { id: record.id });

      return _this.setupBookmarkButton({
        target: '.new-agenda-list-container .agenda-item-bookmark-holder-' + record.id,
        id: record.id,
        identifier: record.id + '-bookmark',
        title: title,
        record: masterRecord
      });
    }));
  });
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
DynamicList.prototype.setupBookmarkButton = function(options) {
  if (!_.get(this.data, 'social.bookmark')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var identifier = options.identifier;
  var title = options.title;
  var target = options.target;
  var record = options.record || _.find(_this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  return new Promise(function (resolve) {
    var btn = LikeButton({
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
    });
    record.bookmarkButton = btn;

    btn.on('like.status', function (liked) {
      record.bookmarked = liked;
      resolve(btn);
    });

    btn.on('liked', function(data){
      record.bookmarked = btn.isLiked();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: title
      });
    });

    btn.on('liked.fail', function(data){
      record.bookmarked = btn.isLiked();
      _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');
    });

    btn.on('unliked', function(data){
      record.bookmarked = btn.isLiked();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: title
      });
    });

    btn.on('unliked.fail', function(data){
      record.bookmarked = btn.isLiked();
      _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');
    });
  });
}

DynamicList.prototype.initializeOverlaySocials = function(id) {
  var _this = this;
  var record = _.find(_this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  var title = _this.$container.find('.agenda-detail-overlay .agenda-detail-wrapper[data-entry-id="' + id + '"] .agenda-item-title').text().trim();

  if (record.bookmarkButton) {
    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(record.bookmarkButton.isLiked() ? 'bookmarked' : 'not-bookmarked');
    return Promise.resolve();
  }

  return _this.setupBookmarkButton({
    id: id,
    identifier: id + '-bookmark',
    title: title,
    record: record
  }).then(function (btn) {
    if (!btn) {
      return;
    }

    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(btn.isLiked() ? 'bookmarked' : 'not-bookmarked');
  });
}

DynamicList.prototype.searchData = function(options) {
  options = options || {};

  var _this = this;

  _this.showBookmarks = $('.toggle-agenda').hasClass('mixitup-control-active');

  return _this.Utils.Records.runSearch({
    records: _this.listItems,
    config: _this.data,
    showBookmarks: _this.showBookmarks
  }).then(function (results) {
    results = results || {};

    if (Array.isArray(results)) {
      results = {
        records: searchedData
      };
    }

    var searchedData = results.records;
    return Fliplet.Hooks.run('flListDataBeforeRenderList', {
      records: searchedData,
      config: _this.data,
      showBookmarks: _this.showBookmarks
    }).then(function () {
      searchedData = searchedData || [];

      var truncated = results.truncated || searchedData.length < _this.listItems;

      /**
       * Render results
       **/
      _this.prepareToRenderLoop(searchedData);
      _this.searchedListItems = searchedData;

      if (options.render) {
        // Render the full list
        return _this.renderLoopHTML().then(function(records){
          if (options.goToToday) {
            _this.goToToday();
          } else {
            // @TODO Stay in current date index
            _this.sliderGoTo($('.agenda-date-selector li.active').index() - $('.agenda-date-selector li:not(.placeholder)').index());
          }

          return _this.initializeSocials();
        });
      }

      var recordIdsToShow = _.map(_this.searchedListItems, 'id');
      var recordIdsToHide = _.difference(_.map(_this.listItems, 'id'), recordIdsToShow);

      // Hide and show content based on existing render
      $(_.map(recordIdsToShow, function (id) {
        return '.agenda-list-item[data-entry-id="' + id + '"]';
      }).join(',')).show();
      $(_.map(recordIdsToHide, function (id) {
        return '.agenda-list-item[data-entry-id="' + id + '"]';
      }).join(',')).hide();
    });
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
  var dateIndex = parseInt(Fliplet.Navigate.query.dateIndex, 10);

  if (dateIndex) {
    this.sliderGoTo(dateIndex);
    return;
  }

  this.goToDate(moment().format('YYYY-MM-DD'), false);
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

DynamicList.prototype.showDetails = function (id) {
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
  var entryId = { id: id };
  var wrapper = '<div class="agenda-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = $('#agenda-detail-overlay-' + _this.data.id);
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

  return beforeShowDetails.then(function (data) {
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

    _this.initializeOverlaySocials(id);

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
  if (this.openedEntryOnQuery && Fliplet.Navigate.query.dynamicListPreviousScreen === 'true') {
    return Fliplet.Navigate.back();
  }

  // Function that closes the overlay
  var _this = this;
  var $overlay = $('#agenda-detail-overlay-' + _this.data.id);

  Fliplet.Page.Context.remove('dynamicListOpenId');
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
