// Constructor
function DynamicList(id, data) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-cards-loop',
      'search-results': 'templates.build.agenda-cards-search-results',
      'detail': 'templates.build.agenda-cards-detail',
      'filter': 'templates.build.agenda-filters',
      'other-loop': 'templates.build.agenda-dates-loop'
    }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.data.computedFields = this.data.computedFields || {};
  this.data.forceRenderList = false;
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
  this.myUserData = {};
  this.agendaDates = [];
  this.showBookmarks;
  this.fetchedAllBookmarks = false;
  this.searchValue = '';
  this.activeFilters = {};

  this.listItems = [];
  this.agendasByDay = [];
  this.filteredAgendasByDay = [];
  this.filteredListItemsByDay = [];
  this.filteredListItems = [];
  this.dataSourceColumns = [];
  this.dateFieldLocation = 'Full Date';

  this.queryOpen = false;
  this.querySearch = false;
  this.queryFilter = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvPreFilterQuery;
  this.pvOpenQuery;
  this.openedEntryOnQuery = false;
  this.imagesData = {};

  /*
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;
  this.ANIMATION_SPEED = 200;

  this.data.bookmarksEnabled = _.get(this, 'data.social.bookmark');
  this.data.hasTopBar = this.data.searchEnabled || this.data.filtersEnabled;

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

  this.detailHTML = Handlebars.compile(this.src);

  // Register handlebars helpers
  this.Utils.registerHandlebarsHelpers();

  // Get the current session data
  Fliplet.User.getCachedSession()
    .then(function(session) {
      if (_.get(session, 'entries.saml2.user')) {
        _this.myUserData = _.get(session, 'entries.saml2.user');
        _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
        _this.myUserData.isSaml2 = true;
      }

      if (_.get(session, 'entries.dataSource.data')) {
        _.extend(_this.myUserData, _.get(session, 'entries.dataSource.data'));
      }

      // Start running the Public functions
      return _this.initialize();
    })
    .catch(function(error) {
      Fliplet.UI.Toast.error(error, {
        message: 'Error loading agenda'
      });
    });
}

DynamicList.prototype.Utils = Fliplet.Registry.get('dynamicListUtils');

DynamicList.prototype.toggleFilterElement = function(target, toggle) {
  var $target = this.Utils.DOM.$(target);
  var filterType = $target.data('type');

  // Date filters are targeted at the same time
  if (filterType === 'date') {
    $target = $target.closest('[data-filter-group]').find('.hidden-filter-controls-filter');
  }

  if (typeof toggle === 'undefined') {
    $target.toggleClass('mixitup-control-active');
  } else {
    $target[!!toggle ? 'addClass' : 'removeClass']('mixitup-control-active');
  }

  if (filterType === 'date') {
    $target.closest('[data-filter-group]').toggleClass('filter-range-active', $target.hasClass('mixitup-control-active'));
  }

  if (this.$container.find('.mixitup-control-active').length) {
    this.$container.find('.clear-filters').removeClass('hidden');
  } else {
    this.$container.find('.clear-filters').addClass('hidden');
  }

  this.Utils.Page.updateActiveFilterCount({
    filtersInOverlay: this.data.filtersInOverlay,
    $target: $target
  });
};

DynamicList.prototype.hideFilterOverlay = function() {
  this.$container.find('.new-agenda-search-filter-overlay').removeClass('display');
  this.$container.find('.section-top-wrapper, .agenda-cards-wrapper, .dynamic-list-add-item').removeClass('hidden');
  $('body').removeClass('lock has-filter-overlay');
};

DynamicList.prototype.goToAgendaFeature = function(options) {
  options = options || {};

  var entry = options.entry;
  var type = options.type;

  if (!entry || !type) {
    console.warn('Unable to open agenda feature');

    return;
  }

  var screenName = entry.data[this.data[type + 'Column']];

  if (!screenName) {
    return;
  }

  var screen = _.find(Fliplet.Env.get('appPages'), { title: screenName });

  if (!screen) {
    return;
  }

  var data = {
    id: this.Utils.Record.getUniqueId({
      record: options.entry,
      config: this.data
    }),
    title: this.$container.find('.agenda-detail-overlay .agenda-item-title').text().trim()
  };

  return Fliplet.App.Storage.set(type + 'SessionTitle-' + screen.id, data)
    .then(function() {
      return Fliplet.Navigate.screen(screen.id, {
        transition: 'fade',
        query: '?sessionId=' + encodeURIComponent(data.id) + '&sessionTitle=' + encodeURIComponent(data.title)
      });
    });
};

DynamicList.prototype.attachObservers = function() {
  var _this = this;

  // Attach your event listeners here
  $(window).resize(function() {
    _this.centerDate();

    _this.Utils.DOM.adjustAddButtonPosition(_this);
  });

  Fliplet.Hooks.on('flListDataAfterRenderList', function() {
    _this.Utils.DOM.adjustAddButtonPosition(_this);
  });

  Fliplet.Hooks.on('beforePageView', function(options) {
    if (options.addToHistory === false) {
      _this.closeDetails();
    }
  });

  _this.$container
    .on('click keydown', '.apply-filters', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(this).parents('.new-agenda-search-filter-overlay').removeClass('display');
      _this.$container.find('.section-top-wrapper, .agenda-cards-wrapper, .dynamic-list-add-item').removeClass('hidden');

      var $selectedFilters = _this.$container.find('.hidden-filter-controls-filter.mixitup-control-active');

      if ($selectedFilters.length) {
        _this.$container.find('.hidden-filter-controls-filter-container').removeClass('hidden');
      }

      _this.$container.find('.fa-sliders').focus();

      _this.hideFilterOverlay();
      _this.searchData();
    })
    .on('click keydown', '.agenda-filters-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $('.agenda-cards-wrapper').removeClass('hidden');
      $(event.target).find('.collapse').collapse('toggle');
    })
    .on('click keydown', '.clear-filters', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(this).addClass('hidden');
      _this.$container.find('.fa-sliders').focus();

      _this.hideFilterOverlay();
      _this.Utils.Page.clearFilters({ instance: _this });
    })
    .on('click keydown', '.hidden-filter-controls-filter', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $filter = $(this);

      // Date filters change events are handled differently
      if (['date'].indexOf($filter.data('type')) > -1) {
        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $filter.text().trim()
      });

      _this.toggleFilterElement($filter);

      if ($filter.parents('.inline-filter-holder').length) {
        // @HACK Skip an execution loop to allow custom handlers to update the filters
        setTimeout(function() {
          _this.searchData();
        }, 0);
      }
    })
    .on('click', '.filter-range-reset', function() {
      var $filterGroup = $(this).closest('[data-filter-group]');
      var $filters = $filterGroup.find('.hidden-filter-controls-filter');

      $filters.each(function() {
        var $filter = $(this);

        $filter.data('flDatePicker').set($filter.data('default'), false);
      });

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: 'RESET_DATES'
      });

      _this.toggleFilterElement($filters, false);

      if ($filters.parents('.inline-filter-holder').length) {
        // @HACK Skip an execution loop to allow custom handlers to update the filters
        setTimeout(function() {
          _this.searchData();
        }, 0);
      }
    })
    .on('click keydown', '.list-search-icon .fa-sliders', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $el = $(this);

      Fliplet.Page.Context.remove('dynamicListFilterHideControls');

      if (_this.data.filtersInOverlay) {
        _this.$container.find('.new-agenda-search-filter-overlay').addClass('display');
        _this.$container.find('.section-top-wrapper, .agenda-cards-wrapper, .dynamic-list-add-item').addClass('hidden');
        _this.$container.find('.agenda-overlay-close').focus();
        $('body').addClass('lock has-filter-overlay');

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search_filter_controls_overlay_activate'
        });

        return;
      }

      _this.$container.find('.agenda-date-selector').addClass('hidden');
      _this.$container.find('.agenda-list-holder').addClass('hidden');
      _this.$container.find('.hidden-filter-controls').addClass('active');
      _this.$container.find('.list-search-cancel').addClass('active').focus();
      _this.$container.find('.hidden-filter-controls-filter-container').removeClass('hidden');
      $el.addClass('active');

      _this.toggleListView();
      _this.calculateFiltersHeight();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search_filter_controls_activate'
      });
    })
    .on('click keydown', '.agenda-overlay-close', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(this).parents('.new-agenda-search-filter-overlay').removeClass('display');
      _this.$container.find('.section-top-wrapper, .agenda-cards-wrapper, .dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.list-search-icon .fa-sliders').focus();
      $('body').removeClass('lock has-filter-overlay');

      // Clear all selected filters
      _this.toggleFilterElement(_this.$container.find('.mixitup-control-active:not(.toggle-bookmarks)'), false);

      // No filters selected
      if (_.isEmpty(_this.activeFilters)) {
        _this.$container.find('.clear-filters').addClass('hidden');

        return;
      }

      if (!_.has(_this.activeFilters, 'undefined')) {
        // Select filters based on existing settings
        var selectors = _.flatten(_.map(_this.activeFilters, function(values, field) {
          return _.map(values, function(value) {
            return '.hidden-filter-controls-filter[data-field="' + field + '"][data-value="' + value + '"]';
          });
        })).join(',');

        _this.toggleFilterElement(_this.$container.find(selectors), true);
        _this.$container.find('.clear-filters').removeClass('hidden');

        return;
      }

      // Legacy class-based settings
      _this.activeFilters['undefined'].forEach(function(filter) {
        _this.toggleFilterElement(_this.$container.find('.hidden-filter-controls-filter[data-toggle="' + filter + '"]'), true);
      });

      _this.$container.find('.clear-filters').removeClass('hidden');
    })
    .on('click keydown', '.list-search-cancel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      // Hide filters
      $(this).removeClass('active');
      _this.$container.find('.agenda-date-selector').removeClass('hidden');
      _this.$container.find('.agenda-list-holder').removeClass('hidden');
      _this.$container.find('.hidden-filter-controls').removeClass('active');
      _this.$container.find('.list-search-icon .fa-sliders').removeClass('active').focus();
      _this.$container.find('.hidden-filter-controls-filter-container').addClass('hidden');
      _this.calculateFiltersHeight(true);

      // Clear filters
      _this.Utils.Page.clearFilters({ instance: _this });
    })
    .on('keyup input', '.search-holder input', function(e) {
      var $inputField = $(this);
      var value = $inputField.val();

      Fliplet.Hooks.run(e.type === 'keyup' ? 'flListDataSearchKeyUp' : 'flListDataSearchInput', {
        instance: _this,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        input: $inputField,
        value: value,
        event: e
      }).then(function() {
        // In case the value has been changed via hooks
        value = $inputField.val();

        if (value.length) {
          $inputField.addClass('not-empty');
        } else {
          $inputField.removeClass('not-empty');
        }

        if (e.type === 'keyup' && (e.which === 13 || e.keyCode === 13)) {
          if (value === '') {
            _this.$container.find('.new-agenda-list-container').removeClass('searching');
            _this.isSearching = false;
            _this.searchData('');

            return;
          }

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'search',
            label: value
          });

          _this.$container.find('.new-agenda-list-container').addClass('searching');
          _this.isSearching = true;
          _this.searchData(value);
        }
      });
    })
    .on('click keydown', '.search-holder .search-btn', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $inputField = $(this).parents('.search-holder').find('.search-feed');
      var value = $inputField.val();

      if (value === '') {
        _this.$container.find('.new-agenda-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.searchData('');

        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search',
        label: value
      });

      _this.$container.find('.new-agenda-list-container').addClass('searching');
      _this.isSearching = true;
      _this.searchData(value);
    })
    .on('click keydown', '.clear-search', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.new-agenda-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.searchData('');
    })
    .on('click keydown', '.go-to-poll', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.pollEnabled || !_this.data.pollColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });

      _this.goToAgendaFeature({
        type: 'poll',
        entry: entry
      });
    })
    .on('click keydown', '.go-to-survey', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.surveyEnabled || !_this.data.surveyColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });

      _this.goToAgendaFeature({
        type: 'survey',
        entry: entry
      });
    })
    .on('click keydown', '.go-to-questions', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.questionsEnabled || !_this.data.questionsColumn) {
        return;
      }

      var entryId = $(this).parents('.agenda-item-inner-content').data('entry-id');
      var entry = _.find(_this.listItems, function(entry) {
        return entry.id === entryId;
      });

      _this.goToAgendaFeature({
        type: 'questions',
        entry: entry
      });
    })
    .on('touchstart', '.agenda-list-controls', function() {
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-controls', function() {
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-controls', function() {
      $(this).removeClass('hover');
    })
    .on('click keydown', '.agenda-list-controls', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $toggle = $(this).find('.toggle-agenda');

      if (!$toggle.length) {
        return;
      }

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: $toggle.hasClass('mixitup-control-active')
          ? 'bookmarks_show'
          : 'bookmarks_hide'
      });
    })
    .on('click keydown', '.toggle-agenda, .toggle-bookmarks', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      event.stopPropagation();

      var $toggle = _this.$container.find(event.handleObj.selector);

      $toggle.toggleClass('mixitup-control-active');
      _this.$container.find('.new-agenda-list-container').toggleClass('show-bookmarks');
      _this.searchData();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: $toggle.hasClass('mixitup-control-active')
          ? 'bookmarks_show'
          : 'bookmarks_hide'
      });
    })
    .on('touchstart', '.agenda-list-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-item', function() {
      _this.allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        _this.allowClick = true;
      }, 100);
    })
    .on('click keydown', '.agenda-list-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

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

      beforeOpen.then(function() {
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

        _this.$container.find('.new-agenda-list-container, .dynamic-list-add-item').addClass('hidden');

        _this.showDetails(entryId);
        Fliplet.Page.Context.update({
          dynamicListOpenId: entryId
        });
      });
    })
    .on('click keydown', '.agenda-detail-overlay-close, .agenda-detail-overlay-screen', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var result;
      var id = _this.$container.find('.agenda-detail-wrapper[data-entry-id]').data('entry-id');

      _this.$container.find('.agenda-list-holder').removeClass('hidden');
      _this.$container.find('.new-agenda-list-container, .dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.agenda-list-item[data-entry-id="' + id + '"]').focus();

      if ($(this).hasClass('go-previous-screen')) {
        if (!_this.pvPreviousScreen) {
          return;
        }

        try {
          // eslint-disable-next-line no-eval
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

        return result.then(function() {
          return Fliplet.Navigate.back();
        }).catch(function(error) {
          console.error(error);
        });
      }

      _this.closeDetails();
    })
    .on('keydown', function(e) {
      var indexOfActiveDate;
      var indexOfClickedDate;
      var indexDifference;

      if (e.keyCode === 39) {
        if (_this.$container.find('.agenda-date-selector li.active').next().hasClass('.placeholder')) {
          return;
        }

        indexOfActiveDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
        indexOfClickedDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active').next());
        indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.updateDateIndexContext(indexOfClickedDate);

        _this.moveForwardDate(indexOfClickedDate, indexDifference);

        return;
      }

      if (e.keyCode === 37) {
        if (_this.$container.find('.agenda-date-selector li.active').prev().hasClass('.placeholder')) {
          return;
        }

        indexOfActiveDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active'));
        indexOfClickedDate = _this.$container.find('.agenda-date-selector li').not('.placeholder').index(_this.$container.find('.agenda-date-selector li.active').prev());
        indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.updateDateIndexContext(indexOfClickedDate);

        _this.moveBackDate(indexOfClickedDate, indexDifference);

        return;
      }
    })
    .on('click keydown', '.agenda-date-selector li', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event) || $(this).is('.active, .placeholder')) {
        return;
      }

      var indexOfActiveDate = _this.$container
        .find('.agenda-date-selector li')
        .not('.placeholder')
        .index(_this.$container.find('.agenda-date-selector li.active'));
      var indexOfClickedDate = _this.$container
        .find('.agenda-date-selector li')
        .not('.placeholder')
        .index(this);
      var indexDifference = indexOfClickedDate - indexOfActiveDate;

      _this.updateDateIndexContext(indexOfClickedDate);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter_date',
        label: [
          $(this).find('.week').text().trim(),
          $(this).find('.day').text().trim(),
          $(this).find('.month').text().trim()
        ].join(' ')
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
    .on('click keydown', '.dynamic-list-add-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.addEntryLinkAction) {
        return;
      }

      if (!_.get(_this, 'data.addEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: 'Link not configured',
          message: 'Form not found. Please check the component\'s configuration.'
        });

        return;
      }

      _this.data.addEntryLinkAction.query = _this.Utils.String.appendUrlQuery(
        _this.data.addEntryLinkAction.query,
        'mode=add'
      );

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
    .on('click keydown', '.dynamic-list-edit-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.editEntryLinkAction) {
        return;
      }

      if (!_.get(_this, 'data.editEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: 'Link not configured',
          message: 'Form not found. Please check the component\'s configuration.'
        });

        return;
      }

      var entryID = $(this).parents('.agenda-item-inner-content').data('entry-id');

      _this.data.editEntryLinkAction.query = _this.Utils.String.appendUrlQuery(
        _this.data.editEntryLinkAction.query,
        'dataSourceEntryId=' + entryID
      );

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
    .on('click keydown', '.dynamic-list-delete-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var _that = $(this);
      var entryID = _that.parents('.agenda-item-inner-content').data('entry-id');
      var options = {
        title: 'Are you sure you want to delete the list entry?',
        labels: [
          {
            label: 'Delete',
            action: function() {
              _that.text('Deleting...').addClass('disabled');

              // Run Hook
              Fliplet.Hooks.run('flListDataBeforeDeleteEntry', {
                instance: _this,
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
      };

      Fliplet.Hooks.run('flListDataBeforeDeleteConfirmation', {
        instance: _this,
        entryId: entryID,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container
      }).then(function() {
        Fliplet.UI.Actions(options);
      });
    })
    .on('click', '.file-item', function(event) {
      var url = $(event.currentTarget).find('input[type=hidden]').val();

      Fliplet.Navigate.file(url);
    })
    .on('click keydown', '.agenda-detail-overlay .bookmark-wrapper, .search-results-wrapper .bookmark-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $parent = $(this).parents('.agenda-item-bookmark-holder');
      var id = $(this)
        .parents('.agenda-detail-wrapper, .agenda-list-item')
        .data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $parent.removeClass('bookmarked').addClass('not-bookmarked');
        $parent.find('.btn-bookmark').focus();

        record.bookmarkButton.unlike();

        return;
      }

      $parent.removeClass('not-bookmarked').addClass('bookmarked');
      $parent.find('.btn-bookmarked').focus();

      record.bookmarkButton.like();
    })
    .on('click keydown', '.multiple-images-item, .single-image-holder', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $this = $(this);
      var id = $this.parents('[data-detail-entry-id]').data('detailEntryId');

      _this.imagesData[id].options.index = $this.index();

      Fliplet.Navigate.previewImages(_this.imagesData[id]);
    });
};

DynamicList.prototype.deleteEntry = function(entryID) {
  var _this = this;

  return Fliplet.DataSources.connect(_this.data.dataSourceId).then(function(connection) {
    return connection.removeById(entryID, { ack: true });
  }).then(function() {
    return Promise.resolve(entryID);
  });
};

DynamicList.prototype.removeListItemHTML = function(options) {
  options = options || {};

  var id = options.id;

  if (!id) {
    return;
  }

  this.$container.find('.agenda-list-item[data-entry-id="' + id + '"]').remove();
};

DynamicList.prototype.scrollEvent = function() {
  var _this = this;
  var lastScrollTop = 0;
  var threshold = 50;

  _this.$container.find('.agenda-list-day-holder').scroll(function() {
    var st = $(this).scrollTop();

    if (st > lastScrollTop && st > threshold) {
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
};

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
  }

  _this.attachObservers();

  // Check if there is a query or PV for search/filter queries
  return (shouldInitFromQuery ? Promise.resolve() : _this.parsePVQueryVars())
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();
      // Determine filter types from configuration
      _this.filterTypes = _this.Utils.getFilterTypes({ instance: _this });

      return _this.connectToDataSource();
    })
    .then(function(records) {
      _this.Utils.Records.addComputedFields({
        records: records,
        config: _this.data
      });

      return Fliplet.Hooks.run('flListDataAfterGetData', {
        instance: _this,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        records: records
      }).then(function() {
        return _this.Utils.Records.setFilterValues({
          config: _this.data
        });
      }).then(function() {
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
      _this.listItems = _this.getPermissions(records);

      return _this.Utils.Records.getFields(_this.listItems, _this.data.dataSourceId).then(function(columns) {
        _this.dataSourceColumns = columns;
      });
    })
    .then(function() {
      // Render dates HTML
      _this.renderDatesHTML(_this.listItems);
      _this.scrollEvent();

      return _this.Utils.Records.updateFiles({
        records: _this.listItems,
        config: _this.data
      });
    })
    .then(function(response) {
      _this.listItems = _.uniqBy(response, 'id');

      return _this.checkIsToOpen();
    })
    .then(function() {
      _this.modifiedListItems = _this.Utils.Records.addFilterProperties({
        records: _this.listItems,
        config: _this.data,
        filterTypes: _this.filterTypes,
        filterQuery: _this.queryFilter ? _this.pvFilterQuery : undefined
      });

      return _this.addFilters(_this.modifiedListItems);
    }).then(function() {
      _this.parseFilterQueries();
      _this.parseSearchQueries();
    });
};

DynamicList.prototype.checkIsToOpen = function() {
  // List of entries saved in: _this.modifiedListItems
  var _this = this;
  var entry;

  if (!_this.queryOpen) {
    return Promise.resolve();
  }

  if (_.hasIn(_this.pvOpenQuery, 'id')) {
    entry = _.find(_this.listItems, { id: _this.pvOpenQuery.id });
  } else if (_.hasIn(_this.pvOpenQuery, 'value') && _.hasIn(_this.pvOpenQuery, 'column')) {
    entry = _.find(_this.listItems, function(row) {
      return row.data[_this.pvOpenQuery.column] === _this.pvOpenQuery.value;
    });
  }

  if (!entry) {
    Fliplet.UI.Toast('Entry not found');

    return Promise.resolve();
  }

  var modifiedData = _this.addSummaryData([entry]);

  return _this.showDetails(entry.id, modifiedData).then(function() {
    _this.openedEntryOnQuery = true;

    // Wait for overlay transition to complete
    return new Promise(function(resolve) {
      setTimeout(resolve, 250);
    });
  });
};

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
};

DynamicList.prototype.parseSearchQueries = function() {
  var _this = this;

  if (!_.get(_this.pvSearchQuery, 'value')) {
    return _this.searchData({
      initialRender: true,
      goToToday: true
    });
  }

  if (_.hasIn(_this.pvSearchQuery, 'column')) {
    return _this.searchData({
      value: _this.pvSearchQuery.value,
      openSingleEntry: _this.pvSearchQuery.openSingleEntry,
      initialRender: true
    });
  }

  _this.$container.find('.new-agenda-list-container').addClass('searching');
  _this.isSearching = true;

  return _this.searchData({
    column: _this.pvSearchQuery.column,
    value: _this.pvSearchQuery.value,
    openSingleEntry: _this.pvSearchQuery.openSingleEntry,
    initialRender: true
  });
};

DynamicList.prototype.parseFilterQueries = function() {
  if (!this.queryFilter) {
    return;
  }

  this.Utils.Page.parseFilterQueries({
    instance: this
  });
};

DynamicList.prototype.connectToDataSource = function() {
  var _this = this;
  var cache = { offline: true };

  function getData(options) {
    if (_this.data.defaultData && !_this.data.dataSourceId) {
      return Promise.resolve(_this.data.defaultEntries);
    }

    options = options || cache;

    return Fliplet.DataSources.connect(_this.data.dataSourceId, options)
      .then(function(connection) {
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
    instance: _this,
    config: _this.data,
    id: _this.data.id,
    uuid: _this.data.uuid,
    container: _this.$container
  }).then(function() {
    if (_this.data.getData) {
      // eslint-disable-next-line no-func-assign
      getData = _this.data.getData;

      if (_this.data.hasOwnProperty('cache')) {
        cache.offline = _this.data.cache;
      }
    }

    return getData(cache);
  });
};

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
};

DynamicList.prototype.groupLoopDataByDate = function(loopData, dateField) {
  var _this = this;
  // Group data by date field
  var recordGroups = _.groupBy(loopData, function(row) {
    // Format date value as it could be in various formats
    return _this.Utils.Date.moment(row[dateField]).format('YYYY-MM-DD');
  });
  var recordMerges = [];
  var recordDates = _.orderBy(_.keys(recordGroups));

  // Prepare a merge if the date values are parsed as the same date
  _.forEach(recordDates, function(key, i) {
    var date = _this.Utils.Date.moment(key);

    _.forEach(recordDates, function(comp, j) {
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
  _.forEach(recordMerges, function(merge) {
    recordGroups[merge.to] = _.concat(recordGroups[merge.to], recordGroups[merge.from]);
    delete recordGroups[merge.from];
  });

  return _(recordGroups).toPairs().sortBy(0).map(1).value();
};

DynamicList.prototype.addSummaryData = function(records) {
  var _this = this;
  var modifiedData = _this.Utils.Records.addFilterProperties({
    records: records,
    config: _this.data,
    filterTypes: _this.filterTypes
  });

  // Uses sumamry view settings set by users
  var loopData = _.map(modifiedData, function(entry) {
    var newObject = {
      id: entry.id,
      flClasses: entry.data['flClasses'],
      flFilters: entry.data['flFilters'],
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

    _this.data['summary-fields'].forEach(function(obj) {
      var content = '';

      if (obj.type === 'image') {
        content = _this.Utils.Record.getImageContent(entry.data[obj.column], true);
      } else if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
      } else {
        content = entry.data[obj.column];
      }

      if (obj.location === 'Start Time' || obj.location === 'End Time') {
        content = TD(content, { format: 'LT' });
      }

      content = _this.Utils.String.toFormattedString(content);

      newObject[obj.location] = content;
    });

    var dateField = _.find(_this.data.detailViewOptions, { location: _this.dateFieldLocation });

    if (dateField) {
      newObject[_this.dateFieldLocation] = entry.data[dateField.column];
    }

    return newObject;
  });

  return loopData;
};

DynamicList.prototype.emptyLoop = function() {
  if (this.isInLoopView()) {
    $('#agenda-cards-wrapper-' + this.data.id + ' .agenda-list-holder').empty();
  } else {
    this.$container.find('.search-results-wrapper .search-results-holder').empty();
  }
};

DynamicList.prototype.renderLoopHTML = function() {
  // Function that renders the List template
  var _this = this;
  var template = '';

  if (this.isInLoopView()) {
    template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
      ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
      : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());
  } else {
    template = _this.data.advancedSettings && _this.data.advancedSettings.searchResultsHTML
      ? Handlebars.compile(_this.data.advancedSettings.searchResultsHTML)
      : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['search-results']]());
  }

  _this.emptyLoop();

  var renderLoopIndex = 0;
  var $renderFull = $([]);
  var $agendaListHolder = _this.isInLoopView()
    ? $('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder')
    : _this.$container.find('.search-results-wrapper .search-results-holder');

  _this.$container.find('.new-agenda-list-container').removeClass('loading').addClass('ready');

  return new Promise(function(resolve) {
    function render() {
      // get the next batch of items to render
      var nextBatch = _this.getAgendasByDay().slice(
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * renderLoopIndex,
        _this.INCREMENTAL_RENDERING_BATCH_SIZE * (renderLoopIndex + 1)
      );

      // Break render cycle if there is no more data
      if (!nextBatch.length && renderLoopIndex > 0) {
        resolve(_.flatten(_this.getAgendasByDay()));

        return;
      }

      var $renderBatch = $(template(nextBatch));

      $renderFull.add($renderBatch);
      $agendaListHolder.append($renderBatch);

      if (_this.isInLoopView() && renderLoopIndex === 0) {
        _this.$container.find('.agenda-list-day-holder').eq(renderLoopIndex).addClass('active');
      }

      renderLoopIndex++;

      // if the browser is ready, render
      requestAnimationFrame(render);
    }

    // Changing close icon in the fa-times-thin class for windows 7 IE11
    if (/Windows NT 6.1/g.test(navigator.appVersion) && Modernizr.ie11) {
      $('.fa-times-thin').addClass('win7');
    }

    // start the initial render
    requestAnimationFrame(render);
  });
};

DynamicList.prototype.renderDatesHTML = function(records, index) {
  if (!records || !records.length) {
    return;
  }

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

  var clonedRecords = _.clone(records);

  // Keep only records with valid dates when rendering dates selectors
  clonedRecords = _.orderBy(_.filter(clonedRecords, function(record) {
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
    for (i = 0; i < numberOfPlaceholderDays; i++) {
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
};

DynamicList.prototype.getAddPermission = function(data) {
  data.showAddEntry = this.Utils.User.canAddRecord(this.data, this.myUserData);

  return data;
};

DynamicList.prototype.getPermissions = function(entries) {
  var _this = this;

  // Adds flag for Edit and Delete buttons
  _.forEach(entries, function(entry) {
    entry.editEntry = _this.Utils.Record.isEditable(entry, _this.data, _this.myUserData);
    entry.deleteEntry = _this.Utils.Record.isDeletable(entry, _this.data, _this.myUserData);
  });

  return entries;
};

DynamicList.prototype.addFilters = function(records) {
  // Function that renders the filters
  var _this = this;
  var filters = _this.Utils.Records.parseFilters({
    records: records,
    filters: _this.data.filterFields,
    id: _this.data.id,
    query: _this.queryFilter ? _this.pvFilterQuery : undefined,
    filterTypes: _this.filterTypes
  });

  return Fliplet.Hooks.run('flListDataBeforeRenderFilters', {
    instance: _this,
    filters: filters,
    records: records,
    config: _this.data
  }).then(function() {
    var filtersTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['filter']];

    var filtersData = {
      filtersInOverlay: _this.data.filtersInOverlay,
      filters: filters
    };
    var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
      ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
      : Handlebars.compile(filtersTemplate());

    _.remove(filters, function(filter) {
      return _.isEmpty(filter.data);
    });
    _this.Utils.Page.renderFilters({
      instance: _this,
      html: template(filtersData)
    });
    Fliplet.Hooks.run('flListDataAfterRenderFilters', {
      instance: _this,
      filters: filters,
      records: records,
      config: _this.data
    });
  });
};

DynamicList.prototype.calculateFiltersHeight = function(hideFilters) {
  var _this = this;
  var totalHeight = hideFilters
    ? 0
    : 'auto';

  _this.$container.find('.hidden-filter-controls').data('height', totalHeight).css({
    height: totalHeight
  });
};

DynamicList.prototype.calculateSearchHeight = function(clearSearch) {
  var _this = this;
  var totalHeight = clearSearch
    ? 0
    : this.$container.find('.hidden-search-controls-content').height();

  return new Promise(function(resolve) {
    _this.$container.find('.hidden-search-controls').data('height', totalHeight).animate({
      height: totalHeight
    }, _this.ANIMATION_SPEED, resolve);
  });
};

DynamicList.prototype.getAllBookmarks = function() {
  var _this = this;

  if (_this.fetchedAllBookmarks || !_this.data.bookmarksEnabled || !_this.data.bookmarkDataSourceId) {
    return Promise.resolve();
  }

  if (typeof _this.data.getBookmarkIdentifier === 'function' || _this.data.dataPrimaryKey) {
    return Promise.resolve();
  }

  return _this.Utils.Query.fetchAndCache({
    key: 'bookmarks-' + _this.data.bookmarkDataSourceId,
    waitFor: 400,
    request: Fliplet.Profile.Content({
      dataSourceId: _this.data.bookmarkDataSourceId,
      view: 'userBookmarks'
    }).then(function(instance) {
      return instance.query({
        where: {
          content: {
            entryId: { $regex: '\\d-bookmark' }
          }
        },
        exact: false
      });
    })
  }).then(function(results) {
    var bookmarkedIds = _.compact(_.map(results.data, function(record) {
      var match = _.get(record, 'data.content.entryId', '').match(/(\d*)-bookmark/);

      return match ? parseInt(match[1], 10) : '';
    }));

    if (results.fromCache) {
      _.forEach(_this.listItems, function(record) {
        if (bookmarkedIds.indexOf(record.id) === -1) {
          return;
        }

        record.bookmarked = true;
      });
    } else {
      _.forEach(_this.listItems, function(record) {
        record.bookmarked = bookmarkedIds.indexOf(record.id) > -1;
      });
    }

    _this.fetchedAllBookmarks = true;
  });
};

DynamicList.prototype.initializeSocials = function(records) {
  var _this = this;

  return _this.getAllBookmarks().then(function() {
    return Promise.all(_.map(_.flatten(records), function(record) {
      var title = _this.$container.find('.agenda-cards-wrapper .agenda-list-item[data-entry-id="' + record.id + '"] .agenda-item-title').text().trim();
      var masterRecord = _.find(_this.listItems, { id: record.id });
      var $listView = _this.isInLoopView()
        ? _this.$container.find('.agenda-cards-wrapper')
        : _this.$container.find('.search-results-wrapper');

      return _this.setupBookmarkButton({
        target: $listView.find('.agenda-item-bookmark-holder-' + record.id),
        id: record.id,
        title: title,
        record: masterRecord
      });
    }));
  });
};

/* ANIMATION FOR DATES BACK AND FORWARD */
// animates dates forward
DynamicList.prototype.animateDateForward = function($nextDateElement, nextDateElementWidth) {
  var _this = this;

  return new Promise(function(resolve) {
    var $currentActiveDate = _this.$container.find('.agenda-date-selector li.active');

    $currentActiveDate.removeClass('active').find('.day').addBack().css('color', '#000');
    setTimeout(function() {
      $currentActiveDate.find('.day').addBack().css('color', '');

      $nextDateElement.addClass('active').find('.day').addBack().css('color', '#000');
      setTimeout(function() {
        $nextDateElement.find('.day').addBack().css('color', '');
      }, 0);
    }, 0);

    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '+=' + nextDateElementWidth
    },
    _this.ANIMATION_SPEED,
    'swing',  // animation easing
    function() {
      resolve();
    });
  });
};

