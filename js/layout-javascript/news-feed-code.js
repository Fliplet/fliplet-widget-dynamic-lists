var newsFeedLayoutMapping = {
  'news-feed': {
    'base': 'templates.build.news-feed-base',
    'loop': 'templates.build.news-feed-loop',
    'filter': 'templates.build.news-feed-filters',
    'comments': 'templates.build.news-feed-comment',
    'single-comment': 'templates.build.news-feed-single-comment',
    'temp-comment': 'templates.build.news-feed-temp-comment'
  }
};

var operators = {
  '==': function(a, b) { return a == b },
  '!=': function(a, b) { return a != b },
  '>': function(a, b) { return a > b },
  '>=': function(a, b) { return a >= b },
  '<': function(a, b) { return a < b },
  '<=': function(a, b) { return a <= b }
};

// Constructor
var DynamicList = function(id, data, container) {
  var _this = this;

  // Makes data and the component container available to Public functions
  this.data = data;
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');
  this.queryOptions = {};

  // Other variables
  // Global variables
  this.allowClick = true;
  this.mixer;
  this.autosizeInit = false;

  this.listItems;
  this.likeButtons = [];
  this.comments = [];
  this.allUsers;
  this.usersToMention = [];
  this.myProfileData;
  this.myUserData;
  this.currentUser;
  this.commentsLoadingHTML = '<div class="loading-holder"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</div>';
  this.entryClicked = undefined;

  this.setupCopyText();

  // Register handlebars helpers
  this.registerHandlebarsHelpers();

   // Start running the Public functions
  this.initialize();
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
}

