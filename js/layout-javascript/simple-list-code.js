// Constructor
var DynamicList = function(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;

  this.simpleListLayoutMapping = {
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
  this.mixer;
  this.likeButtons = [];
  this.bookmarkButtons = [];
  this.likeButtonOverlay;
  this.bookmarkButtonOverlay;
  this.comments = [];
  this.allUsers;
  this.usersToMention = [];
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</div>';
  this.entryClicked = undefined;
  this.isFiltering;
  this.isSearching;

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.entryOverlay;
  this.myUserData;
  this.dataSourceColumns;
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

  Handlebars.registerHelper('formatComment', function(text) {
    var breakRegExp = /(\r\n|\n|\r)/gm,
      emailRegExp = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/gm,
      numberRegExp = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,8}/gm,
      urlRegExp = /(?:^|[^@\.\w-])([a-z0-9]+:\/\/)?(\w(?!ailto:)\w+:\w+@)?([\w.-]+\.[a-z]{2,4})(:[0-9]+)?(\/.*)?(?=$|[^@\.\w-])/ig,
      mentionRegExp = /\B@[a-z0-9_-]+/ig;

    /* capture email addresses and turn into mailto links */
    text = text.replace(emailRegExp, '<a href="mailto:$&">$&</a>');

    /* capture phone numbers and turn into tel links */
    text = text.replace(numberRegExp, '<a href="tel:$&">$&</a>');

    /* capture URLs and turn into links */
    text = text.replace(urlRegExp, function(match, p1, p2, p3, p4, p5, offset, string) {
      return breakRegExp.test(string) ? ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a><br>' :
        ' <a href="' + (typeof p1 !== "undefined" ? p1 : "http://") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '">' + (typeof p1 !== "undefined" ? p1 : "") + p3 + (typeof p5 !== "undefined" ? p5 : "") + '</a>';
    });

    text = text.replace(mentionRegExp, '<strong>$&</strong>');

    /* capture line break and turn into <br> */
    text = text.replace(breakRegExp, '<br>');

    return new Handlebars.SafeString(text);
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
    return moment(date).utc().format('DD MMMM YYYY');
  });

  Handlebars.registerHelper('plaintext', function(context) {
    result = $('<div></div>').html(context).text();
    return $('<div></div>').html(result).text();
  });

  Handlebars.registerHelper('removeSpaces', function(context) {
    return context.replace(/\s+/g, '');
  });
}