// animates cards forward
DynamicList.prototype.animateAgendaForward = function(nextAgendaElement, nextAgendaElementWidth) {
  var _this = this;

  return new Promise(function(resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '+=' + nextAgendaElementWidth
    },
    _this.ANIMATION_SPEED,
    'swing',  // animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      nextAgendaElement.addClass('active');

      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;

      resolve();
    });
  });
};

// animates dates back
DynamicList.prototype.animateDateBack = function($prevDateElement, prevDateElementWidth) {
  var _this = this;

  return new Promise(function(resolve) {
    var $currentActiveDate = _this.$container.find('.agenda-date-selector li.active');

    $currentActiveDate.removeClass('active').find('.day').addBack().css('color', '#000');
    setTimeout(function() {
      $currentActiveDate.find('.day').addBack().css('color', '');

      $prevDateElement.addClass('active').find('.day').addBack().css('color', '#000');
      setTimeout(function() {
        $prevDateElement.find('.day').addBack().css('color', '');
      }, 0);
    }, 0);

    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '-=' + prevDateElementWidth
    },
    _this.ANIMATION_SPEED,
    'swing',  // animation easing
    function() {
      resolve();
    });
  });
};

// animate cards back
DynamicList.prototype.animateAgendaBack = function(prevAgendaElement, prevAgendaElementWidth) {
  var _this = this;

  return new Promise(function(resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '-=' + prevAgendaElementWidth
    },
    _this.ANIMATION_SPEED,
    'swing',  // animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      prevAgendaElement.addClass('active');

      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;
      resolve();
    });
  });
};

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
  ]).then(function() {
    _this.isPanning = false;
    _this.animatingForward = false;
  });
};

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
  ]).then(function() {
    _this.isPanning = false;
    _this.animatingBack = false;
  });
};

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
};

