// Constructor
function DynamicList(id, data) {
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
  this.data.forceRenderList = false;
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');

  // Other variables
  // Global variables
  this.allowClick = true;
  this.isFiltering;
  this.isSearching;
  this.showBookmarks;
  this.fetchedAllBookmarks = false;

  this.emailField = 'Email';
  this.myProfileData = [];
  this.modifiedProfileData;
  this.myUserData = {};

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.dataSourceColumns;
  this.directoryDetailWrapper;
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
  this.sortField = null;
  this.sortOrder = 'none';
  this.imagesData = {};

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

  // Register handlebars helpers
  this.Utils.registerHandlebarsHelpers();

  // Get the current session data
  Fliplet.User.getCachedSession().then(function(session) {
    if (_.get(session, 'entries.saml2.user')) {
      _this.myUserData = _.get(session, 'entries.saml2.user');
      _this.myUserData[_this.data.userEmailColumn] = _this.myUserData.email;
      _this.myUserData.isSaml2 = true;
    }

    if (_.get(session, 'entries.dataSource.data')) {
      _.extend(_this.myUserData, _.get(session, 'entries.dataSource.data'));
    }

    // Start running the Public functions
    _this.initialize();
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
  this.$container.find('.small-card-search-filter-overlay').removeClass('display');
  $('body').removeClass('lock has-filter-overlay');
};

DynamicList.prototype.attachObservers = function() {
  var _this = this;

  // Attach your event listeners here
  Fliplet.Hooks.on('beforePageView', function(options) {
    if (options.addToHistory === false) {
      _this.closeDetails();
    }
  });

  $(window).resize(function() {
    _this.Utils.DOM.adjustAddButtonPosition(_this);
  });

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

      _this.Utils.Records.sortByField({
        $container: _this.$container,
        $listContainer: $('#small-card-list-wrapper-' + _this.data.id),
        listItem: '.small-card-list-item',
        records: _this.searchedListItems,
        sortOrder: _this.sortOrder,
        sortField: _this.sortField
      });
    })
    .on('click keydown', '.apply-filters', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $selectedFilters = _this.$container.find('.hidden-filter-controls-filter.mixitup-control-active');

      if ($selectedFilters) {
        _this.$container.find('.hidden-filter-controls-filter-container').removeClass('hidden');
      }

      _this.$container.find('.dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.fa-sliders').focus();

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

      // Date filters change events are handled differently
      if (['date'].indexOf($filter.data('type')) > -1) {
        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $filter.text()
      });

      _this.toggleFilterElement(this);

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
    .on('click keydown', '.small-card-list-detail-button a', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

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
        _this.expandElement(_this.directoryDetailWrapper, _this.modifiedProfileData[0].id, _this.modifiedProfileData);
      } else {
        _this.showDetails(_this.modifiedProfileData[0].id, _this.modifiedProfileData);
        Fliplet.Page.Context.update({
          dynamicListOpenId: _this.modifiedProfileData[0].id
        });
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_open'
      });
    })
    .on('click keydown', '.small-card-list-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $el = $(this);
      var $target = $(event.target);

      if ($target.hasClass('small-card-bookmark-holder') || $target.parents('.small-card-bookmark-holder').length) {
        return;
      }

      var entryId = $el.data('entry-id');
      var entryTitle = $el.find('.small-card-list-name').text().trim();
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

        if (_this.allowClick) {
          _this.$container.find('.new-small-card-list-container').addClass('hidden');
          _this.$container.find('.dynamic-list-add-item').addClass('hidden');

          $el.parents('.small-card-list-wrapper').addClass('hidden');
        }

        // find the element to expand and expand it
        if (_this.allowClick && $(window).width() < 640) {
          _this.directoryDetailWrapper = $el.find('.small-card-list-detail-wrapper');
          _this.expandElement(_this.directoryDetailWrapper, entryId);
        } else if (_this.allowClick && $(window).width() >= 640) {
          _this.showDetails(entryId);
        }

        Fliplet.Page.Context.update({
          dynamicListOpenId: entryId
        });
      });
    })
    .on('click keydown', '.small-card-detail-overlay-close, .small-card-detail-overlay-screen', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      event.stopPropagation();

      var result;

      _this.$container.find('.new-small-card-list-container, .small-card-list-wrapper, .dynamic-list-add-item').removeClass('hidden');

      var id = _this.$container.find('.small-card-detail-wrapper[data-entry-id]').data('entry-id');

      _this.$container.find('.small-card-list-item[data-entry-id="' + id + '"]').focus();

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

      if ($(window).width() < 640) {
        if (typeof _this.directoryDetailWrapper === 'undefined') {
          _this.directoryDetailWrapper = _this.$container.find('.small-card-list-item[data-entry-id="' + id + '"] .small-card-list-detail-wrapper');
        }

        _this.collapseElement(_this.directoryDetailWrapper);
        _this.directoryDetailWrapper = undefined;
      } else {
        _this.closeDetails();
      }

      Fliplet.Page.Context.remove('dynamicListOpenId');
    })
    .on('click keydown', '.list-search-icon .fa-sliders', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-small-card-list-container');

      Fliplet.Page.Context.remove('dynamicListFilterHideControls');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.small-card-search-filter-overlay').addClass('display');

        _this.$container.find('.small-card-search-filter-overlay .small-card-overlay-close').focus();
        _this.$container.find('.dynamic-list-add-item').addClass('hidden');

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
    .on('click keydown', '.small-card-overlay-close', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.small-card-search-filter-overlay');

      $parentElement.removeClass('display');
      $('.dynamic-list-add-item').removeClass('hidden');
      $('body').removeClass('lock has-filter-overlay');
      $('.list-search-icon .fa-sliders').focus();

      // Clear all selected filters
      _this.toggleFilterElement(_this.$container.find('.mixitup-control-active:not(.toggle-bookmarks)'), false);

      // Select filters based on existing settings
      if (_this.activeFilters) {
        if (_.isEmpty(_this.activeFilters)) {
          _this.$container.find('.clear-filters').addClass('hidden');

          return;
        }

        var selectors = _.flatten(_.map(_this.activeFilters, function(values, key) {
          return _.map(values, function(value) {
            return '.hidden-filter-controls-filter[data-field="' + key + '"][data-value="' + value + '"]';
          });
        })).join(',');

        _this.toggleFilterElement(_this.$container.find(selectors), true);

        _this.$container.find('.clear-filters').removeClass('hidden');

        return;
      }

      // Legacy class-based settings
      if (!_this.filterClasses || !_this.filterClasses.length) {
        _this.$container.find('.clear-filters').addClass('hidden');

        return;
      }

      _this.filterClasses.forEach(function(filter) {
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
            _this.$container.find('.new-small-card-list-container').removeClass('searching');
            _this.isSearching = false;
            _this.searchData('');

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
      });
    })
    .on('click keydown', '.search-holder .search-btn', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $inputField = $(this).parents('.search-holder').find('.search-feed');
      var value = $inputField.val();

      if (value === '') {
        _this.$container.find('.new-small-card-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.searchData('');

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
    .on('click keydown', '.clear-search', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.new-small-card-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.searchData('');
    })
    .on('show.bs.collapse', '.small-card-filters-panel .panel-collapse', function(event) {
      event.stopPropagation();
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.small-card-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
    })
    .on('click keydown', '.small-card-filters-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(event.target).find('.collapse').collapse('toggle');
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

      var entryID = $(this).parents('.small-card-detail-overlay').find('.small-card-list-detail-content-scroll-wrapper').data('entry-id');

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
      var entryID = $(this).parents('.small-card-detail-overlay').find('.small-card-list-detail-content-scroll-wrapper').data('entry-id');
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

                  if ($(window).width() < 640) {
                    _this.collapseElement(_this.directoryDetailWrapper);
                    _this.directoryDetailWrapper = undefined;
                  } else {
                    _this.closeDetails();
                  }

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
    .on('click keydown', '.toggle-bookmarks', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $toggle = $(this);

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();
    })
    .on('click keydown', '.small-card-detail-overlay .small-card-bookmark-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var id = $(this).parents('.small-card-detail-wrapper').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $(this).parents('.small-card-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
        record.bookmarkButton.unlike();

        return;
      }

      $(this).parents('.small-card-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
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

  this.$container.find('.small-card-list-item[data-entry-id="' + id + '"]').remove();
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
      records = _this.getPermissions(records);

      // Get user profile
      if (!_.isEmpty(_this.myUserData)) {
        // Create flag for current user
        records.forEach(function(record) {
          record.isCurrentUser = _this.Utils.Record.isCurrentUser(record, _this.data, _this.myUserData);

          if (record.isCurrentUser) {
            _this.myProfileData.push(record);
          }
        });
      }

      // Make rows available Globally
      _this.listItems = records;

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
    })
    .then(function() {
      _this.parseFilterQueries();
      _this.parseSearchQueries();
      _this.changeSortOrder();
    });
};