DynamicList.prototype.attachObservers = function() {
  var _this = this;

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

      $(this).parents('.simple-list-search-filter-overlay').removeClass('display');
      $('body').removeClass('lock');
    })
    .on('click', '.clear-filters', function() {
      $('.mixitup-control-active').removeClass('mixitup-control-active');
      $(this).addClass('hidden');
      _this.filterList();
    })
    .on('click', '.simple-list-search-filter-overlay .hidden-filter-controls-filter', function() {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $(this).text()
      });

      $(this).toggleClass('mixitup-control-active');

      if ($('.mixitup-control-active').length) {
        $('.clear-filters').removeClass('hidden');
      } else {
        $('.clear-filters').addClass('hidden');
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
    .on('click', '.simple-list-item', function(event) {
      if ($(event.target).hasClass('simple-list-social-holder') || $(event.target).parents('.simple-list-social-holder').length) {
        return;
      }

      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.list-item-title').text();

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
    .on('click', '.simple-list-detail-overlay-close', function() {
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
      var $parentElement = $elementClicked.parents('.simple-list-container');

      if (_this.data.filtersInOverlay) {
        $parentElement.find('.simple-list-search-filter-overlay').addClass('display');
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
    .on('click', '.simple-list-overlay-close', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-search-filter-overlay');
      $parentElement.removeClass('display');
      $('body').removeClass('lock');

      // Resets selected filters if any
      $('.mixitup-control-active').removeClass('mixitup-control-active');

      if (_this.filterClasses.length) {
        _this.filterClasses.forEach(function(filter) {
          $('.hidden-filter-controls-filter[data-toggle="' + filter + '"]').addClass('mixitup-control-active');
        });

        $('.clear-filters').removeClass('hidden');
      } else {
        $('.clear-filters').addClass('hidden');
      }
    })
    .on('click', '.list-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.simple-list-container');

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
          _this.$container.find('.simple-list-container').removeClass('searching');
          _this.isSearching = false;
          _this.clearSearch();
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
    })
    .on('click', '.search-holder .search-btn', function(e) {
      var $inputField = $(this).parents('.search-holder').find('.search-feed');
      var value = $inputField.val();

      if (value === '') {
        _this.$container.find('.simple-list-container').removeClass('searching');
        _this.isSearching = false;
        _this.clearSearch();
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
    .on('click', '.clear-search', function() {
      _this.$container.find('.simple-list-container').removeClass('searching');
      _this.isSearching = false;
      _this.clearSearch();
    })
    .on('show.bs.collapse', '.simple-list-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-down').removeClass('fa-angle-down').addClass('fa-angle-up');
    })
    .on('hide.bs.collapse', '.simple-list-filters-panel .panel-collapse', function() {
      $(this).siblings('.panel-heading').find('.fa-angle-up').removeClass('fa-angle-up').addClass('fa-angle-down');
    })
    .on('click', '.simple-list-comment-holder', function(e) {
      e.stopPropagation();
      var identifier;
      if (_this.$container.find('.simple-list-container').hasClass('overlay-open')) {
        identifier = $(this).parents('.simple-list-details-holder').data('entry-id');
      } else {
        identifier = $(this).parents('.simple-list-item').data('entry-id');
      }
      _this.entryClicked = identifier;
      _this.showComments(identifier);
      $('body').addClass('lock');
      $('.simple-list-detail-overlay-content-holder').addClass('lock');
      $('.simple-list-comment-panel').addClass('open');

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click', '.simple-list-comment-close-panel', function() {
      $('.simple-list-comment-panel').removeClass('open');
      $('.simple-list-detail-overlay-content-holder').removeClass('lock');
      if (!_this.$container.find('.simple-list-container').hasClass('overlay-open')) {
        $('body').removeClass('lock');
      }
    })
    .on('click', '.simple-list-comment-input-holder .comment', function() {
      var entryId = _this.entryClicked;
      var $commentArea = $(this).parents('.simple-list-comment-input-holder').find('[data-comment-body]');
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
      var value = $(this).val();

      if (value.length) {
        $(this).parents('.simple-list-comment-input-holder').addClass('ready');
      } else {
        $(this).parents('.simple-list-comment-input-holder').removeClass('ready');
      }
    })
    .on('click', '.simple-list-comment-input-holder .save', function() {
      var commentId = $('.fl-individual-comment.editing').data('id');
      var entryId = _this.entryClicked;
      var $commentArea = $(this).parents('.simple-list-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val();

      $('.fl-individual-comment').removeClass('editing');
      $('.simple-list-comment-input-holder').removeClass('editing');
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
      $('.fl-individual-comment').removeClass('editing');
      $('.simple-list-comment-input-holder').removeClass('editing');

      var $messageArea = $('[data-comment-body]');
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
                var $messageArea = $('[data-comment-body]');
                _that.parents('.fl-individual-comment').addClass('editing');
                $('.simple-list-comment-input-holder').addClass('editing');

                $messageArea.val(textToCopy);
                autosize.update($messageArea);
                $messageArea.focus();

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
      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');
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
      var entryID = $(this).parents('.simple-list-detail-overlay-content').find('.simple-list-detail-wrapper').data('entry-id');
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
                  _this.prepareToRenderLoop(_this.listItems);
                  _this.renderLoopHTML();
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
    return connection.removeById(entryID, { ack: true });
  }).then(function () {
    return Promise.resolve(entryID);
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
  var filtered;

  // Prepare sorting
  if (_this.data.sortOptions.length) {
    var fields = [];
    var sortOrder = [];
    var sortColumns = [];

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

      });

      return record;
    });

    sortColumns = fields.map(function (field) {
      return 'data[modified_' + field.column + ']';
    })

    // Sort data
    records = _.orderBy(mappedRecords, sortColumns, sortOrder);
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

  // Add flag for likes
  records.forEach(function(obj, i) {
    // Add likes flag
    records[i].likesEnabled = _this.data.social && _this.data.social.likes;

    // Add bookmarks flag
    records[i].bookmarksEnabled = _this.data.social && _this.data.social.bookmark;

    // Add comments flag
    records[i].commentsEnabled = _this.data.social && _this.data.social.comments;
  });

  return records;
}

DynamicList.prototype.convertFiles = function(listItems, forComments) {
  var _this = this;
  var dataToGetFile = [];
  var summaryDataToGetFile = [];
  var detailDataToGetFile = [];
  var promises = [];

  // Test pattern for URLS
  var urlPattern = /^https?:\/\//i;
  // Test pattern for BASE64 images
  var base64Pattern = /^data:image\/[^;]+;base64,/i;
  // Test pattern for DATASOURCES images
  var datasourcesPattern = /^datasources\//i;

  listItems.forEach(function(entry, index) {
    var summaryData = {
      query: {},
      entry: entry,
      entryIndex: index,
      field: undefined
    };

    var detailData = {
      query: {},
      entry: entry,
      entryIndex: index,
      field: undefined
    };

    var userData = {
      query: {},
      entry: entry,
      entryIndex: index,
      field: {
        column: undefined
      }
    };

    if (!forComments) {
      _this.data['summary-fields'].forEach(function(obj) {
        if (!obj.imageField) {
          return;
        }

        if (obj.type === 'image' && obj.imageField !== 'url') {
          if (obj.imageField === 'app') {
            summaryData.query.appId = obj.appFolderId;
            summaryData.field = obj;
          }

          if (obj.imageField === 'organization') {
            summaryData.query.organizationId = obj.organizationFolderId;
            summaryData.field = obj;
          }

          if (obj.imageField === 'all-folders') {
            summaryData.query.folderId = obj.folder.selectFiles[0].id;
            summaryData.field = obj;
          }

          summaryDataToGetFile.push(summaryData);
        } else if (obj.type === 'image' && obj.imageField === 'url') {
          if (!urlPattern.test(entry.data[obj.column]) && !base64Pattern.test(entry.data[obj.column]) && !datasourcesPattern.test(entry.data[obj.column])) {
            listItems[index].data[obj.column] = '';
          }
        }
      });

      _this.data.detailViewOptions.forEach(function(obj) {
        if (!obj.imageField) {
          return;
        }

        if (obj.type === 'image' && obj.imageField !== 'url') {
          if (obj.imageField === 'app') {
            detailData.query.appId = obj.appFolderId;
            detailData.field = obj;
          }

          if (obj.imageField === 'organization') {
            detailData.query.organizationId = obj.organizationFolderId;
            detailData.field = obj;
          }

          if (obj.imageField === 'all-folders') {
            detailData.query.folderId = obj.folder.selectFiles[0].id;
            detailData.field = obj;
          }

          detailDataToGetFile.push(detailData);
        } else if (obj.type === 'image' && obj.imageField === 'url') {
          if (!urlPattern.test(entry.data[obj.column]) && !base64Pattern.test(entry.data[obj.column]) && !datasourcesPattern.test(entry.data[obj.column])) {
            listItems[index].data[obj.column] = '';
          }
        }
      });
    } else {
      if (_this.data.userPhotoColumn && _this.data.userFolderOption !== 'url') {
        if (_this.data.userFolderOption === 'app') {
          userData.query.appId = _this.data.userAppFolder;
          userData.field.column = _this.data.userPhotoColumn;
        }

        if (_this.data.userFolderOption === 'organization') {
          userData.query.organizationId = _this.data.userOrgFolder;
          userData.field.column = _this.data.userPhotoColumn;
        }

        if (_this.data.userFolderOption === 'all-folders') {
          userData.query.folderId = _this.data.userFolder.folder.selectFiles[0].id;
          userData.field.column = _this.data.userPhotoColumn;
        }

        dataToGetFile.push(userData);
      } else if (_this.data.userFolderOption === 'url' && _this.data.userPhotoColumn) {
        if (!urlPattern.test(entry.data[_this.data.userPhotoColumn]) && !base64Pattern.test(entry.data[_this.data.userPhotoColumn]) && !datasourcesPattern.test(entry.data[_this.data.userPhotoColumn])) {
          listItems[index].data[_this.data.userPhotoColumn] = '';
        }
      }
    }
  });

  if (!forComments) {
    if (summaryDataToGetFile.length) {
      summaryDataToGetFile.forEach(function(data) {
        promises.push(_this.connectToGetFiles(data));
      });
    }

    if (detailDataToGetFile.length) {
      detailDataToGetFile.forEach(function(data) {
        promises.push(_this.connectToGetFiles(data));
      });
    }
  } else {
    if (dataToGetFile.length) {
      dataToGetFile.forEach(function(data) {
        promises.push(_this.connectToGetFiles(data));
      });
    }
  }

  if (promises.length) {
    return Promise.all(promises);
  }

  return Promise.resolve(listItems);
}

DynamicList.prototype.connectToGetFiles = function(data) {
  var _this = this;

  return Fliplet.Media.Folders.get(data.query)
    .then(function(response) {
      var allFiles = response.files;

      // Test pattern for URLS
      var urlPattern = /^https?:\/\//i;
      // Test pattern for BASE64 images
      var base64Pattern = /^data:image\/[^;]+;base64,/i;
      // Test pattern for DATASOURCES images
      var datasourcesPattern = /^datasources\//i;
      // Test pattern for Numbers/IDs
      var numberPattern = /^\d+$/i;

      if (!data.field) {
        return data.entry;
      }

      allFiles.forEach(function(file) {
        // Add this IF statement to make the URLs to work with encrypted organizations
        if (file.isEncrypted) {
          file.url += '?auth_token=' + Fliplet.User.getAuthToken();
        }

        if (data.entry.data[data.field.column] && file.name.indexOf(data.entry.data[data.field.column]) !== -1) {
          data.entry.data[data.field.column] = file.url;
          // Save new temporary key to mark the URL as edited - Required (No need for a column with the same name)
          data.entry.data['imageUrlEdited'] = true;
        } else if (urlPattern.test(data.entry.data[data.field.column]) || base64Pattern.test(data.entry.data[data.field.column]) || datasourcesPattern.test(data.entry.data[data.field.column])) {
          // Save new temporary key to mark the URL as edited - Required (No need for a column with the same name)
          data.entry.data['imageUrlEdited'] = true;
        } else if (numberPattern.test(data.entry.data[data.field.column])) {
          var imageId = parseInt(data.entry.data[data.field.column], 10);
          if (imageId === file.id) {
            data.entry.data[data.field.column] = file.url;
            // Save new temporary key to mark the URL as edited - Required (No need for a column with the same name)
            data.entry.data['imageUrlEdited'] = true;
          }
        }
      });

      if (!data.entry.data['imageUrlEdited']) {
        data.entry.data[data.field.column] = '';
      }

      return data.entry;
    });
}

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render list with default data
  if (_this.data.defaultData) {
    // Render Base HTML template
    _this.renderBaseHTML();
    _this.listItems = _this.prepareData(_this.data.defaultEntries);
    _this.dataSourceColumns = _this.data.defaultColumns;

    return _this.convertFiles(_this.listItems)
      .then(function(response) {
        _this.listItems = _.uniqBy(response, function (item) {
          return item.id;
        });

        // Render Loop HTML
        _this.prepareToRenderLoop(_this.listItems);
        _this.renderLoopHTML(function(from, to){
          _this.onPartialRender(from, to);
        }).then(function(){
          _this.addFilters(_this.modifiedListItems);
          _this.attachObservers();
          _this.checkBookmarked();
          _this.initializeMixer();
        });
      });
  }

  // Check if there is a PV for search/filter queries
  _this.parsePVQueryVars()
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();
      
      return _this.connectToDataSource();
    })
    .then(function (records) {
      if (records && !Array.isArray(records)) {
        records = [records];
      }
      _this.listItems = _this.prepareData(records);
      return;
    })
    .then(function() {
      return Fliplet.DataSources.getById(_this.data.dataSourceId)
        .catch(function () {
          return Promise.resolve(); // Resolve anyway if it fails
        });
    })
    .then(function(dataSource) {
      if (dataSource) {
        _this.dataSourceColumns = dataSource.columns;
      }

      return;
    })
    .then(function() {
      return _this.convertFiles(_this.listItems);
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
        _this.attachObservers();
        _this.checkBookmarked();
        _this.initializeMixer();
      });
    })
}

