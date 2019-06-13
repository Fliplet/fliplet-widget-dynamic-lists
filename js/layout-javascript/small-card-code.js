// Constructor
function DynamicList(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'small-card': {
      'base': 'templates.build.small-card-base',
      'loop': 'templates.build.small-card-loop',
      'detail': 'templates.build.small-card-detail',
      'filter': 'templates.build.small-card-filters',
      'profile-icon': 'templates.build.small-card-profile-icon',
      'user-profile': 'templates.build.small-card-user-profile'
    }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.data.computedFields = this.data.computedFields || {};
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.queryOptions = {};

  // Other variables
  // Global variables
  this.allowClick = true;
  this.isFiltering;
  this.isSearching;

  this.emailField = 'Email';
  this.myProfileData;
  this.modifiedProfileData;
  this.myUserData;

  this.mixer;
  this.bookmarkButtons = [];
  this.bookmarkButtonOverlay;

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.dataSourceColumns;
  this.directoryDetailWrapper;
  this.filterClasses = [];

  this.queryOpen = false;
  this.querySearch = false;
  this.queryFilter = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvGoBack;
  this.pvSearchQuery;
  this.pvFilterQuery;
  this.pvPreFilterQuery;
  this.pvOpenQuery;

  /**
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

  this.data.bookmarksEnabled = _this.data.social.bookmark;

  // Register handlebars helpers
  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

  this.profileHTML = Handlebars.compile(this.src);

  this.Utils.registerHandlebarsHelpers();
  // Get the current session data
  Fliplet.User.getCachedSession().then(function(session) {
    if (_.get(session, 'entries.dataSource.data')) {
      _this.myUserData = _.get(session, 'entries.dataSource.data');
    } else if (_.get(session, 'entries.saml2.user')) {
      _this.myUserData = _.get(session, 'entries.saml2.user');
      _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
      _this.myUserData.isSaml2 = true;
    }

    // Start running the Public functions
    _this.initialize();
  });
};

DynamicList.prototype.Utils = Fliplet.Registry.get('dynamicListUtils');

DynamicList.prototype.attachObservers = function() {
  var _this = this;
  // Attach your event listeners here
  _this.$container
    .on('click', '[data-lfd-back]', function() {
      var result;

      if (!_this.pvGoBack && !_this.pvGoBack.enableButton) {
        return;
      }

      if (!_this.pvGoBack && !_this.pvGoBack.action) {
        try {
          _this.pvGoBack.action = eval(_this.pvGoBack.action);
        } catch (error) {
          console.error('Your custom function for the back button contains a syntax error: ' + error);
        }
      }

      try {
        result = (typeof _this.pvGoBack.action === 'function') && _this.pvGoBack.action();
      } catch (error) {
        console.error('Your custom function for the back button thrown an error: ' + error);
      }

      if (!(result instanceof Promise)) {
        result = Promise.resolve();
      }

      return result.then(function () {
        return Fliplet.Navigate.back();
      }).catch(function (error) {
        console.error(error);
      });
    })
    .on('click', '.apply-filters', function() {
      _this.filterList();

      $(this).parents('.small-card-search-filter-overlay').removeClass('display');
      $('body').removeClass('lock');
    })
    .on('click', '.clear-filters', function() {
      _this.$container.find('.mixitup-control-active').removeClass('mixitup-control-active');
      $(this).addClass('hidden');
      _this.filterList();
    })
    .on('click', '.small-card-search-filter-overlay .hidden-filter-controls-filter', function() {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $(this).text()
      });

      $(this).toggleClass('mixitup-control-active');

      if (_this.$container.find('.mixitup-control-active').length) {
        _this.$container.find('.clear-filters').removeClass('hidden');
      } else {
        _this.$container.find('.clear-filters').addClass('hidden');
      }
    })
    .on('click', '.inline-filter-holder .hidden-filter-controls-filter', function() {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $(this).text()
      });

      $(this).toggleClass('mixitup-control-active');
      _this.filterList();
    })
    .on('click', '.small-card-list-detail-button a', function() {
      var _that = $(this);
       Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_buttons',
        label: _that.find('.small-card-list-detail-button-text').text()
      });
    })
    .on('touchstart', '.small-card-list-item', function(event) {
      event.stopPropagation();
      if (!$(this).hasClass('open')) {
        $(this).addClass('hover');
      }
    })
    .on('touchmove', '.small-card-list-item', function() {
      _this.allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.small-card-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        _this.allowClick = true;
      }, 100);
    })
    .on('click', '.my-profile-container', function() {
      if ($(window).width() < 640) {
        _this.directoryDetailWrapper = $(this).find('.small-card-list-detail-wrapper');
        _this.expandElement(_this.directoryDetailWrapper, _this.modifiedProfileData[0].id);
      } else {
        _this.showDetails(_this.modifiedProfileData[0].id);
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_open'
      });
    })
    .on('click', '.small-card-list-item', function(event) {
      var _that = $(this);

      if ($(event.target).hasClass('small-card-bookmark-holder') || $(event.target).parents('.small-card-bookmark-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.small-card-list-name').text();

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

        // find the element to expand and expand it
        if (_this.allowClick && $(window).width() < 640) {
          _this.directoryDetailWrapper = _that.find('.small-card-list-detail-wrapper');
          _this.expandElement(_this.directoryDetailWrapper, entryId);
        } else if (_this.allowClick && $(window).width() >= 640) {
          _this.showDetails(entryId);
        }
      });
    })
    .on('click', '.small-card-detail-overlay-close', function(event) {
      event.stopPropagation();
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
          console.error('Your custom function thrown an error: ' + error);
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

      if ($(window).width() < 640) {
        _this.collapseElement(_this.directoryDetailWrapper);
        _this.directoryDetailWrapper = undefined;
      } else {
        _this.closeDetails();
      }
    })
    .on('click', '.list-search-icon .fa-sliders', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-small-card-list-container');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.small-card-search-filter-overlay').addClass('display');
        $('body').addClass('lock');

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
    .on('click', '.small-card-overlay-close', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.small-card-search-filter-overlay');
      $parentElement.removeClass('display');
      $('body').removeClass('lock');

      // Clear all selected filters
      _this.$container.find('.mixitup-control-active').removeClass('mixitup-control-active');

      // Select filters based on existing settings
      if (_this.activeFilters) {
        if (_.isEmpty(_this.activeFilters)) {
          _this.$container.find('.clear-filters').addClass('hidden');
          return;
        }

        var selectors = _.flatten(_.map(_this.activeFilters, function (values, key) {
          return _.map(values, function (value) {
            return '.hidden-filter-controls-filter[data-key="' + key + '"][data-value="' + value + '"]';
          });
        })).join(',');
        $(selectors).addClass('mixitup-control-active');

        _this.$container.find('.clear-filters').removeClass('hidden');
        return;
      }

      // Legacy class-based settings
      if (!_this.filterClasses || !_this.filterClasses.length) {
        _this.$container.find('.clear-filters').addClass('hidden');
        return;
      }

      _this.filterClasses.forEach(function(filter) {
        _this.$container.find('.hidden-filter-controls-filter[data-toggle="' + filter + '"]').addClass('mixitup-control-active');
      });

      _this.$container.find('.clear-filters').removeClass('hidden');
    })
    .on('click', '.list-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-small-card-list-container');

      if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').removeClass('active');
        $elementClicked.removeClass('active');
        $parentElement.find('.list-search-icon .fa-sliders').removeClass('active');
        $parentElement.find('.hidden-filter-controls').animate({ height: 0 }, 200);
      }
    })
    .on('keydown change paste', '.search-holder input', function(e) {
      var $inputField = $(this);
      var value = $inputField.val();

      if (value.length) {
        $inputField.addClass('not-empty');
      } else {
        $inputField.removeClass('not-empty');
      }

      if (e.which == 13 || e.keyCode == 13) {
        if (value === '') {
          _this.$container.find('.new-small-card-list-container').removeClass('searching');
          _this.isSearching = false;
          _this.clearSearch();
          return;
        }

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search',
          label: value
        });

        _this.$container.find('.new-small-card-list-container').addClass('searching');
        _this.isSearching = true;
        _this.searchData(value);
      }
    })
    .on('click', '.search-holder .search-btn', function(e) {
      var $inputField = $(this).parents('.search-holder').find('.search-feed');
      var value = $inputField.val();

      if (value === '') {
        _this.$container.find('.new-small-card-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.clearSearch();
        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search',
        label: value
      });

      _this.$container.find('.new-small-card-list-container').addClass('searching');
      _this.isSearching = true;
      _this.searchData(value);
    })
    .on('click', '.clear-search', function() {
      _this.$container.find('.new-small-card-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.clearSearch();
    })
    .on('show.bs.collapse', '.small-card-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.small-card-filters-panel .panel-collapse', function() {
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
          Fliplet.UI.Toast(options);
        }
      }
    })
    .on('click', '.dynamic-list-edit-item', function() {
      var entryID = $(this).parents('.small-card-detail-overlay').find('.small-card-list-detail-content-scroll-wrapper').data('entry-id');
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
      var entryID = $(this).parents('.small-card-detail-overlay').find('.small-card-list-detail-content-scroll-wrapper').data('entry-id');
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

                  if ($(window).width() < 640) {
                    _this.collapseElement(_this.directoryDetailWrapper);
                    _this.directoryDetailWrapper = undefined;
                  } else {
                    _this.closeDetails();
                  }
                  _this.prepareToRenderLoop(_this.listItems);
                  _this.renderLoopHTML();
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

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render list with default data
  if (_this.data.defaultData) {
    // Render Base HTML template
    _this.renderBaseHTML();

    var records = _this.Utils.Records.prepareData({
      records: _this.data.defaultEntries,
      config: _this.data,
      filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
    });

    _this.listItems = _this.getPermissions(records);
    _this.dataSourceColumns = _this.data.defaultColumns;

    return _this.Utils.Records.updateFiles({
      records: _this.listItems,
      config: _this.data
    }).then(function(response) {
      _this.listItems = _.uniqBy(response, function (item) {
        return item.id;
      });

      // Get user profile
      if (_this.myUserData) {
        // Create flag for current user
        _this.listItems.forEach(function(item) {
          item.isCurrentUser = _this.Utils.Record.isCurrentUser(item, _this.data, _this.myUserData);
        });

        _this.myProfileData = _.filter(_this.listItems, function(row) {
          return row.isCurrentUser;
        });
      }

      // Render Loop HTML
      _this.prepareToRenderLoop(_this.listItems);
      _this.renderLoopHTML(function(from, to){
        _this.onPartialRender(from, to);
      }).then(function(){
        _this.addFilters(_this.modifiedListItems);
        // Render user profile
        if (_this.myProfileData && _this.myProfileData.length) {
          _this.modifiedProfileData = _this.prepareToRenderLoop(_this.myProfileData, true);
          var myProfileTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['user-profile']];
          var myProfileTemplateCompiled = Handlebars.compile(myProfileTemplate());
          _this.$container.find('.my-profile-placeholder').html(myProfileTemplateCompiled(_this.modifiedProfileData[0]));

          var profileIconTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['profile-icon']];
          var profileIconTemplateCompiled = Handlebars.compile(profileIconTemplate());
          _this.$container.find('.my-profile-icon').html(profileIconTemplateCompiled(_this.modifiedProfileData[0]));

          _this.$container.find('.section-top-wrapper').removeClass('profile-disabled');
        }
        // Listeners and Ready
        _this.attachObservers();
        _this.checkBookmarked();
        _this.initializeMixer();
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
    .then(function (records) {
      records = _this.getPermissions(records);

      // Get user profile
      if (_this.myUserData) {
        // Create flag for current user
        records.forEach(function(record) {
          record.isCurrentUser = _this.Utils.Record.isCurrentUser(record, _this.data, _this.myUserData);
        });

        _this.myProfileData = _.filter(records, function(row) {
          return row.isCurrentUser;
        });
      }

      // Make rows available Globally
      _this.listItems = records;

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
      _this.renderLoopHTML(function(from, to){
        _this.onPartialRender(from, to);
      }).then(function(){
        _this.addFilters(_this.modifiedListItems);
        _this.prepareToSearch();
        _this.prepareToFilter();

        // Render user profile
        if (_this.myProfileData && _this.myProfileData.length) {
          _this.modifiedProfileData = _this.prepareToRenderLoop(_this.myProfileData, true);
          var myProfileTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['user-profile']];
          var myProfileTemplateCompiled = Handlebars.compile(myProfileTemplate());
          _this.$container.find('.my-profile-placeholder').html(myProfileTemplateCompiled(_this.modifiedProfileData[0]));

          var profileIconTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['profile-icon']];
          var profileIconTemplateCompiled = Handlebars.compile(profileIconTemplate());
          _this.$container.find('.my-profile-icon').html(profileIconTemplateCompiled(_this.modifiedProfileData[0]));

          _this.$container.find('.section-top-wrapper').removeClass('profile-disabled');
        }
        _this.attachObservers();
        _this.checkBookmarked();
        _this.initializeMixer();
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
    entry = _.find(_this.modifiedListItems, function(row) {
      return row.id === _this.pvOpenQuery.id;
    });
  }

  if (_.hasIn(_this.pvOpenQuery, 'value') && _.hasIn(_this.pvOpenQuery, 'column')) {
    entry = _.find(_this.modifiedListItems, function(row) {
      return row.originalData[_this.pvOpenQuery.column] === _this.pvOpenQuery.value;
    });
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

DynamicList.prototype.prepareToSearch = function() {
  var _this = this;

  if ( !_.hasIn(_this.pvSearchQuery, 'value') ) {
    return;
  }

  if (_.hasIn(_this.pvSearchQuery, 'column')) {
    _this.overrideSearchData(_this.pvSearchQuery.value);
    return;
  }

  _this.searchData(_this.pvSearchQuery.value);
}

DynamicList.prototype.prepareToFilter = function() {
  var _this = this;

  if ( !_this.pvFilterQuery || !_.hasIn(_this.pvFilterQuery, 'value') ) {
    return;
  }

  if (Array.isArray(_this.pvFilterQuery.value)) {
    _this.pvFilterQuery.value.forEach(function(value) {
      value = value.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
      _this.$container.find('.hidden-filter-controls-filter[data-toggle="' + value + '"]').addClass('mixitup-control-active');
    });
  } else {
    _this.pvFilterQuery.value = _this.pvFilterQuery.value.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
    _this.$container.find('.hidden-filter-controls-filter[data-toggle="' + _this.pvFilterQuery.value + '"]').addClass('mixitup-control-active');
  }

  _this.filterList();

  if (typeof _this.pvFilterQuery.hideControls !== 'undefined' && !_this.pvFilterQuery.hideControls) {
    _this.$container.find('.hidden-filter-controls').addClass('active');
    _this.$container.find('.list-search-cancel').addClass('active');

    if (!_this.data.filtersInOverlay) {
      _this.$container.find('.list-search-icon .fa-sliders').addClass('active');
    }

    _this.calculateFiltersHeight(_this.$container.find('.new-small-card-list-container'));
  }
}

DynamicList.prototype.navigateBackEvent = function() {
  var _this = this;
  var result;

  if (!_this.pvGoBack && !_this.pvGoBack.hijackBack) {
    return;
  }

  $('[data-fl-navigate-back]').off();

  if (_this.pvGoBack && _this.pvGoBack.action) {
    try {
      _this.pvGoBack.action = eval(_this.pvGoBack.action);
    } catch (error) {
      console.error('Your custom function for the back button contains a syntax error: ' + error);
    }
  }

  $('[data-fl-navigate-back]').on('click', function (event) {
    try {
      result = (typeof _this.pvGoBack.action === 'function') && _this.pvGoBack.action()
    } catch (error) {
      console.error('Your custom function for the back button thrown an error: ' + error);
    }

    if (!(result instanceof Promise)) {
      result = Promise.resolve();
    }


    return result.then(function () {
      return Fliplet.Navigate.back();
    }).catch(function (error) {
      console.error(error);
    });
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
      _this.pvGoBack = value.goBack;

      if (_this.pvGoBack && _this.pvGoBack.hijackBack) {
        _this.navigateBackEvent();
      }

      if (_.hasIn(value, 'prefilter')) {
        _this.queryPreFilter = true;
        _this.pvPreFilterQuery = value.prefilter;
      }

      if (_.hasIn(value, 'open')) {
        _this.queryOpen = true;
        _this.pvOpenQuery = value.open;
      }

      if (_.hasIn(value, 'search')) {
        _this.querySearch = true;
        _this.pvSearchQuery = value.search;
        _this.data.searchEnabled = true;
      }

      if (_.hasIn(value, 'filter')) {
        _this.queryFilter = true;
        _this.pvFilterQuery = value.filter;
        _this.data.filtersEnabled = true;
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

  // go back to previous screen on click - TRUE/FALSE
  data.goBackButton = _this.pvGoBack && _this.pvGoBack.enableButton;

  if (typeof _this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
    ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
    : Handlebars.compile(baseHTML());

  _this.$container.html(template(data));
}

DynamicList.prototype.prepareToRenderLoop = function(records, forProfile) {
  var _this = this;
  var savedColumns = [];
  var modifiedData = _this.Utils.Records.addFilterProperties({
    records: records,
    config: _this.data
  });
  var loopData = [];
  var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return !option.editable;
  });
  var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return option.editable;
  });

  // Uses sumamry view settings set by users
  modifiedData.forEach(function(entry) {
    var newObject = {
      id: entry.id,
      flClasses: entry.data['flClasses'],
      flFilters: entry.data['flFilters'],
      editEntry: entry.editEntry,
      deleteEntry: entry.deleteEntry,
      isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      bookmarksEnabled: entry.bookmarksEnabled,
      entryDetails: [],
      originalData: entry.data
    };

    _this.data['summary-fields'].forEach(function(obj) {
      var content = '';

      if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
      } else if (_this.data.filterFields.indexOf(obj.column) > -1) {
        content = _this.Utils.String.splitByCommas(entry.data[obj.column]).join(', ');
      } else {
        content = entry.data[obj.column];
      }

      newObject[obj.location] = content;
    });

    notDynamicData.forEach(function(obj) {
      if (!newObject[obj.location]) {
        var content = '';
        if (obj.column === 'custom') {
          content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
        } else if (_this.data.filterFields.indexOf(obj.column) > -1) {
          content = _this.Utils.String.splitByCommas(entry.data[obj.column]).join(', ');
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
      } else if (_this.data.filterFields.indexOf(dynamicDataObj.column) > -1) {
        content = _this.Utils.String.splitByCommas(entry.data[dynamicDataObj.column]).join(', ');
      } else {
        content = entry.data[dynamicDataObj.column];
      }

      // Define data object
      var newEntryDetail = {
        id: dynamicDataObj.id,
        content: content,
        label: label,
        labelEnabled: labelEnabled,
        type: dynamicDataObj.type
      }

      newObject.entryDetails.push(newEntryDetail);
    });
    loopData.push(newObject);
  });

  savedColumns = dynamicData.map(function(data){
    return data.column;
  })

  var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
  if (_this.data.detailViewAutoUpdate && extraColumns.length) {
    loopData.forEach(function(obj, index) {
      var entryData = _.find(modifiedData, function(modEntry) {
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

  if (forProfile) {
    return loopData;
  }

  _this.modifiedListItems = loopData;
  return _this.modifiedListItems;
}

DynamicList.prototype.renderLoopHTML = function(iterateeCb) {
  // Function that renders the List template
  var _this = this;


  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());

  var limitedList = undefined;
  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0 && !_this.isSearching && !_this.isFiltering) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);
  }

  // Hides the entry limit warning if the number of entries to show is less than the limit value
  if (_this.data.enabledLimitEntries && (_this.data.limitEntries > _this.modifiedListItems.length)) {
    _this.$container.find('.limit-entries-text').addClass('hidden');
  }

  _this.$container.find('#small-card-list-wrapper-' + _this.data.id).empty();

  var renderLoopIndex = 0;
  var data = (limitedList || _this.modifiedListItems);
  return new Promise(function(resolve){
    function render() {
      // get the next batch of items to render
      let nextBatch = data.slice(
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE,
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE
      );
      if (nextBatch.length) {
        _this.$container.find('#small-card-list-wrapper-' + _this.data.id).append(template(nextBatch));
        if(iterateeCb && typeof iterateeCb === 'function'){
          if(renderLoopIndex === 0){
            _this.$container.find('.new-small-card-list-container').removeClass('loading').addClass('ready');
          }
          iterateeCb(renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE, renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE);
        }
        renderLoopIndex++;
        // if the browser is ready, render
        requestAnimationFrame(render);
      }
      else{
        _this.$container.find('.new-small-card-list-container').removeClass('loading').addClass('ready');
        resolve()
      }
    }
    // start the initial render
    requestAnimationFrame(render);
  })
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

DynamicList.prototype.addFilters = function(records) {
  // Function that renders the filters
  var _this = this;
  var filtersData = {
    filtersInOverlay: _this.data.filtersInOverlay,
    filters: _this.Utils.Records.parseFilters({
      records: records,
      filters: _this.data.filterFields,
      id: _this.data.id
    })
  };

  filtersTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['filter']];
  var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
    ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
    : Handlebars.compile(filtersTemplate());

  _this.$container.find('.filter-holder').html(template(filtersData));
};

DynamicList.prototype.filterList = function() {
  var _this = this;
  var filteredData = [];
  _this.filterClasses = undefined;
  _this.activeFilters = undefined;

  var listData = _this.searchedListItems ? _this.searchedListItems : _this.listItems;
  var $activeFilterControls = _this.$container.find('.hidden-filter-controls-filter.mixitup-control-active');

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  _this.$container.find('.hidden-search-controls').removeClass('no-results');

  if (!$activeFilterControls.length) {
    _this.$container.find('.new-small-card-list-container').removeClass('filtering');
    _this.isFiltering = false;
    _this.prepareToRenderLoop(listData);
    return _this.renderLoopHTML(function(from, to){
      _this.onPartialRender(from, to);
    });
  }

  if (_.every($activeFilterControls, function (el) {
    return el.dataset.key && el.dataset.key.length
  })) {
    // Filter UI contains data-filter, i.e. uses new field-based filters
    _this.activeFilters = _.mapValues(_.groupBy($activeFilterControls.map(function () {
      var $elem = $(this);
      return {
        key: $elem.data('key'),
        value: $elem.data('value')
      };
    }), 'key'), function (filter) {
      return _.map(filter, 'value');
    });

    filteredData = _.filter(listData, function (record) {
      return _this.Utils.Record.matchesFilters({
        record: record,
        filters: _this.activeFilters,
        config: _this.data
      });
    });
  } else {
    // Legacy class-based filters
    _this.filterClasses = _.map($activeFilterControls, function (element) {
      return $(element).data('toggle');
    });

    filteredData = _.filter(listData, function(record) {
      return _this.Utils.Record.matchesFilterClasses(record, _this.filterClasses);
    });
  }

  if (!filteredData.length) {
    _this.$container.find('.hidden-search-controls').addClass('no-results');
  }

  _this.$container.find('.new-small-card-list-container').addClass('filtering');
  _this.isFiltering = true;
  _this.prepareToRenderLoop(filteredData);
  return _this.renderLoopHTML(function(from, to){
    _this.onPartialRender(from, to);
  });
}

DynamicList.prototype.onPartialRender = function(from, to) {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  if (_this.data.social && _this.data.social.bookmark) {
    _this.$container.find('.small-card-list-item').not('.is-current-user').slice(from, to).each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-bookmark';
      var title = $(element).find('.small-card-list-name').text();
      _this.setupBookmarkButton(cardId, likeIndentifier, title);
    });

    _this.likesObservers();
  }
}

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
      $(element).parents('.small-card-list-item').addClass('bookmarked');
    });
    checkTimer++;
  }, 1000);
}

DynamicList.prototype.calculateFiltersHeight = function($el) {
  $el.find('.hidden-filter-controls').each(function () {
    var $controls = $(this);
    var totalHeight = $controls.find('.hidden-filter-controls-content').height();
    $controls.animate({
      height: totalHeight,
    }, 200);
  });
}

DynamicList.prototype.calculateSearchHeight = function(element, isClearSearch) {
  var totalHeight = element.find('.hidden-search-controls-content').height();

  if (isClearSearch) {
    totalHeight = 0;
  }

  element.find('.hidden-search-controls').animate({
    height: totalHeight,
  }, 200);
}

DynamicList.prototype.overrideSearchData = function(value) {
  var _this = this;
  var $inputField = _this.$container.find('.search-holder input');
  var copyOfValue = value;
  value = value.toLowerCase();

  $inputField.val('');
  $inputField.blur();
  _this.$container.find('.hidden-search-controls').addClass('is-searching').removeClass('no-results');
  _this.$container.find('.hidden-search-controls').addClass('active');

  // Removes cards
  _this.$container.find('#small-card-wrapper-' + _this.data.id).html('');
  // Adds search query to HTML
  _this.$container.find('.current-query').html(value);

  // Search
  var searchedData = [];
  var filteredData;
  var fields = _this.pvSearchQuery.column; // Can be Array or String

  if (Array.isArray(_this.pvSearchQuery.column)) {
    fields.forEach(function(field) {
      filteredData = _.filter(_this.listItems, function(obj) {
        return _this.Utils.Record.contains(obj.data[field], value);
      });

      if (filteredData.length) {
        filteredData.forEach(function(item) {
          searchedData.push(item);
        });
      }
    });
  } else {
    searchedData = _.filter(_this.listItems, function(obj) {
      return _this.Utils.Record.contains(obj.data[field], value);
    });

    if (!searchedData || !searchedData.length) {
      searchedData = [];
    }
  }

  _this.$container.find('.hidden-search-controls').removeClass('is-searching no-results').addClass('search-results');
  _this.$container.find('.new-small-card-list-container').removeClass('searching');

  _this.calculateSearchHeight(_this.$container.find('.new-small-card-list-container'));

  if (!searchedData.length) {
    _this.$container.find('.hidden-search-controls').addClass('no-results');
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  if (_this.data.enabledLimitEntries) {
    _this.$container.find('.limit-entries-text').addClass('hidden');
  }

  // Remove duplicates
  searchedData = _.uniq(searchedData);
  _this.searchedListItems = searchedData;

  if (_this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
    _this.showDetails(_this.searchedListItems[0].id);
  }

  _this.prepareToRenderLoop(searchedData);
  _this.renderLoopHTML(function(from, to){
    _this.onPartialRender(from, to);
  }).then(function(){
    _this.addFilters(_this.modifiedListItems);
    _this.checkBookmarked();
    _this.initializeMixer();
  });
}

DynamicList.prototype.searchData = function(value) {
  // Function called when user executes a search
  var _this = this;
  var $inputField = _this.$container.find('.search-holder input');
  var copyOfValue = value;
  value = value.toLowerCase();

  $inputField.val('');
  $inputField.blur();
  _this.$container.find('.hidden-search-controls').addClass('is-searching').removeClass('no-results');
  _this.$container.find('.hidden-search-controls').addClass('active');

  // Removes cards
  _this.$container.find('#small-card-list-wrapper-' + _this.data.id).html('');
  // Adds search query to HTML
  _this.$container.find('.current-query').html(value);

  // Search
  if (!_this.data.searchEnabled || !_this.data.searchFields.length) {
    return;
  }

  var executeSeach;

  if (typeof _this.data.searchData === 'function') {
    executeSearch = _this.data.searchData({
      config: _this.data,
      query: value
    });

    if (!(executeSearch instanceof Promise)) {
      executeSearch = Promise.resolve(executeSearch);
    }
  } else {
    executeSearch = new Promise(function (resolve, reject) {
      var searchedData = [];
      var filteredData;

      _this.data.searchFields.forEach(function(field) {
        filteredData = _.filter(_this.listItems, function(obj) {
          return _this.Utils.Record.contains(obj.data[field], value);
        });

        if (filteredData.length) {
          filteredData.forEach(function(item) {
            searchedData.push(item);
          });
        }
      });

      resolve(searchedData);
    });
  }

  executeSearch.then(function (searchedData) {
    _this.$container.find('.hidden-search-controls').removeClass('is-searching no-results').addClass('search-results');
    _this.$container.find('.new-small-card-list-container').removeClass('searching');

    _this.calculateSearchHeight(_this.$container.find('.new-small-card-list-container'));

    if (!searchedData.length) {
      _this.$container.find('.hidden-search-controls').addClass('no-results');
    }

    if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
      _this.mixer.destroy();
    }

    if (_this.data.enabledLimitEntries) {
      _this.$container.find('.limit-entries-text').addClass('hidden');
    }

    // Remove duplicates
    searchedData = _.uniq(searchedData);
    _this.searchedListItems = searchedData;

    if (_this.querySearch && _this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
      _this.showDetails(_this.searchedListItems[0].id);
    }

    _this.prepareToRenderLoop(searchedData);
    _this.renderLoopHTML(function(from, to){
      _this.onPartialRender(from, to);
    }).then(function(){
      _this.addFilters(_this.modifiedListItems);
      _this.checkBookmarked();
      _this.initializeMixer();
    });
  });
}

DynamicList.prototype.clearSearch = function() {
  // Function called when user clears the search field
  var _this = this;

  // Removes value from search box
  _this.$container.find('.search-holder input').val('').blur().removeClass('not-empty');
  // Resets all classes related to search
  _this.$container.find('.hidden-search-controls').removeClass('is-searching no-results search-results searching');

  if (_this.$container.find('.hidden-search-controls').hasClass('active')) {
    _this.calculateSearchHeight(_this.$container.find('.new-small-card-list-container'), true);
  } else {
    _this.$container.find('.hidden-search-controls').animate({ height: 0 }, 200);
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  if (_this.data.enabledLimitEntries) {
    _this.$container.find('.limit-entries-text').removeClass('hidden');
  }

  // Resets list
  _this.searchedListItems = undefined;
  _this.prepareToRenderLoop(_this.listItems);
  _this.renderLoopHTML(function(from, to){
    _this.onPartialRender(from, to);
  }).then(function(){
    _this.addFilters(_this.modifiedListItems);
    _this.checkBookmarked();
    _this.initializeMixer();
  });
}

DynamicList.prototype.initializeMixer = function() {
  // Function that initializes MixItUP
  // Plugin used for filtering
  var _this = this;

  _this.mixer = mixitup('#small-card-list-wrapper-' + _this.data.id, {
    selectors: {
      control: '[data-mixitup-control="' + _this.data.id + '"]',
      target: '.small-card-list-item'
    },
    load: {
      filter: 'all'
    },
    layout: {
      allowNestedTargets: false
    },
    animation: {
      enable: false
    },
    callbacks: {
      onMixStart: function(state, originalEvent) {
        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'filter',
          label: 'bookmarks'
        });
      },
      onMixEnd: function(state, originalEvent) {
        if (!state.totalShow) {
          if (_this.data.enabledLimitEntries) {
            _this.$container.find('.limit-entries-text').addClass('hidden');
          }

          _this.$container.find('.no-bookmarks-holder').addClass('show');
          return;
        }

        if (state.totalShow && state.totalShow === state.totalTargets) {
          if (_this.data.enabledLimitEntries) {
            _this.$container.find('.limit-entries-text').removeClass('hidden');
          }

          _this.$container.find('.no-bookmarks-holder').removeClass('show');
        } else if (state.totalShow && state.totalShow !== state.totalTargets) {
          if (_this.data.enabledLimitEntries) {
            _this.$container.find('.limit-entries-text').addClass('hidden');
          }

          _this.$container.find('.no-bookmarks-holder').removeClass('show');
        }
      }
    }
  });
}

DynamicList.prototype.setupBookmarkButton = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.bookmarkButtons.push({
    btn: LikeButton({
      target: '.small-card-bookmark-holder-' + id,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: {
        entryId: identifier
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<i class="fa fa-bookmark-o"></i>',
      likedLabel: '<i class="fa fa-bookmark animated fadeIn"></i>',
      likeWrapper: '<div class="small-card-bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="small-card-bookmark-wrapper btn-bookmarked"></div>',
      addType: 'html',
      getAllCounts: false
    }),
    id: id
  });
}

DynamicList.prototype.prepareSetupBookmarkOverlay = function(id) {
  var _this = this;
  var isLiked = false;
  var button = _.find(_this.bookmarkButtons, function(btn) {
    return btn.id === id;
  });

  if (button && button.btn) {
    if (button.btn.isLiked()) {
      _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + button.id).addClass('bookmarked');
      isLiked = button.btn.isLiked();
    } else {
      _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + button.id).addClass('not-bookmarked');
      isLiked = button.btn.isLiked();
    }
  } else {
    _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder').addClass('not-bookmarked');
    isLiked = false;
  }

  _this.likesObserversOverlay(id, button, isLiked);
}

DynamicList.prototype.likesObservers = function() {
  var _this = this;

  _this.bookmarkButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      this.$btn.parents('.small-card-list-item').addClass('bookmarked');
      var entryTitle = this.$btn.parents('.small-card-list-text-wrapper').find('.small-card-list-name').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    button.btn.on('liked.fail', function(data){
      this.$btn.parents('.small-card-list-item').removeClass('bookmarked');
      _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + button.id).removeClass('bookmarked').addClass('not-bookmarked');
    });

    button.btn.on('unliked', function(data){
      this.$btn.parents('.small-card-list-item').removeClass('bookmarked');
      var entryTitle = this.$btn.parents('.small-card-list-text-wrapper').find('.small-card-list-name').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });

    button.btn.on('unliked.fail', function(data){
      this.$btn.parents('.small-card-list-item').addClass('bookmarked');
      _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + button.id).removeClass('not-bookmarked').addClass('bookmarked');
    });
  });
}

DynamicList.prototype.likesObserversOverlay = function(id, button, isLiked) {
  var _this = this;

  _this.$container.find('.small-card-detail-overlay .small-card-bookmark-wrapper').on('click', function() {
    if (isLiked) {
      $(this).parents('.small-card-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
      button.btn.unlike();
      isLiked = !isLiked;
      return;
    }

    $(this).parents('.small-card-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
    button.btn.like();
    isLiked = !isLiked;
  });
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

  var entryData = _.find(_this.modifiedListItems, function(entry) {
    return entry.id === id;
  });
  // Process template with data
  var entryId = {
    id: id
  };
  var wrapper = '<div class="small-card-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = _this.$container.find('#small-card-detail-overlay-' + _this.data.id);

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
    $overlay.find('.small-card-detail-overlay-content-holder').html(wrapperTemplate(entryId));
    $overlay.find('.small-card-detail-wrapper').append(template(data.data || entryData));

    // Doesn't setup the bookmark button for the current user profile
    if ((data.data && !data.data.isCurrentUser) || (entryData && !entryData.isCurrentUser)) {
      _this.prepareSetupBookmarkOverlay(id);
    }

    // Trigger animations
    _this.$container.find('.new-small-card-list-container').addClass('overlay-open');
    $overlay.addClass('open');
    setTimeout(function() {
      $overlay.addClass('ready');

      if (typeof _this.directoryDetailWrapper === 'undefined') {
        _this.directoryDetailWrapper = _this.$container.find('.small-card-list-item[data-entry-id="' + id + '"] .small-card-list-detail-wrapper');
      }

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

  var $overlay = _this.$container.find('#small-card-detail-overlay-' + _this.data.id);
  $overlay.removeClass('open');
  _this.$container.find('.new-small-card-list-container').removeClass('overlay-open');

  setTimeout(function() {
    $overlay.removeClass('ready');

    // Clears overlay
    $overlay.find('.small-card-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }
  }, 300);
}

DynamicList.prototype.expandElement = function(elementToExpand, id) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
  if (elementToExpand.parents('.panel-group').not('.filter-overlay').length) {
    elementToExpand.parents('.panel-group').not('.filter-overlay').addClass('remove-transform');
  }

  //check to see if element is already expanded
  if (!elementToExpand.hasClass('open')) {
    // freeze the current scroll position of the background content
    $('body').addClass('lock');
    elementToExpand.parents('.small-card-list-item').addClass('opening');

    var currentPosition = elementToExpand.offset();
    var elementScrollTop = $(window).scrollTop();
    var netOffset = currentPosition.top - elementScrollTop;

    var expandWidth = $('body').outerWidth();
    var expandHeight = $('html').outerHeight();

    var directoryDetailImageWrapper = elementToExpand.find('.small-card-list-detail-image-wrapper');
    var directoryDetailImage = elementToExpand.find('.small-card-list-detail-image');

    // Get the size of the html offset
    // This get into account phones with notch
    var computedStyles = window.getComputedStyle(document.getElementsByTagName('html')[0]);
    var htmlMarginTop = computedStyles.getPropertyValue('margin-top');
    var toTop = parseInt(htmlMarginTop, 10);

    // convert the expand-item to fixed position with a high z-index without moving it
    elementToExpand.css({
      'top': netOffset,
      'left': currentPosition.left,
      'height': elementToExpand.height(),
      'width': elementToExpand.width(),
      'max-width': expandWidth,
      'position': 'fixed',
      'z-index': 1010,
    });

    elementToExpand.animate({
      'left': 0,
      'top': !isNaN(toTop) ? toTop : 0,
      'height': expandHeight,
      'width': expandWidth,
      'max-width': expandWidth
    }, 200, 'linear', function() {
      _this.showDetails(id);

      setTimeout(function() {
        elementToExpand.parents('.small-card-list-item').removeClass('opening');
      }, 200); // How long it takes for the overlay to fade in
    });

    elementToExpand.addClass('open');
    elementToExpand.parents('.small-card-list-item').addClass('open');
    elementToExpand.find('.small-card-list-detail-content-scroll-wrapper').addClass('open');

    directoryDetailImageWrapper.css({
      height: directoryDetailImageWrapper.outerHeight(),
      'z-index': 12
    });

    directoryDetailImageWrapper.animate({
      height: '70vh'
    },
    200,
    'linear'
    );

    directoryDetailImage.css({
      height: directoryDetailImage.outerHeight(),
      'z-index': 12
    });

    directoryDetailImage.animate({
      height: '70vh'
    }, 200, 'linear');
  }
}

DynamicList.prototype.collapseElement = function(elementToCollapse) {
  // Function called when a list item is tapped to close
  var _this = this;

  $('body').removeClass('lock');
  elementToCollapse.parents('.small-card-list-item').addClass('closing');

  var directoryDetailImageWrapper = elementToCollapse.find('.small-card-list-detail-image-wrapper');
  var directoryDetailImage = elementToCollapse.find('.small-card-list-detail-image');

  if (!directoryDetailImageWrapper.length || !directoryDetailImage.length) {
    _this.closeDetails();
  }

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
    _this.closeDetails();
    elementToCollapse.parents('.small-card-list-item').removeClass('opening');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    // Only happens when the closing animation finishes
    if (elementToCollapse.parents('.panel-group').not('.filter-overlay').length) {
      elementToCollapse.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }
  });

  elementToCollapse.removeClass('open');
  elementToCollapse.parents('.small-card-list-item').removeClass('open');
  elementToCollapse.find('.small-card-list-detail-content-scroll-wrapper').removeClass('open');
}