DynamicList.prototype.changeSortOrder = function() {
  if (_.has(this.pvPreSortQuery, 'column') && _.has(this.pvPreSortQuery, 'order')) {
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

  if (_.hasIn(_this.pvOpenQuery, 'id')) {
    entry = _.find(_this.listItems, { id: _this.pvOpenQuery.id });
  } else if (_.hasIn(_this.pvOpenQuery, 'value') && _.hasIn(_this.pvOpenQuery, 'column')) {
    entry = _.find(_this.listItems, function(row) {
      // eslint-disable-next-line eqeqeq
      return row.data[_this.pvOpenQuery.column] == _this.pvOpenQuery.value;
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

DynamicList.prototype.parseSearchQueries = function() {
  var _this = this;

  if (!_.get(_this.pvSearchQuery, 'value')) {
    return _this.searchData({
      initialRender: true
    });
  }

  if (_.hasIn(_this.pvSearchQuery, 'column')) {
    return _this.searchData({
      value: _this.pvSearchQuery.value,
      openSingleEntry: _this.pvSearchQuery.openSingleEntry,
      initialRender: true
    });
  }

  _this.$container.find('.new-small-card-list-container').addClass('searching');
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
  }).catch(function(error) {
    Fliplet.UI.Toast.error(error, {
      message: 'Error loading data'
    });
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
};

DynamicList.prototype.addSummaryData = function(records) {
  var _this = this;
  var modifiedData = _this.Utils.Records.addFilterProperties({
    records: records,
    config: _this.data,
    filterTypes: _this.filterTypes
  });
  var loopData = _.map(modifiedData, function(entry) {
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

    // Uses sumamry view settings set by users
    _this.data['summary-fields'].forEach(function(obj) {
      var content = '';

      if (obj.type === 'image') {
        content = _this.Utils.Record.getImageContent(entry.data[obj.column], true);
      } else if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
      } else if (_this.data.filterFields.indexOf(obj.column) > -1) {
        content = _this.Utils.String.splitByCommas(entry.data[obj.column]).join(', ');
      } else {
        content = entry.data[obj.column];
      }

      content = _this.Utils.String.toFormattedString(content);

      newObject[obj.location] = content;
    });

    return newObject;
  });

  return loopData;
};

DynamicList.prototype.renderLoopHTML = function() {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());
  var limitedList;

  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0
    && !_this.isSearching && !_this.isFiltering && !_this.showBookmarks) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);

    // Hides the entry limit warning if the number of entries to show is less than the limit value
    if (_this.data.limitEntries > _this.modifiedListItems.length) {
      _this.$container.find('.limit-entries-text').addClass('hidden');
    }
  }

  $('#small-card-list-wrapper-' + _this.data.id).empty();

  var renderLoopIndex = 0;
  var data = limitedList || _this.modifiedListItems;

  return new Promise(function(resolve) {
    function render() {
      // get the next batch of items to render
      var nextBatch = data.slice(
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE,
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE
      );

      if (nextBatch.length) {
        $('#small-card-list-wrapper-' + _this.data.id).append(template(nextBatch));
        renderLoopIndex++;
        // if the browser is ready, render
        requestAnimationFrame(render);
      } else {
        _this.$container.find('.new-small-card-list-container').removeClass('loading').addClass('ready');

        // Changing close icon in the fa-times-thin class for windows 7 IE11
        if (/Windows NT 6.1/g.test(navigator.appVersion) && Modernizr.ie11) {
          $('.fa-times-thin').addClass('win7');
        }

        resolve(data);
      }
    }

    // start the initial render
    requestAnimationFrame(render);
  });
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
  _this.showBookmarks = $('.toggle-bookmarks').hasClass('mixitup-control-active');

  var limitEntriesEnabled = _this.data.enabledLimitEntries && !isNaN(_this.data.limitEntries);
  var limit = limitEntriesEnabled && _this.data.limitEntries > -1
    && !_this.isSearching && !_this.showBookmarks && !_this.isFiltering
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
      limit: limit
    }).then(function() {
      searchedData = searchedData || [];

      var truncated = results.truncated || (searchedData.length && searchedData.length < _this.listItems.length);

      if (openSingleEntry && searchedData.length === 1) {
        _this.showDetails(searchedData[0].id);
      }

      /**
       * Update search UI
       **/
      $inputField.val('');
      $inputField.blur();
      _this.$container.find('.new-small-card-list-container').removeClass('searching');
      // Adds search query to HTML
      _this.$container.find('.current-query').html(_this.searchValue);
      // Search value is provided
      _this.$container.find('.hidden-search-controls')
        [value.length ? 'addClass' : 'removeClass']('search-results');
      _this.calculateSearchHeight(_this.$container.find('.new-small-card-list-container'), !value.length);
      _this.$container.find('.hidden-search-controls')
        .addClass('active')
        [searchedData.length || truncated ? 'removeClass' : 'addClass']('no-results');

      if (!_this.data.forceRenderList
        && searchedData.length
        && !_.xorBy(searchedData, _this.searchedListItems, 'id').length) {
        // Same results returned. Do nothing.
        return Promise.resolve();
      }

      if (limitEntriesEnabled) {
        // Do not show limit text when user is searching or filtering
        var hideLimitText = !results.truncated && _this.data.limitEntries > 0;

        _this.$container.find('.limit-entries-text').toggleClass('hidden', hideLimitText);
      }

      if (!_this.data.forceRenderList
        && searchedData.length
        && searchedData.length === _.intersectionBy(searchedData, _this.searchedListItems, 'id').length) {
        // Search results is a subset of the current render.
        // Remove the extra records without re-render.
        _this.$container.find(_.map(_.differenceBy(_this.searchedListItems, searchedData, 'id'), function(record) {
          return '.small-card-list-item[data-entry-id="' + record.id + '"]';
        }).join(',')).remove();
        _this.searchedListItems = searchedData;

        return Promise.resolve();
      }

      /**
       * Render results
       **/

      $('#small-card-list-wrapper-' + _this.data.id).html('');

      _this.modifiedListItems = _this.addSummaryData(searchedData);
      _this.modifiedListItems = _this.Utils.Records.sortByField({
        records: _this.modifiedListItems,
        sortOrder: _this.sortOrder,
        sortField: _this.sortField,
        sortHTMLElements: false
      });

      return _this.renderLoopHTML().then(function(records) {
        _this.searchedListItems = searchedData;

        // Render user profile
        if (!_.isEmpty(_this.myProfileData)) {
          var myProfileTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['user-profile']];
          var myProfileTemplateCompiled = Handlebars.compile(myProfileTemplate());
          var profileIconTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['profile-icon']];
          var profileIconTemplateCompiled = Handlebars.compile(profileIconTemplate());

          _this.modifiedProfileData = _this.addSummaryData(_this.myProfileData, true);
          _this.$container.find('.my-profile-placeholder').html(myProfileTemplateCompiled(_this.modifiedProfileData[0]));
          _this.$container.find('.my-profile-icon').html(profileIconTemplateCompiled(_this.modifiedProfileData[0]));
          _this.$container.find('.section-top-wrapper').removeClass('profile-disabled');
        }

        return records;
      });
    }).then(function(renderedRecords) {
      _this.initializeSocials(renderedRecords).then(function() {
        return Fliplet.Hooks.run('flListDataAfterRenderListSocial', {
          instance: _this,
          value: value,
          records: _this.searchedListItems,
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
        filterOverlayClass: '.small-card-search-filter-overlay',
        filtersInOverlay: _this.data.filtersInOverlay,
        filterTypes: _this.filterTypes
      });

      return Fliplet.Hooks.run('flListDataAfterRenderList', {
        instance: _this,
        value: value,
        records: _this.searchedListItems,
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
  if (!_.get(this.data, 'social.bookmark')) {
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
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<i class="fa fa-bookmark-o"></i>',
          likedLabel: '<i class="fa fa-bookmark animated fadeIn"></i>',
          likeWrapper: '<div class="small-card-bookmark-wrapper btn-bookmark focus-outline" tabindex="0"></div>',
          likedWrapper: '<div class="small-card-bookmark-wrapper btn-bookmarked focus-outline" tabindex="0"></div>',
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
          _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');

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
          _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');

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

  var title = _this.$container.find('.small-card-detail-overlay .small-card-detail-wrapper[data-entry-id="' + id + '"] .small-card-list-detail-name').text().trim();

  if (record.bookmarkButton) {
    _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(record.bookmarkButton.isLiked() ? 'bookmarked' : 'not-bookmarked');

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

    _this.$container.find('.small-card-detail-overlay .small-card-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(btn.isLiked() ? 'bookmarked' : 'not-bookmarked');
  });
};

DynamicList.prototype.getAllBookmarks = function() {
  var _this = this;

  if (_this.fetchedAllBookmarks || !_.get(_this.data, 'social.bookmark') || !_this.data.bookmarkDataSourceId) {
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

  if (!_.get(_this.data, 'social.bookmark') || !_this.data.bookmarkDataSourceId) {
    return Promise.resolve();
  }

  return _this.getAllBookmarks().then(function() {
    return Promise.all(_.map(records, function(record) {
      var title = _this.$container.find('.small-card-list-item[data-entry-id="' + record.id + '"] .small-card-list-name').text().trim();
      var masterRecord = _.find(_this.listItems, { id: record.id });

      return _this.setupBookmarkButton({
        target: '.new-small-card-list-container .small-card-bookmark-holder-' + record.id,
        id: record.id,
        title: title,
        record: masterRecord
      });
    }));
  });
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
    if (!entry[obj.location]) {
      var content = '';

      if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.originalData));
      } else if (_this.data.filterFields.indexOf(obj.column) > -1) {
        content = _this.Utils.String.splitByCommas(entry.originalData[obj.column]).join(', ');
      } else {
        content = entry.originalData[obj.column];
      }

      entry[obj.location] = content;
    }
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
    } else if (_this.data.filterFields.indexOf(dynamicDataObj.column) > -1) {
      content = _this.Utils.String.splitByCommas(entry.originalData[dynamicDataObj.column]).join(', ');
    } else {
      content = entry.originalData[dynamicDataObj.column];
    }

    if (dynamicDataObj.type === 'image') {
      var imagesContentData = _this.Utils.Record.getImageContent(entry.originalData[dynamicDataObj.column]);
      var contentArray = imagesContentData.imagesArray;

      content = imagesContentData.imageContent;
      _this.imagesData[dynamicDataObj.id] = imagesContentData.imagesData;
    }

    // Define data object
    var newEntryDetail = {
      id: dynamicDataObj.id,
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
  var entryData = _.find(listData || _this.modifiedListItems, { id: id });
  // Process template with data
  var entryId = { id: id };
  var wrapper = '<div class="small-card-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = $('#small-card-detail-overlay-' + _this.data.id);
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

        $('body').addClass('lock');

        // Adds content to overlay
        $overlay.find('.small-card-detail-overlay-content-holder').html(wrapperTemplate(entryId));
        $overlay.find('.small-card-detail-wrapper').append(template(data.data || entryData));

        _this.initializeOverlaySocials(id);

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
    });
};

DynamicList.prototype.closeDetails = function() {
  if (this.openedEntryOnQuery && Fliplet.Navigate.query.dynamicListPreviousScreen === 'true') {
    Fliplet.Page.Context.remove('dynamicListPreviousScreen');

    return Fliplet.Navigate.back();
  }

  // Function that closes the overlay
  var _this = this;
  var $overlay = $('#small-card-detail-overlay-' + _this.data.id);

  Fliplet.Page.Context.remove('dynamicListOpenId');
  $overlay.removeClass('open');
  _this.$container.find('.new-small-card-list-container').removeClass('overlay-open');
  $('body').removeClass('lock');

  setTimeout(function() {
    $overlay.removeClass('ready');

    // Clears overlay
    $overlay.find('.small-card-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }

    _this.$container.find('.new-small-card-list-container, .dynamic-list-add-item, .small-card-list-wrapper').removeClass('hidden');
  }, 300);
};

DynamicList.prototype.expandElement = function(elementToExpand, id, listData) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
  if (elementToExpand.parents('.panel-group').not('.filter-overlay').length) {
    elementToExpand.parents('.panel-group').not('.filter-overlay').addClass('remove-transform');
  }

  // check to see if element is already expanded
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
      'z-index': 1010
    });

    elementToExpand.animate({
      'left': 0,
      'top': !isNaN(toTop) ? toTop : 0,
      'height': expandHeight,
      'width': expandWidth,
      'max-width': expandWidth
    }, 200, 'linear', function() {
      _this.showDetails(id, listData);

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
};

DynamicList.prototype.collapseElement = function(elementToCollapse) {
  // Function called when a list item is tapped to close
  var _this = this;

  $('body').removeClass('lock');
  elementToCollapse = $([]).add(elementToCollapse);
  elementToCollapse.parents('.small-card-list-item').addClass('closing');

  var directoryDetailImageWrapper = elementToCollapse.find('.small-card-list-detail-image-wrapper');
  var directoryDetailImage = elementToCollapse.find('.small-card-list-detail-image');

  if (!directoryDetailImageWrapper.length || !directoryDetailImage.length) {
    _this.closeDetails();
  }

  var collapseTarget = elementToCollapse.parent();

  if (!collapseTarget.length) {
    return;
  }

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
      'width': '100%'
    });
  });

  directoryDetailImageWrapper.animate({
    height: targetCollapseHeight
  }, 200, 'linear');

  directoryDetailImage.animate({
    height: targetCollapseHeight
  }, 200, 'linear',
  function() {
    elementToCollapse.css({ height: '100%' });
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
};
