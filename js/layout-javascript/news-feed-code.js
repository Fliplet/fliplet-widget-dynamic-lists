// Constructor
function DynamicList(id, data, container) {
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
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.$overlay;

  // Other variables
  // Global variables
  this.allowClick = true;
  this.autosizeInit = false;

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.dataSourceColumns;
  this.allUsers;
  this.usersToMention = [];
  this.myUserData;
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</div>';
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

  /**
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

  this.data.bookmarksEnabled = _this.data.social.bookmark;

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

  this.detailHTML = Handlebars.compile(this.src);

  // Register handlebars helpers
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

DynamicList.prototype.toggleFilterElement = function (target, toggle) {
  var $target = this.Utils.DOM.$(target);

  if (typeof toggle === 'undefined') {
    $target.toggleClass('mixitup-control-active');
  } else {
    $target[!!toggle ? 'addClass' : 'removeClass']('mixitup-control-active');
  }

  if (this.$container.find('.mixitup-control-active').length) {
    this.$container.find('.clear-filters').removeClass('hidden');
  } else {
    this.$container.find('.clear-filters').addClass('hidden');
  }
}

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
      _this.searchData();

      $(this).parents('.news-feed-search-filter-overlay').removeClass('display');
      $('body').removeClass('lock');
    })
    .on('click', '.clear-filters', function() {
      _this.toggleFilterElement(_this.$container.find('.mixitup-control-active'), false);
      $(this).addClass('hidden');
      _this.searchData();
    })
    .on('click', '.hidden-filter-controls-filter', function() {
      var $filter = $(this);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $filter.text().trim()
      });

      _this.toggleFilterElement($filter);

      if ($filter.parents('.inline-filter-holder').length) {
        _this.searchData();
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
    .on('click', '.news-feed-list-item', function(event) {
      if ($(event.target).hasClass('news-feed-info-holder') || $(event.target).parents('.news-feed-info-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.news-feed-item-title').text().trim();

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
        if (_this.allowClick) {
          _this.showDetails(entryId);
        }
      });
    })
    .on('click', '.news-feed-detail-overlay-close', function() {
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

      _this.closeDetails();
    })
    .on('click', '.list-search-icon .fa-sliders', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-news-feed-list-container');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.news-feed-search-filter-overlay').addClass('display');
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
    .on('click', '.news-feed-overlay-close', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.news-feed-search-filter-overlay');
      $parentElement.removeClass('display');
      $('body').removeClass('lock');

      // Clear all selected filters
      _this.toggleFilterElement(_this.$container.find('.mixitup-control-active'), false);

      // No filters selected
      if (_.isEmpty(_this.activeFilters)) {
        _this.$container.find('.clear-filters').addClass('hidden');
        return;
      }

      if (!_.has(_this.activeFilters, 'undefined')) {
        // Select filters based on existing settings
        var selectors = _.flatten(_.map(_this.activeFilters, function (values, field) {
          return _.map(values, function (value) {
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
    .on('click', '.list-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-news-feed-list-container');

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
    })
    .on('click', '.search-holder .search-btn', function(e) {
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
    .on('click', '.clear-search', function() {
      _this.$container.find('.new-news-feed-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.searchData('');
    })
    .on('show.bs.collapse', '.news-feed-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.news-feed-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
    })
    .on('click', '.news-feed-comment-holder', function(e) {
      e.stopPropagation();
      var identifier;
      if (_this.$container.find('.new-news-feed-list-container').hasClass('overlay-open')) {
        identifier = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      } else {
        identifier = $(this).parents('.news-feed-list-item').data('entry-id');
      }
      _this.entryClicked = identifier;
      _this.showComments(identifier);
      $('body').addClass('lock');
      _this.$container.find('.new-news-feed-comment-panel').addClass('open');

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click', '.news-feed-comment-close-panel', function() {
      _this.$container.find('.new-news-feed-comment-panel').removeClass('open');
      _this.$container.find('.news-feed-list-item.open .slide-over').removeClass('lock');
      if (!_this.$container.find('.news-feed-detail-overlay').hasClass('open')) {
        $('body').removeClass('lock');
      }
    })
    .on('click', '.news-feed-comment-input-holder .comment', function() {
      var entryId = _this.$container.find('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
      var $commentArea = $(this).parents('.news-feed-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val();

      $commentArea.val('').trigger('change');;
      autosize.update($commentArea);

      if (comment !== '') {
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
      var value = $(this).val();

      if (value.length) {
        $(this).parents('.news-feed-comment-input-holder').addClass('ready');
      } else {
        $(this).parents('.news-feed-comment-input-holder').removeClass('ready');
      }
    })
    .on('click', '.news-feed-comment-input-holder .save', function() {
      var commentId = _this.$container.find('.fl-individual-comment.editing').data('id');
      var entryId = _this.$container.find('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
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
              action: function (i) {
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
              label: 'Delete',
              action: function (i) {
                var options = {
                  title: 'Delete comment',
                  message: 'Are you sure you want to delete this comment?',
                  labels: ['Delete','Cancel'] // Native only (defaults to [OK,Cancel])
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
        }).then(function(i){
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
        }).then(function(i){
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
      var entryID = $(this).parents('.news-feed-details-content-holder').data('entry-id');
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
      var entryID = $(this).parents('.news-feed-details-content-holder').data('entry-id');
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
    .on('click', '.toggle-bookmarks', function () {
      var $toggle = $(this);

      $toggle.toggleClass('mixitup-control-active');
      _this.searchData();
    })
    .on('click', '.news-feed-detail-overlay .news-feed-bookmark-wrapper', function() {
      var id = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

      if (!record || !record.bookmarkButton) {
        return;
      }

      if (record.bookmarked) {
        $(this).parents('.news-feed-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
        record.bookmarkButton.unlike();
        return;
      }

      $(this).parents('.news-feed-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
      record.bookmarkButton.like();
    })
    .on('click', '.news-feed-detail-overlay .news-feed-like-wrapper', function() {
      var id = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      var record = _.find(_this.listItems, { id: id });

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

  this.$container.find('.news-feed-list-item[data-entry-id="' + id + '"]').remove();
}

DynamicList.prototype.initializeOverlaySocials = function (id) {
  var _this = this;
  var record = _.find(_this.listItems, { id: id });

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
      identifier: id + '-bookmark',
      title: title,
      record: record
    }).then(function (btn) {
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
      identifier: id + '-like',
      title: title,
      record: record
    }).then(function (btn) {
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

DynamicList.prototype.initializeSocials = function (records) {
  var _this = this;

  return _this.getAllBookmarks().then(function () {
    return Promise.all(_.flatten(_.map(records, function (record) {
      var title = _this.$container.find('.news-feed-list-item[data-entry-id="' + record.id + '"] .news-feed-item-title').text().trim();
      var masterRecord = _.find(_this.listItems, { id: record.id });

      return [
        _this.setupLikeButton({
          target: '.new-news-feed-list-container .news-feed-like-holder-' + record.id,
          id: record.id,
          identifier: record.id + '-like',
          title: title,
          record: masterRecord
        }),
        _this.setupBookmarkButton({
          target: '.new-news-feed-list-container .news-feed-bookmark-holder-' + record.id,
          id: record.id,
          identifier: record.id + '-bookmark',
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

DynamicList.prototype.getCommentUsers = function () {
  if (!_.get(this.data, 'social.comments')) {
    return Promise.resolve();
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
      if (_this.myUserData) {
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
    .then(function (usersToMention) {
      _this.usersToMention = usersToMention;
    });
};

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render Base HTML template
  _this.renderBaseHTML();
  _this.attachObservers();

  // Render list with default data
  if (_this.data.defaultData) {
    var records = _this.Utils.Records.prepareData({
      records: _this.data.defaultEntries,
      config: _this.data,
      filterQueries: _this.queryPreFilter ? _this.pvPreFilterQuery : undefined
    });

    _this.listItems = records;
    _this.dataSourceColumns = _this.data.defaultColumns;

    return _this.Utils.Records.updateFiles({
      records: _this.listItems,
      config: _this.data
    }).then(function(response) {
      _this.listItems = _.uniqBy(response, function (item) {
        return item.id;
      });

      // Render Loop HTML
      _this.prepareToRenderLoop(_this.listItems);
      _this.addFilters(_this.modifiedListItems);
      _this.renderLoopHTML().then(function (records) {
        _this.searchedListItems = _.clone(_this.listItems);
        return _this.initializeSocials(records);
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
      _this.addFilters(_this.modifiedListItems);
      _this.parseFilterQueries();
      _this.parseSearchQueries();
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

DynamicList.prototype.parseSearchQueries = function() {
  var _this = this;

  if (!_.get(_this.pvSearchQuery, 'value')) {
    // Continue to exectute query filters
    return _this.searchData({
      query: true
    });
  }

  if (_.hasIn(_this.pvSearchQuery, 'column')) {
    // Query search column and value provided
    return _this.searchData({
      value: _this.pvSearchQuery.value,
      column: _this.pvSearchQuery.column,
      openSingleEntry: _this.pvSearchQuery.openSingleEntry,
      query: true
    });
  }

  // Query search value provided without column
  _this.$container.find('.new-news-feed-list-container').addClass('searching');
  _this.isSearching = true;

  return _this.searchData({
    value: _this.pvSearchQuery.value,
    openSingleEntry: _this.pvSearchQuery.openSingleEntry,
    query: true
  });
}

DynamicList.prototype.parseFilterQueries = function() {
  var _this = this;

  if (!_this.queryFilter) {
    return;
  }

  var filterSelectors = _this.Utils.Query.getFilterSelectors({ query: _this.pvFilterQuery });

  var $filters = _this.$container.find(_.map(filterSelectors, function (selector) {
    return '.hidden-filter-controls-filter' + selector;
  }).join(','));

  _this.toggleFilterElement($filters, true);
  $filters.parents('.small-card-filters-panel').find('.panel-collapse').addClass('in');

  if (!_.get(_this.pvFilterQuery, 'hideControls', false)) {
    _this.$container.find('.hidden-filter-controls').addClass('active');
    _this.$container.find('.list-search-cancel').addClass('active');

    if (!_this.data.filtersInOverlay) {
      _this.$container.find('.list-search-icon .fa-sliders').addClass('active');
    }

    _this.calculateFiltersHeight(_this.$container.find('.new-news-feed-list-container'));
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
}

DynamicList.prototype.prepareToRenderLoop = function(records) {
  var _this = this;
  var savedColumns = [];
  var loopHTML = '';
  var modifiedData = _this.Utils.Records.addFilterProperties({
    records: records,
    config: _this.data
  });
  modifiedData = _this.getPermissions(modifiedData);

  var loopData = [];

  // Uses sumamry view settings set by users
  modifiedData.forEach(function(entry) {
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

    _this.data.detailViewOptions.forEach(function(dynamicDataObj) {
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

  savedColumns = _this.data.detailViewOptions.map(function(data){
    return data.column;
  })

  var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
  if (_this.data.detailViewAutoUpdate && extraColumns.length) {
    loopData.forEach(function(entry, index) {
      var entryData = _.find(modifiedData, function(modEntry) {
        return modEntry.id === entry.id;
      });

      extraColumns.forEach(function(column) {
        var newColumnData = {
          id: entryData.id,
          content: entryData.data[column],
          label: column,
          labelEnabled: true,
          type: 'text'
        };

        entry.entryDetails.push(newColumnData);
      });
    });
  }
  _this.modifiedListItems = loopData;
}

DynamicList.prototype.renderLoopHTML = function (iterateeCb) {
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

  $('#news-feed-list-wrapper-' + _this.data.id).empty();

  var renderLoopIndex = 0;
  var data = (limitedList || _this.modifiedListItems);

  return new Promise(function (resolve) {
    function render() {
      // get the next batch of items to render
      var nextBatch = data.slice(
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE,
        renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE
      );

      if (nextBatch.length) {
        $('#news-feed-list-wrapper-' + _this.data.id).append(template(nextBatch));
        if (iterateeCb && typeof iterateeCb === 'function') {
          if (renderLoopIndex === 0) {
            _this.$container.find('.new-news-feed-list-container').removeClass('loading').addClass('ready');
          }
          iterateeCb(renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE, renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE);
        }
        renderLoopIndex++;
        // if the browser is ready, render
        requestAnimationFrame(render);
      } else {
        _this.$container.find('.new-news-feed-list-container').removeClass('loading').addClass('ready');
        resolve(data);
      }
    }
    // start the initial render
    requestAnimationFrame(render);
  });
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

DynamicList.prototype.getActiveFilters = function () {
  return _(this.$container.find('.hidden-filter-controls-filter.mixitup-control-active'))
    .map(function (el) {
      return _.pickBy({
        class: el.dataset.toggle,
        field: el.dataset.field,
        value: el.dataset.value
      });
    })
    .groupBy('field')
    .mapValues(function (filters) {
      return _.map(filters, function (filter) {
        return _.has(filter, 'field') && _.has(filter, 'value')
          ? filter.value
          : filter.class;
      });
    })
    .value();
};

DynamicList.prototype.calculateFiltersHeight = function($el) {
  $el.find('.hidden-filter-controls').each(function () {
    $(this).animate({
      height: '100%',
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
  _this.activeFilters = _this.getActiveFilters();
  _this.isSearching = value !== '';
  _this.isFiltering = !_.isEmpty(_this.activeFilters);
  _this.showBookmarks = $('.toggle-bookmarks').hasClass('mixitup-control-active');

  var limit = _this.data.enabledLimitEntries && _this.data.limitEntries
  && !_this.isSearching && !_this.showBookmarks && !_this.isFiltering
    ? _this.data.limitEntries
    : -1;

  return _this.Utils.Records.runSearch({
    value: value,
    records: _this.listItems,
    fields: fields,
    config: _this.data,
    activeFilters: _this.activeFilters,
    showBookmarks: _this.showBookmarks,
    limit: limit
  }).then(function (results) {
    results = results || {};

    if (Array.isArray(results)) {
      results = {
        records: searchedData
      };
    }

    var searchedData = results.records;
    var truncated = results.truncated;

    if (openSingleEntry && searchedData.length === 1) {
      _this.showDetails(searchedData[0].id);
    }

    /**
     * Update search UI
     **/
    $inputField.val('');
    $inputField.blur();
    _this.$container.find('.new-news-feed-list-container').removeClass('searching');
    // Adds search query to HTML
    _this.$container.find('.current-query').html(_this.searchValue);
    // Search value is provided
    _this.$container.find('.hidden-search-controls')[value.length ? 'addClass' : 'removeClass']('search-results');
    _this.calculateSearchHeight(_this.$container.find('.new-news-feed-list-container'), !value.length);
    _this.$container.find('.hidden-search-controls').addClass('active');
    _this.$container.find('.hidden-search-controls')[searchedData.length ? 'removeClass' : 'addClass']('no-results');

    if (searchedData.length && !_.xorBy(searchedData, _this.searchedListItems, 'id').length) {
      // Same results returned. Do nothing.
      return Promise.resolve();
    }

    if (_this.data.enabledLimitEntries) {
      _this.$container.find('.limit-entries-text')[truncated ? 'removeClass' : 'addClass']('hidden');
    }

    if (searchedData.length && searchedData.length === _.intersectionBy(searchedData, _this.searchedListItems, 'id').length) {
      // Search results is a subset of the current render.
      // Remove the extra records without re-render.
      _this.$container.find(_.map(_.differenceBy(_this.searchedListItems, searchedData, 'id'), function (record) {
        return '.news-feed-list-item[data-entry-id="' + record.id + '"]';
      }).join(',')).remove();
      _this.searchedListItems = searchedData;
      return Promise.resolve();
    }

    /**
     * Render results
     **/

    $('#news-feed-list-wrapper-' + _this.data.id).html('');

    _this.searchedListItems = searchedData;
    _this.prepareToRenderLoop(searchedData);
    return _this.renderLoopHTML().then(function (records) {
      return _this.initializeSocials(records);
    });
  });
}