DynamicList.prototype.attachObservers = function() {
  var _this = this;
  // Attach your event listeners here
  $(window).resize(function() {
    _this.setCardHeight();
  });

  _this.$container
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
      event.stopPropagation();
      var elementToExpand = $(this).find('.news-feed-item-content');
      // find the element to expand and expand it
      if (_this.allowClick) {
        _this.expandElement(elementToExpand);
      }

      var entryTitle = $(this).find('.news-feed-item-title').text();
      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'entry_open',
        label: entryTitle
      });
    })
    .on('click', '.news-feed-item-close-btn-wrapper', function(event) {
      event.stopPropagation();
      // find the element to collpase and collpase it
      _this.collapseElement($(this));
    })
    .on('click', '.list-search-icon .fa-sliders', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.news-feed-list-container');

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
      var $parentElement = $elementClicked.parents('.news-feed-list-container');

      if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').removeClass('active');
        $elementClicked.removeClass('active');
        $parentElement.find('.list-search-icon .fa-sliders').removeClass('active');
        $parentElement.find('.hidden-filter-controls').animate({ height: 0, }, 200);
      }
    })
    .on('keydown', '.search-holder input', function(e) {
      var $inputField = $(this);
      var $parentElement = $inputField.parents('.news-feed-list-container');
      var value = $inputField.val();
      if (value.length) {
        value = value.toLowerCase();
      }
      if (e.which == 13 || e.keyCode == 13) {
        if (value === '') {
          _this.clearSearch();
          return;
        }

        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'search',
          label: value
        });

        if ($inputField.hasClass('from-overlay')) {
          $inputField.parents('.news-feed-search-filter-overlay').removeClass('display');
        }
        $inputField.blur();
        $parentElement.find('.hidden-filter-controls').addClass('is-searching').removeClass('no-results');
        _this.searchData(value);
      }
    })
    .on('click', '.clear-search', function() {
      _this.clearSearch();
    })
    .on('click', '.search-query span', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.news-feed-list-container');

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
      var identifier = $(this).parents('.news-feed-list-item').data('entry-id');
      _this.entryClicked = identifier;
      _this.showComments(identifier);
      $('body').addClass('lock');
      $('.news-feed-list-item.open .slide-over').addClass('lock');
      $('.news-feed-comment-panel').addClass('open');

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comments_open'
      });
    })
    .on('click', '.news-feed-comment-close-panel', function() {
      $('.news-feed-comment-panel').removeClass('open');
      $('.news-feed-list-item.open .slide-over').removeClass('lock');
      if (!$('.news-feed-list-item').hasClass('open')) {
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
          _that.parents('.news-feed-comment-panel').addClass('typing');

          // Adds binding
          $(document).on('touchstart', '[data-comment-body]', function() {
            $(this).focus();
          });
        }, 0);
      }

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'comment_type'
      });
    })
    .on('blur', '[data-comment-body]', function() {
      var _that = $(this);

      if (Modernizr.ios) {
        setTimeout(function() {
          _that.parents('.news-feed-comment-panel').removeClass('typing');

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
    });
    
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
}

DynamicList.prototype.initialize = function() {
  var _this = this;
  // Render Base HTML template
  _this.renderBaseHTML();

  Fliplet.Session.get().then(function(session) {
    if (session && session.entries && session.entries.dataSource) {
      _this.myUserData = session.entries.dataSource.data;
    } else if (session && session.entries && session.entries.saml2) {
      _this.myUserData = session.entries.saml2.user;
      _this.myUserData.isSaml2 = true;
    } else {
      _this.myUserData = session.user;
    }

    return;
  }).then(function() {
    // Connect to data source to get rows
    _this.connectToDataSource()
      .then(function (records) {
        // Received the rows

        var sorted;
        var ordered;
        var filtered;

        // Prepare sorting
        if (_this.data.sortOptions.length) {
          var fields = [];
          var sortOrder = [];

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

          // Sort data
          sorted = _.sortBy(records, function (obj) {
            fields.forEach(function(field) {
              obj.data[field.column] = obj.data[field.column] || '';
              var value = obj.data[field.column].toString().toUpperCase();

              if (field.type === "alphabetical") {
                return value.match(/[A-Za-z]/)
                ? value
                : '{' + value;
              }

              if (field.type === "numerical") {
                return value.match(/[0-9]/)
                ? parseInt(value, 10)
                : '{' + value;
              }

              if (field.type === "date") {
                var newDate = new Date(value).getTime();
                return newDate;
              }
            });
          });

          ordered = _.orderBy(sorted, function(record) {
            var values = [];

            fields.forEach(function(field) {
              if (record.data[field.column] !== '' && record.data[field.column] !== null && typeof record.data[field.column] !== 'undefined') {
                values.push(record.data[field.column].toString());
              }
            });

            return values;
          }, sortOrder);
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
          filtered = _.filter(records, function(record) {
            var matched = 0;

            filters.some(function(filter) {
              var condition = filter.condition;
              // Case insensitive
              if (filter.value !== null && filter.value !== '' && typeof filter.value !== 'undefined') {
                filter.value = filter.value.toLowerCase();
              }
              if (record.data[filter.column] !== null && record.data[filter.column] !== '' && typeof record.data[filter.column] !== 'undefined') {
                record.data[filter.column] = record.data[filter.column].toLowerCase();
              }

              if (condition === 'contains') {
                if (record.data[filter.column].indexOf(filter.value) > -1) {
                  matched++;
                }
                return;
              }
              if (condition === 'notcontain') {
                if (record.data[filter.column].indexOf(filter.value) === -1) {
                  matched++;
                }
                return;
              }
              if (condition === 'regex') {
                var pattern = new RegExp(filter.value);
                if (patt.test(record.data[filter.column])){
                  matched++;
                }
                return;
              }
              if (operators[condition](record.data[filter.column], filter.value)) {
                matched++;
                return;
              }
            });

            return matched >= filters.length ? true : false;
          });
          records = filtered;
        }

        // Convert date and add flag for likes
        records.forEach(function(obj, i) {
          // Convert date
          if (typeof obj.data['Date'] !== 'undefined' || obj.data['Date'] !== null || obj.data['Date'] !== '') {
            records[i].data['Date'] = moment(obj.data['Date']).utc().format("MMM DD YYYY");
          }

          // Add likes flag
          if (_this.data.social && _this.data.social.likes) {
            records[i].likesEnabled = true;
          } else {
            records[i].likesEnabled = false;
          }

          // Add comments flag
          if (_this.data.social && _this.data.social.comments) {
            records[i].commentsEnabled = true;
          } else {
            records[i].commentsEnabled = false;
          }
        });

        // Make rows available Globally
        _this.listItems = records;
        
        // Render Loop HTML
        _this.renderLoopHTML(records);
        
        return;
      })
      .then(function() {
        // Listeners and Ready
        _this.attachObservers();
        _this.onReady();
      });
  });
}

DynamicList.prototype.connectToDataSource = function() {
  var _this = this;
  var options = {
    offline: true
  }

  return Fliplet.DataSources.connect(_this.data.dataSourceId, options)
    .then(function (connection) {
      // If you want to do specific queries to return your rows
      // See the documentation here: https://developers.fliplet.com/API/fliplet-datasources.html
      return connection.find(_this.queryOptions);
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

DynamicList.prototype.renderBaseHTML = function() {
  // Function that renders the List container
  var _this = this;
  var baseHTML = '';

  if (typeof _this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(_this.data));
}

DynamicList.prototype.renderLoopHTML = function(records) {
  // Function that renders the List template
  var _this = this;
  var loopHTML = '';
  var modifiedData = _this.convertCategories(records);

  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
  ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['loop']]());

  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).html(template(modifiedData));
  _this.addFilters(modifiedData);
}

DynamicList.prototype.addFilters = function(data) {
  // Function that renders the filters
  var _this = this;
  var filters = [];
  var filtersData = {
    'filtersInOverlay': _this.data.filtersInOverlay
  };

  data.forEach(function(row) {
    row.data.filters.forEach(function(filter) {
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

  filtersTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['filter']];
  var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
  ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
  : Handlebars.compile(filtersTemplate());

  _this.$container.find('.filter-holder').html(template(filtersData));
}

DynamicList.prototype.convertCategories = function(data) {
  // Function that get and converts the categories for the filters to work
  var _this = this;

  data.forEach(function(element) {
    element.data['classes'] = '';
    element.data['filters'] = [];
    var lowerCaseTags = [];
    _this.data.filterFields.forEach(function(filter) {
      var arrayOfTags = [];
      if (element.data[filter] !== null && typeof element.data[filter] !== 'undefined' && element.data[filter] !== '') {
        var arrayOfTags = element.data[filter].split(',').map(function(item) {
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
            class: '.' + classConverted
          }
        }
        lowerCaseTags.push(classConverted);
        element.data['filters'].push(newObj);
      });
      
    });
    element.data['classes'] = lowerCaseTags.join(' ');
  });
  return data;
}

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;
  var imagePromises = [];

  // Wait for image to load
  _this.$container.find('.news-feed-list-item').each(function(index, element) {
    var promise = new Promise(function(resolve, reject) {
      var image = $(element).find('.image-banner img')[0];

      if (image) {
        if (image.complete) {
          resolve();
        } else {
          image.addEventListener('load', resolve);
        }
      } else {
        resolve();
      }
    });

    imagePromises.push(promise);
  });

  Promise.all(imagePromises)
    .then(function() {
      _this.setCardHeight();
    });

  if (_this.data.filtersEnabled) {
    _this.initializeMixer();
  }

  if (_this.data.social && _this.data.social.likes) {
    _this.$container.find('.news-feed-list-item').each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-like';
      var title = $(element).find('.news-feed-item-inner-content .news-feed-item-title').text();
      _this.setupLikeButton(cardId, likeIndentifier, title);
    });
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

      _this.getUser();
    });
  }

  // Ready
  _this.$container.find('.news-feed-list-container').removeClass('loading').addClass('ready');
}