DynamicList.prototype.toggleBookmarkStatus = function(record) {
  if (!record) {
    return;
  }

  if (record.bookmarked) {
    this.$container
      .find('.agenda-cards-wrapper, .search-results-wrapper')
      .find('.agenda-item-bookmark-holder-' + record.id + ' .bookmark-wrapper.btn-bookmark')
      .removeClass('btn-bookmark').addClass('btn-bookmarked')
      .find('.fa-bookmark-o').removeClass('fa-bookmark-o').addClass('fa-bookmark');
  } else {
    this.$container
      .find('.agenda-cards-wrapper, .search-results-wrapper')
      .find('.agenda-item-bookmark-holder-' + record.id + ' .bookmark-wrapper.btn-bookmarked')
      .removeClass('btn-bookmarked').addClass('btn-bookmark')
      .find('.fa-bookmark').removeClass('fa-bookmark').addClass('fa-bookmark-o');
  }
};

DynamicList.prototype.getBookmarkIdentifier = function(record) {
  var uniqueId = this.Utils.Record.getUniqueId({
    record: record,
    config: this.data
  });
  var defaultIdentifier = {
    entryId: uniqueId + '-bookmark',
    pageId: Fliplet.Env.get('pageId')
  };
  var customIdentifier = Promise.resolve();

  if (typeof this.data.getBookmarkIdentifier === 'function') {
    customIdentifier = this.data.getBookmarkIdentifier({
      record: record,
      config: this.data,
      id: this.data.id,
      uuid: this.data.uuid,
      container: this.$container
    });

    if (!(customIdentifier instanceof Promise)) {
      customIdentifier = Promise.resolve(customIdentifier);
    }
  }

  return customIdentifier.then(function(identifier) {
    if (!identifier) {
      identifier = defaultIdentifier;
    }

    return identifier;
  });
};