DynamicList.prototype.checkIsToOpen = function() {
  // List of entries saved in: _this.modifiedListItems
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
  
  _this.$container.find('.simple-list-container').addClass('searching');
  _this.isSearching = true;
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
      $('.hidden-filter-controls-filter[data-toggle="' + value + '"]').addClass('mixitup-control-active');
    });
  } else {
    _this.pvFilterQuery.value = _this.pvFilterQuery.value.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
    $('.hidden-filter-controls-filter[data-toggle="' + _this.pvFilterQuery.value + '"]').addClass('mixitup-control-active');
  }

  _this.filterList();
  
  if (typeof _this.pvFilterQuery.hideControls !== 'undefined' && !_this.pvFilterQuery.hideControls) {
    _this.$container.find('.hidden-filter-controls').addClass('active');
    _this.$container.find('.list-search-cancel').addClass('active');

    if (!_this.data.filtersInOverlay) {
      _this.$container.find('.list-search-icon .fa-sliders').addClass('active');
    }

    _this.calculateFiltersHeight(_this.$container.find('.simple-list-container'));
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

  // go back to previous screen on click - TRUE/FALSE
  data.goBackButton = _this.pvGoBack && _this.pvGoBack.enableButton;

  if (typeof _this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(data));
}

DynamicList.prototype.prepareToRenderLoop = function(records) {
  var _this = this;

  var modifiedData = _this.convertCategories(records);
  var loopData = [];

  // Uses sumamry view settings set by users
  modifiedData.forEach(function(entry) {
    var newObject = {
      id: entry.id,
      flClasses: entry.data['flClasses'],
      flFilters: entry.data['flFilters'],
      likesEnabled: entry.likesEnabled,
      bookmarksEnabled: entry.bookmarksEnabled,
      commentsEnabled: entry.commentsEnabled,
      originalData: entry.data
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
    loopData.push(newObject);
  });

  _this.modifiedListItems = loopData;
}

DynamicList.prototype.renderLoopHTML = function(iterateeCb) {
  // Function that renders the List template
  var _this = this;


  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['loop']]());

  var limitedList = undefined;
  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0 && !_this.isSearching && !_this.isFiltering) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);
  }

  // Hides the entry limit warning if the number of entries to show is less than the limit value
  if (_this.data.enabledLimitEntries && (_this.data.limitEntries > _this.modifiedListItems.length)) {
    _this.$container.find('.limit-entries-text').addClass('hidden');
  }

  _this.$container.find('#simple-list-wrapper-' + _this.data.id).empty();

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
        _this.$container.find('#simple-list-wrapper-' + _this.data.id).append(template(nextBatch));
        if(iterateeCb && typeof iterateeCb === 'function'){
          if(renderLoopIndex === 0){
            _this.$container.find('.simple-list-container').removeClass('loading').addClass('ready');
          }
          iterateeCb(renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE, renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE);
        }
        renderLoopIndex++;
        // if the browser is ready, render
        requestAnimationFrame(render);
      }
      else{
        _this.$container.find('.simple-list-container').removeClass('loading').addClass('ready');
        resolve();
      }
    }
    // start the initial render
    requestAnimationFrame(render);
  })
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