DynamicList.prototype.calculateFiltersHeight = function(element) {
  var targetHeight = element.find('.hidden-filter-controls-content').height();
  element.find('.hidden-filter-controls').animate({
    height: targetHeight,
  }, 200);
}

DynamicList.prototype.searchData = function(value) {
  // Function called when user executes a search
  var _this = this;

  // Removes cards
  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).html('');
  // Remove filters
  _this.$container.find('.filter-holder').html('');
  // Adds search query to HTML
  _this.$container.find('.current-query').html(value);
  
  // Search
  var searchedData = [];
  var filteredData;

  if (_this.data.searchEnabled && _this.data.searchFields.length) {
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
  }
  
  // Simulate that search is taking half a second
  // OPTIONAL - setTimeout can be removed
  setTimeout(function() {
    _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results').addClass('search-results');
    _this.calculateFiltersHeight(_this.$container.find('.news-feed-list-container'));

    if (!searchedData.length) {
      _this.$container.find('.hidden-filter-controls').addClass('no-results');
      return;
    }

    if (_this.data.filtersEnabled) {
      _this.mixer.destroy();
    }
    // Remove duplicates
    searchedData = _.uniq(searchedData);
    _this.renderLoopHTML(searchedData);
    _this.onReady();
  }, 0);
}

