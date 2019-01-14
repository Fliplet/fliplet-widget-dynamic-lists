// Constructor
var DynamicList = function(id, data, container) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.newsFeedLayoutMapping = {
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
  this.$overlay;
  this.queryOptions = {};

  // Other variables
  // Global variables
  this.allowClick = true;
  this.mixer;
  this.autosizeInit = false;

  this.listItems;
  this.modifiedListItems;
  this.searchedListItems;
  this.dataSourceColumns;
  this.likeButtons = [];
  this.bookmarkButtons = [];
  this.likeButtonOverlay;
  this.bookmarkButtonOverlay;
  this.comments = [];
  this.allUsers;
  this.usersToMention = [];
  this.myUserData;
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</div>';
  this.entryClicked = undefined;
  this.isFiltering;
  this.isSearching;

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

  this.data.bookmarksEnabled = _this.data.social.bookmark;

  this.setupCopyText();

  this.src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[this.data.layout]['detail']]();


  this.detailHTML = Handlebars.compile(this.src);

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

DynamicList.prototype.setupCopyText = function() {
  // Copy to clipboard text prototype
  HTMLElement.prototype.copyText = function() {
    var range = document.createRange();
    this.style.webkitUserSelect = 'text';
    range.selectNode(this);
    window.getSelection().addRange(range);
    this.style.webkitUserSelect = 'inherit';

    try {
      // Now that we've selected the anchor text, execute the copy command
      var successful = document.execCommand('copy');
      var msg = successful ? 'successful' : 'unsuccessful';
    } catch(err) {
      console.error('Oops, unable to copy', err);
    }

    // Remove the selections - NOTE: Should use
    // removeRange(range) when it is supported
    window.getSelection().removeAllRanges();
  }

  if (typeof jQuery !== 'undefined') {
    $.fn.copyText = function(){
      return $(this).each(function(i){
        if (i > 0) return;
        this.copyText();
      });
    };
  }
}

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
    if (!date) {
      return;
    }

    return moment(date).utc().format('DD MMMM YYYY');
  });

  Handlebars.registerHelper('removeSpaces', function(context) {
    return context.replace(/\s+/g, '');
  });
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
    .on('click', '.hidden-filter-controls-filter', function() {
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'filter',
        label: $(this).text()
      });

      $(this).toggleClass('mixitup-control-active');
      _this.filterList();
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
      var entryTitle = $(this).find('.news-feed-item-title').text();

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_open',
        label: entryTitle
      });

      var beforeOpen = Promise.resolve();
    
      if (typeof _this.data.beforeOpen === 'function') {
        beforeOpen = _this.data.beforeOpen({
          config: _this.data,
          entry: _.find(_this.listItems, { id: entryId })
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
    })
    .on('click', '.list-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-news-feed-list-container');

      if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').removeClass('active');
        $elementClicked.removeClass('active');
        $parentElement.find('.list-search-icon .fa-sliders').removeClass('active');
        $parentElement.find('.hidden-filter-controls').animate({ height: 0, }, 200);
      }
    })
    .on('keydown', '.search-holder input', function(e) {
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
          _this.clearSearch();
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
        _this.clearSearch();
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
      _this.clearSearch();
    })
    .on('click', '.search-query span', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.new-news-feed-list-container');

      _this.backToSearch();
      $parentElement.find('.search-holder input').focus();
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
      if ($('.new-news-feed-list-container').hasClass('overlay-open')) {
        identifier = $(this).parents('.news-feed-details-content-holder').data('entry-id');
      } else {
        identifier = $(this).parents('.news-feed-list-item').data('entry-id');
      }
      _this.entryClicked = identifier;
      _this.showComments(identifier);
      $('body').addClass('lock');
      $('.new-news-feed-comment-panel').addClass('open');

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click', '.news-feed-comment-close-panel', function() {
      $('.new-news-feed-comment-panel').removeClass('open');
      $('.news-feed-list-item.open .slide-over').removeClass('lock');
      if (!$('.news-feed-detail-overlay').hasClass('open')) {
        $('body').removeClass('lock');
      }
    })
    .on('click', '.news-feed-comment-input-holder .comment', function() {
      var entryId = $('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
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
      var commentId = $('.fl-individual-comment.editing').data('id');
      var entryId = $('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
      var $commentArea = $(this).parents('.news-feed-comment-input-holder').find('[data-comment-body]');
      var comment = $commentArea.val();

      $('.fl-individual-comment').removeClass('editing');
      $('.news-feed-comment-input-holder').removeClass('editing');
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
      $('.fl-individual-comment').removeClass('editing');
      $('.news-feed-comment-input-holder').removeClass('editing');

      var $messageArea = $('[data-comment-body]');
      $messageArea.val('').trigger('change');
      autosize.update($messageArea);
    })
    .on('click', '.final .fl-comment-value', function(e) {
      e.preventDefault();
      var _that = $(this);
      var commentId = $(this).parents('.fl-individual-comment').data('id');
      var $parentContainer = $(this).parents('.fl-individual-comment');
      var elementToCopy = $(this);

      if ($parentContainer.hasClass('current-user')) {
        Fliplet.UI.Actions({
          title: 'What do you want to do?',
          labels: [
            {
              label: 'Copy',
              action: function (i) {
                elementToCopy.copyText();

                Fliplet.Analytics.trackEvent({
                  category: 'list_dynamic_' + _this.data.layout,
                  action: 'comment_copy'
                });
              }
            },
            {
              label: 'Edit',
              action: function (i) {
                var $messageArea = $('[data-comment-body]');
                var textToEdit = elementToCopy.text().trim();
                _that.parents('.fl-individual-comment').addClass('editing');
                $('.news-feed-comment-input-holder').addClass('editing');

                $messageArea.val(textToEdit);
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
        });
      } else {
        Fliplet.UI.Actions({
          title: 'What do you want to do?',
          labels: [
            {
              label: 'Copy',
              action: function (i) {
                elementToCopy.copyText();

                Fliplet.Analytics.trackEvent({
                  category: 'list_dynamic_' + _this.data.layout,
                  action: 'comment_copy'
                });
              }
            }
          ],
          cancel: 'Cancel'
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
    return connection.removeById(entryID);
  }).then(function () {
    return Promise.resolve(entryID);
  });
}

DynamicList.prototype.prepareSetupBookmarkOverlay = function(id) {
  var _this = this;
  var bookmarkIndentifier = id + '-bookmark';
  var likeIndentifier = id + '-like';
  var title = $('.news-feed-detail-overlay').find('.news-feed-item-inner-content .news-feed-item-title').text();

  if (_this.data.social && _this.data.social.bookmark) {
    _this.setupBookmarkButtonOverlay(id, bookmarkIndentifier, title);
  }
  if (_this.data.social && _this.data.social.likes) {
    _this.setupLikeButtonOverlay(id, likeIndentifier, title);
  }
  if (_this.data.social && (_this.data.social.bookmark || _this.data.social.likes)) {
    _this.likesObserversOverlay(id);
  }
}

DynamicList.prototype.likesObservers = function() {
  var _this = this;

  _this.likeButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_like',
        label: entryTitle
      });
    });

    button.btn.on('unliked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unlike',
        label: entryTitle
      });
    });
  });

  _this.bookmarkButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      this.$btn.parents('.news-feed-list-item').addClass('bookmarked');
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    button.btn.on('unliked', function(data){
      this.$btn.parents('.news-feed-list-item').removeClass('bookmarked');
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });
  });
}

