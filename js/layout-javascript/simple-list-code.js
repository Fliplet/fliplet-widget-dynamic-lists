// Constructor
function DynamicList(id, data) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'simple-list': {
      'base': 'templates.build.simple-list-base',
      'loop': 'templates.build.simple-list-loop',
      'detail': 'templates.build.simple-list-detail',
      'filter': 'templates.build.simple-list-filters',
      'comments': 'templates.build.simple-list-comment',
      'single-comment': 'templates.build.simple-list-single-comment',
      'temp-comment': 'templates.build.simple-list-temp-comment'
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
  this.allUsers;
  this.usersToMention;
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</div>';
  this.entryClicked = undefined;
  this.isFiltering;
  this.isSearching;
  this.showBookmarks;
  this.fetchedAllBookmarks = false;

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.entryOverlay;
  this.myUserData = {};
  this.dataSourceColumns;
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

  /**
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

  this.data.bookmarksEnabled = _.get(this, 'data.social.bookmark');

  this.data.searchIconsEnabled = this.data.filtersEnabled || this.data.bookmarksEnabled || this.data.sortEnabled;

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
  this.$container.find('.simple-list-search-filter-overlay').removeClass('display');
  $('body').removeClass('lock has-filter-overlay');
};

DynamicList.prototype.attachObservers = function() {
  var _this = this;

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
        $listContainer: $('#simple-list-wrapper-' + _this.data.id),
        listItem: '.simple-list-item',
        records: _this.searchedListItems,
        sortOrder: _this.sortOrder,
        sortField: _this.sortField
      });
    })
    .on('click keydown', '.apply-filters', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.simple-list-container, .dynamic-list-add-item').removeClass('hidden');
      _this.$container.find('.fa-sliders').focus();

      var $selectedFilters = _this.$container.find('.hidden-filter-controls-filter.mixitup-control-active');

      if ($selectedFilters) {
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
    .on('click keydown', '.simple-list-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $el = $(event.target);

      if ($el.hasClass('simple-list-social-holder') || $el.parents('.simple-list-social-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.list-item-title').text().trim();
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

        $el.parents('.simple-list-container').addClass('hidden');
        _this.$container.find('.dynamic-list-add-item').addClass('hidden');

        _this.showDetails(entryId);
        Fliplet.Page.Context.update({
          dynamicListOpenId: entryId
        });
      });
    })
    .on('click keydown', '.simple-list-detail-overlay-close', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var result;

      _this.$container.find('.simple-list-container, .dynamic-list-add-item').removeClass('hidden');

      var id = _this.$container.find('.simple-list-detail-wrapper[data-entry-id]').data('entry-id');

      _this.$container.find('.simple-list-item[data-entry-id="' + id + '"]').focus();

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

      _this.closeDetails();
    })
    .on('click keydown', '.list-search-icon .fa-sliders', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-container');

      Fliplet.Page.Context.remove('dynamicListFilterHideControls');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.simple-list-search-filter-overlay').addClass('display');
        $('body').addClass('lock has-filter-overlay');

        _this.$container.find('.simple-list-search-filter-overlay .simple-list-overlay-close').focus();
        _this.$container.find('.dynamic-list-add-item').addClass('hidden');

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
    .on('click keydown', '.simple-list-overlay-close', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-search-filter-overlay');

      $parentElement.removeClass('display');

      _this.$container.find('.simple-list-container, .dynamic-list-add-item').removeClass('hidden');
      $('body').removeClass('lock has-filter-overlay');
      _this.$container.find('.list-search-icon .fa-sliders').focus();

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
            _this.$container.find('.simple-list-container').removeClass('searching');
            _this.isSearching = false;
            _this.searchData('');

            return;
          }

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + _this.data.layout,
            action: 'search',
            label: value
          });

          _this.$container.find('.simple-list-container').addClass('searching');
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
        _this.$container.find('.simple-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.searchData('');

        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'search',
        label: value
      });

      _this.$container.find('.simple-list-container').addClass('searching');
      _this.isSearching = true;
      _this.searchData(value);
    })
    .on('click keydown', '.clear-search', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.simple-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.searchData('');
    })
    .on('show.bs.collapse', '.simple-list-filters-panel .panel-collapse', function(event) {
      event.stopPropagation();
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.simple-list-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
    })
    .on('click keydown', '.simple-list-filters-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      $(event.target).find('.collapse').collapse('toggle');
    })
    .on('click keydown', '.simple-list-comment-holder', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      event.stopPropagation();

      var identifier;

      if (_this.$container.find('.simple-list-container').hasClass('overlay-open')) {
        identifier = $(this).parents('.simple-list-details-holder').data('entry-id');
      } else {
        identifier = $(this).parents('.simple-list-item').data('entry-id');
      }

      _this.entryClicked = identifier;
      _this.showComments(identifier);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click keydown', '.simple-list-comment-close-panel', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      _this.$container.find('.simple-list-comment-panel').removeClass('open');
      _this.$container.find('.simple-list-detail-overlay-content-holder').removeClass('lock');
      _this.$container.find('.simple-list-comment-close-panel').focus();

      var contextsToRemove = ['dynamicListOpenComments', 'dynamicListCommentId'];

      if (!_this.$container.find('.simple-list-container').hasClass('overlay-open')) {
        $('body').removeClass('lock');
        contextsToRemove.push('dynamicListOpenId');
      }

      Fliplet.Page.Context.remove(contextsToRemove);
    })
    .on('click', '.simple-list-comment-input-holder .comment', function() {
      var entryId = _this.entryClicked;
      var $commentArea = $(this).parents('.simple-list-comment-input-holder').find('[data-comment-body]');
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
          _that.parents('.simple-list-comment-panel').addClass('typing');

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
          _that.parents('.simple-list-comment-panel').removeClass('typing');
          window.scrollTo(0, 0);

          // Removes binding
          $(document).off('touchstart', '[data-comment-body]');
        }, 0);
      }
    })
    .on('keyup change', '[data-comment-body]', function() {
      var value = $(this).val().trim();

      if (value.length) {
        $(this).parents('.simple-list-comment-input-holder').addClass('ready');
      } else {
        $(this).parents('.simple-list-comment-input-holder').removeClass('ready');
      }
    })
    .on('click', '.simple-list-comment-input-holder .save', function() {
      var commentId = _this.$container.find('.fl-individual-comment.editing').data('id');
      var entryId = _this.entryClicked;
      var $commentArea = $(this).parents('.simple-list-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val();

      _this.$container.find('.fl-individual-comment').removeClass('editing');
      _this.$container.find('.simple-list-comment-input-holder').removeClass('editing');
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
    .on('click', '.simple-list-comment-input-holder .cancel', function() {
      _this.$container.find('.fl-individual-comment').removeClass('editing');
      _this.$container.find('.simple-list-comment-input-holder').removeClass('editing');

      var $messageArea = _this.$container.find('[data-comment-body]');

      $messageArea.val('').trigger('change');
      autosize.update($messageArea);
    })
    .on('click', '.final .fl-comment-value', function(e) {
      e.preventDefault();

      var _that = $(this);
      var commentId = $(this).parents('.fl-individual-comment').data('id');
      var $parentContainer = $(this).parents('.fl-individual-comment');
      var textToCopy = $(this).text().trim();

      if ($parentContainer.hasClass('current-user')) {
        Fliplet.UI.Actions({
          title: 'What do you want to do?',
          labels: [
            {
              label: 'Copy',
              action: {
                type: 'copyText',
                text: textToCopy
              }
            },
            {
              label: 'Edit',
              action: function() {
                var $messageArea = _this.$container.find('[data-comment-body]');

                _that.parents('.fl-individual-comment').addClass('editing');
                _this.$container.find('.simple-list-comment-input-holder').addClass('editing');

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
              label: 'Delete',
              action: function() {
                var options = {
                  title: 'Delete comment',
                  message: 'Are you sure you want to delete this comment?',
                  labels: ['Delete', 'Cancel'] // Native only (defaults to [OK,Cancel])
                };

                Fliplet.Navigate.confirm(options)
                  .then(function(result) {
                    Fliplet.Analytics.trackEvent({
                      category: 'list_dynamic_' + _this.data.layout,
                      action: 'comment_delete'
                    });

                    if (!result) {
                      return;
                    }

                    _this.deleteComment(commentId);
                  });
              }
            }
          ],
          cancel: 'Cancel'
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
          title: 'What do you want to do?',
          labels: [
            {
              label: 'Copy',
              action: {
                type: 'copyText',
                text: textToCopy
              }
            }
          ],
          cancel: 'Cancel'
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

      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');

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
      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');
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
    .on('click keydown', '.toggle-bookmarks', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $toggle = $(this);

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();
    })
    .on('click keydown', '.simple-list-detail-overlay .simple-list-bookmark-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var id = $(this).parents('.simple-list-details-holder').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $(this).parents('.simple-list-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked').focus();
        record.bookmarkButton.unlike();

        return;
      }

      $(this).parents('.simple-list-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked').focus();
      record.bookmarkButton.like();
    })
    .on('click keydown', '.simple-list-detail-overlay .simple-list-like-wrapper', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var id = $(this).parents('.simple-list-details-holder').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.likeButton) {
        return;
      }

      var count = record.likeButton.getCount();

      if (count < 1) {
        count = '';
      }

      if (record.liked) {
        $(this).parents('.simple-list-like-holder').removeClass('liked').addClass('not-liked').focus();
        record.likeButton.unlike();
        $(this).find('.count').html(count);

        return;
      }

      $(this).parents('.simple-list-like-holder').removeClass('not-liked').addClass('liked').focus();
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

  this.$container.find('.simple-list-item[data-entry-id="' + id + '"]').remove();
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
      _this.changeSort();

      return _this.parseSearchQueries();
    });
};

DynamicList.prototype.changeSort = function() {
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

  _this.$container.find('.simple-list-container').addClass('searching');
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
      likesEnabled: entry.likesEnabled,
      bookmarksEnabled: entry.bookmarksEnabled,
      commentsEnabled: entry.commentsEnabled,
      originalData: entry.data
    };

    // Uses sumamry view settings set by users
    _this.data['summary-fields'].some(function(obj) {
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

  $('#simple-list-wrapper-' + _this.data.id).empty();

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
        $('#simple-list-wrapper-' + _this.data.id).append(template(nextBatch));
        renderLoopIndex++;

        // if the browser is ready, render
        requestAnimationFrame(render);
      } else {
        _this.$container.find('.simple-list-container').removeClass('loading').addClass('ready');

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
  _this.showBookmarks = _this.$container.find('.toggle-bookmarks').hasClass('mixitup-control-active');

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
      _this.$container.find('.simple-list-container').removeClass('searching');
      // Adds search query to HTML
      _this.$container.find('.current-query').html(_this.searchValue);
      // Search value is provided
      _this.$container.find('.hidden-search-controls')[value.length ? 'addClass' : 'removeClass']('search-results');
      _this.calculateSearchHeight(_this.$container.find('.simple-list-container'), !value.length);
      _this.$container.find('.hidden-search-controls').addClass('active');
      _this.$container.find('.hidden-search-controls')[searchedData.length || truncated ? 'removeClass' : 'addClass']('no-results');

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
          return '.simple-list-item[data-entry-id="' + record.id + '"]';
        }).join(',')).remove();
        _this.searchedListItems = searchedData;

        return Promise.resolve();
      }

      /**
       * Render results
       **/

      $('#simple-list-wrapper-' + _this.data.id).html('');

      _this.modifiedListItems = _this.addSummaryData(searchedData);
      _this.modifiedListItems = _this.Utils.Records.sortByField({
        records: _this.modifiedListItems,
        sortOrder: _this.sortOrder,
        sortField: _this.sortField,
        sortHTMLElements: false
      });

      return _this.renderLoopHTML().then(function(records) {
        _this.searchedListItems = searchedData;

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
        filterOverlayClass: '.simple-list-search-filter-overlay',
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

DynamicList.prototype.getLikeIdentifier = function(record) {
  var uniqueId = this.Utils.Record.getUniqueId({
    record: record,
    config: this.data
  });
  var defaultIdentifier = {
    entryId: uniqueId + '-like'
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
  if (!_.get(this.data, 'social.likes')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var title = options.title;
  var record = options.record || _.find(_this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  return _this.getLikeIdentifier(record)
    .then(function(identifier) {
      return new Promise(function(resolve) {
        var btn = LikeButton({
          target: '.simple-list-like-holder-' + id,
          dataSourceId: _this.data.likesDataSourceId,
          content: identifier,
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart-o fa-lg"></i>',
          likedLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart fa-lg animated bounceIn"></i>',
          likeWrapper: '<div class="simple-list-like-wrapper focus-outline btn-like" tabindex="0"></div>',
          likedWrapper: '<div class="simple-list-like-wrapper focus-outline btn-liked" tabindex="0"></div>',
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
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);

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
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id).removeClass('liked').addClass('not-liked');
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);

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
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);

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
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id).removeClass('not-liked').addClass('liked');
          _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);

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
  if (!_.get(this.data, 'social.bookmark')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var title = options.title;
  var record = options.record || _.find(_this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  return _this.getBookmarkIdentifier(record)
    .then(function(identifier) {
      return new Promise(function(resolve) {
        var btn = LikeButton({
          target: '.simple-list-bookmark-holder-' + id,
          dataSourceId: _this.data.bookmarkDataSourceId,
          view: 'userBookmarks',
          content: identifier,
          name: Fliplet.Env.get('pageTitle') + '/' + title,
          likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
          likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
          likeWrapper: '<div class="simple-list-bookmark-wrapper btn-bookmark focus-outline" tabindex="0"></div>',
          likedWrapper: '<div class="simple-list-bookmark-wrapper btn-bookmarked focus-outline" tabindex="0"></div>',
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
          _this.$container.find('.simple-list-detail-overlay .simple-list-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');

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
          _this.$container.find('.simple-list-detail-overlay .simple-list-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');

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

  var bookmarkPromise = Promise.resolve();
  var likePromise = Promise.resolve();

  if (record.bookmarkButton) {
    _this.$container.find('.simple-list-detail-overlay .simple-list-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(record.bookmarkButton.isLiked() ? 'bookmarked' : 'not-bookmarked');
  } else {
    bookmarkPromise = _this.setupBookmarkButton({
      id: id,
      record: record
    }).then(function(btn) {
      if (!btn) {
        return;
      }

      _this.$container.find('.simple-list-detail-overlay .simple-list-bookmark-holder-' + id).removeClass('bookmarked not-bookmarked').addClass(btn.isLiked() ? 'bookmarked' : 'not-bookmarked');
    });
  }

  var count;

  if (record.likeButton) {
    count = record.likeButton.getCount() > 0 ? record.likeButton.getCount() : '';
    _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);
    _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id).removeClass('liked not-liked').addClass(record.likeButton.isLiked() ? 'liked' : 'not-liked');
  } else {
    likePromise = _this.setupLikeButton({
      id: id,
      record: record
    }).then(function(btn) {
      if (!btn) {
        return;
      }

      count = btn.getCount() > 0 ? btn.getCount() : '';
      _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id + ' .count').html(count);
      _this.$container.find('.simple-list-detail-overlay .simple-list-like-holder-' + id).removeClass('liked not-liked').addClass(btn.isLiked() ? 'liked' : 'not-liked');
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

  return _this.getAllBookmarks().then(function() {
    return Promise.all(_.flatten(_.map(records, function(record) {
      var title = _this.$container.find('.simple-list-item[data-entry-id="' + record.id + '"] .list-item-title').text().trim();
      var masterRecord = _.find(_this.listItems, { id: record.id });

      return [
        _this.setupLikeButton({
          target: '.simple-list-container .simple-list-like-holder-' + record.id,
          id: record.id,
          title: title,
          record: masterRecord
        }),
        _this.setupBookmarkButton({
          target: '.simple-list-container .simple-list-bookmark-holder-' + record.id,
          id: record.id,
          title: title,
          record: masterRecord
        }),
        _this.getEntryComments({
          id: record.id,
          record: masterRecord
        })
      ];
    })));
  });
};

DynamicList.prototype.getCommentUsers = function() {
  if (!_.get(this.data, 'social.comments')) {
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
      if (!_.isEmpty(_this.myUserData)) {
        var myUser = _.find(_this.allUsers, function(user) {
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

DynamicList.prototype.addDetailViewData = function(entry) {
  var _this = this;

  if (_.isArray(entry.data) && entry.data.length) {
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
    var savedColumns = _.map(_this.data.detailViewOptions, 'column');
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
  var wrapper = '<div class="simple-list-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = $('#simple-list-detail-overlay-' + _this.data.id);
  var src = _this.data.advancedSettings && _this.data.advancedSettings.detailHTML
    ? _this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['detail']]();

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
        $overlay.find('.simple-list-detail-overlay-content-holder').html(wrapperTemplate(entryId));
        $overlay.find('.simple-list-detail-wrapper').append(template(data.data || entryData));

        _this.initializeOverlaySocials(id);

        // Trigger animations
        $('body').addClass('lock');
        _this.$container.find('.simple-list-container').addClass('overlay-open');
        $overlay.addClass('open');

        if (typeof _this.data.afterShowDetails === 'function') {
          _this.data.afterShowDetails({
            config: _this.data,
            src: data.src || src,
            data: data.data || entryData
          });
        }
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
  var $overlay = $('#simple-list-detail-overlay-' + _this.data.id);

  Fliplet.Page.Context.remove('dynamicListOpenId');
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

    _this.$container.find('.simple-list-container, .dynamic-list-add-item').removeClass('hidden');
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
  if (!_.get(this.data, 'social.comments')) {
    return Promise.resolve();
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var record = options.record || _.find(_this.listItems, { id: id });

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
      return connection.find();
    });
};

DynamicList.prototype.updateCommentCounter = function(options) {
  if (!_.get(this.data, 'social.comments')) {
    return;
  }

  options = options || {};

  var _this = this;
  var id = options.id;
  var record = options.record || _.find(_this.listItems, { id: id });

  if (!record) {
    return;
  }

  var commentCounterTemplate = '<span class="count">{{#if count}}{{count}}{{/if}}</span> <i class="fa fa-comment-o fa-lg"></i> <span class="comment-label">Comment</span>';
  var counterCompiled = Handlebars.compile(commentCounterTemplate);
  var data = {
    count: TN(record.commentCount)
  };
  var html = counterCompiled(data);

  // Updates both main list and overlay comment counters
  _this.$container.find('.simple-list-comemnt-holder-' + id).html(html);
};

DynamicList.prototype.showComments = function(id, commentId) {
  var _this = this;

  _this.$container.find('simple-list-comment-area').html(_this.commentsLoadingHTML);
  $('body').addClass('lock');
  _this.$container.find('.simple-list-detail-overlay-content-holder').addClass('lock');
  _this.$container.find('.simple-list-comment-panel').addClass('open');

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
    var entry = _.find(_this.listItems, { id: id });
    var entryComments = _.get(entry, 'comments');

    // Display comments
    entryComments.forEach(function(entry, index) {
      // Convert data/time
      var newDate = new Date(entry.createdAt);
      var timeInMilliseconds = newDate.getTime();
      var userName = _.compact(_.map(_this.data.userNameFields, function(name) {
        return _.get(entry, 'data.settings.user.' + name);
      })).join(' ').trim();

      entryComments[index].timeInMilliseconds = timeInMilliseconds;
      entryComments[index].literalDate = TD(entry.createdAt, { format: 'lll' });
      entryComments[index].userName = userName;
      entryComments[index].photo = entry.data.settings.user[_this.data.userPhotoColumn] || '';
      entryComments[index].text = entry.data.settings.text || '';

      var myEmail = '';

      if (!_.isEmpty(_this.myUserData)) {
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
    entryComments = _.orderBy(entryComments, ['timeInMilliseconds'], ['asc']);

    if (!_this.autosizeInit) {
      autosize(_this.$container.find('simple-list-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['comments']];
    var commentsTemplateCompiled = Handlebars.compile(commentsTemplate());
    var commentsHTML = commentsTemplateCompiled(entryComments);
    var $commentArea = _this.$container.find('.simple-list-comment-area');
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
            scrollTop = $commentHolder.position().top - $('.simple-list-comment-panel-header').outerHeight();
          }
        }

        $commentArea.scrollTop(scrollTop);
      });
    });
  }).catch(function(error) {
    Fliplet.UI.Toast.error(error, {
      message: 'Unable to load comments'
    });
  });
};

DynamicList.prototype.sendComment = function(id, value) {
  var record = _.find(this.listItems, { id: id });

  if (!record) {
    return Promise.resolve();
  }

  var _this = this;
  var guid = Fliplet.guid();
  var userName = '';

  if (_.isEmpty(_this.myUserData) || (!_this.myUserData[_this.data.userEmailColumn] && !_this.myUserData['email'] && !_this.myUserData['Email'])) {
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

    return Fliplet.UI.Toast('You must be logged in to use this feature');
  }

  var myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'] || _this.myUserData['Email'];
  var userFromDataSource = _.find(_this.allUsers, function(user) {
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
    return Fliplet.UI.Toast.error('We couldn\'t find your user details.', {
      message: 'Invalid user'
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

    if (_.get(record, 'commentCount')) {
      record.commentCount++;
    }

    _this.updateCommentCounter({
      id: id,
      record: record
    });

    userName = _.compact(_.map(_this.data.userNameFields, function(name) {
      return _this.myUserData.isSaml2
        ? _.get(userFromDataSource, 'data.' + name)
        : _this.myUserData[name];
    })).join(' ').trim();

    var comment = {
      fromName: userName,
      user: _this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData
    };

    _.assignIn(comment, { contentDataSourceEntryId: id });

    var timestamp = (new Date()).toISOString();

    // Get mentioned user(s)
    var mentionRegexp = /\B@[a-z0-9_-]+/ig;
    var mentions = value.match(mentionRegexp);
    var usersMentioned = [];

    if (mentions && mentions.length) {
      var filteredUsers = _.filter(_this.usersToMention, function(userToMention) {
        return mentions.indexOf('@' + userToMention.username) > -1;
      });

      if (filteredUsers && filteredUsers.length) {
        filteredUsers.forEach(function(filteredUser) {
          var foundUser = _.find(_this.allUsers, function(user) {
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

    if (_.get(record, 'commentCount')) {
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
  var userName = _.compact(_.map(_this.data.userNameFields, function(name) {
    return _this.myUserData.isSaml2
      ? _.get(userFromDataSource, 'data.' + name)
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
  var $commentArea = _this.$container.find('.simple-list-comment-area');

  $commentArea.append(tempCommentHTML);
  $commentArea.stop().animate({
    scrollTop: $commentArea[0].scrollHeight
  }, 250);
};

DynamicList.prototype.replaceComment = function(guid, commentData, context) {
  var _this = this;
  var userName = _.compact(_.map(_this.data.userNameFields, function(name) {
    return _.get(commentData, 'data.settings.user.' + name);
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
  var entryId = _this.$container.find('.simple-list-details-holder').data('entry-id') || _this.entryClicked;
  var entry = _.find(_this.listItems, { id: entryId });
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
      _.remove(entry.comments, { id: id });
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
      message: 'Error deleting comment'
    });
  });
};

DynamicList.prototype.saveComment = function(entryId, commentId, newComment) {
  var _this = this;
  var entry = _.find(_this.listItems, { id: entryId });
  var entryComments = _.get(entry, 'comments', []);
  var commentData = _.find(entryComments, { id: commentId });

  if (!commentData) {
    return Promise.reject('Comment not found');
  }

  var oldCommentData = _.clone(commentData);
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
        message: 'Error updating comment'
      });
    });
};