DynamicList.prototype.backToSearch = function() {
  // Function that is called when user wants to return
  // to the search input after searching for a value first
  var _this = this;

  _this.$container.find('.hidden-filter-controls').removeClass('is-searching search-results');
  
  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.news-feed-list-container'));
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }
}

DynamicList.prototype.clearSearch = function() {
  // Function called when user clears the search field
  var _this = this;

  // Removes value from search box
  _this.$container.find('.search-holder').find('input').val('').blur();
  // Resets all classes related to search
  _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results search-results searching');

  if (_this.$container.find('.hidden-filter-controls').hasClass('active')) {
    _this.calculateFiltersHeight(_this.$container.find('.news-feed-list-container'));
  } else {
    _this.$container.find('.hidden-filter-controls').animate({ height: 0, }, 200);
  }

  // Resets list
  if (_this.data.filtersEnabled) {
    _this.mixer.destroy();
  }
  _this.renderLoopHTML(_this.listItems);
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
    multifilter: {
      enable: true // enable the multifilter extension for the _this.mixer
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
      onMixClick: function(state, originalEvent) {
        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic_' + _this.data.layout,
          action: 'filter',
          label: this.innerText
        });
      }
    }
  });
}

DynamicList.prototype.setCardHeight = function() {
  var _this = this;

  _this.$container.find('.news-feed-list-item').each(function(index, element) {
    var slideHeight = $(element).find('.slide-under').outerHeight();
    var containerHeight = $(element).find('.news-feed-item-inner-content').outerHeight();
    var contentHeight;

    if (slideHeight) {
      contentHeight = slideHeight + containerHeight
    } else {
      contentHeight = containerHeight
    }

    $(element).css({
      height: contentHeight
    });
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
      likeLabel: '<i class="fa fa-heart-o fa-lg"></i> <span class="count">{{#if count}}{{count}}{{/if}}</span>',
      likedLabel: '<i class="fa fa-heart fa-lg animated bounceIn"></i> <span class="count">{{#if count}}{{count}}{{/if}}</span>',
      likeWrapper: '<div class="news-feed-like-wrapper btn-like"></div>',
      likedWrapper: '<div class="news-feed-like-wrapper btn-liked"></div>',
      addType: 'html'
    }),
    id: id
  });
}

DynamicList.prototype.expandElement = function(elementToExpand) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // Adds class 'open' to help with styling
  elementToExpand.parents('.news-feed-list-item').addClass('open');

  // Prevents 'body' scroll
  $('body').addClass('lock');

  // freeze the current scroll position of the background page expand-wrapper
  var elementOffset = elementToExpand.offset();
  var elementScrollTop = $(window).scrollTop();
  var netOffset = elementOffset.top - elementScrollTop;
  var expandPosition = $('body').offset();
  var expandTop = expandPosition.top;
  var expandLeft = expandPosition.left;
  var expandWidth = $('body').outerWidth();
  var expandHeight = $('body').outerHeight();

  // convert the expand-item to fixed position without moving it
  elementToExpand.css({
    'top': netOffset,
    'left': elementToExpand.offset().left,
    'height': elementToExpand.height(),
    'width': elementToExpand.width(),
    'position': 'fixed'
  });

  // start expand-item animation to the expand wrapper
  // expand the element with class .about-tile-bg-image
  elementToExpand.animate({
      'left': expandLeft,
      'top': expandTop,
      'height': expandHeight,
      'width': expandWidth
    },
    400, // animation timing in millisecs
    'easeOutBack', //animation easing
    function() {
      elementToExpand.css({
        'right': 0,
        'bottom': 0,
        'width': 'auto',
        'height': 'auto'
      });

      var windowWidth = $('body').width();
      if (windowWidth < 640) {
        elementToExpand.find('.slide-under').css({
          position: 'fixed'
        });

        var expandedPosition = elementToExpand.find('.slide-under').outerHeight();
        elementToExpand.find('.news-feed-item-inner-content').css({ top: expandedPosition + 'px' });
      }
    }
  );
}