DynamicList.prototype.setupLikeButton = function(options) {
  if (!_.get(this.data, 'social.likes')) {
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
      target: target,
      dataSourceId: _this.data.likesDataSourceId,
      content: {
        entryId: identifier,
        pageId: Fliplet.Env.get('pageId')
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart-o fa-lg"></i>',
      likedLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart fa-lg animated bounceIn"></i>',
      likeWrapper: '<div class="news-feed-like-wrapper btn-like"></div>',
      likedWrapper: '<div class="news-feed-like-wrapper btn-liked"></div>',
      addType: 'html',
      liked: record.liked,
      count: record.likeCount
    });
    record.likeButton = btn;

    btn.on('like.status', function (liked, count) {
      record.liked = liked;
      record.likeCount = count;
      resolve(btn);
    });

    btn.on('liked', function(data){
      var count = btn.getCount() > 0 ? btn.getCount() : '';

      record.liked = btn.isLiked();
      record.likeCount = count;
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_like',
        label: title
      });
    });

    btn.on('liked.fail', function(data){
      var count = btn.getCount() > 0 ? btn.getCount() : '';

      record.liked = btn.isLiked();
      record.likeCount = count;
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('liked').addClass('not-liked');
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);
    });

    btn.on('unliked', function(data){
      var count = btn.getCount() > 0 ? btn.getCount() : '';

      record.liked = btn.isLiked();
      record.likeCount = count;
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unlike',
        label: title
      });
    });

    btn.on('unliked.fail', function(data){
      var count = btn.getCount() > 0 ? btn.getCount() : '';

      record.liked = btn.isLiked();
      record.likeCount = count;
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id).removeClass('not-liked').addClass('liked');
      _this.$container.find('.news-feed-detail-overlay .news-feed-like-holder-' + id + ' .count').html(count);
    });
  });
}

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
      target: target,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: {
        entryId: identifier
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
      likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
      likeWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmarked"></div>',
      addType: 'html',
      getAllCounts: false,
      liked: record.bookmarked
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
      _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('bookmarked').addClass('not-bookmarked');
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
      _this.$container.find('.news-feed-detail-overlay .news-feed-bookmark-holder-' + id).removeClass('not-bookmarked').addClass('bookmarked');
    });
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