DynamicList.prototype.addFilters = function(data) {
  // Function that renders the filters
  var _this = this;
  var filters = [];
  var filtersData = {
    'filtersInOverlay': _this.data.filtersInOverlay
  };

  data.forEach(function(row) {
    row['flFilters'].forEach(function(filter) {
      filters.push(filter);
    });
  });

  var uniqueCategories = _.uniqBy(filters, function(obj) {
    return obj.data.name;
  });

  var allFilters = [];
  _this.data.filterFields.forEach(function(filter) {
    var arrangedFilters = {
      id: _this.data.id,
      name: filter,
      data: []
    };
    uniqueCategories.forEach(function(item) {
      if (item.type === filter) {
        arrangedFilters.data.push(item.data);
      }
    });

    arrangedFilters.data = _.orderBy(arrangedFilters.data, function(item) {
      return item.name;
    }, ['asc']);

    allFilters.push(arrangedFilters);
  });

  filtersData.filters = allFilters

  filtersTemplate = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['filter']];
  var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
  ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
  : Handlebars.compile(filtersTemplate());

  _this.$container.find('.filter-holder').html(template(filtersData));
}

DynamicList.prototype.filterList = function() {
  var _this = this;
  _this.filterClasses = [];

  var listData = _this.searchedListItems ? _this.searchedListItems : _this.listItems;

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  _this.$container.find('.hidden-search-controls').removeClass('no-results');

  if (!$('.hidden-filter-controls-filter.mixitup-control-active').length) {
    _this.$container.find('.simple-list-container').removeClass('filtering');
    _this.isFiltering = false;
    _this.prepareToRenderLoop(listData);
    _this.renderLoopHTML(function(from, to){
      _this.onPartialRender(from, to);
    });
    return;
  }
  
  $('.hidden-filter-controls-filter.mixitup-control-active').each(function(index, element) {
    _this.filterClasses.push($(element).data('toggle'));
  });

  var filteredData = _.filter(listData, function(row) {
    var filters = [];
    row.data['flFilters'].forEach(function(obj) {
      filters.push(obj.data.class);
    });

    var matched = [];
    _this.filterClasses.forEach(function(filter) {
      matched.push(filters.indexOf(filter.toString()) >= 0);
    });
    
    // If "_.includes" returns TRUE
    // we actually want to return FALSE to _.filter 
    return !_.includes(matched, false);
  });

  if (!filteredData.length) {
    _this.$container.find('.hidden-search-controls').addClass('no-results');
  }

  _this.$container.find('.simple-list-container').addClass('filtering');
  _this.isFiltering = true;
  _this.prepareToRenderLoop(filteredData);
  _this.renderLoopHTML(function(from, to){
    _this.onPartialRender(from, to);
  });
}

DynamicList.prototype.splitByCommas = function(str) {
  if (Array.isArray(str)) {
    return str;
  }

  if (typeof str !== 'string') {
    return [str];
  }

  // Split a string by commas but ignore commas within double-quotes using Javascript
  // https://stackoverflow.com/questions/11456850/split-a-string-by-commas-but-ignore-commas-within-double-quotes-using-javascript
  var regexp = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
  var arr = [];
  var res;
  while ((res = regexp.exec(str)) !== null) {
    arr.push(res[0].replace(/(?:^")|(?:"$)/g, '').trim());
  }
  return arr;
}

DynamicList.prototype.convertCategories = function(data) {
  // Function that get and converts the categories for the filters to work
  var _this = this;

  data.forEach(function(element) {
    element.data['flClasses'] = '';
    element.data['flFilters'] = [];
    var lowerCaseTags = [];
    _this.data.filterFields.forEach(function(filter) {
      var arrayOfTags = [];
      if (element.data[filter] !== null && typeof element.data[filter] !== 'undefined' && element.data[filter] !== '') {
        var arrayOfTags = _this.splitByCommas(element.data[filter]).map(function(item) {
          return item.trim();
        });
      }
      arrayOfTags.forEach(function(item, index) {
        var classConverted = item.toLowerCase().replace(/[!@#\$%\^\&*\)\(\ ]/g,"-");
        if (classConverted === '') {
          return;
        }
        var newObj = {
          type: filter,
          data: {
            name: item,
            class: classConverted
          }
        }
        lowerCaseTags.push(classConverted);
        element.data['flFilters'].push(newObj);
      });
      
    });
    element.data['flClasses'] = lowerCaseTags.join(' ');
  });
  return data;
}

DynamicList.prototype.onPartialRender = function(from, to) {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  if (_this.data.social && _this.data.social.likes) {
    _this.$container.find('.simple-list-item').slice(from, to).each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-like';
      var title = $(element).find('.list-item-body .list-item-title').text();
      _this.setupLikeButton(cardId, likeIndentifier, title);
    });
  }

  if (_this.data.social && _this.data.social.bookmark) {
    _this.$container.find('.simple-list-item').slice(from, to).each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-bookmark';
      var title = $(element).find('.list-item-body .list-item-title').text();
      _this.setupBookmarkButton(cardId, likeIndentifier, title);
    });
  }

  if (_this.data.social && (_this.data.social.bookmark || _this.data.social.likes)) {
    _this.likesObservers();
  }

  if (_this.data.social && _this.data.social.comments) {
    _this.$container.find('.simple-list-item').slice(from, to).each(function(index, element) {
      _this.getCommentsCount(element);
    });

    // Get users info
    _this.connectToUsersDataSource()
      .then(function(users) {
        return _this.convertFiles(users, true);
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

        var usersInfoToMention = [];
        _this.allUsers.forEach(function(user) {
          var userName = '';
          var userNickname = '';
          var counter = 1;

          if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
            _this.data.userNameFields.forEach(function(name, i) {
              userName += user.data[name] + ' ';
              userNickname += counter === 1 ? user.data[name].toLowerCase().charAt(0) + ' ' : user.data[name].toLowerCase().replace(/\s/g, '') + ' ';
            });
            userName = userName.trim();
            userNickname = userNickname.trim();

            counter++;
          } else {
            userName = user.data[_this.data.userNameFields[0]];
            userNickname = user.data[_this.data.userNameFields[0]].toLowerCase().replace(/\s/g, '')
          }

          var userInfo = {
            id: user.id,
            username: userNickname,
            name: userName,
            image: user.data[_this.data.userPhotoColumn] || ''
          }
          usersInfoToMention.push(userInfo);
        });
        _this.usersToMention = usersInfoToMention;
      });
  }
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
      $(element).parents('.simple-list-item').addClass('bookmarked');
    });
    checkTimer++;
  }, 1000);
}