DynamicList.prototype.likesObserversOverlay = function(id) {
  var _this = this;

  if (_this.bookmarkButtonOverlay) {
    _this.bookmarkButtonOverlay.on('liked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      var button = _.find(_this.bookmarkButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.like();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    _this.bookmarkButtonOverlay.on('unliked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      var button = _.find(_this.bookmarkButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.unlike();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });
  }

  if (_this.likeButtonOverlay) {
    _this.likeButtonOverlay.on('liked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      var button = _.find(_this.likeButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.like();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_bookmark',
        label: entryTitle
      });
    });

    _this.likeButtonOverlay.on('unliked', function(data){
      var entryTitle = this.$btn.parents('.news-feed-item-inner-content').find('.news-feed-item-title').text();
      var button = _.find(_this.likeButtons, function(btn) {
        return btn.id === id;
      });

      if (button) {
        button.btn.unlike();
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_unbookmark',
        label: entryTitle
      });
    });
  }
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

        columns.push('data[modified_' + field.column + ']');
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
    if (_this.data.social && _this.data.social.likes) {
      records[i].likesEnabled = true;
    } else {
      records[i].likesEnabled = false;
    }

    // Add bookmarks flag
    if (_this.data.social && _this.data.social.bookmark) {
      records[i].bookmarksEnabled = true;
    } else {
      records[i].bookmarksEnabled = false;
    }

    // Add comments flag
    if (_this.data.social && _this.data.social.comments) {
      records[i].commentsEnabled = true;
    } else {
      records[i].commentsEnabled = false;
    }
  });

  return records;
}