DynamicList.prototype.showDetails = function (id) {
  // Function that loads the selected entry data into an overlay for more details
  var _this = this;
  var entryData = _.find(_this.modifiedListItems, { id: id });
  var wrapper = '<div class="news-feed-detail-wrapper" data-entry-id="{{id}}"></div>';
  var entryId = { id: id };
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
    _this.$overlay.find('.news-feed-detail-overlay-content-holder').html(wrapperTemplate(entryId));
    _this.$overlay.find('.news-feed-detail-wrapper').append(template(data.data || entryData));

    _this.initializeOverlaySocials(id);

    // Trigger animations
    $('body').addClass('lock');
    _this.$container.find('.new-news-feed-list-container').addClass('overlay-open');

    // Calculate top position when image finishes loading
    if ($(window).width() < 640) {
      _this.$container.find('.news-feed-list-detail-image-wrapper img').one('load', function() {
        var expandedPosition = $(this).outerHeight();
        _this.$overlay.find('.news-feed-item-inner-content').css({ top: expandedPosition + 'px' });
      }).each(function() {
        if (this.complete) {
          $(this).trigger('load');
        }
      });
    }

    _this.$overlay.addClass('open');

    if (typeof _this.data.afterShowDetails === 'function') {
      _this.data.afterShowDetails({
        config: _this.data,
        src: data.src || src,
        data: data.data || entryData
      });
    }
  });
}