DynamicList.prototype.calculateFiltersHeight = function(element) {
  var totalHeight = element.find('.hidden-filter-controls-content').height();
  
  element.find('.hidden-filter-controls').animate({
    height: totalHeight,
  }, 200);
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
  _this.$container.find('#simple-list-wrapper-' + _this.data.id).html('');
  // Adds search query to HTML
  _this.$container.find('.current-query').html(value);
  
  // Search
  var searchedData = [];
  var filteredData;
  var fields = _this.pvSearchQuery.column; // Can be Array or String

  if (Array.isArray(_this.pvSearchQuery.column)) {
    fields.forEach(function(field) {    
      filteredData = _.filter(_this.listItems, function(obj) {
        if (obj.data[field] !== null && obj.data[field] !== '' && typeof obj.data[field] !== 'undefined') {
          return obj.data[field].toLowerCase().indexOf(value) > -1;
        }
      });

      if (filteredData.length) {
        filteredData.forEach(function(item) {
          searchedData.push(item);
        });
      }
    });
  } else {
    searchedData = _.filter(_this.listItems, function(obj) {
      if (obj.data[fields] !== null && obj.data[fields] !== '' && typeof obj.data[fields] !== 'undefined') {
        return obj.data[fields].toLowerCase().indexOf(value) > -1;
      }
    });

    if (!searchedData || !searchedData.length) {
      searchedData = [];
    }
  }


  _this.$container.find('.hidden-search-controls').removeClass('is-searching no-results').addClass('search-results');
  _this.$container.find('.simple-list-container').removeClass('searching');
  if (!_this.data.filtersInOverlay) {
    _this.calculateSearchHeight(_this.$container.find('.simple-list-container'));
  }

  if (!searchedData.length) {
    _this.$container.find('.hidden-search-controls').addClass('no-results');
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  if (_this.data.enabledLimitEntries) {
    $('.limit-entries-text').addClass('hidden');
  }

  // Remove duplicates
  searchedData = _.uniq(searchedData);
  _this.searchedListItems = searchedData;

  if (_this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
    _this.showDetails(_this.searchedListItems[0].id)
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
  _this.$container.find('#simple-list-wrapper-' + _this.data.id).html('');
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
          if (obj.data[field] !== null && obj.data[field] !== '' && typeof obj.data[field] !== 'undefined') {
            return obj.data[field].toLowerCase().indexOf(value) > -1;
          }
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
    _this.$container.find('.simple-list-container').removeClass('searching');
    if (!_this.data.filtersInOverlay) {
      _this.calculateSearchHeight(_this.$container.find('.simple-list-container'));
    }

    if (!searchedData.length) {
      _this.$container.find('.hidden-search-controls').addClass('no-results');
    }

    if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
      _this.mixer.destroy();
    }

    if (_this.data.enabledLimitEntries) {
      $('.limit-entries-text').addClass('hidden');
    }

    // Remove duplicates
    searchedData = _.uniq(searchedData);
    _this.searchedListItems = searchedData;

    if (_this.querySearch && _this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
      _this.showDetails(_this.searchedListItems[0].id)
    }

    _this.prepareToRenderLoop(searchedData);
    _this.renderLoopHTML(function(from, to){
      _this.onPartialRender(from, to);
    }).then(function(){
      _this.addFilters(_this.modifiedListItems);
    });
  });
}

DynamicList.prototype.clearSearch = function() {
  // Function called when user clears the search field
  var _this = this;

  // Removes value from search box
  _this.$container.find('.search-holder').find('input').val('').blur().removeClass('not-empty');
  // Resets all classes related to search
  _this.$container.find('.hidden-search-controls').removeClass('is-searching no-results search-results searching');

  if (_this.$container.find('.hidden-search-controls').hasClass('active')) {
    _this.calculateSearchHeight(_this.$container.find('.simple-list-container'), true);
  } else {
    _this.$container.find('.hidden-search-controls').animate({ height: 0 }, 200);
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  if (_this.data.enabledLimitEntries) {
    $('.limit-entries-text').removeClass('hidden');
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

  _this.mixer = mixitup('#simple-list-wrapper-' + _this.data.id, {
    selectors: {
      control: '[data-mixitup-control="' + _this.data.id + '"]',
      target: '.simple-list-item'
    },
    load: {
      filter: 'all'
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
            $('.limit-entries-text').addClass('hidden');
          }

          $('.no-bookmarks-holder').addClass('show');
          return;
        }

        if (state.totalShow && state.totalShow === state.totalTargets) {
          if (_this.data.enabledLimitEntries) {
            $('.limit-entries-text').removeClass('hidden');
          }

          $('.no-bookmarks-holder').removeClass('show');
        } else if (state.totalShow && state.totalShow !== state.totalTargets) {
          if (_this.data.enabledLimitEntries) {
            $('.limit-entries-text').addClass('hidden');
          }

          $('.no-bookmarks-holder').removeClass('show');
        }
      }
    }
  });
}