DynamicList.prototype.initialize = function() {
  var _this = this;

  // Render list with default data
  if (_this.data.defaultData) {
    // Render Base HTML template
    _this.renderBaseHTML();

    _this.listItems = _this.prepareData(_this.data.defaultEntries);
    _this.dataSourceColumns = _this.data.defaultColumns;
    // Render Loop HTML
    _this.prepareToRenderLoop(_this.listItems);
    _this.renderLoopHTML();
    _this.addFilters(_this.modifiedListItems);
    // Listeners and Ready
    _this.attachObservers();
    _this.onReady();
    return;
  }

  // Check if there is a PV for search/filter queries
  _this.parsePVQueryVars()
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();

      return _this.connectToDataSource();
    })
    .then(function (records) {
      _this.listItems = _this.prepareData(records);
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
      _this.prepareToRenderLoop(_this.listItems);
      _this.checkIsToOpen();
      _this.renderLoopHTML();
      _this.addFilters(_this.modifiedListItems);
      _this.prepareToSearch();
      _this.prepareToFilter();
      return
    })
    .then(function() {
      // Listeners and Ready
      _this.attachObservers();
      _this.onReady();
    });
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
  
  _this.$container.find('.new-news-feed-list-container').addClass('searching');
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
    baseHTML = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(data));
  _this.$overlay = _this.$container.find('#news-feed-detail-overlay-' + _this.data.id);
}