DynamicList.prototype.closeDetails = function() {
  // Function that closes the overlay
  var _this = this;

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
  }, 300);
}

/******************/
/**** COMMENTS ****/
/******************/

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
  var content = {
    contentDataSourceEntryId: id,
    type: 'comment'
  };
  var getComments = Promise.resolve();

  if (typeof count === 'undefined' || options.force) {
    getComments = Fliplet.Content({ dataSourceId: _this.data.commentsDataSourceId })
      .then(function(instance) {
        return instance.query({
          allowGrouping: true,
          where: {
            content: content
          }
        });
      })
      .then(function(entries){
        record.comments = entries;
        record.commentCount = entries.length;
      });
  }

  return getComments
    .then(function () {
      _this.updateCommentCounter({
        id: id,
        record: record
      });
    });
}

DynamicList.prototype.connectToUsersDataSource = function() {
  var _this = this;
  var options = {
    offline: true // By default on native platform it connects to offline DB. Set this option to false to connect to api's
  }

  return Fliplet.DataSources.connect(_this.data.userDataSourceId, options)
    .then(function(connection) {
      return connection.find();
    });
}

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
    count: record.commentCount
  };
  var html = counterCompiled(data);

  // Updates both main list and overlay comment counters
  _this.$container.find('.news-feed-comemnt-holder-' + id).html(html);
}