DynamicList.prototype.setupLikeButton = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.likeButtons.push({
    btn: LikeButton({
      target: '.simple-list-like-holder-' + id,
      dataSourceId: _this.data.likesDataSourceId,
      content: { 
        entryId: identifier
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart-o fa-lg"></i>',
      likedLabel: '<span class="count">{{#if count}}{{count}}{{/if}}</span><i class="fa fa-heart fa-lg animated bounceIn"></i>',
      likeWrapper: '<div class="simple-list-like-wrapper btn-like"></div>',
      likedWrapper: '<div class="simple-list-like-wrapper btn-liked"></div>',
      addType: 'html'
    }),
    id: id
  });
}

DynamicList.prototype.setupBookmarkButton = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.bookmarkButtons.push({
    btn: LikeButton({
      target: '.simple-list-bookmark-holder-' + id,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: { 
        entryId: identifier
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
      likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
      likeWrapper: '<div class="simple-list-bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="simple-list-bookmark-wrapper btn-bookmarked"></div>',
      addType: 'html'
    }),
    id: id
  });
}

DynamicList.prototype.prepareSetupBookmarkOverlay = function(id) {
  var _this = this;
  
  var isBookmarked = false;
  var isLiked = false;
  var count;
  var bookmarkButton = _.find(_this.bookmarkButtons, function(btn) {
    return btn.id === id;
  });
  var likeButton = _.find(_this.likeButtons, function(btn) {
    return btn.id === id;
  });

  if (bookmarkButton && bookmarkButton.btn) {
    if (bookmarkButton.btn.isLiked()) {
      $('.simple-list-detail-overlay').find('.simple-list-bookmark-holder-' + bookmarkButton.id).addClass('bookmarked');
      isBookmarked = bookmarkButton.btn.isLiked();
    } else {
      $('.simple-list-detail-overlay').find('.simple-list-bookmark-holder-' + bookmarkButton.id).addClass('not-bookmarked');
      isBookmarked = bookmarkButton.btn.isLiked();
    }
  } else {
    $('.simple-list-detail-overlay').find('.simple-list-bookmark-holder').addClass('not-bookmarked');
    isBookmarked = false;
  }

  if (likeButton && likeButton.btn) {
    count = likeButton.btn.getCount() > 0 ? likeButton.btn.getCount() : '';
    if (likeButton.btn.isLiked()) {
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + likeButton.id).addClass('liked');
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + likeButton.id + ' .count').html(count);
      isLiked = likeButton.btn.isLiked();
    } else {
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + likeButton.id).addClass('not-liked');
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + likeButton.id + ' .count').html(count);
      isLiked = likeButton.btn.isLiked();
    }
  } else {
    $('.simple-list-detail-overlay').find('.simple-list-like-holder').addClass('not-liked');
    isLiked = false;
  }

  _this.likesObserversOverlay(id, bookmarkButton, isBookmarked, likeButton, isLiked);
}

DynamicList.prototype.likesObservers = function() {
  var _this = this;

  _this.likeButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      var entryTitle = this.$btn.parents('.list-item-body').find('.list-item-title').text();
      var count = button.btn.getCount() > 0 ? button.btn.getCount() : '';

      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id + ' .count').html(count);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_like',
        label: entryTitle
      });
    });

    button.btn.on('liked.fail', function(data){
      var count = button.btn.getCount() > 0 ? button.btn.getCount() : '';
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id).removeClass('liked').addClass('not-liked');
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id + ' .count').html(count);
    });

    button.btn.on('unliked', function(data){
      var entryTitle = this.$btn.parents('.list-item-body').find('.list-item-title').text();
      var count = button.btn.getCount() > 0 ? button.btn.getCount() : '';

      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id + ' .count').html(count);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unlike',
        label: entryTitle
      });
    });

    button.btn.on('unliked.fail', function(data){
      var count = button.btn.getCount() > 0 ? button.btn.getCount() : '';
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id).removeClass('not-liked').addClass('liked');
      $('.simple-list-detail-overlay').find('.simple-list-like-holder-' + button.id + ' .count').html(count);
    });
  });

  _this.bookmarkButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      this.$btn.parents('.simple-list-item').addClass('bookmarked');
      var entryTitle = this.$btn.parents('.list-item-body').find('.list-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    button.btn.on('liked.fail', function(data){
      this.$btn.parents('.simple-list-item').removeClass('bookmarked');
      $('.simple-list-detail-overlay').find('.simple-list-bookmark-holder-' + button.id).removeClass('bookmarked').addClass('not-bookmarked');
    });

    button.btn.on('unliked', function(data){
      this.$btn.parents('.simple-list-item').removeClass('bookmarked');
      var entryTitle = this.$btn.parents('.list-item-body').find('.list-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });

    button.btn.on('unliked.fail', function(data){
      this.$btn.parents('.simple-list-item').addClass('bookmarked');
      $('.simple-list-detail-overlay').find('.simple-list-bookmark-holder-' + button.id).removeClass('not-bookmarked').addClass('bookmarked');
    });
  });
}

