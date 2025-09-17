/**
 * Dynamic List constructor for news-feed layout
 * Initializes a news feed component with social features like comments and bookmarks
 * 
 * @constructor
 * @param {string} id - The unique identifier for the dynamic list instance
 * @param {Object} data - Configuration data for the dynamic list
 * @param {string} data.layout - Layout type ('news-feed')
 * @param {Object} data.social - Social features configuration
 * @param {boolean} data.social.bookmark - Whether bookmarking is enabled
 * @param {boolean} data.social.comments - Whether comments are enabled
 * @param {Array} data.filterFields - Fields available for filtering
 * @param {Array} data.searchFields - Fields available for searching
 * @param {Object} data.advancedSettings - Advanced HTML template settings
 */
// Constructor
function DynamicList(id, data) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'news-feed': {
      'base': 'templates.build.news-feed-base',
      'loop': 'templates.build.news-feed-loop',
      'detail': 'templates.build.news-feed-detail',
      'filter': 'templates.build.news-feed-filters',
      'comments': 'templates.build.news-feed-comment',
      'single-comment': 'templates.build.news-feed-single-comment',
      'temp-comment': 'templates.build.news-feed-temp-comment'
    }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.data.computedFields = this.data.computedFields || {};
  this.data.forceRenderList = false;
  this.data.apiFiltersAvailable = true;
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.$overlay;

  // Other variables
  // Global variables
  this.allowClick = true;
  this.autosizeInit = false;

  this.listItems;
  this.modifiedListItems;
  this.renderListItems = [];
  this.searchedListItems = [];
  this.dataSourceColumns;
  this.allUsers;
  this.usersToMention;
  this.myUserData = {};
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> ' + T('widgets.list.dynamic.loading') + '</div>';
  this.entryClicked = undefined;
  this.isFiltering;
  this.isSearching;
  this.showBookmarks;
  this.fetchedAllBookmarks = false;
  this.searchValue = '';
  this.activeFilters = {};

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
  this.openedEntryOnQuery = false;
  this.sortOrder = 'none';
  this.sortField = null;
  this.imagesData = {};
  this.$closeButton = null;
  this.$detailsContent = null;

  /**
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

  this.data.bookmarksEnabled = _this.data.social.bookmark;

  this.data.searchIconsEnabled = this.data.filtersEnabled || this.data.bookmarksEnabled || this.data.sortEnabled;

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

  // Register handlebars helpers
  this.Utils.registerHandlebarsHelpers();

  // Get the current session data
  Fliplet.User.getCachedSession().then(function(session) {
    if (NativeUtils.get(session, 'entries.saml2.user')) {
      _this.myUserData = NativeUtils.get(session, 'entries.saml2.user');
      _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
      _this.myUserData.isSaml2 = true;
    }

    if (NativeUtils.get(session, 'entries.dataSource.data')) {
      NativeUtils.extend(_this.myUserData, NativeUtils.get(session, 'entries.dataSource.data'));
    }

    // Start running the Public functions
    _this.initialize();
  });
}

DynamicList.prototype.Utils = Fliplet.Registry.get('dynamicListUtils');

/**
 * Toggles the active state of a filter element
 * Handles both individual filters and range filters (date/number)
 * 
 * @param {HTMLElement|string} target - The filter element or selector to toggle
 * @param {boolean} [toggle] - Optional explicit toggle state. If undefined, toggles current state
 */