DynamicList.prototype.prepareToRenderLoop = function(records) {
  var _this = this;
  var savedColumns = [];
  var loopHTML = '';
  var modifiedData = _this.convertCategories(records);
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

  
  // Define detail view data based on user's settings
  var detailData = [];

  _this.data.detailViewOptions.forEach(function(obj) {
    modifiedData.some(function(entryData) {
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

  if (_this.data.detailViewAutoUpdate) {
    loopData.forEach(function(entry, index) {
      var extraColumns = _.difference(_this.dataSourceColumns, savedColumns);
      if (extraColumns && extraColumns.length) {

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
      }
    });
  }
  _this.modifiedListItems = loopData;
}

DynamicList.prototype.renderLoopHTML = function() {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['loop']]());

  var limitedList = undefined;
  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0 && !_this.isSearching && !_this.isFiltering) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);
  }

  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).html(template(limitedList || _this.modifiedListItems));
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

  filtersTemplate = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['filter']];
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

  if (!$('.hidden-filter-controls-filter.mixitup-control-active').length) {
    _this.prepareToRenderLoop(listData);
    _this.renderLoopHTML();
    _this.onReady();
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

  _this.prepareToRenderLoop(filteredData);
  _this.renderLoopHTML();
  _this.onReady();
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

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  if (_this.data.social && _this.data.social.likes) {
    _this.$container.find('.news-feed-list-item').each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-like';
      var title = $(element).find('.news-feed-item-inner-content .news-feed-item-title').text();
      _this.setupLikeButton(cardId, likeIndentifier, title);
    });
  }

  if (_this.data.social && _this.data.social.bookmark) {
    _this.initializeMixer();
    _this.$container.find('.news-feed-list-item').each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-bookmark';
      var title = $(element).find('.news-feed-item-inner-content .news-feed-item-title').text();
      _this.setupBookmarkButton(cardId, likeIndentifier, title);
    });
  }

  if (_this.data.social && (_this.data.social.bookmark || _this.data.social.likes)) {
    _this.likesObservers();
  }

  if (_this.data.social && _this.data.social.comments) {
    _this.$container.find('.news-feed-list-item').each(function(index, element) {
      _this.getCommentsCount(element);
    });

    // Get users info
    _this.connectToUsersDataSource().then(function(users) {
      _this.allUsers = users;
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

  // Ready
  _this.$container.find('.new-news-feed-list-container').removeClass('loading').addClass('ready');

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

// Function to add class to card marking it as bookmarked - for filtering
DynamicList.prototype.checkBookmarked = function() {
  var _this = this;

  _this.$container.find('.btn-bookmarked').each(function(idx, element) {
    $(element).parents('.news-feed-list-item').addClass('bookmarked');
  });
}

DynamicList.prototype.calculateFiltersHeight = function(element, isFromSearch, isClearSearch) {
  var targetHeight = element.find('.hidden-filter-controls-content').height();
  var filterHolder = element.find('.filter-holder').height();
  var totalHeight = targetHeight;

  if (isFromSearch && filterHolder) {
    totalHeight = targetHeight - filterHolder;
  }

  if (isClearSearch) {
    totalHeight = 0;
  }

  element.find('.hidden-filter-controls').animate({
    height: totalHeight,
  }, 200);
}

DynamicList.prototype.overrideSearchData = function(value) {
  var _this = this;
  var $inputField = _this.$container.find('.search-holder input');
  var copyOfValue = value;
  value = value.toLowerCase();

  $inputField.val(copyOfValue);
  $inputField.blur();
  _this.$container.find('.hidden-filter-controls').addClass('is-searching').removeClass('no-results');
  _this.$container.find('.hidden-filter-controls').addClass('active');
  _this.$container.find('.list-search-cancel').addClass('active');
  _this.$container.find('.list-search-cancel ~ .fa-sliders').addClass('active');

  // Removes cards
  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).html('');
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

  _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results').addClass('search-results');
  if (!_this.data.filtersInOverlay) {
    _this.calculateFiltersHeight(_this.$container.find('.new-news-feed-list-container'), true);
  }

  if (!searchedData.length) {
    _this.$container.find('.hidden-filter-controls').addClass('no-results');
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  // Remove duplicates
  searchedData = _.uniq(searchedData);
  _this.searchedListItems = searchedData;
  _this.prepareToRenderLoop(searchedData);
  _this.renderLoopHTML();
  _this.addFilters(_this.modifiedListItems);

  if (_this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
    _this.showDetails(_this.searchedListItems[0].id);
  }

  _this.onReady();
}

DynamicList.prototype.searchData = function(value) {
  // Function called when user executes a search
  var _this = this;
  var $inputField = _this.$container.find('.search-holder input');
  var copyOfValue = value;
  value = value.toLowerCase();

  $inputField.val(copyOfValue);
  $inputField.blur();
  _this.$container.find('.hidden-filter-controls').addClass('is-searching').removeClass('no-results');
  _this.$container.find('.hidden-filter-controls').addClass('active');
  _this.$container.find('.list-search-cancel').addClass('active');
  _this.$container.find('.list-search-cancel ~ .fa-sliders').addClass('active');

  // Removes cards
  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).html('');
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
    _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results').addClass('search-results');
    if (!_this.data.filtersInOverlay) {
      _this.calculateFiltersHeight(_this.$container.find('.new-news-feed-list-container'), true);
    }

    if (!searchedData.length) {
      _this.$container.find('.hidden-filter-controls').addClass('no-results');
    }

    if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
      _this.mixer.destroy();
    }

    searchedData = _.uniq(searchedData);
    _this.searchedListItems = searchedData;
    _this.prepareToRenderLoop(searchedData);
    _this.renderLoopHTML();
    _this.addFilters(_this.modifiedListItems);

    if (_this.querySearch && _this.pvSearchQuery && _this.pvSearchQuery.openSingleEntry && _this.searchedListItems.length === 1) {
      _this.showDetails(_this.searchedListItems[0].id);
    }

    _this.onReady();
  });
}

DynamicList.prototype.backToSearch = function() {
  // Function that is called when user wants to return
  // to the search input after searching for a value first
  var _this = this;

  _this.$container.find('.hidden-filter-controls').removeClass('is-searching search-results');
  
  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.new-news-feed-list-container'), false, true);
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }
}

DynamicList.prototype.clearSearch = function() {
  // Function called when user clears the search field
  var _this = this;

  // Removes value from search box
  _this.$container.find('.search-holder').find('input').val('').blur().removeClass('not-empty');
  // Resets all classes related to search
  _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results search-results searching');

  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.new-news-feed-list-container'), false, true);
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }

  if (_this.data.social && _this.data.social.bookmark && _this.mixer) {
    _this.mixer.destroy();
  }

  // Resets list
  _this.searchedListItems = undefined;
  _this.prepareToRenderLoop(_this.listItems);
  _this.renderLoopHTML();
  _this.addFilters(_this.modifiedListItems);
  _this.onReady();
}