DynamicList.prototype.likesObserversOverlay = function(id, bookmarkButton, isBookmarked, likeButton, isLiked) {
  var _this = this;

  var count;

  $('.simple-list-detail-overlay').find('.simple-list-bookmark-wrapper').on('click', function() {
    if (isBookmarked) {
      $(this).parents('.simple-list-bookmark-holder').removeClass('bookmarked').addClass('not-bookmarked');
      bookmarkButton.btn.unlike();
      isBookmarked = !isBookmarked;
      return;
    }

    $(this).parents('.simple-list-bookmark-holder').removeClass('not-bookmarked').addClass('bookmarked');
    bookmarkButton.btn.like();
    isBookmarked = !isBookmarked;
  });

  $('.simple-list-detail-overlay').find('.simple-list-like-wrapper').on('click', function() {
    if (isLiked) {
      $(this).parents('.simple-list-like-holder').removeClass('liked').addClass('not-liked');
      likeButton.btn.unlike();
      $(this).find('.count').html(count);
      isLiked = !isLiked;
      return;
    }

    $(this).parents('.simple-list-like-holder').removeClass('not-liked').addClass('liked');
    likeButton.btn.like();
    $(this).find('.count').html(count);
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

  var savedColumns = [];

  var modifiedData = _this.getPermissions(_this.listItems);
  var entryData = _.find(modifiedData, function(entry) {
    return entry.id === id;
  });

  // Define detail view data based on user's settings
  var newData = {
    id: entryData.id,
    editEntry: entryData.editEntry,
    deleteEntry: entryData.deleteEntry,
    likesEnabled: entryData.likesEnabled,
    bookmarksEnabled: entryData.bookmarksEnabled,
    commentsEnabled: entryData.commentsEnabled,
    data: [],
    originalData: entryData.data
  };

  _this.data.detailViewOptions.forEach(function(obj) {
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
      content: content,
      label: label,
      labelEnabled: labelEnabled,
      type: obj.type
    }
    newData.data.push(newObject);
    savedColumns.push(obj.column);
  });

  if (_this.data.detailViewAutoUpdate) {
    var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
    if (extraColumns && extraColumns.length) {
      extraColumns.forEach(function(column) {
        var newColumnData = {
          content: entryData.data[column],
          label: column,
          labelEnabled: true,
          type: 'text'
        };

        newData.data.push(newColumnData);
      });
    }
  }

  // Process template with data
  var entryId = {
    id: id
  };
  var wrapper = '<div class="simple-list-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = _this.$container.find('#simple-list-detail-overlay-' + _this.data.id);

  var src = _this.data.advancedSettings && _this.data.advancedSettings.detailHTML
    ? _this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['detail']]();
  var beforeShowDetails = Promise.resolve({
    src: src,
    data: newData
  });

  if (typeof _this.data.beforeShowDetails === 'function') {
    beforeShowDetails = _this.data.beforeShowDetails({
      config: _this.data,
      src: src,
      data: newData
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
    $overlay.find('.simple-list-detail-overlay-content-holder').html(wrapperTemplate(entryId));
    $overlay.find('.simple-list-detail-wrapper').append(template(data.data || newData));

    _this.prepareSetupBookmarkOverlay(id);
    _this.updateCommentCounter(id, true);

    // Trigger animations
    $('body').addClass('lock');
    _this.$container.find('.simple-list-container').addClass('overlay-open');
    $overlay.addClass('open');

    if (typeof _this.data.afterShowDetails === 'function') {
      _this.data.afterShowDetails({
        config: _this.data,
        src: data.src || src,
        data: data.data || newData
      });
    }
  });
}

DynamicList.prototype.closeDetails = function() {
  // Function that closes the overlay
  var _this = this;

  var $overlay = _this.$container.find('#simple-list-detail-overlay-' + _this.data.id);
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
  }, 300);
}

/******************/
/**** COMMENTS ****/
/******************/

DynamicList.prototype.getCommentsCount = function(element) {
  var _this = this;
  var identifier = $(element).data('entry-id');
  _this.connectToCommentsDataSource(identifier);
}