DynamicList.prototype.toggleFilterElement = function(target, toggle) {
  var $target = this.Utils.DOM.$(target);
  var filterType = $target.data('type');

  // Range filters are targeted at the same time
  if (['date', 'number'].indexOf(filterType) > -1) {
    $target = $target.closest('[data-filter-group]').find('.hidden-filter-controls-filter');
  }

  if (typeof toggle === 'undefined') {
    $target.toggleClass('mixitup-control-active');
  } else {
    $target[!!toggle ? 'addClass' : 'removeClass']('mixitup-control-active');
  }

  if (['date', 'number'].indexOf(filterType) > -1) {
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

/**
 * Hides the filter overlay and restores normal page state
 * Removes overlay classes and unlocks body scroll for news feed layout
 */
DynamicList.prototype.hideFilterOverlay = function() {
  this.$container.find('.news-feed-search-filter-overlay').removeClass('display');
  this.$container.find('.section-top-wrapper, .news-feed-list-wrapper, .dynamic-list-add-item').removeClass('hidden');
  this.$container.find('.new-news-feed-list-container').removeClass('overlay-active');
  $('body').removeClass('lock has-filter-overlay');
};

/**
 * Attaches all event listeners and observers for the news feed
 * Sets up handlers for user interactions, filtering, searching, comments, and navigation
 */
DynamicList.prototype.attachObservers = function() {
  var _this = this;

  // Attach your event listeners here
  Fliplet.Hooks.on('beforePageView', function(options) {
    if (options.addToHistory === false) {
      _this.closeDetails();
    }
  });

  $(window).resize(NativeUtils.debounce(function() {
    _this.Utils.DOM.adjustAddButtonPosition(_this);

    if ($(window).width() < 640) {
      _this.addContentIndent();
    }
  }, 500));

  Fliplet.Hooks.on('flListDataAfterRenderList', function() {
    _this.Utils.DOM.adjustAddButtonPosition(_this);
  });

  _this.$container
    .on('show.bs.dropdown', function(event) {
      var $element = $(event.target);

      $element.parents('[data-collapse-id]').css('overflow', 'visible');
      $element.parents('.panel-group').css({
        'z-index': 1000,
        position: 'relative'
      });
    })
    .on('hide.bs.dropdown', function(event) {
      var $element = $(event.target);

      $element.parents('[data-collapse-id]').css('overflow', 'hidden');
      $element.parents('.panel-group').css({
        'z-index': 'auto',
        position: 'static'
      });
    })
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

      return result.then(function() {
        return Fliplet.Navigate.back();
      }).catch(function(error) {
        console.error(error);
      });
    })
    .on('keydown', '.fa-sort-amount-desc', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(event.currentTarget).dropdown('toggle');
    })
    .on('click keydown', '.sort-group .list-sort li', function(e) {
      if (!_this.Utils.accessibilityHelpers.isExecute(e)) {
        return;
      }

      e.stopPropagation();

      var $sortListItem = $(e.currentTarget);
      var $sortList = _this.$container.find('.list-sort li');
      var currentSortOrder = $sortListItem.attr('data-sort-order');

      switch (currentSortOrder) {
        case 'asc':
          _this.sortOrder = 'desc';
          break;
        case 'desc':
          _this.sortOrder = 'none';
          break;
        default:
          _this.sortOrder = 'asc';
          break;
      }

      _this.sortField = $sortListItem.data('sortField');
      _this.Utils.DOM.resetSortIcons({ $sortList: $sortList });

      $sortListItem.attr('data-sort-order', _this.sortOrder);

      _this.searchData();
    })
    .on('click keydown', '.apply-filters', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.section-top-wrapper, .news-feed-list-wrapper, .dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.fa-sliders').focus();

      var $selectedFilters = _this.$container.find('.hidden-filter-controls-filter.mixitup-control-active');

      if ($selectedFilters.length) {
        _this.$container.find('.hidden-filter-controls-filter-container').removeClass('hidden');
      }

      _this.hideFilterOverlay();
      _this.searchData();
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

      // Range filters change events are handled differently
      if (['date', 'number'].indexOf($filter.data('type')) > -1) {
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
    .on('click keydown', '.filter-range-reset', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $filterGroup = $(this).closest('[data-filter-group]');
      var $filters = $filterGroup.find('.hidden-filter-controls-filter');
      var type = $filterGroup.data('type');
      var inputDataNames = {
        date: 'flDatePicker',
        number: 'flNumberInput'
      };

      $filters.each(function() {
        var $filter = $(this);

        $filter.data(inputDataNames[type]).set($filter.data('default'), false);
      });

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: 'RESET_' + type.toUpperCase() + 'S'
      });

      _this.toggleFilterElement($filters, false);

      if ($filters.parents('.inline-filter-holder').length) {
        // @HACK Skip an execution loop to allow custom handlers to update the filters
        setTimeout(function() {
          _this.searchData();
        }, 0);
      }
    })
    .on('touchstart', '.news-feed-list-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.news-feed-list-item', function() {
      _this.allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.news-feed-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        _this.allowClick = true;
      }, 100);
    })
    .on('click keydown', '.news-feed-list-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $el = $(event.target);

      if ($el.hasClass('news-feed-info-holder') || $el.parents('.news-feed-info-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.news-feed-item-title').text().trim();
      var beforeOpen = Promise.resolve();

      if (typeof _this.data.beforeOpen === 'function') {
        beforeOpen = _this.data.beforeOpen({
          config: _this.data,
          entry: _this.listItems.find(function(item) { return item.id === entryId; }),
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

        // find the element to expand and expand it
        if (_this.allowClick) {
          _this.$container.find('.dynamic-list-add-item').addClass('hidden');

          _this.showDetails(entryId);
          Fliplet.Page.Context.update({
            dynamicListOpenId: entryId
          });
        }
      });
    })
    .on('focusout', '.news-feed-detail-overlay', function(event) {
      // Overlay is not open. Do nothing.
      if (!_this.$container.find('.new-news-feed-list-container').hasClass('overlay-open')) {
        return;
      }

      var focusTarget = event.relatedTarget || event.target;
      var focusingOnDetails = _this.$detailsContent.get(0).contains(focusTarget);
      var commentContainer = _this.$container.find('.new-news-feed-comment-panel').get(0);
      var focusingOnComments = commentContainer && commentContainer.contains(focusTarget);

      // Focus is moved to valid element. Do nothing.
      if (focusingOnDetails || focusingOnComments) {
        return;
      }

      // Move focus back to close button
      $(_this.$closeButton).focus();
    })
    .on('click keydown', '.news-feed-detail-overlay-close, .news-feed-detail-overlay-screen', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var result;

      _this.$container.find('.dynamic-list-add-item').removeClass('hidden');

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

        return result.then(function() {
          return Fliplet.Navigate.back();
        }).catch(function(error) {
          console.error(error);
        });
      }

      _this.closeDetails({ focusOnEntry: event.type === 'keydown' });
    })
    .on('click keydown', '.list-search-icon .fa-sliders', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-news-feed-list-container');

      Fliplet.Page.Context.remove('dynamicListFilterHideControls');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.news-feed-search-filter-overlay').addClass('display');
        _this.$container.find('.section-top-wrapper, .news-feed-list-wrapper, .dynamic-list-add-item').addClass('hidden');
        _this.$container.find('.news-feed-search-filter-overlay .news-feed-overlay-close').focus();
        _this.$container.find('.new-news-feed-list-container').addClass('overlay-active');
        $('body').addClass('lock has-filter-overlay');

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search_filter_controls_overlay_activate'
        });

        return;
      }

      $parentElement.find('.hidden-filter-controls').addClass('active');
      $parentElement.find('.list-search-cancel').addClass('active').focus();
      $parentElement.find('.hidden-filter-controls-filter-container').removeClass('hidden');
      $elementClicked.addClass('active');

      _this.calculateFiltersHeight();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search_filter_controls_activate'
      });
    })
    .on('click keydown', '.news-feed-overlay-close', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.news-feed-search-filter-overlay');

      $parentElement.removeClass('display');
      _this.$container.find('.section-top-wrapper, .news-feed-list-wrapper, .dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.list-search-icon .fa-sliders').focus();
      _this.$container.find('.new-news-feed-list-container').removeClass('overlay-active');
      $('body').removeClass('lock has-filter-overlay');

      // Clear all selected filters
      _this.toggleFilterElement(_this.$container.find('.mixitup-control-active:not(.toggle-bookmarks)'), false);

      // No filters selected
      if (NativeUtils.isEmpty(_this.activeFilters)) {
        _this.$container.find('.clear-filters').addClass('hidden');

        return;
      }

      if (!NativeUtils.has(_this.activeFilters, 'undefined')) {
        // Select filters based on existing settings
        var selectors = Object.keys(_this.activeFilters).map(function(field) {
          var values = _this.activeFilters[field];
          return values.map(function(value) {
            return '.hidden-filter-controls-filter[data-field="' + field + '"][data-value="' + value + '"]';
          });
        }).reduce(function(acc, val) { return acc.concat(val); }, []).join(',');

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
      _this.$container.find('.hidden-filter-controls').removeClass('active');
      _this.$container.find('.list-search-icon .fa-sliders').removeClass('active').focus();
      _this.$container.find('.hidden-filter-controls-filter-container').addClass('hidden');
      _this.$container.find('.hidden-filter-controls').animate({ height: 0 }, 200);

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
            _this.$container.find('.new-news-feed-list-container').removeClass('searching');
            _this.isSearching = false;
            _this.searchData('');

            return;
          }

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'search',
            label: value
          });

          _this.$container.find('.new-news-feed-list-container').addClass('searching');
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
        _this.$container.find('.new-news-feed-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.searchData('');

        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search',
        label: value
      });

      _this.$container.find('.new-news-feed-list-container').addClass('searching');
      _this.isSearching = true;
      _this.searchData(value);
    })
    .on('click keydown', '.clear-search', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.new-news-feed-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.searchData('');
    })
    .on('show.bs.collapse', '.news-feed-filters-panel .panel-collapse', function(event) {
      event.stopPropagation();
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.news-feed-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
    })
    .on('click keydown', '.news-feed-filters-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(event.target).find('.collapse').collapse('toggle');
    })
    .on('click keydown', '.news-feed-comment-holder', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      event.stopPropagation();

      var identifier;

      if (_this.$container.find('.new-news-feed-list-container').hasClass('overlay-open')) {
        identifier = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      } else {
        identifier = $(this).parents('.news-feed-list-item').data('entry-id');
      }

      _this.entryClicked = identifier;
      _this.showComments(identifier);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click keydown', '.news-feed-comment-close-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.new-news-feed-comment-panel').removeClass('open');
      _this.$container.find('.news-feed-list-item.open .slide-over').removeClass('lock');
      _this.$container.find('.news-feed-comment-holder').focus();

      var contextsToRemove = ['dynamicListOpenComments', 'dynamicListCommentId'];

      if (!_this.$container.find('.news-feed-detail-overlay').hasClass('open')) {
        $('body').removeClass('lock');
        contextsToRemove.push('dynamicListOpenId');
      }

      Fliplet.Page.Context.remove(contextsToRemove);
    })
    .on('click keydown', '.news-feed-comment-input-holder .comment', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var entryId = _this.$container.find('.news-feed-details-content-holder').data('entry-id') || _this.entryClicked;
      var $commentArea = $(this).parents('.news-feed-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val().trim();

      $commentArea.val('').trigger('change');
      autosize.update($commentArea);

      if (comment) {
        _this.sendComment(entryId, comment);
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comment_send'
      });
    })
    .on('focus', '[data-comment-body]', function() {
      var _that = $(this);

      if (Modernizr.ios) {
        setTimeout(function() {
          _that.parents('.new-news-feed-comment-panel').addClass('typing');

          // Adds binding
          $(document).on('touchstart', '[data-comment-body]', function() {
            $(this).focus();
          });
        }, 0);
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comment_entered'
      });
    })
    .on('blur', '[data-comment-body]', function() {
      var _that = $(this);

      if (Modernizr.ios) {
        setTimeout(function() {
          _that.parents('.new-news-feed-comment-panel').removeClass('typing');
          window.scrollTo(0, 0);

          // Removes binding
          $(document).off('touchstart', '[data-comment-body]');
        }, 0);
      }
    })
    .on('keyup change', '[data-comment-body]', function() {
      var value = $(this).val().trim();

      if (value.length) {
        $(this).parents('.news-feed-comment-input-holder').addClass('ready');
      } else {
        $(this).parents('.news-feed-comment-input-holder').removeClass('ready');
      }
    })
    .on('click', '.news-feed-comment-input-holder .save', function() {
      var commentId = _this.$container.find('.fl-individual-comment.editing').data('id');
      var entryId = _this.$container.find('.news-feed-details-content-holder').data('entry-id') || _this.entryClicked;
      var $commentArea = $(this).parents('.news-feed-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val();

      _this.$container.find('.fl-individual-comment').removeClass('editing');
      _this.$container.find('.news-feed-comment-input-holder').removeClass('editing');
      $commentArea.val('').trigger('change');
      autosize.update($commentArea);

      if (comment !== '') {
        _this.saveComment(entryId, commentId, comment);
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comment_save_edit'
      });
    })
    .on('click', '.news-feed-comment-input-holder .cancel', function() {
      _this.$container.find('.fl-individual-comment').removeClass('editing');
      _this.$container.find('.news-feed-comment-input-holder').removeClass('editing');

      var $messageArea = _this.$container.find('[data-comment-body]');

      $messageArea.val('').trigger('change');
      autosize.update($messageArea);
    })
    .on('click', '.final .fl-comment-value', function(event) {
      event.preventDefault();

      var _that = $(this);
      var commentId = $(this).parents('.fl-individual-comment').data('id');
      var $parentContainer = $(this).parents('.fl-individual-comment');
      var textToCopy = $(this).text().trim();

      if ($parentContainer.hasClass('current-user')) {
        Fliplet.UI.Actions({
          title: T('widgets.list.dynamic.notifications.actionRequest.title'),
          labels: [
            {
              label: T('widgets.list.dynamic.notifications.actionRequest.copy'),
              action: {
                type: 'copyText',
                text: textToCopy
              }
            },
            {
              label: T('widgets.list.dynamic.notifications.actionRequest.edit'),
              action: function() {
                var $messageArea = _this.$container.find('[data-comment-body]');

                _that.parents('.fl-individual-comment').addClass('editing');
                _this.$container.find('.news-feed-comment-input-holder').addClass('editing');

                $messageArea.val(textToCopy);
                autosize.update($messageArea);
                $messageArea.focus();
                $messageArea.trigger('change');

                Fliplet.Analytics.trackEvent({
                  category: 'list_dynamic_' + _this.data.layout,
                  action: 'comment_edit'
                });
              }
            },
            {
              label: T('widgets.list.dynamic.notifications.actionRequest.delete'),
              action: function() {
                var options = {
                  title: T('widgets.list.dynamic.notifications.actionRequest.confirmDelete.title'),
                  message: T('widgets.list.dynamic.notifications.actionRequest.confirmDelete.message'),
                  labels: [
                    {
                      label: T('widgets.list.dynamic.notifications.actionRequest.delete'),
                      action: function() {
                        Fliplet.Analytics.trackEvent({
                          category: 'list_dynamic_' + _this.data.layout,
                          action: 'comment_delete'
                        });

                        _this.deleteComment(commentId);
                      }
                    }
                  ]
                };

                Fliplet.UI.Actions(options);
              }
            }
          ],
          cancel: T('widgets.list.dynamic.notifications.actionRequest.cancel')
        }).then(function(i) {
          if (i === 0) {
            Fliplet.Analytics.trackEvent({
              category: 'list_dynamic_' + _this.data.layout,
              action: 'comment_copy'
            });
          }
        });
      } else {
        Fliplet.UI.Actions({
          title: T('widgets.list.dynamic.notifications.actionRequest.title'),
          labels: [
            {
              label: T('widgets.list.dynamic.notifications.actionRequest.copy'),
              action: {
                type: 'copyText',
                text: textToCopy
              }
            }
          ],
          cancel: T('widgets.list.dynamic.notifications.actionRequest.cancel')
        }).then(function(i) {
          if (i === 0) {
            Fliplet.Analytics.trackEvent({
              category: 'list_dynamic_' + _this.data.layout,
              action: 'comment_copy'
            });
          }
        });
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comment_options'
      });
    })
    .on('click keydown', '.dynamic-list-add-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      if (!_this.data.addEntryLinkAction) {
        return;
      }

      if (!NativeUtils.get(_this, 'data.addEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: T('widgets.list.dynamic.notifications.noConfiguration.title'),
          message: T('widgets.list.dynamic.notifications.noConfiguration.message')
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
                message: T('widgets.list.dynamic.errors.addFailed')
              });
            });
        }
      } catch (error) {
        Fliplet.UI.Toast(error, {
          message: T('widgets.list.dynamic.errors.addFailed')
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

      if (!NativeUtils.get(_this, 'data.editEntryLinkAction.page')) {
        Fliplet.UI.Toast({
          title: T('widgets.list.dynamic.notifications.noConfiguration.title'),
          message: T('widgets.list.dynamic.notifications.noConfiguration.message')
        });

        return;
      }

      var entryID = $(this).parents('.news-feed-details-content-holder').data('entry-id');

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
                message: T('widgets.list.dynamic.errors.editFailed')
              });
            });
        }
      } catch (error) {
        Fliplet.UI.Toast(error, {
          message: T('widgets.list.dynamic.errors.editFailed')
        });
      }
    })
    .on('click keydown', '.dynamic-list-delete-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var _that = $(this);
      var entryID = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      var options = {
        title: T('widgets.list.dynamic.notifications.confirmDelete.title'),
        labels: [
          {
            label: T('widgets.list.dynamic.notifications.confirmDelete.label'),
            action: function() {
              _that.text(T('widgets.list.dynamic.notifications.confirmDelete.progress')).addClass('disabled');

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
                  NativeUtils.remove(_this.listItems, function(entry) {
                    return entry.id === parseInt(entryId, 10);
                  });

                  _that.text(T('widgets.list.dynamic.notifications.confirmDelete.action')).removeClass('disabled');
                  _this.closeDetails({ focusOnEntry: event.type === 'keydown' });
                  _this.removeListItemHTML({
                    id: entryId
                  });
                })
                .catch(function(error) {
                  Fliplet.UI.Toast.error(error, {
                    message: T('widgets.list.dynamic.errors.deleteFailed')
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
    .on('click keydown', '.toggle-bookmarks', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $toggle = $(this);

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();
    })
    .on('click keydown', '.news-feed-detail-overlay .news-feed-bookmark-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var id = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      var record = _this.listItems.find(function(item) { return item.id === id; });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $(this).parents('.news-feed-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked').focus();
        record.bookmarkButton.unlike();

        return;
      }

      $(this).parents('.news-feed-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked').focus();
      record.bookmarkButton.like();
    })
    .on('click keydown', '.news-feed-detail-overlay .news-feed-like-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var id = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      var record = _this.listItems.find(function(item) { return item.id === id; });

      if (!record || !record.likeButton) {
        return;
      }

      var count = record.likeButton.getCount();

      if (count < 1) {
        count = '';
      }

      if (record.liked) {
        $(this).parents('.news-feed-like-holder').removeClass('liked').addClass('not-liked');
        record.likeButton.unlike();
        $(this).find('.count').html(count);

        return;
      }

      $(this).parents('.news-feed-like-holder').removeClass('not-liked').addClass('liked');
      record.likeButton.like();
      $(this).find('.count').html(count);
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

/**
 * Deletes an entry from the data source
 * 
 * @param {string|number} entryID - The ID of the entry to delete
 * @returns {Promise<string|number>} Promise resolving to the deleted entry ID
 */
DynamicList.prototype.deleteEntry = function(entryID) {
  var _this = this;

  return Fliplet.DataSources.connect(_this.data.dataSourceId).then(function(connection) {
    return connection.removeById(entryID, { ack: true });
  }).then(function() {
    return Promise.resolve(entryID);
  });
};

/**
 * Removes an entry's HTML element from the DOM
 * 
 * @param {Object} options - Options object
 * @param {string|number} options.id - The ID of the entry to remove from DOM
 */
DynamicList.prototype.removeListItemHTML = function(options) {
  options = options || {};

  var id = options.id;

  if (!id) {
    return;
  }

  this.$container.find('.news-feed-list-item[data-entry-id="' + id + '"]').remove();
};

DynamicList.prototype.initializeOverlaySocials = function(id) {
  var _this = this;
  var record = _this.listItems.find(function(item) { return item.id === id; });

  if (!record) {
    return Promise.resolve();
  }

  var title = _this.$container.find('.news-feed-detail-overlay .news-feed-details-content-holder[data-entry-id="' + id + '"] .news-feed-item-title').text().trim();
  var bookmarkPromise = Promise.resolve();
  var likePromise = Promise.resolve();

  if (record.bookmarkButton) {
    _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(record.bookmarkButton.isLiked() ? 'bookmarked' : 'not-bookmarked');
  } else {
    bookmarkPromise = _this.setupBookmarkButton({
      id: id,
      title: title,
      record: record
    }).then(function(btn) {
      if (!btn) {
        return;
      }

      _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(btn.isLiked() ? 'bookmarked' : 'not-bookmarked');
    });
  }

  var count;

  if (record.likeButton) {
    count = record.likeButton.getCount() > 0 ? record.likeButton.getCount() : '';
    _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);
    _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('liked not-liked').addClass(record.likeButton.isLiked() ? 'liked' : 'not-liked');
  } else {
    likePromise = _this.setupLikeButton({
      id: id,
      title: title,
      record: record
    }).then(function(btn) {
      if (!btn) {
        return;
      }

      count = btn.getCount() > 0 ? btn.getCount() : '';
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('liked not-liked').addClass(btn.isLiked() ? 'liked' : 'not-liked');
    });
  }

  return Promise.all([
    bookmarkPromise,
    likePromise,
    _this.getEntryComments({
      id: record.id,
      record: record
    })
  ]);
};

DynamicList.prototype.getAllBookmarks = function() {
  var _this = this;

  if (_this.fetchedAllBookmarks || !NativeUtils.get(_this.data, 'social.bookmark') || !_this.data.bookmarkDataSourceId) {
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
    var bookmarkedIds = NativeUtils.compact(results.data.map(function(record) {
      var match = NativeUtils.get(record, 'data.content.entryId', '').match(/(\d*)-bookmark/);

      return match ? parseInt(match[1], 10) : '';
    }));

    if (results.fromCache) {
      _this.listItems.forEach(function(record) {
        if (bookmarkedIds.indexOf(record.id) === -1) {
          return;
        }

        record.bookmarked = true;
      });
    } else {
      _this.listItems.forEach(function(record) {
        record.bookmarked = bookmarkedIds.indexOf(record.id) > -1;
      });
    }

    _this.fetchedAllBookmarks = true;
  });
};

/**
 * Initializes social features (bookmarks, comments) for rendered records
 * Sets up bookmark buttons, comment functionality, and social interaction handlers
 * 
 * @param {Array<Object>} records - Array of records to initialize social features for
 * @returns {Promise} Promise that resolves when all social features are initialized
 */
DynamicList.prototype.initializeSocials = function(records) {
  var _this = this;

  return _this.getAllBookmarks().then(function() {
    return Promise.all(records.map(function(record) {
      var title = _this.$container.find('.news-feed-list-item[data-entry-id="' + record.id + '"] .news-feed-item-title').text().trim();
      var masterRecord = _this.listItems.find(function(item) { return item.id === record.id; });

      return [
        _this.setupLikeButton({
          target: '.new-news-feed-list-container .news-feed-like-holder-' + record.id,
          id: record.id,
          title: title,
          record: masterRecord
        }),
        _this.setupBookmarkButton({
          target: '.new-news-feed-list-container .news-feed-bookmark-holder-' + record.id,
          id: record.id,
          title: title,
          record: masterRecord
        }),
        _this.getEntryComments({
          id: record.id,
          record: masterRecord
        })
      ];
    }).reduce(function(acc, val) { return acc.concat(val); }, []));
  });
};

/**
 * Retrieves and caches user data for comment functionality
 * Loads all users from the data source for user mentions and comments
 * 
 * @returns {Promise<Array<Object>>} Promise resolving to array of user data
 */
DynamicList.prototype.getCommentUsers = function() {
  if (!NativeUtils.get(this.data, 'social.comments')) {
    return Promise.resolve();
  }

  if (this.usersToMention) {
    return Promise.resolve(this.usersToMention);
  }

  var _this = this;

  // Get users info for comments
  return _this.connectToUsersDataSource()
    .then(function(users) {
      return _this.Utils.Records.updateFiles({
        records: users,
        config: _this.data,
        forComments: true
      });
    })
    .then(function(users) {
      _this.allUsers = users;

      // Update my user data
      if (!NativeUtils.isEmpty(_this.myUserData)) {
        var myUser = _this.allUsers.find(function(user) {
          return _this.myUserData[_this.data.userEmailColumn] === user.data[_this.data.userEmailColumn];
        });

        if (myUser) {
          _this.myUserData = $.extend(true, _this.myUserData, myUser.data);
        }
      }

      return _this.Utils.Users.getUsersToMention({
        allUsers: _this.allUsers,
        config: _this.data
      });
    })
    .then(function(usersToMention) {
      _this.usersToMention = usersToMention;
    });
};

/**
 * Initializes the news feed component
 * Processes query parameters, loads data, renders templates, and sets up social functionality
 * 
 * @returns {Promise} Promise that resolves when initialization is complete
 */
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

      return _this.Utils.Records.setFilterValues({
        config: _this.data
      });
    })
    .then(function() {
      return _this.Utils.Records.loadData({
        instance: _this,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        $container: _this.$container,
        filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
      });
    })
    .then(function(records) {
      _this.Utils.Records.addComputedFields({
        records: records,
        config: _this.data,
        filterTypes: _this.filterTypes
      });

      return Fliplet.Hooks.run('flListDataAfterGetData', {
        instance: _this,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        records: records
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

      if (!_this.data.detailViewAutoUpdate) {
        return Promise.resolve();
      }

      return _this.Utils.Records.getFields(_this.listItems, _this.data.dataSourceId).then(function(columns) {
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
      _this.listItems = NativeUtils.uniqBy(response, 'id');

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
    })
    .then(function() {
      _this.parseFilterQueries();
      _this.parseSearchQueries();
      _this.changeSort();
    });
};

DynamicList.prototype.changeSort = function() {
  if (NativeUtils.has(this.pvPreSortQuery, 'column') && NativeUtils.has(this.pvPreSortQuery, 'order')) {
    $('[data-sort-field="' + this.pvPreSortQuery.column + '"]')
      .attr('data-sort-order', this.pvPreSortQuery.order);
  }
};

DynamicList.prototype.checkIsToOpen = function() {
  var _this = this;
  var entry;

  if (!_this.queryOpen) {
    return Promise.resolve();
  }

  if (NativeUtils.hasIn(_this.pvOpenQuery, 'id')) {
    entry = _this.listItems.find(function(item) { return item.id === _this.pvOpenQuery.id; });
  } else if (NativeUtils.hasIn(_this.pvOpenQuery, 'value') && NativeUtils.hasIn(_this.pvOpenQuery, 'column')) {
    entry = _this.listItems.find(function(row) {
      // eslint-disable-next-line eqeqeq
      return row.data[_this.pvOpenQuery.column] == _this.pvOpenQuery.value;
    });
  }

  if (!entry) {
    Fliplet.UI.Toast(T('widgets.list.dynamic.notifications.notFound'));

    return Promise.resolve();
  }

  var modifiedData = _this.addSummaryData([entry]);

  return _this.showDetails(entry.id, modifiedData).then(function() {
    _this.openedEntryOnQuery = true;

    if (_this.pvOpenQuery.openComments || _this.pvOpenQuery.commentId) {
      _this.showComments(entry.id, _this.pvOpenQuery.commentId);
    }

    // Wait for overlay transition to complete
    return new Promise(function(resolve) {
      setTimeout(resolve, 250);
    });
  });
};

DynamicList.prototype.parseSearchQueries = function() {
  var _this = this;

  if (!NativeUtils.get(_this.pvSearchQuery, 'value')) {
    // Continue to execute query filters
    return _this.searchData({
      initialRender: true
    });
  }

  if (NativeUtils.hasIn(_this.pvSearchQuery, 'column')) {
    // Query search column and value provided
    return _this.searchData({
      value: _this.pvSearchQuery.value,
      column: _this.pvSearchQuery.column,
      openSingleEntry: _this.pvSearchQuery.openSingleEntry,
      initialRender: true
    });
  }

  // Query search value provided without column
  _this.$container.find('.new-news-feed-list-container').addClass('searching');
  _this.isSearching = true;

  return _this.searchData({
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

  $('[data-fl-navigate-back]').on('click', function() {
    try {
      result = (typeof _this.pvGoBack.action === 'function') && _this.pvGoBack.action();
    } catch (error) {
      console.error('Your custom function for the back button thrown an error: ' + error);
    }

    if (!(result instanceof Promise)) {
      result = Promise.resolve();
    }

    return result.then(function() {
      return Fliplet.Navigate.back();
    }).catch(function(error) {
      console.error(error);
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
      _this.pvGoBack = value.goBack;

      if (_this.pvGoBack && _this.pvGoBack.hijackBack) {
        _this.navigateBackEvent();
      }

      if (NativeUtils.hasIn(value, 'prefilter')) {
        _this.queryPreFilter = true;
        _this.pvPreFilterQuery = value.prefilter;
      }

      if (NativeUtils.hasIn(value, 'open')) {
        _this.queryOpen = true;
        _this.pvOpenQuery = value.open;
      }

      if (NativeUtils.hasIn(value, 'search')) {
        _this.querySearch = true;
        _this.pvSearchQuery = value.search;
        _this.data.searchEnabled = true;
      }

      if (NativeUtils.hasIn(value, 'filter')) {
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
};

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
  _this.$overlay = $('#news-feed-detail-overlay-' + _this.data.id);
};

/**
 * Processes records and adds summary data for news feed rendering
 * Applies field mappings, filter properties, and social data based on layout configuration
 * 
 * @param {Array<Object>} records - Array of data records to process
 * @returns {Array<Object>} Processed records with summary data for template rendering
 */
DynamicList.prototype.addSummaryData = function(records) {
  var _this = this;
  var modifiedData = _this.Utils.Records.addFilterProperties({
    records: records,
    config: _this.data,
    filterTypes: _this.filterTypes
  });
  var loopData = modifiedData.map(function(entry) {
    var newObject = {
      id: entry.id,
      flClasses: entry.data['flClasses'],
      flFilters: entry.data['flFilters'],
      editEntry: entry.editEntry,
      deleteEntry: entry.deleteEntry,
      likesEnabled: entry.likesEnabled,
      bookmarksEnabled: entry.bookmarksEnabled,
      commentsEnabled: entry.commentsEnabled,
      entryDetails: [],
      originalData: entry.data
    };

    // Uses summary view settings set by users
    _this.data['summary-fields'].forEach(function(obj) {
      newObject[obj.location] = _this.Utils.Record.getDataViewContent({
        record: entry,
        field: obj,
        filterFields: _this.data.filterFields
      });
    });

    return newObject;
  });

  return loopData;
};

/**
 * Renders a batch of news feed items incrementally to improve performance
 * Uses requestAnimationFrame for smooth rendering of large datasets
 * 
 * @param {Object} options - Rendering options
 * @param {Array<Object>} options.data - Array of records to render
 * @returns {Promise<Array<Object>>} Promise resolving to the rendered data
 */
DynamicList.prototype.renderLoopSegment = function(options) {
  options = options || {};

  var _this = this;
  var data = options.data;
  var renderLoopIndex = 0;
  var template = this.data.advancedSettings && this.data.advancedSettings.loopHTML
    ? Handlebars.compile(this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[this.layoutMapping[this.data.layout]['loop']]());

  return new Promise(function(resolve) {
    function render() {
      // get the next batch of items to render
      var nextBatch = data.slice(
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE,
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE
      );

      if (nextBatch.length) {
        $('#news-feed-list-wrapper-' + _this.data.id).append(template(nextBatch));
        renderLoopIndex++;
        // if the browser is ready, render
        requestAnimationFrame(render);
      } else {
        resolve(data);
      }
    }

    // start the initial render
    requestAnimationFrame(render);
  });
};

DynamicList.prototype.lazyLoadMore = function() {
  var _this = this;

  if (!this.renderListItems.length) {
    this.$container.find('.list-load-more').addClass('hidden');

    return Promise.resolve();
  }

  return this.renderLoopSegment({
    data: this.renderListItems.splice(0, this.data.lazyLoadBatchSize)
  }).then(function(renderedRecords) {
    _this.$container.find('.list-load-more').toggleClass('hidden', !_this.renderListItems.length);

    _this.attachLazyLoadObserver({
      renderedRecords: renderedRecords
    });

    _this.initializeSocials(renderedRecords).then(function() {
      return Fliplet.Hooks.run('flListDataAfterRenderMoreListSocial', {
        instance: _this,
        records: _this.searchedListItems,
        renderedRecords: renderedRecords,
        config: _this.data,
        sortField: _this.sortField,
        sortOrder: _this.sortOrder,
        activeFilters: _this.activeFilters,
        showBookmarks: _this.showBookmarks,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container
      });
    });

    // Update selected highlight size in Edit
    Fliplet.Widget.updateHighlightDimensions(_this.data.id);

    return Fliplet.Hooks.run('flListDataAfterRenderMoreList', {
      instance: _this,
      records: _this.searchedListItems,
      renderedRecords: renderedRecords,
      config: _this.data,
      sortField: _this.sortField,
      sortOrder: _this.sortOrder,
      activeFilters: _this.activeFilters,
      showBookmarks: _this.showBookmarks,
      id: _this.data.id,
      uuid: _this.data.uuid,
      container: _this.$container
    });
  });
};

DynamicList.prototype.attachLazyLoadObserver = function(options) {
  options = options || {};

  var renderedRecords = options.renderedRecords || [];

  if (!renderedRecords.length || !('IntersectionObserver' in window)) {
    return;
  }

  var _this = this;

  var lazyLoadThresholdIndex = Math.floor(renderedRecords.length * 0.9);
  var triggerRecord = renderedRecords[lazyLoadThresholdIndex];

  if (!triggerRecord) {
    return;
  }

  var $triggerEntry = _this.$container.find('.news-feed-list-item[data-entry-id="' + triggerRecord.id + '"]');
  var observer = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) {
        return;
      }

      observer.disconnect();
      _this.lazyLoadMore();
    });
  });

  requestAnimationFrame(function() {
    observer.observe($triggerEntry.get(0));
  });
};

DynamicList.prototype.renderLoopHTML = function() {
  // Function that renders the List template
  var _this = this;
  var limitedList;
  var isSorting = this.sortField && ['asc', 'desc'].indexOf(this.sortOrder) > -1;

  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0
    && !_this.isSearching && !_this.isFiltering && !_this.showBookmarks && !isSorting) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);

    // Hides the entry limit warning if the number of entries to show is less than the limit value
    if (_this.data.limitEntries > _this.modifiedListItems.length) {
      _this.$container.find('.limit-entries-text').addClass('hidden');
    }
  }

  $('#news-feed-list-wrapper-' + _this.data.id).empty();

  this.renderListItems = NativeUtils.clone(limitedList || _this.modifiedListItems || []);

  var data = this.renderListItems.splice(0, this.data.lazyLoadBatchSize || this.renderListItems.length);

  return this.renderLoopSegment({
    data: data
  }).then(function(renderedRecords) {
    if (_this.data.lazyLoadBatchSize) {
      var $loadMore = _this.$container.find('.list-load-more');

      if (!$loadMore.length) {
        $loadMore = $('<div class="list-load-more" style="text-align:center;padding-bottom:20px;margin-bottom:10px;">Load more</div>');

        $loadMore.on('click', function() {
          _this.lazyLoadMore();
        });

        _this.$container.find('.news-feed-list-wrapper').after($loadMore);
      }

      _this.attachLazyLoadObserver({
        renderedRecords: renderedRecords
      });

      $loadMore.toggleClass('hidden', !_this.renderListItems.length);
    }

    _this.$container.find('.new-news-feed-list-container').removeClass('loading').addClass('ready');

    // Changing close icon in the fa-times-thin class for windows 7 IE11
    if (/Windows NT 6.1/g.test(navigator.appVersion) && Modernizr.ie11) {
      $('.fa-times-thin').addClass('win7');
    }

    return renderedRecords;
  });
};

DynamicList.prototype.getAddPermission = function(data) {
  data.showAddEntry = this.Utils.User.canAddRecord(this.data, this.myUserData);

  return data;
};

DynamicList.prototype.getPermissions = function(entries) {
  var _this = this;

  // Adds flag for Edit and Delete buttons
  entries.forEach(function(entry) {
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

    NativeUtils.remove(filters, function(filter) {
      return NativeUtils.isEmpty(filter.data);
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

DynamicList.prototype.calculateFiltersHeight = function() {
  this.$container.find('.hidden-filter-controls').each(function() {
    $(this).animate({
      height: '100%'
    }, 200);
  });
};

DynamicList.prototype.calculateSearchHeight = function(element, isClearSearch) {
  var totalHeight = element.find('.hidden-search-controls-content').height();

  if (isClearSearch) {
    totalHeight = 0;
  }

  element.find('.hidden-search-controls').animate({
    height: totalHeight
  }, 200);
};

/**
 * Performs search and filtering operations on the news feed data
 * Handles text search, filters, bookmarks, and sorting with real-time feed updates
 * 
 * @param {Object|string} options - Search options or search value string
 * @param {string} [options.value] - Search term to filter records
 * @param {Array<string>} [options.fields] - Fields to search in
 * @param {boolean} [options.openSingleEntry] - Whether to auto-open if only one result
 * @param {boolean} [options.initialRender] - Whether this is the initial render
 * @returns {Promise} Promise that resolves when search and render is complete
 */
DynamicList.prototype.searchData = function(options) {
  if (typeof options === 'string') {
    options = {
      value: options
    };
  }

  options = options || {};

  var _this = this;
  var value = NativeUtils.isUndefined(options.value) ? _this.searchValue : ('' + options.value).trim();
  var fields = options.fields || _this.data.searchFields;
  var openSingleEntry = options.openSingleEntry;
  var $inputField = _this.$container.find('.search-holder input');

  _this.searchValue = value;
  value = value.toLowerCase();
  _this.activeFilters = _this.Utils.Page.getActiveFilters({ $container: _this.$container });
  _this.isSearching = value !== '';
  _this.isFiltering = !NativeUtils.isEmpty(_this.activeFilters);
  _this.showBookmarks = $('.toggle-bookmarks').hasClass('mixitup-control-active');

  var limitEntriesEnabled = _this.data.enabledLimitEntries && !isNaN(_this.data.limitEntries);
  var isSorting = _this.sortField && ['asc', 'desc'].indexOf(_this.sortOrder) > -1;
  var limit = limitEntriesEnabled && _this.data.limitEntries > -1
    && !_this.isSearching && !_this.showBookmarks && !_this.isFiltering && !isSorting
    ? _this.data.limitEntries
    : -1;

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
    showBookmarks: _this.showBookmarks,
    sortField: _this.sortField,
    sortOrder: _this.sortOrder,
    limit: limit
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
      fields: fields,
      config: _this.data,
      activeFilters: _this.activeFilters,
      showBookmarks: _this.showBookmarks,
      sortField: _this.sortField,
      sortOrder: _this.sortOrder,
      limit: limit
    }).then(function() {
      searchedData = searchedData || [];

      var truncated = results.truncated || (searchedData.length && searchedData.length < _this.listItems.length);

      if (openSingleEntry && searchedData.length === 1) {
        _this.showDetails(searchedData[0].id);
      }

      _this.$container.find('.new-news-feed-list-container').toggleClass('no-results', !searchedData.length);

      /**
       * Update search UI
       **/
      $inputField.val('');
      $inputField.blur();
      _this.$container.find('.new-news-feed-list-container').removeClass('searching');
      // Adds search query to HTML
      _this.$container.find('.current-query').text(_this.searchValue);
      // Search value is provided
      _this.$container.find('.hidden-search-controls')[value.length ? 'addClass' : 'removeClass']('search-results');
      _this.calculateSearchHeight(_this.$container.find('.new-news-feed-list-container'), !value.length);
      _this.$container.find('.hidden-search-controls').addClass('active');
      _this.$container.find('.hidden-search-controls')[searchedData.length || truncated ? 'removeClass' : 'addClass']('no-results');

      var searchedDataIds = searchedData.map(function(item) { return item.id; });
      var searchedListItemIds = _this.searchedListItems.map(function(item) { return item.id; });

      if (!_this.data.forceRenderList
        && searchedData.length
        && NativeUtils.isEqual(searchedDataIds, searchedListItemIds)) {
        // Same results returned. Do nothing.
        return;
      }

      if (limitEntriesEnabled) {
        // Do not show limit text when user is searching or filtering
        var hideLimitText = !results.truncated && _this.data.limitEntries > 0;

        _this.$container.find('.limit-entries-text').toggleClass('hidden', hideLimitText);
      }

      if (!_this.data.forceRenderList
        && !_this.data.sortEnabled
        && !(_this.data.sortFields || []).length
        && searchedData.length
        && searchedData.length === NativeUtils.intersection(searchedDataIds, searchedListItemIds).length) {
        // Search results is a subset of the current render.
        // Remove the extra records without re-render.
        _this.$container.find(NativeUtils.difference(searchedListItemIds, searchedDataIds).map(function(id) {
          return '.news-feed-list-item[data-entry-id="' + id + '"]';
        }).join(',')).remove();
        _this.searchedListItems = searchedData;

        return;
      }

      /**
       * Render results
       **/

      $('#news-feed-list-wrapper-' + _this.data.id).html('');

      _this.modifiedListItems = _this.addSummaryData(searchedData);

      return _this.renderLoopHTML().then(function(records) {
        _this.searchedListItems = searchedData;

        return records;
      });
    });
  }).then(function(renderedRecords) {
    _this.initializeSocials(renderedRecords).then(function() {
      return Fliplet.Hooks.run('flListDataAfterRenderListSocial', {
        instance: _this,
        value: value,
        records: _this.searchedListItems,
        renderedRecords: renderedRecords,
        config: _this.data,
        sortField: _this.sortField,
        sortOrder: _this.sortOrder,
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
      filterOverlayClass: '.news-feed-search-filter-overlay',
      filtersInOverlay: _this.data.filtersInOverlay,
      filterTypes: _this.filterTypes
    });

    return Fliplet.Hooks.run('flListDataAfterRenderList', {
      instance: _this,
      value: value,
      records: _this.searchedListItems,
      renderedRecords: renderedRecords,
      config: _this.data,
      sortField: _this.sortField,
      sortOrder: _this.sortOrder,
      activeFilters: _this.activeFilters,
      showBookmarks: _this.showBookmarks,
      id: _this.data.id,
      uuid: _this.data.uuid,
      container: _this.$container,
      initialRender: !!options.initialRender
    }).then(function() {
      var descriptions = _this.$container.find('.news-feed-item-description a');

      descriptions.each(function() {
        $(this).attr('tabindex', -1);
      });
    });
  });
};

DynamicList.prototype.getLikeIdentifier = function(record) {
  var uniqueId = this.Utils.Record.getUniqueId({
    record: record,
    config: this.data
  });
  var defaultIdentifier = {
    entryId: uniqueId + '-like',
    pageId: Fliplet.Env.get('pageId')
  };
  var customIdentifier = Promise.resolve();

  if (typeof this.data.getLikeIdentifier === 'function') {
    customIdentifier = this.data.getLikeIdentifier({
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

DynamicList.prototype.setupLikeButton = function(options) {
  if (!NativeUtils.get(this.data, 'social.likes')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var title = options.title;
  var target = options.target;
  var record = options.record || _this.listItems.find(function(item) { return item.id === id; });

  if (!record) {
    return Promise.resolve();
  }

  return _this.getLikeIdentifier(record)
    .then(function(identifier) {
      return new Promise(function(resolve) {
        var btn = LikeButton({
          target: target,
          dataSourceId: _this.data.likesDataSourceId,
          content: identifier,
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart-o fa-lg"></i>',
          likedLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart fa-lg animated bounceIn"></i>',
          likeWrapper: '<div class="news-feed-like-wrapper btn-like focus-outline" tabindex="0"></div>',
          likedWrapper: '<div class="news-feed-like-wrapper btn-liked focus-outline" tabindex="0"></div>',
          addType: 'html',
          liked: record.liked,
          count: record.likeCount
        });

        record.likeButton = btn;

        btn.on('like.status', function(liked, count) {
          record.liked = liked;
          record.likeCount = count;
          resolve(btn);
        });

        btn.on('liked', function() {
          var count = btn.getCount() > 0 ? btn.getCount() : '';

          record.liked = btn.isLiked();
          record.likeCount = count;
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

          Fliplet.Hooks.run('flListDataEntryLike', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'entry_like',
            label: title
          });
        });

        btn.on('liked.success', function() {
          Fliplet.Hooks.run('flListDataEntryLikeSuccess', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('liked.fail', function() {
          var count = btn.getCount() > 0 ? btn.getCount() : '';

          record.liked = btn.isLiked();
          record.likeCount = count;
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('liked').addClass('not-liked');
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

          Fliplet.Hooks.run('flListDataEntryLikeFail', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('unliked', function() {
          var count = btn.getCount() > 0 ? btn.getCount() : '';

          record.liked = btn.isLiked();
          record.likeCount = count;
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

          Fliplet.Hooks.run('flListDataEntryUnlike', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'entry_unlike',
            label: title
          });
        });

        btn.on('unliked.success', function() {
          Fliplet.Hooks.run('flListDataEntryUnlikeSuccess', {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: record
          });
        });

        btn.on('unliked.fail', function() {
          var count = btn.getCount() > 0 ? btn.getCount() : '';

          record.liked = btn.isLiked();
          record.likeCount = count;
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('not-liked').addClass('liked');
          _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

          Fliplet.Hooks.run('flListDataEntryUnlikeFail', {
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

DynamicList.prototype.getBookmarkIdentifier = function(record) {
  var uniqueId = this.Utils.Record.getUniqueId({
    record: record,
    config: this.data
  });
  var defaultIdentifier = {
    entryId: uniqueId + '-bookmark'
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

DynamicList.prototype.setupBookmarkButton = function(options) {
  if (!NativeUtils.get(this.data, 'social.bookmark')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var title = options.title;
  var target = options.target;
  var record = options.record || _this.listItems.find(function(item) { return item.id === id; });

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
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
          likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
          likeWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmark focus-outline" tabindex="0"></div>',
          likedWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmarked focus-outline" tabindex="0"></div>',
          addType: 'html',
          getAllCounts: false,
          liked: record.bookmarked
        });

        record.bookmarkButton = btn;

        btn.on('like.status', function(liked) {
          record.bookmarked = liked;
          resolve(btn);
        });

        btn.on('liked', function() {
          record.bookmarked = btn.isLiked();

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
          _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');

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
          _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');

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

DynamicList.prototype.addDetailViewData = function(entry, files) {
  var _this = this;
  var fileList = files && Array.isArray(files) ? files.filter(Boolean) : null;

  if (Array.isArray(entry.entryDetails) && entry.entryDetails.length) {
    _this.Utils.Record.assignImageContent(_this, entry);

    return entry;
  }

  entry.entryDetails = [];

  // Define detail view data based on user's settings
  _this.data.detailViewOptions.forEach(function(obj) {
    var label = '';
    var labelEnabled = true;
    var content = '';

    if (obj.type === 'file') {
      if (!fileList) {
        return;
      }

      var file = fileList.find(function(fileEntry) {
        return fileEntry.id === obj.id;
      });

      if (file) {
        entry.entryDetails.push(file);
      }

      return;
    }

    // Define label
    if (obj.fieldLabel === 'column-name' && obj.column !== 'custom') {
      label = obj.column;
    }

    if (obj.fieldLabel === 'custom-label') {
      label = new Handlebars.SafeString(Handlebars.compile(obj.customFieldLabel)(entry.originalData));
    }

    if (obj.fieldLabel === 'no-label') {
      labelEnabled = false;
    }

    // Define content
    if (obj.customFieldEnabled) {
      content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.originalData));
    } else if (_this.data.filterFields.indexOf(obj.column) > -1) {
      content = _this.Utils.String.splitByCommas(entry.originalData[obj.column]).join(', ');
    } else {
      content = entry.originalData[obj.column];
    }

    if (obj.type === 'image') {
      var imagesContentData = _this.Utils.Record.getImageContent(entry.originalData[obj.column]);
      var contentArray = imagesContentData.imagesArray;

      content = imagesContentData.imageContent;
      _this.imagesData[obj.id] = imagesContentData.imagesData;
    }

    // Define data object
    var newEntryDetail = {
      id: obj.id,
      content: content,
      label: label,
      labelEnabled: labelEnabled,
      type: obj.type
    };

    if (contentArray) {
      newEntryDetail.contentArray = contentArray;
    }

    entry.entryDetails.push(newEntryDetail);
  });

  if (_this.data.detailViewAutoUpdate) {
    var savedColumns = _this.data.detailViewOptions.map(function(option) { return option.column; });
    var extraColumns = NativeUtils.difference(_this.dataSourceColumns, savedColumns);

    extraColumns.forEach(function(column) {
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
  var entryData = (listData || _this.modifiedListItems).find(function(item) { return item.id === id; });
  // Process template with data
  var entryId = { id: id };
  var wrapper = '<div class="news-feed-detail-wrapper" data-entry-id="{{id}}"></div>';
  var src = _this.src;

  if (!this.$detailsContent || !this.$closeButton) {
    this.$detailsContent = $('.news-feed-detail-overlay');
    this.$closeButton = this.$detailsContent.find('.news-feed-detail-overlay-close').filter(function(i, el) {
      return !$(el).hasClass('tablet');
    });
  }

  return _this.Utils.Records.getFilesInfo({
    entryData: entryData,
    detailViewOptions: _this.data.detailViewOptions
  })
    .then(function(files) {
      entryData = _this.addDetailViewData(entryData, files);

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
        _this.$overlay.find('.news-feed-detail-overlay-content-holder').html(wrapperTemplate(entryId));
        _this.$overlay.find('.news-feed-detail-wrapper').append(template(data.data || entryData));

        _this.initializeOverlaySocials(id);

        // Trigger animations
        $('body').addClass('lock');
        _this.$container.find('.new-news-feed-list-container').addClass('overlay-open');

        // Calculate top position when image finishes loading
        if ($(window).width() < 640) {
          _this.addContentIndent();
        }

        _this.$overlay.addClass('open');

        if (typeof _this.data.afterShowDetails === 'function') {
          _this.data.afterShowDetails({
            config: _this.data,
            src: data.src || src,
            data: data.data || entryData
          });
        }

        // Focus on close button after opening overlay
        setTimeout(function() {
          _this.$closeButton.focus();
        }, 200);
      });
    });
};

DynamicList.prototype.addContentIndent = function() {
  var _this = this;

  this.$container.find('.news-feed-list-detail-image-wrapper img').one('load', function() {
    var expandedPosition = $(this).outerHeight();

    _this.$overlay.find('.news-feed-item-inner-content').css({ top: expandedPosition + 'px' });
  }).each(function() {
    if (this.complete) {
      $(this).trigger('load');
    }
  });
};

DynamicList.prototype.closeDetails = function(options) {
  if (this.openedEntryOnQuery && Fliplet.Navigate.query.dynamicListPreviousScreen === 'true') {
    Fliplet.Page.Context.remove('dynamicListPreviousScreen');

    return Fliplet.Navigate.back();
  }

  var _this = this;
  var id = _this.$container.find('.news-feed-detail-wrapper[data-entry-id]').data('entry-id');

  options = options || {};

  Fliplet.Page.Context.remove('dynamicListOpenId');
  _this.$overlay.removeClass('open');
  _this.$container.find('.new-news-feed-list-container').removeClass('overlay-open');
  $('body').removeClass('lock');

  setTimeout(function() {
    // Clears overlay
    _this.$overlay.find('.news-feed-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }

    _this.$container.find('.new-news-feed-list-container, .dynamic-list-add-item').removeClass('hidden');

    // Focus on closed entry
    if (options.focusOnEntry) {
      _this.$container.find('.news-feed-list-item[data-entry-id="' + id + '"]').focus();
    }
  }, 300);
};

/** ****************/
/** ** COMMENTS ****/
/** ****************/

DynamicList.prototype.getCommentIdentifier = function(record) {
  var uniqueId = this.Utils.Record.getUniqueId({
    record: record,
    config: this.data
  });
  var defaultIdentifier = {
    contentDataSourceEntryId: uniqueId,
    type: 'comment'
  };
  var customIdentifier = Promise.resolve();

  /* Deprecated method of defining comment identifiers */
  if (typeof this.data.getCommentIdentifier === 'function') {
    customIdentifier = this.data.getCommentIdentifier({
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

DynamicList.prototype.getEntryComments = function(options) {
  if (!NativeUtils.get(this.data, 'social.comments')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var record = options.record || _this.listItems.find(function(item) { return item.id === id; });

  if (!record) {
    return Promise.resolve();
  }

  var count = record.commentCount;

  return _this.getCommentIdentifier(record)
    .then(function(identifier) {
      var getComments = Promise.resolve();

      if (typeof count === 'undefined' || options.force) {
        getComments = Fliplet.Content({ dataSourceId: _this.data.commentsDataSourceId })
          .then(function(instance) {
            return instance.query({
              allowGrouping: true,
              where: {
                content: identifier,
                settings: {
                  text: { $regex: '[^\s]+' }
                }
              }
            });
          })
          .then(function(entries) {
            record.comments = entries;
            record.commentCount = entries.length;
          });
      }

      return getComments;
    })
    .then(function() {
      _this.updateCommentCounter({
        id: id,
        record: record
      });
    });
};

DynamicList.prototype.connectToUsersDataSource = function() {
  var _this = this;
  var options = {
    offline: true // By default on native platform it connects to offline DB. Set this option to false to connect to api's
  };

  return Fliplet.DataSources.connect(_this.data.userDataSourceId, options)
    .then(function(connection) {
      return connection.find(_this.data.commentUsersQuery);
    });
};

DynamicList.prototype.updateCommentCounter = function(options) {
  if (!NativeUtils.get(this.data, 'social.comments')) {
    return;
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var record = options.record || _this.listItems.find(function(item) { return item.id === id; });

  if (!record) {
    return;
  }

  var commentCounterTemplate = '<span class="count">{{#if count}}{{count}}{{/if}}</span> <i class="fa fa-comment-o fa-lg"></i> <span class="comment-label">' + T('widgets.list.dynamic.comments.title') + '</span>';
  var counterCompiled = Handlebars.compile(commentCounterTemplate);
  var data = {
    count: TN(record.commentCount)
  };
  var html = counterCompiled(data);

  // Updates both main list and overlay comment counters
  _this.$container.find('.news-feed-comemnt-holder-' + id).html(html);
};

DynamicList.prototype.showComments = function(id, commentId) {
  var _this = this;

  _this.$container.find('.news-feed-comment-area').html(_this.commentsLoadingHTML);
  $('body').addClass('lock');
  _this.$container.find('.new-news-feed-comment-panel').addClass('open');

  var context = {
    dynamicListOpenId: id
  };

  if (commentId) {
    context.dynamicListCommentId = commentId;
  } else {
    context.dynamicListOpenComments = 'true';
  }

  Fliplet.Page.Context.update(context);

  return _this.getCommentUsers().then(function() {
    return _this.getEntryComments({
      id: id,
      force: true
    });
  }).then(function() {
    // Get comments for entry
    var entry = _this.listItems.find(function(item) { return item.id === id; });
    var entryComments = NativeUtils.get(entry, 'comments');

    // Display comments
    entryComments.forEach(function(entry, index) {
      // Convert data/time
      var newDate = new Date(entry.createdAt);
      var timeInMilliseconds = newDate.getTime();
      var userName = NativeUtils.compact(_this.data.userNameFields.map(function(name) {
        return NativeUtils.get(entry, 'data.settings.user.' + name);
      })).join(' ').trim();

      entryComments[index].timeInMilliseconds = timeInMilliseconds;
      entryComments[index].literalDate = TD(entry.createdAt, { format: 'lll' });
      entryComments[index].userName = userName;
      entryComments[index].photo = entry.data.settings.user[_this.data.userPhotoColumn] || '';
      entryComments[index].text = entry.data.settings.text || '';

      var myEmail = '';

      if (!NativeUtils.isEmpty(_this.myUserData)) {
        myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'] || _this.myUserData['Email'];
      }

      var dataSourceEmail = '';

      if (entry.data.settings.user && entry.data.settings.user[_this.data.userEmailColumn]) {
        dataSourceEmail = entry.data.settings.user[_this.data.userEmailColumn];
      }

      // Check if comment is from current user
      if (_this.myUserData.isSaml2) {
        var myEmailParts = myEmail.match(/[^\@]+[^\.]+/);
        var toComparePart = myEmailParts && myEmailParts.length ? myEmailParts[0] : '';
        var dataSourceEmailParts = dataSourceEmail.match(/[^\@]+[^\.]+/);
        var toComparePart2 = dataSourceEmailParts && dataSourceEmailParts.length ? dataSourceEmailParts[0] : '';

        if (toComparePart.toLowerCase() === toComparePart2.toLowerCase()) {
          entryComments[index].currentUser = true;
        }
      } else if (dataSourceEmail === myEmail) {
        entryComments[index].currentUser = true;
      }
    });
    entryComments = NativeUtils.orderBy(entryComments, ['timeInMilliseconds'], ['asc']);

    if (!_this.autosizeInit) {
      autosize(_this.$container.find('.news-feed-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['comments']];
    var commentsTemplateCompiled = Handlebars.compile(commentsTemplate());
    var commentsHTML = commentsTemplateCompiled(entryComments);
    var $commentArea = _this.$container.find('.news-feed-comment-area');
    var hookData = {
      instance: _this,
      config: _this.data,
      id: _this.data.id,
      uuid: _this.data.uuid,
      container: _this.$container,
      html: commentsHTML,
      src: commentsTemplate,
      comments: entryComments,
      entryId: id,
      record: entry
    };

    return Fliplet.Hooks.run('flListDataBeforeShowComments', hookData).then(function() {
      $commentArea.html(hookData.html);

      return Fliplet.Hooks.run('flListDataAfterShowComments', {
        instance: _this,
        config: _this.data,
        id: _this.data.id,
        uuid: _this.data.uuid,
        container: _this.$container,
        html: commentsHTML,
        comments: entryComments,
        entryId: id,
        record: entry
      }).then(function() {
        var scrollTop = $commentArea[0].scrollHeight;

        if (commentId) {
          var $commentHolder = $('.fl-individual-comment[data-id="' + commentId + '"]');

          if ($commentHolder.length) {
            scrollTop = $commentHolder.position().top - $('.news-feed-comment-panel-header').outerHeight();
          }
        }

        $commentArea.scrollTop(scrollTop);
      });
    });
  }).catch(function(error) {
    Fliplet.UI.Toast.error(error, {
      message: T('widgets.list.dynamic.comments.errors.loadFailed')
    });
  });
};

DynamicList.prototype.sendComment = function(id, value) {
  var record = this.listItems.find(function(item) { return item.id === id; });

  if (!record) {
    return Promise.resolve();
  }

  var _this = this;
  var guid = Fliplet.guid();
  var userName = '';

  if (NativeUtils.isEmpty(_this.myUserData) || (!_this.myUserData[_this.data.userEmailColumn] && !_this.myUserData['email'] && !_this.myUserData['Email'])) {
    if (typeof Raven !== 'undefined' && Raven.captureMessage) {
      Fliplet.User.getCachedSession().then(function(session) {
        Raven.captureMessage('User data not found for commenting', {
          extra: {
            config: _this.data,
            myUserData: _this.myUserData,
            session: session
          }
        });
      });
    }

    return Fliplet.UI.Toast(T('widgets.list.dynamic.notifications.unauthorized'));
  }

  var myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'] || _this.myUserData['Email'];
  var userFromDataSource = _this.allUsers.find(function(user) {
    /**
     * there could be users with null for Email
     */
    var toCompareDataEmailPart = user.data[_this.data.userEmailColumn] ? user.data[_this.data.userEmailColumn].match(/[^\@]+[^\.]+/) : null;
    var toCompareEmailPart = myEmail.match(/[^\@]+[^\.]+/);

    /**
     * the regexp match could return null
     */
    return toCompareDataEmailPart && toCompareEmailPart && toCompareDataEmailPart[0].toLowerCase() === toCompareEmailPart[0].toLowerCase();
  });

  if (!userFromDataSource) {
    return Fliplet.UI.Toast.error(T('widgets.list.dynamic.errors.invalidUser.title'), {
      message: T('widgets.list.dynamic.errors.invalidUser.message')
    });
  }

  var options = {
    instance: _this,
    config: _this.data,
    id: _this.data.id,
    uuid: _this.data.uuid,
    container: _this.$container,
    record: record,
    comment: value,
    commentGuid: guid
  };

  return Fliplet.Hooks.run('flListDataBeforeNewComment', options).then(function() {
    value = options.comment;
    guid = options.commentGuid;

    if (!value) {
      return Promise.resolve();
    }

    _this.appendTempComment(id, value, guid, userFromDataSource);

    if (typeof NativeUtils.get(record, 'commentCount') === 'number') {
      record.commentCount++;
    }

    _this.updateCommentCounter({
      id: id,
      record: record
    });

    userName = NativeUtils.compact(_this.data.userNameFields.map(function(name) {
      return _this.myUserData.isSaml2
        ? NativeUtils.get(userFromDataSource, 'data.' + name)
        : _this.myUserData[name];
    })).join(' ').trim();

    var comment = {
      fromName: userName,
      user: _this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData
    };

    Object.assign(comment, { contentDataSourceEntryId: id });

    var timestamp = (new Date()).toISOString();

    // Get mentioned user(s)
    var mentionRegexp = /\B@[a-z0-9_-]+/ig;
    var mentions = value.match(mentionRegexp);
    var usersMentioned = [];

    if (mentions && mentions.length) {
      var filteredUsers = _this.usersToMention.filter(function(userToMention) {
        return mentions.indexOf('@' + userToMention.username) > -1;
      });

      if (filteredUsers && filteredUsers.length) {
        filteredUsers.forEach(function(filteredUser) {
          var foundUser = _this.allUsers.find(function(user) {
            return user.id === filteredUser.id;
          });

          if (foundUser) {
            usersMentioned.push(foundUser);
          }
        });
      }
    }

    comment.mentions = [];

    if (usersMentioned && usersMentioned.length) {
      usersMentioned.forEach(function(user) {
        comment.mentions.push(user.id);
      });
    }

    comment.text = value;
    comment.timestamp = timestamp;
    comment.contentDataSourceId = _this.data.dataSourceId;
    comment.contentDataSourceEntryId = id;

    return _this.getCommentIdentifier(record)
      .then(function(identifier) {
        return Fliplet.Profile.Content({ dataSourceId: _this.data.commentsDataSourceId })
          .then(function(instance) {
            return instance.create(identifier, {
              settings: comment
            });
          });
      })
      .then(function(comment) {
        options = {
          instance: _this,
          config: _this.data,
          id: _this.data.id,
          uuid: _this.data.uuid,
          container: _this.$container,
          record: record,
          commentEntry: comment,
          commentGuid: guid
        };

        return Fliplet.Hooks.run('flListDataAfterNewComment', options)
          .then(function() {
            comment = options.commentEntry || comment;
            record.comments.push(comment);
            _this.replaceComment(guid, comment, 'final');
            options.commentContainer = _this.$container.find('.fl-individual-comment[data-id="' + comment.id + '"]');
            Fliplet.Hooks.run('flListDataAfterNewCommentShown', options);
          });
      });
  }).catch(function(error) {
    // Reverses count if error occurs
    console.error(error);

    if (NativeUtils.get(record, 'commentCount')) {
      record.commentCount--;
    }

    _this.updateCommentCounter({
      id: id,
      record: record
    });
  });
};

DynamicList.prototype.appendTempComment = function(id, value, guid, userFromDataSource) {
  var _this = this;
  var timestamp = (new Date()).toISOString();
  var userName = NativeUtils.compact(_this.data.userNameFields.map(function(name) {
    return _this.myUserData.isSaml2
      ? NativeUtils.get(userFromDataSource, 'data.' + name)
      : _this.myUserData[name];
  })).join(' ').trim();

  var commentInfo = {
    id: guid,
    literalDate: TD(timestamp, { format: 'lll' }),
    userName: userName,
    photo: _this.myUserData[_this.data.userPhotoColumn] || '',
    text: value
  };

  var tempCommentTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['temp-comment']];
  var tempCommentTemplateCompiled = Handlebars.compile(tempCommentTemplate());
  var tempCommentHTML = tempCommentTemplateCompiled(commentInfo);

  _this.$container.find('.news-feed-comment-area').append(tempCommentHTML);
  _this.$container.find('.news-feed-comment-area').stop().animate({
    scrollTop: _this.$container.find('.news-feed-comment-area')[0].scrollHeight
  }, 250);
};

DynamicList.prototype.replaceComment = function(guid, commentData, context) {
  var _this = this;
  var userName = NativeUtils.compact(_this.data.userNameFields.map(function(name) {
    return NativeUtils.get(commentData, 'data.settings.user.' + name);
  })).join(' ').trim();

  if (!commentData.literalDate) {
    commentData.literalDate = TD(commentData.createdAt, { format: 'lll' });
  }

  var myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'];
  var commentEmail = '';

  if (commentData.data.settings.user[_this.data.userEmailColumn]) {
    commentEmail = commentData.data.settings.user[_this.data.userEmailColumn];
  }

  var commentInfo = {
    id: commentData.id,
    literalDate: commentData.literalDate,
    userName: userName,
    photo: commentData.data.settings.user[_this.data.userPhotoColumn] || '',
    text: commentData.data.settings.text
  };

  var commentTemplate;
  var commentTemplateCompiled;
  var commentHTML;

  if (context === 'final') {
    // Check if comment is from current user
    if (_this.myUserData.isSaml2) {
      var myEmailParts = myEmail.match(/[^\@]+[^\.]+/);
      var toComparePart = myEmailParts[0];
      var commentEmailParts = commentEmail.match(/[^\@]+[^\.]+/);
      var toComparePart2 = commentEmailParts[0];

      if (toComparePart.toLowerCase() === toComparePart2.toLowerCase()) {
        commentInfo.currentUser = true;
      }
    } else if (commentEmail === myEmail) {
      commentInfo.currentUser = true;
    }

    commentTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['single-comment']];
    commentTemplateCompiled = Handlebars.compile(commentTemplate());
    commentHTML = commentTemplateCompiled(commentInfo);
  }

  if (context === 'temp') {
    commentTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['temp-comment']];
    commentTemplateCompiled = Handlebars.compile(commentTemplate());
    commentHTML = commentTemplateCompiled(commentInfo);
  }

  _this.$container.find('.fl-individual-comment[data-id="' + guid + '"]').replaceWith(commentHTML);
};

DynamicList.prototype.deleteComment = function(id) {
  var _this = this;
  var entryId = _this.$container.find('.news-feed-details-content-holder').data('entry-id') || _this.entryClicked;
  var entry = _this.listItems.find(function(item) { return item.id === entryId; });
  var commentHolder = _this.$container.find('.fl-individual-comment[data-id="' + id + '"]');
  var options = {
    instance: _this,
    config: _this.data,
    id: _this.data.id,
    uuid: _this.data.uuid,
    container: _this.$container,
    record: entry,
    commentId: id,
    commentContainer: commentHolder
  };

  commentHolder.hide();

  return Fliplet.Hooks.run('flListDataBeforeDeleteComment', options).then(function() {
    return Fliplet.DataSources.connect(_this.data.commentsDataSourceId).then(function(connection) {
      return connection.removeById(id, { ack: true });
    }).then(function onRemove() {
      NativeUtils.remove(entry.comments, function(comment) { return comment.id === id; });
      entry.commentCount--;
      _this.updateCommentCounter({
        id: entryId,
        record: entry
      });
      commentHolder.remove();
      Fliplet.Hooks.run('flListDataAfterDeleteComment', options);
    });
  }).catch(function(error) {
    commentHolder.show();
    Fliplet.UI.Toast.error(error, {
      message: T('widgets.list.dynamic.comments.errors.deleteFailed')
    });
  });
};

DynamicList.prototype.saveComment = function(entryId, commentId, newComment) {
  var _this = this;
  var entry = _this.listItems.find(function(item) { return item.id === entryId; });
  var entryComments = NativeUtils.get(entry, 'comments', []);
  var commentData = entryComments.find(function(comment) { return comment.id === commentId; });

  if (!commentData) {
    return Promise.reject('Comment not found');
  }

  var oldCommentData = NativeUtils.clone(commentData);
  var options = {
    instance: _this,
    config: _this.data,
    id: _this.data.id,
    uuid: _this.data.uuid,
    container: _this.$container,
    record: entry,
    oldCommentData: oldCommentData,
    newComment: newComment
  };

  return Fliplet.Hooks.run('flListDataBeforeUpdateComment', options)
    .then(function() {
      newComment = options.newComment;

      if (!newComment) {
        return Promise.resolve();
      }

      commentData.data.settings.text = newComment;
      _this.replaceComment(commentId, commentData, 'temp');

      return Fliplet.Content({ dataSourceId: _this.data.commentsDataSourceId })
        .then(function(instance) {
          return instance.update({
            settings: commentData.data.settings
          }, {
            id: commentId
          });
        })
        .then(function(newCommentData) {
          options = {
            instance: _this,
            config: _this.data,
            id: _this.data.id,
            uuid: _this.data.uuid,
            container: _this.$container,
            record: entry,
            oldCommentData: oldCommentData,
            newCommentData: newCommentData
          };

          return Fliplet.Hooks.run('flListDataAfterUpdateComment', options)
            .then(function() {
              newCommentData = options.newCommentData;
              _this.replaceComment(commentId, newCommentData, 'final');
              options.commentContainer = _this.$container.find('.fl-individual-comment[data-id="' + newCommentData.id + '"]');
              Fliplet.Hooks.run('flListDataAfterUpdateCommentShown', options);
            });
        });
    })
    .catch(function(error) {
      _this.replaceComment(commentId, oldCommentData, 'final');
      Fliplet.UI.Toast.error(error, {
        message: T('widgets.list.dynamic.comments.errors.updateFailed')
      });
    });
};