DynamicList.prototype.showComments = function(id) {
  var _this = this;

  _this.$container.find('.news-feed-comment-area').html(_this.commentsLoadingHTML);

  return _this.getCommentUsers().then(function () {
    return _this.getEntryComments({
      id: id,
      force: true
    });
  }).then(function() {
    // Get comments for entry
    var entryComments = _.get(_.find(_this.listItems, { id: id }), 'comments');

    // Display comments
    entryComments.forEach(function(entry, index) {
      // Convert data/time
      var newDate = new Date(entry.createdAt);
      var timeInMilliseconds = newDate.getTime();
      var userName = _.compact(_.map(_this.data.userNameFields, function (name) {
        return _.get(entry, 'data.settings.user.' + name);
      })).join(' ').trim();

      entryComments[index].timeInMilliseconds = timeInMilliseconds;
      entryComments[index].literalDate = moment(entry.createdAt).calendar(null, {
        sameDay: '[Today], HH:mm',
        nextDay: '[Tomorrow], HH:mm',
        nextWeek: 'dddd, HH:mm',
        lastDay: '[Yesterday], HH:mm',
        lastWeek: 'dddd, HH:mm',
        sameElse: 'MMM Do YY, HH:mm'
      });
      entryComments[index].userName = userName;
      entryComments[index].photo = entry.data.settings.user[_this.data.userPhotoColumn] || '';
      entryComments[index].text = entry.data.settings.text || '';

      var myEmail = '';
      if (_this.myUserData) {
        myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'];
      }

      var dataSourceEmail = '';
      if (entry.data.settings.user && entry.data.settings.user[_this.data.userEmailColumn]) {
        dataSourceEmail = entry.data.settings.user[_this.data.userEmailColumn];
      }

      // Check if comment is from current user
      if (_this.myUserData && _this.myUserData.isSaml2) {
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
      autosize(_this.$container.find('.news-feed-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['comments']];
    var commentsTemplateCompiled = Handlebars.compile(commentsTemplate());
    var commentsHTML = commentsTemplateCompiled(entryComments);
    // Display comments (fl-comments-list-holder)
    _this.$container.find('.news-feed-comment-area').html(commentsHTML).stop().animate({
      scrollTop: _this.$container.find('.news-feed-comment-area')[0].scrollHeight
    }, 250);
  }).catch(function (error) {
    Fliplet.UI.Toast.error(error, {
      message: 'Unable to load comments'
    });
  });
}

DynamicList.prototype.sendComment = function(id, value) {
  var _this = this;
  var guid = Fliplet.guid();
  var userName = '';

  if (!_this.myUserData || (_this.myUserData && (!_this.myUserData[_this.data.userEmailColumn] && !_this.myUserData['email']))) {
    return Fliplet.Navigate.popup({
      title: 'Invalid login',
      message: 'You must be logged in to use this feature.'
    });
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
    return Fliplet.Navigate.popup({
      title: 'Invalid user',
      message: 'We couldn\'t find your user details.'
    });
  }

  _this.appendTempComment(id, value, guid, userFromDataSource);

  var record = _.find(_this.listItems, { id: id });

  if (_.get(record, 'commentCount')) {
    record.commentCount++;
  }

  _this.updateCommentCounter({
    id: id,
    record: record
  });

  userName = _.compact(_.map(_this.data.userNameFields, function (name) {
    return _this.myUserData.isSaml2
      ? _.get(userFromDataSource, 'data.' + name)
      : _this.myUserData[name];
  })).join(' ').trim();

  var comment = {
    fromName: userName,
    user: _this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData
  };

  var content = {
    contentDataSourceEntryId: id,
    type: 'comment'
  };

  _.assignIn(comment, { contentDataSourceEntryId: id });

  var query;

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

  return Fliplet.Profile.Content({ dataSourceId: _this.data.commentsDataSourceId })
    .then(function(instance) {
      return instance.create(content, {
        settings: comment
      })
    })
    .then(function(comment) {
      record.comments.push(comment);
      _this.replaceComment(guid, comment, 'final');
    })
    .catch(function onQueryError(error) {
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
}

DynamicList.prototype.appendTempComment = function(id, value, guid, userFromDataSource) {
  var _this = this;
  var timestamp = (new Date()).toISOString();
  var userName = _.compact(_.map(_this.data.userNameFields, function (name) {
    return _this.myUserData.isSaml2
      ? _.get(userFromDataSource, 'data.' + name)
      : _this.myUserData[name];
  })).join(' ').trim();

  var commentInfo = {
    id: guid,
    literalDate: moment(timestamp).calendar(null, {
      sameDay: '[Today], HH:mm',
      nextDay: '[Tomorrow], HH:mm',
      nextWeek: 'dddd, HH:mm',
      lastDay: '[Yesterday], HH:mm',
      lastWeek: 'dddd, HH:mm',
      sameElse: 'MMM Do YY, HH:mm'
    }),
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
}

DynamicList.prototype.replaceComment = function(guid, commentData, context) {
  var _this = this;
  var userName = _.compact(_.map(_this.data.userNameFields, function (name) {
    return _.get(commentData, 'data.settings.user.' + name);
  })).join(' ').trim();

  if (!commentData.literalDate) {
    commentData.literalDate = moment(commentData.createdAt).calendar(null, {
      sameDay: '[Today], HH:mm',
      nextDay: '[Tomorrow], HH:mm',
      nextWeek: 'dddd, HH:mm',
      lastDay: '[Yesterday], HH:mm',
      lastWeek: 'dddd, HH:mm',
      sameElse: 'MMM Do YY, HH:mm'
    });
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

  if (context === 'final') {
    // Check if comment is from current user
    if (_this.myUserData && _this.myUserData.isSaml2) {
      var myEmailParts = myEmail.match(/[^\@]+[^\.]+/);
      var toComparePart = myEmailParts[0];
      var commentEmailParts = commentEmail.match(/[^\@]+[^\.]+/);
      var toComparePart2 = commentEmailParts[0];

      if (toComparePart.toLowerCase() === toComparePart2.toLowerCase()) {
        commentInfo.currentUser = true;
      }
    } else {
      if (commentEmail === myEmail) {
        commentInfo.currentUser = true;
      }
    }

    var commentTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['single-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  if (context === 'temp') {
    var commentTemplate = Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['temp-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  _this.$container.find('.fl-individual-comment[data-id="' + guid + '"]').replaceWith(commentHTML);
}

DynamicList.prototype.deleteComment = function(id) {
  var _this = this;
  var entryId = _this.$container.find('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
  var entry = _.find(_this.listItem, { id: entryId });
  var commentHolder = _this.$container.find('.fl-individual-comment[data-id="' + id + '"]');

  return Fliplet.DataSources.connect(_this.data.commentsDataSourceId).then(function (connection) {
    return connection.removeById(id, { ack: true });
  }).then(function onRemove() {
    _.remove(entry.comments, { id: id });
    entry.commentCount--;
    _this.updateCommentCounter({
      id: entryId,
      record: entry
    });
    commentHolder.remove();
  });
}

DynamicList.prototype.saveComment = function(entryId, commentId, value) {
  var _this = this;
  var entryComments = _.get(_.find(_this.listItems, { id: entryId }), 'comments', []);
  var commentData = _.find(entryComments.entries, function(comment) {
    return comment.id === commentId;
  });

  if (commentData) {
    commentData.data.settings.text = value;
    _this.replaceComment(commentId, commentData, 'temp');
  }

  var content = {
    contentDataSourceEntryId: entryId,
    type: 'comment'
  };

  Fliplet.Content({dataSourceId: _this.data.commentsDataSourceId})
    .then(function(instance) {
      return instance.update({
        settings: commentData.data.settings
      }, {
        where: {
          content: content
        }
      });
    })
    .then(function() {
      _this.replaceComment(commentId, commentData, 'final');
    });
}