DynamicList.prototype.collapseElement = function(collapseButton) {
  // Function called when a list item is tapped to close
  var _this = this;

  var elementToCollapseParent = collapseButton.parents('.news-feed-list-item');
  var elementToCollapse = elementToCollapseParent.find('.news-feed-item-content');
  
  // find the location of the placeholder
  var elementScrollTop = $(window).scrollTop();
  var elementToCollapsePlaceholderTop = elementToCollapseParent.offset().top - elementScrollTop;
  var elementToCollapsePlaceholderLeft = elementToCollapseParent.offset().left;
  var elementToCollapsePlaceholderHeight = elementToCollapseParent.outerHeight();
  var elementToCollapsePlaceholderWidth = elementToCollapseParent.outerWidth();

  var windowWidth = $('body').width();
  if (windowWidth < 640) {
    elementToCollapse.find('.slide-under').css({ position: 'relative' });
    elementToCollapse.find('.news-feed-item-inner-content').css({ top: '0px' });
  }

  // convert the width and height to numeric values
  elementToCollapse.css({
    'right': 'auto',
    'bottom': 'auto',
    'width': elementToCollapse.outerWidth(),
    'height': elementToCollapse.outerHeight(),
  });

  elementToCollapse.animate({
      'left': elementToCollapsePlaceholderLeft,
      'top': elementToCollapsePlaceholderTop,
      'height': elementToCollapsePlaceholderHeight,
      'width': elementToCollapsePlaceholderWidth
    },
    200, // animation timing in millisecs
    'linear', //animation easing
    function() {
      // Removes class 'open'
      elementToCollapseParent.removeClass('open');

      elementToCollapse.css({
        'position': 'relative',
        'top': 'auto',
        'left': 'auto',
        'width': '100%',
        'height': '100%'
      });
    }
  );

  // Stops preventing 'body' scroll
  $('body').removeClass('lock');
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

DynamicList.prototype.getUser = function() {
  var _this = this;
  return Fliplet.Profile.get('email')
    .then(function(email) {
      var user = email;
      if (!user) {
        var device = Fliplet.Navigator.device();
        user = device.uuid;
        _this.currentUser = user;
      } else {
        _this.currentUser = _.find(_this.allUsers, function(singleUser) {
          return singleUser.data[_this.data.userEmailColumn] === user;
        });
      }
      return Promise.resolve(_this.currentUser);
    });
}

DynamicList.prototype.updateCommentCounter = function(id) {
  var _this = this;
  // Get comments for entry
  var entryComments = _.find(_this.comments, function(obj) {
    return obj.contentDataSourceEntryId === id;
  });

  // Display comments count
  var data = {
    count: entryComments.count
  };
  var commentCounterTemplate = '<span class="count">{{#if count}}{{count}}{{/if}}</span> <i class="fa fa-comment-o fa-lg"></i> <span class="comment-label">Comment</span>';
  var counterCompiled = Handlebars.compile(commentCounterTemplate);
  var html = counterCompiled(data);
  $('.news-feed-comemnt-holder-' + id).html(html);
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
          userName += entry.data.settings.user.data[name] + ' ';
        });

        userName = userName.trim();
      } else {
        userName = entry.data.settings.user.data[_this.data.userNameFields[0]];
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
      entryComments.entries[index].photo = entry.data.settings.user.data[_this.data.userPhotoColumn] || '';
      entryComments.entries[index].text = entry.data.settings.text || '';

      var myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'];
      var dataSourceEmail = '';
      if (entry.data.settings.user && entry.data.settings.user.data[_this.data.userEmailColumn]) {
        dataSourceEmail = entry.data.settings.user.data[_this.data.userEmailColumn];
      }
      // Check if comment is from current user
      if (_this.myUserData && _this.myUserData.isSaml2) {
        var myEmailParts = myEmail.match(/[^\.]+/);
        var toComparePart = myEmailParts[0];
        var dataSourceEmailParts = dataSourceEmail.match(/[^\.]+/);
        var toComparePart2 = dataSourceEmailParts[0];

        if (toComparePart === toComparePart2) {
          entryComments.entries[index].currentUser = true;
        }
      } else {
        if (dataSourceEmail === myEmail) {
          entryComments.entries[index].currentUser = true;
        }
      }
    });
    entryComments.entries = _.orderBy(entryComments.entries, ['timeInMilliseconds'], ['asc']);

    if (!_this.autosizeInit) {
      autosize($('.news-feed-comment-input-holder textarea'));
      _this.autosizeInit = true;
    }

    var commentsTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['comments']];
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

  if (!_this.currentUser || (_this.currentUser && !_this.currentUser.data)) {
    return Fliplet.Navigate.popup({
      title: 'Invalid login',
      message: 'You must be logged in to use this feature.'
    });
  }

  _this.appendTempComment(id, value, guid);

  _this.comments.forEach(function(obj, idx) {
    if (obj.contentDataSourceEntryId === id) {
      _this.comments[idx].count++
    }
  });
  
  _this.updateCommentCounter(id);

  _this.getUser()
    .then(function (user) {
      var device = Fliplet.Navigator.device();
      var userName = '';

      if (user === device.uuid) {
        Fliplet.Navigate.popup({
          title: 'Invalid login',
          message: 'You must be logged in to use this feature.'
        });

        return Promise.reject('User must be logged in.');
      }

      if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
        _this.data.userNameFields.forEach(function(name, i) {
          userName += user.data[name] + ' ';
        });
        userName = userName.trim();
      } else {
        userName = user.data[_this.data.userNameFields[0]];
      }

      var comment = {
        fromName: userName,
        user: user
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

      return Fliplet.Content({dataSourceId: _this.data.commentsDataSourceId})
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
        });
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