DynamicList.prototype.connectToCommentsDataSource = function(id) {
  var _this = this;
  var content = {
    contentDataSourceEntryId: id,
    type: 'comment'
  }
  return Fliplet.Content({dataSourceId: _this.data.commentsDataSourceId})
    .then(function(instance) {
      return instance.query({
        allowGrouping: true,
        where: {
          content: content
        }
      });
    })
    .then(function(entries){
      var foundExisting = false;
      _this.comments.forEach(function(obj, index) {
        if (obj.contentDataSourceEntryId === id) {
          _this.comments[index] = {
            contentDataSourceEntryId: id,
            count: entries.length,
            entries: entries
          }
          foundExisting = true;
        }
      });

      if (!foundExisting) {
        _this.comments.push({
          contentDataSourceEntryId: id,
          count: entries.length,
          entries: entries
        });
      }

      _this.updateCommentCounter(id);

      return;
    })
    .catch(function (error) {
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

DynamicList.prototype.updateCommentCounter = function(id, isOverlay) {
  var _this = this;
  // Get comments for entry
  var entryComments = _.find(_this.comments, function(obj) {
    return obj.contentDataSourceEntryId === id;
  });

  // Display comments count
  var data = {};

  if (entryComments) {
    data.count = entryComments.count
  }

  var commentCounterTemplate = '<span class="count">{{#if count}}{{count}}{{/if}}</span> <i class="fa fa-comment-o fa-lg"></i> <span class="comment-label">Comment</span>';
  var counterCompiled = Handlebars.compile(commentCounterTemplate);
  var html = counterCompiled(data);
  if (isOverlay) {
    $('.simple-list-detail-overlay .simple-list-comemnt-holder-' + id).html(html);
  } else {
    $('.simple-list-comemnt-holder-' + id).html(html);
  }
}

DynamicList.prototype.showComments = function(id) {
  var _this = this;

  $('.simple-list-comment-area').html(_this.commentsLoadingHTML);
  _this.connectToCommentsDataSource(id).then(function() {
    // Get comments for entry
    var entryComments = _.find(_this.comments, function(obj) {
      return obj.contentDataSourceEntryId === id;
    });

    // Display comments
    entryComments.entries.forEach(function(entry, index) {
      // Convert data/time
      var newDate = new Date(entry.createdAt);
      var timeInMilliseconds = newDate.getTime();
      var userName = '';

      if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
        _this.data.userNameFields.forEach(function(name, i) {
          userName += entry.data.settings.user[name] + ' ';
        });

        userName = userName.trim();
      } else {
        userName = entry.data.settings.user[_this.data.userNameFields[0]];
      }

      entryComments.entries[index].timeInMilliseconds = timeInMilliseconds;
      entryComments.entries[index].literalDate = moment(entry.createdAt).calendar(null, {
        sameDay: '[Today], HH:mm',
        nextDay: '[Tomorrow], HH:mm',
        nextWeek: 'dddd, HH:mm',
        lastDay: '[Yesterday], HH:mm',
        lastWeek: 'dddd, HH:mm',
        sameElse: 'MMM Do YY, HH:mm'
      });
      entryComments.entries[index].userName = userName;
      entryComments.entries[index].photo = entry.data.settings.user[_this.data.userPhotoColumn] || '';
      entryComments.entries[index].text = entry.data.settings.text || '';

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
          entryComments.entries[index].currentUser = true;
        }
      } else if (dataSourceEmail === myEmail) {
        entryComments.entries[index].currentUser = true;
      }
    });
    entryComments.entries = _.orderBy(entryComments.entries, ['timeInMilliseconds'], ['asc']);

    if (!_this.autosizeInit) {
      autosize($('.simple-list-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['comments']];
    var commentsTemplateCompiled = Handlebars.compile(commentsTemplate());
    var commentsHTML = commentsTemplateCompiled(entryComments.entries);
    // Display comments (fl-comments-list-holder)
    $('.simple-list-comment-area').html(commentsHTML).stop().animate({
      scrollTop: $('.simple-list-comment-area')[0].scrollHeight
    }, 250);
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
    var toCompareDataEmailPart = user.data[_this.data.userEmailColumn].match(/[^\@]+[^\.]+/)[0];
    var toCompareEmailPart = myEmail.match(/[^\@]+[^\.]+/)[0];

    return toCompareDataEmailPart.toLowerCase() === toCompareEmailPart.toLowerCase();
  });

  if (!userFromDataSource) {
    return Fliplet.Navigate.popup({
      title: 'Invalid user',
      message: 'We couldn\'t find your user details.'
    });
  }

  _this.appendTempComment(id, value, guid, userFromDataSource);

  _this.comments.forEach(function(obj, idx) {
    if (obj.contentDataSourceEntryId === id) {
      _this.comments[idx].count++
    }
  });
  
  _this.updateCommentCounter(id);

  if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
    _this.data.userNameFields.forEach(function(name, i) {
      if (_this.myUserData.isSaml2) {
        userName += userFromDataSource.data[name] + ' ';
      } else {
        userName += _this.myUserData[name] + ' ';
      }
    });
    userName = userName.trim();
  } else {
    if (_this.myUserData.isSaml2) {
      userName += userFromDataSource.data[_this.data.userNameFields[0]];
    } else {
      userName = _this.myUserData[_this.data.userNameFields[0]];
    }
  }

  var comment = {
    fromName: userName,
    user: _this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData
  };

  var content = {
    contentDataSourceEntryId: id,
    type: 'comment'
  }

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

  return Fliplet.Profile.Content({dataSourceId: _this.data.commentsDataSourceId})
    .then(function(instance) {
      return instance.create(content, {
        settings: comment
      })
    })
    .then(function(comment) {
      _this.comments.forEach(function(obj, idx) {
        if (obj.contentDataSourceEntryId === id) {
          _this.comments[idx].entries.push(comment);
        }
      });
      _this.replaceComment(guid, comment, 'final');
    })
    .catch(function onQueryError(error) {
      // Reverses count if error occurs
      console.error(error);
      _this.comments.forEach(function(obj, idx) {
        if (obj.contentDataSourceEntryId === id) {
          _this.comments[idx].count--
        }
      });

      _this.updateCommentCounter(id);
    });
}

DynamicList.prototype.appendTempComment = function(id, value, guid, userFromDataSource) {
  var _this = this;
  var timestamp = (new Date()).toISOString();
  var userName = '';

  if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
    _this.data.userNameFields.forEach(function(name, i) {
      if (_this.myUserData.isSaml2) {
        userName += userFromDataSource.data[name] + ' ';
      } else {
        userName += _this.myUserData[name] + ' ';
      }
    });
    userName = userName.trim();
  } else {
    if (_this.myUserData.isSaml2) {
      userName += userFromDataSource.data[_this.data.userNameFields[0]];
    } else {
      userName = _this.myUserData[_this.data.userNameFields[0]];
    }
  }

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

  var tempCommentTemplate = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['temp-comment']];
  var tempCommentTemplateCompiled = Handlebars.compile(tempCommentTemplate());
  var tempCommentHTML = tempCommentTemplateCompiled(commentInfo);

  $('.simple-list-comment-area').append(tempCommentHTML);
  $('.simple-list-comment-area').stop().animate({
    scrollTop: $('.simple-list-comment-area')[0].scrollHeight
  }, 250);
}

DynamicList.prototype.replaceComment = function(guid, commentData, context) {
  var _this = this;
  var userName = '';

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

  if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
    _this.data.userNameFields.forEach(function(name, i) {
      userName += commentData.data.settings.user[name] + ' ';
    });
    userName = userName.trim();
  } else {
    userName = commentData.data.settings.user[_this.data.userNameFields[0]];
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

    var commentTemplate = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['single-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  if (context === 'temp') {
    var commentTemplate = Fliplet.Widget.Templates[_this.simpleListLayoutMapping[_this.data.layout]['temp-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  $('.fl-individual-comment[data-id="' + guid + '"]').replaceWith(commentHTML);
}

DynamicList.prototype.deleteComment = function(id) {
  var _this = this;
  var entryId = $('.simple-list-item.open').data('entry-id') || _this.entryClicked;
  var commentHolder = $('.fl-individual-comment[data-id="' + id + '"]');
  Fliplet.DataSources.connect(_this.data.commentsDataSourceId).then(function (connection) {
    connection.removeById(id, { ack: true }).then(function onRemove() {
      _this.comments.forEach(function(obj, i) {
        if (obj.contentDataSourceEntryId && obj.contentDataSourceEntryId === entryId) {
          _.remove(_this.comments[i].entries, function(entry) {
            return entry.id === id;
          });
          _this.comments[i].count = _this.comments[i].entries.length;
        }
      });

      _this.updateCommentCounter(entryId);
      commentHolder.remove();
    });
  });
}

DynamicList.prototype.saveComment = function(entryId, commentId, value) {
  var _this = this;
  var commentData;
  var entryComments = _.find(_this.comments, function(entry) {
    return entry.contentDataSourceEntryId === entryId;
  });

  if (entryComments) {
    commentData = _.find(entryComments.entries, function(comment) {
      return comment.id === commentId;
    });
  }
  
  if (commentData) {
    commentData.data.settings.text = value;
    _this.replaceComment(commentId, commentData, 'temp');
  }

  var content = {
    contentDataSourceEntryId: entryId,
    type: 'comment'
  }

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