DynamicList.prototype.initializeMixer = function() {
  // Function that initializes MixItUP
  // Plugin used for filtering
  var _this = this;

  _this.mixer = mixitup('#news-feed-list-wrapper-' + _this.data.id, {
    selectors: {
      control: '[data-mixitup-control="' + _this.data.id + '"]',
      target: '.news-feed-list-item'
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
      }
    }
  });
}

DynamicList.prototype.setupLikeButton = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.likeButtons.push({
    btn: LikeButton({
      target: '.news-feed-like-holder-' + id,
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
      target: '.news-feed-bookmark-holder-' + id,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: { 
        entryId: identifier
      },
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
      likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
      likeWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmarked"></div>',
      addType: 'html'
    }),
    id: id
  });
}

DynamicList.prototype.setupLikeButtonOverlay = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.likeButtonOverlay = LikeButton({
    target: '.news-feed-detail-overlay .news-feed-like-holder-' + id,
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
    addType: 'html'
  });
}

DynamicList.prototype.setupBookmarkButtonOverlay = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  _this.bookmarkButtonOverlay = LikeButton({
    target: '.news-feed-detail-overlay .news-feed-bookmark-holder-' + id,
    dataSourceId: _this.data.bookmarkDataSourceId,
    content: { 
      entryId: identifier
    },
    name: Fliplet.Env.get('pageTitle') + '/' + title,
    likeLabel: '<i class="fa fa-bookmark-o fa-lg"></i>',
    likedLabel: '<i class="fa fa-bookmark fa-lg animated fadeIn"></i>',
    likeWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmark"></div>',
    likedWrapper: '<div class="news-feed-bookmark-wrapper btn-bookmarked"></div>',
    addType: 'html'
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

  var wrapper = '<div class="news-feed-detail-wrapper" data-entry-id="{{id}}"></div>';

  var entryId = {
    id: id
  };

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

    _this.prepareSetupBookmarkOverlay(id);
    _this.updateCommentCounter(id, true);

    // Trigger animations
    $('body').addClass('lock');
    _this.$container.find('.new-news-feed-list-container').addClass('overlay-open');

    // Calculate top position when image finishes loading
    if ($(window).width() < 640) {
      $('.news-feed-list-detail-image-wrapper img').one('load', function() {
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
    $('.news-feed-detail-overlay .news-feed-comemnt-holder-' + id).html(html);
  } else {
    $('.news-feed-comemnt-holder-' + id).html(html);
  }
}

DynamicList.prototype.showComments = function(id) {
  var _this = this;

  $('.news-feed-comment-area').html(_this.commentsLoadingHTML);
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
      autosize($('.news-feed-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['comments']];
    var commentsTemplateCompiled = Handlebars.compile(commentsTemplate());
    var commentsHTML = commentsTemplateCompiled(entryComments.entries);
    // Display comments (fl-comments-list-holder)
    $('.news-feed-comment-area').html(commentsHTML).stop().animate({
      scrollTop: $('.news-feed-comment-area')[0].scrollHeight
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

  var tempCommentTemplate = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['temp-comment']];
  var tempCommentTemplateCompiled = Handlebars.compile(tempCommentTemplate());
  var tempCommentHTML = tempCommentTemplateCompiled(commentInfo);

  $('.news-feed-comment-area').append(tempCommentHTML);
  $('.news-feed-comment-area').stop().animate({
    scrollTop: $('.news-feed-comment-area')[0].scrollHeight
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

    var commentTemplate = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['single-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  if (context === 'temp') {
    var commentTemplate = Fliplet.Widget.Templates[_this.newsFeedLayoutMapping[_this.data.layout]['temp-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  $('.fl-individual-comment[data-id="' + guid + '"]').replaceWith(commentHTML);
}

DynamicList.prototype.deleteComment = function(id) {
  var _this = this;
  var entryId = $('.news-feed-list-item.open').data('entry-id') || _this.entryClicked;
  var commentHolder = $('.fl-individual-comment[data-id="' + id + '"]');
  Fliplet.DataSources.connect(_this.data.commentsDataSourceId).then(function (connection) {
    connection.removeById(id).then(function onRemove() {
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