DynamicList.prototype.appendTempComment = function(id, value, guid) {
  var _this = this;
  var timestamp = (new Date()).toISOString();
  var userName = '';

  if (_this.data.userNameFields && _this.data.userNameFields.length > 1) {
    _this.data.userNameFields.forEach(function(name, i) {
      userName += _this.currentUser.data[name] + ' ';
    });
    userName = userName.trim();
  } else {
    userName = _this.currentUser.data[_this.data.userNameFields[0]];
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
    photo: _this.currentUser.data[_this.data.userPhotoColumn] || '',
    text: value
  };

  var tempCommentTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['temp-comment']];
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
      userName += commentData.data.settings.user.data[name] + ' ';
    });
    userName = userName.trim();
  } else {
    userName = commentData.data.settings.user.data[_this.data.userNameFields[0]];
  }

  var myEmail = _this.myUserData[_this.data.userEmailColumn] || _this.myUserData['email'];
  var commentEmail = '';
  if (commentData.data.settings.user.data[_this.data.userEmailColumn]) {
    commentEmail = commentData.data.settings.user.data[_this.data.userEmailColumn];
  }
  var commentInfo = {
    id: commentData.id,
    literalDate: commentData.literalDate,
    userName: userName,
    photo: commentData.data.settings.user.data[_this.data.userPhotoColumn] || '',
    text: commentData.data.settings.text
  };
  
  if (context === 'final') {
    // Check if comment is from current user
    if (_this.myUserData && _this.myUserData.isSaml2) {
      var myEmailParts = myEmail.match(/[^\.]+/);
      var toComparePart = myEmailParts[0];
      var commentEmailParts = commentEmail.match(/[^\.]+/);
      var toComparePart2 = commentEmailParts[0];

      if (toComparePart === toComparePart2) {
        commentInfo.currentUser = true;
      }
    } else {
      if (commentEmail === myEmail) {
        commentInfo.currentUser = true;
      }
    }

    var commentTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['single-comment']];
    var commentTemplateCompiled = Handlebars.compile(commentTemplate());
    var commentHTML = commentTemplateCompiled(commentInfo);
  }
  if (context === 'temp') {
    var commentTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['temp-comment']];
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
        settings: {
          text: value
        }
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