// Functions to setup Fliplet Like
DynamicList.prototype.setupBookmarkButton = function(options) {
  if (!this.data.bookmarksEnabled) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var title = options.title;
  var target = options.target;
  var record = options.record || _.find(_this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  return _this.getBookmarkIdentifier(record)
    .then(function(identifier) {
      return new Promise(function(resolve) {
        var btn = LikeButton({
          target: target,
          dataSourceId: _this.data.bookmarkDataSourceId,
          view: 'userBookmarks',
          content: identifier,
          allowAnonymous: true,
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<span class="fa fa-bookmark-o"></span>',
          likedLabel: '<span class="fa fa-bookmark"></span>',
          likeWrapper: '<div class="bookmark-wrapper btn-bookmark focus-outline" tabindex="0"></div>',
          likedWrapper: '<div class="bookmark-wrapper btn-bookmarked focus-outline" tabindex="0"></div>',
          addType: 'prepend',
          getAllCounts: false,
          liked: record.bookmarked,
          silent: record.bookmarkButton
        });

        if (record.bookmarkButton) {
          resolve(btn);

          return;
        }

        record.bookmarkButton = btn;

        btn.on('like.status', function(liked) {
          record.bookmarked = liked;
          resolve(btn);
        });

        btn.on('liked', function() {
          record.bookmarked = btn.isLiked();
          _this.toggleBookmarkStatus(record);

          Fliplet.Hooks.run('flListDataEntryBookmark', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'entry_bookmark',
            label: title
          });
        });

        btn.on('liked.success', function() {
          Fliplet.Hooks.run('flListDataEntryBookmarkSuccess', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('liked.fail', function() {
          record.bookmarked = btn.isLiked();
          _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');
          _this.$container.find('.search-results-wrapper .agenda-item-bookmark-holder-' + id + ' .bookmark-wrapper').removeClass('btn-bookmarked').addClass('btn-bookmark');

          Fliplet.Hooks.run('flListDataEntryBookmarkFail', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('unliked', function() {
          record.bookmarked = btn.isLiked();
          _this.toggleBookmarkStatus(record);

          Fliplet.Hooks.run('flListDataEntryUnbookmark', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'entry_unbookmark',
            label: title
          });
        });

        btn.on('unliked.success', function() {
          Fliplet.Hooks.run('flListDataEntryUnbookmarkSuccess', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('unliked.fail', function() {
          record.bookmarked = btn.isLiked();
          _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');
          _this.$container.find('.search-results-wrapper .agenda-item-bookmark-holder-' + id + ' .bookmark-wrapper').removeClass('btn-bookmark').addClass('btn-bookmarked');

          Fliplet.Hooks.run('flListDataEntryUnbookmarkFail', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });
      });
    });
};

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
    title: title,
    record: record
  }).then(function(btn) {
    if (!btn) {
      return;
    }

    _this.$container.find('.agenda-detail-overlay .agenda-item-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(btn.isLiked() ? 'bookmarked' : 'not-bookmarked');
  });
};

DynamicList.prototype.toggleListView = function(view) {
  if (['loop', 'search-results'].indexOf(view) === -1) {
    view = this.isInLoopView() ? 'loop' : 'search-results';
  }

  if (view !== 'search-results') {
    // Empty search results
    this.emptySearchResults();
  }

  this.$container.attr('data-view', view);
};

DynamicList.prototype.emptySearchResults = function() {
  this.$container.find('.search-results-wrapper .search-results-holder').empty();
  this.filteredListItems = [];
};

DynamicList.prototype.getAgendasByDay = function() {
  return this.isInLoopView() ? this.agendasByDay : this.filteredAgendasByDay;
};

DynamicList.prototype.setAgendasByDay = function(agenda) {
  if (this.isInLoopView()) {
    this.agendasByDay = agenda;
  } else {
    this.filteredAgendasByDay = agenda;
  }
};

DynamicList.prototype.getListItems = function() {
  return this.isInLoopView() ? this.filteredListItemsByDay : this.filteredListItems;
};

DynamicList.prototype.isSameResult = function(data) {
  return data.length && !_.xorBy(data, this.getListItems(), 'id').length;
};

DynamicList.prototype.isSubsetResult = function(data) {
  return data.length && data.length === _.intersectionBy(data, this.getListItems(), 'id').length;
};

DynamicList.prototype.isInLoopView = function() {
  return !this.isFiltering && !this.isSearching && !this.showBookmarks && !this.$container.find('.list-search-icon .fa-sliders.active').length;
};

DynamicList.prototype.isInSearchResultsView = function() {
  return this.isFiltering || this.isSearching || this.showBookmarks || this.$container.find('.list-search-icon .fa-sliders.active').length;
};

DynamicList.prototype.removeFilteredEntries = function(data) {
  if (this.isInLoopView()) {
    // Search results is a subset of the current render.
    // Remove the extra records without re-render.
    var recordIdsToShow = _.map(data, 'id');
    var recordIdsToHide = _.difference(_.map(this.filteredListItemsByDay, 'id'), recordIdsToShow);

    // Hide and show content based on existing render
    this.$container.find('.agenda-cards-wrapper').find(_.map(recordIdsToShow, function(id) {
      return '.agenda-list-item[data-entry-id="' + id + '"]';
    }).join(',')).show();
    this.$container.find('.agenda-cards-wrapper').find(_.map(recordIdsToHide, function(id) {
      return '.agenda-list-item[data-entry-id="' + id + '"]';
    }).join(',')).hide();
  } else {
    this.$container.find('.search-results-list-day-holder').find(_.map(_.differenceBy(this.filteredListItems, data, 'id'), function(record) {
      return '.agenda-list-item[data-entry-id="' + record.id + '"]';
    }).join(',')).remove();
    this.$container.find('.search-results-list-day-holder').each(function() {
      if ($(this).find('.agenda-list-item').length) {
        return;
      }

      $(this).prev().remove(); // Remove date heading
      $(this).remove();
    });
  }
};

DynamicList.prototype.cacheSearchedData = function(data) {
  if (this.isInLoopView()) {
    this.filteredListItemsByDay = data;
  } else {
    this.filteredListItems = data;
  }
};

DynamicList.prototype.searchData = function(options) {
  if (typeof options === 'string') {
    options = {
      value: options
    };
  }

  options = options || {};

  var _this = this;
  var value = _.isUndefined(options.value) ? _this.searchValue : ('' + options.value).trim();
  var fields = options.fields || _this.data.searchFields;
  var openSingleEntry = options.openSingleEntry;
  var $inputField = _this.$container.find('.search-holder input');

  _this.searchValue = value;
  value = value.toLowerCase();
  _this.activeFilters = _this.Utils.Page.getActiveFilters({ $container: _this.$container });
  _this.isSearching = value !== '';
  _this.isFiltering = !_.isEmpty(_this.activeFilters);
  _this.showBookmarks = !!_this.$container.find('.toggle-agenda.mixitup-control-active, .toggle-bookmarks.mixitup-control-active').length;

  if (_this.isFiltering) {
    _this.$container.find('.new-agenda-list-container').addClass('is-filtering');
  } else {
    _this.$container.find('.new-agenda-list-container').removeClass('is-filtering');
  }

  if (_this.isSearching) {
    _this.$container.find('.new-agenda-list-container').addClass('is-searching');
  } else {
    _this.$container.find('.new-agenda-list-container').removeClass('is-searching');
  }

  _this.Utils.Page.updateSearchContext({
    activeFilters: _this.activeFilters,
    searchValue: _this.searchValue,
    filterControlsActive: !!_this.$container.find('.hidden-filter-controls.active').length,
    filterTypes: _this.filterTypes
  });

  return _this.Utils.Records.runSearch({
    value: value,
    records: _this.listItems,
    fields: fields,
    config: _this.data,
    filterTypes: _this.filterTypes,
    activeFilters: _this.activeFilters,
    showBookmarks: _this.showBookmarks
  }).then(function(results) {
    results = results || {};

    if (Array.isArray(results)) {
      results = {
        records: searchedData
      };
    }

    var searchedData = results.records;

    return Fliplet.Hooks.run('flListDataBeforeRenderList', {
      instance: _this,
      value: value,
      records: searchedData,
      config: _this.data,
      activeFilters: _this.activeFilters,
      showBookmarks: _this.showBookmarks
    }).then(function() {
      searchedData = searchedData || [];

      var truncated = results.truncated || (searchedData.length && searchedData.length < _this.listItems.length);

      if (openSingleEntry && searchedData.length === 1) {
        _this.showDetails(searchedData[0].id);
      }

      // Toggle between filtered list view and
      _this.toggleListView();

      /**
       * Update search UI
       **/
      $inputField.val('');
      $inputField.blur();
      _this.$container.find('.new-agenda-list-container').removeClass('searching');
      // Adds search query to HTML
      _this.$container.find('.current-query').html(_this.searchValue);
      // Search value is provided
      _this.$container.find('.hidden-search-controls')[value.length ? 'addClass' : 'removeClass']('has-query');
      _this.calculateSearchHeight(!value.length);
      _this.$container.find('.hidden-search-controls').addClass('active');
      _this.$container.find('.hidden-search-controls')[searchedData.length || truncated ? 'removeClass' : 'addClass']('no-results');

      if (!_this.data.forceRenderList && _this.isSameResult(searchedData)) {
        // Same results returned. Do nothing.
        return Promise.resolve();
      }

      if (!_this.data.forceRenderList && _this.isSubsetResult(searchedData)) {
        _this.removeFilteredEntries(searchedData);
        _this.cacheSearchedData(searchedData);

        return Promise.resolve();
      }

      /**
       * Render results
       **/

      _this.modifiedListItems = _this.addSummaryData(searchedData);
      _this.setAgendasByDay(_this.groupLoopDataByDate(_this.modifiedListItems, _this.dateFieldLocation));

      // Render the full list
      return _this.renderLoopHTML().then(function(records) {
        _this.cacheSearchedData(searchedData);

        if (_this.isInLoopView()) {
          if (options.goToToday) {
            _this.goToToday();
          } else {
            _this.sliderGoTo($('.agenda-date-selector li.active').index() - $('.agenda-date-selector li:not(.placeholder)').index());
          }
        }

        return records;
      });
    }).then(function(renderedRecords) {
      _this.initializeSocials(renderedRecords).then(function() {
        return Fliplet.Hooks.run('flListDataAfterRenderListSocial', {
          instance: _this,
          view: _this.$container.attr('data-view'),
          value: value,
          records: _this.getListItems(),
          config: _this.data,
          activeFilters: _this.activeFilters,
          showBookmarks: _this.showBookmarks,
          id: _this.data.id,
          uuid: _this.data.uuid,
          container: _this.$container,
          initialRender: !!options.initialRender
        });
      });

      // Update selected highlight size in Edit
      Fliplet.Widget.updateHighlightDimensions(_this.data.id);

      _this.Utils.Page.updateActiveFilters({
        $container: _this.$container,
        filterOverlayClass: '.new-agenda-search-filter-overlay',
        filtersInOverlay: _this.data.filtersInOverlay,
        filterTypes: _this.filterTypes
      });

      return Fliplet.Hooks.run('flListDataAfterRenderList', {
        instance: _this,
        view: _this.$container.attr('data-view'),
        value: value,
        records: _this.getListItems(),
        config: _this.data,
        activeFilters: _this.activeFilters,
        showBookmarks: _this.showBookmarks,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        initialRender: !!options.initialRender
      });
    });
  });
};

DynamicList.prototype.bindTouchEvents = function() {
  var _this = this;
  var handle = document.getElementById('agenda-cards-wrapper-' + _this.data.id);

  _this.hammer = _this.hammer || new Hammer(handle, {
    inputClass: Hammer.TouchInput,
    touchAction: 'pan-y'
  });

  _this.hammer.on('panright panleft', function(e) {
    if (!_this.isPanningHorizontal(e)) {
      return;
    }

    _this.isPanning = true;
    _this.sliderCount = _this.$container.find('.agenda-list-day-holder').length;
    _this.activeSlideIndex = _this.$container.find('.agenda-list-day-holder').index(_this.$container.find('.agenda-list-day-holder.active'));
    _this.$container.find('.agenda-date-selector, .agenda-date-selector ul').addClass('is-panning');
    _this.scrollValue = -1 * e.deltaX;
    _this.$container.find('.agenda-cards-wrapper').scrollLeft(_this.copyOfScrollValue + _this.scrollValue);
  });

  _this.hammer.on('panend', function(e) {
    _this.$container.find('.agenda-date-selector, .agenda-date-selector ul').removeClass('is-panning');

    if (!_this.isPanningHorizontal(e)) {
      return;
    }

    if ( _this.scrollValue > 0 ) {
      _this.sliderGoTo( _this.activeSlideIndex + 1 );
    } else if ( _this.scrollValue < 0 ) {
      _this.sliderGoTo( _this.activeSlideIndex - 1 );
    }
  });
};

DynamicList.prototype.isPanningHorizontal = function(e) {
  return Math.abs(e.deltaX) > Math.abs(e.deltaY);
};

DynamicList.prototype.getDateIndex = function(date) {
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

DynamicList.prototype.goToToday = function() {
  var dateIndex = parseInt(Fliplet.Navigate.query.dateIndex, 10);

  if (dateIndex) {
    this.sliderGoTo(dateIndex);

    return;
  }

  this.goToDate(moment().format('YYYY-MM-DD'), false);
};

DynamicList.prototype.goToDate = function(date) {
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
  if (!this.isInLoopView()) {
    console.info('Date selector is not currently in use');

    return;
  }

  var _this = this;

  // Stop it from doing weird things like moving to slides that don’t exist
  if ( number < 0 ) {
    _this.activeSlideIndex = 0;
  } else if ( number > _this.sliderCount - 1 ) {
    _this.activeSlideIndex = _this.sliderCount - 1;
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
};

DynamicList.prototype.addDetailViewData = function(entry) {
  var _this = this;

  if (_.isArray(entry.entryDetails) && entry.entryDetails.length) {
    _this.Utils.Record.assignImageContent(_this, entry);

    return entry;
  }

  var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return !option.editable;
  });
  var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return option.editable;
  });

  entry.entryDetails = [];

  // Uses detail view settings not set by users
  notDynamicData.forEach(function(obj) {
    if (entry[obj.location]) {
      return;
    }

    var content = '';

    if (obj.column === 'custom') {
      content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.originalData));
    } else {
      content = entry.originalData[obj.column];
    }

    entry[obj.location] = content;
  });

  // Uses detail view settings set by users
  dynamicData.forEach(function(dynamicDataObj) {
    var label = '';
    var labelEnabled = true;
    var content = '';

    if (dynamicDataObj.type === 'file') {
      return;
    }

    // Define label
    if (dynamicDataObj.fieldLabel === 'column-name' && dynamicDataObj.column !== 'custom') {
      label = dynamicDataObj.column;
    }

    if (dynamicDataObj.fieldLabel === 'custom-label') {
      label = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customFieldLabel)(entry.originalData));
    }

    if (dynamicDataObj.fieldLabel === 'no-label') {
      labelEnabled = false;
    }

    // Define content
    if (dynamicDataObj.customFieldEnabled) {
      content = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customField)(entry.originalData));
    } else {
      content = entry.originalData[dynamicDataObj.column];
    }

    if (dynamicDataObj.type === 'image') {
      var imagesContentData = _this.Utils.Record.getImageContent(entry.originalData[dynamicDataObj.column]);
      var contentArray = imagesContentData.imagesArray;

      content = imagesContentData.imageContent;
      _this.imagesData[dynamicDataObj.id] = imagesContentData.imagesData;
    } else {
      content = _this.Utils.String.toFormattedString(content);
    }

    // Define data object
    var newEntryDetail = {
      id: entry.id,
      content: content,
      label: label,
      labelEnabled: labelEnabled,
      type: dynamicDataObj.type
    };

    if (contentArray) {
      newEntryDetail.contentArray = contentArray;
    }

    entry.entryDetails.push(newEntryDetail);
  });

  if (_this.data.detailViewAutoUpdate) {
    var savedColumns = _.map(dynamicData, 'column');
    var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);

    _.forEach(extraColumns, function(column) {
      var newColumnData = {
        id: entry.id,
        content: entry.originalData[column],
        label: column,
        labelEnabled: true,
        type: 'text'
      };

      entry.entryDetails.push(newColumnData);
    });
  }

  return entry;
};

DynamicList.prototype.showDetails = function(id, listData) {
  // Function that loads the selected entry data into an overlay for more details
  var _this = this;
  var entryData = _.find(listData, { id: id }) || _(_this.getAgendasByDay())
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

  return _this.Utils.Records.getFilesInfo({
    entryData: entryData,
    detailViewOptions: _this.data.detailViewOptions
  })
    .then(function(files) {
      entryData = _this.addDetailViewData(entryData);

      if (files && Array.isArray(files)) {
        _.forEach(files, function(file) {
          if (!file) {
            return;
          }

          var isFileAdded = !!_.find(entryData.entryDetails, { id: file.id });

          if (!isFileAdded) {
            entryData.entryDetails.push(file);
          }
        });
      }

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

      return beforeShowDetails.then(function(data) {
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
    });
};

DynamicList.prototype.closeDetails = function() {
  if (this.openedEntryOnQuery && Fliplet.Navigate.query.dynamicListPreviousScreen === 'true') {
    Fliplet.Page.Context.remove('dynamicListPreviousScreen');

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
  if (_this.data.bookmarksEnabled) {
    _this.bookmarkButtonOverlay = undefined;
  }

  setTimeout(function() {
    $overlay.removeClass('ready');
    // Clears overlay
    $overlay.find('.agenda-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');

    _this.$container.find('.new-agenda-list-container, .dynamic-list-add-item').removeClass('hidden');
  }, 300);
};
