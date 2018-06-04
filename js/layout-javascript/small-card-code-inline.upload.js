var SmallCardsLayoutInline = (function() {
  var layoutMapping = {
    'small-card': {
      'base': 'templates.build.small-card-base',
      'loop': 'templates.build.small-card-loop',
      'detail': 'templates.build.small-card-detail',
      'profile-icon': 'templates.build.small-card-profile-icon',
      'user-profile': 'templates.build.small-card-user-profile'
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
  function SmallCardsLayoutInline(data, container) {
    console.log(data);
    var _this = this;

    // Global variables
    var allowClick = true;
    var clusterize;
    var mixer;

    var emailField = 'Email';
    var myProfileData;
    var myUserData;

    var listItems;

    // Makes data and the component container available to Public functions
    this.data = data;
    this.$container = $('[data-dynamic-lists-id="' + _this.data.id + '"]');

    // Register handlebars helpers
    this.registerHandlebarsHelpers();
    // Get the current session data
    Fliplet.Session.get().then(function(session) {
      if (session && session.entries && session.entries.dataSource) {
        myUserData = session.entries.dataSource.data;
      } else {
        myUserData = session.user;
      }
      
      // Start running the Public functions
      _this.initialize();
    });
  }

  SmallCardsLayoutInline.prototype = {
    // Public functions
    constructor: SmallCardsLayoutInline,

    registerHandlebarsHelpers: function() {
      // Register your handlebars helpers here

      var partialDOM = Fliplet.Widget.Templates[layoutMapping[_this.data.layout]['detail']]();
      Handlebars.registerPartial('profile', partialDOM);

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
    },
    attachObservers: function() {
      // Attach your event listeners here
      $(document)
        .on('touchstart', '.small-card-list-item', function(event) {
          event.stopPropagation();
          $(this).addClass('hover');
        })
        .on('touchmove', '.small-card-list-item', function() {
          allowClick = false;
          $(this).removeClass('hover');
        })
        .on('touchend touchcancel', '.small-card-list-item', function() {
          $(this).removeClass('hover');
          // Delay to compensate for the fast click event
          setTimeout(function() {
            allowClick = true;
          }, 100);
        })
        .on('click', '.my-profile-container', function() {
          var directoryDetailWrapper = $(this).find('.small-card-list-detail-wrapper');
          _this.expandElement(directoryDetailWrapper);
        })
        .on('click', '.small-card-list-item', function(event) {
          event.stopPropagation();
          // find the element to expand and expand it
          if (allowClick) {
            var directoryDetailWrapper = $(this).find('.small-card-list-detail-wrapper');
            _this.expandElement(directoryDetailWrapper);
          }
        })
        .on('click', '.small-card-list-detail-close-btn', function(event) {
          event.stopPropagation();
          // find the element to collpase and collpase it
          var directoryDetailWrapper = $(this).parents('.small-card-list-detail-wrapper');
          _this.collapseElement(directoryDetailWrapper);
        })
        .on('click', '.list-search-icon .fa-search, .list-search-icon .fa-filter', function() {
          var $elementClicked = $(this);
          var $parentElement = $elementClicked.parents('.small-card-list-container');

          if (!$parentElement.find('.hidden-filter-controls').hasClass('active')) {
            $parentElement.find('.hidden-filter-controls').addClass('active');
            $parentElement.find('.list-search-cancel').addClass('active');
            $elementClicked.addClass('active');

            var targetHeight = $parentElement.find('.hidden-filter-controls-content').outerHeight();
            $parentElement.find('.hidden-filter-controls').animate({ height: targetHeight, }, 200);
          }
        })
        .on('click', '.list-search-cancel', function() {
          var $elementClicked = $(this);
          var $parentElement = $elementClicked.parents('.small-card-list-container');

          if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
            $parentElement.find('.hidden-filter-controls').removeClass('active');
            $elementClicked.removeClass('active');
            $parentElement.find('.list-search-icon .fa-search').removeClass('active');
            $parentElement.find('.list-search-icon .fa-filter').removeClass('active');
            $parentElement.find('.hidden-filter-controls').animate({ height: 0, }, 200);
          }
        })
        .on('keydown', '.search-holder input', function(e) {
          var $inputField = $(this);
          var $parentElement = $inputField.parents('.small-card-list-container');
          var value = $inputField.val().toLowerCase();
          if (event.which == 13 || event.keyCode == 13) {
            if (value === '') {
              _this.clearSearch();
              return;
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
          var $parentElement = $elementClicked.parents('.small-card-list-container');

          _this.backToSearch();
          $parentElement.find('.search-holder input').focus();
        });
    },
    initialize: function() {
      // Render Base HTML template
      _this.renderBaseHTML();

      // Connect to data source to get rows
      _this.connectToDataSource()
        .then(function (records) {
          // Received the rows

          var sorted;
          var filtered;

          // Prepare sorting
          if (_this.data.sortOptions.length) {
            var fields = [];
            var sortOrder = [];

            _this.data.sortOptions.forEach(function(option) {
              fields.push(option.column);

              if (option.orderBy === 'ascending') {
                sortOrder.push('asc');
              }
              if (option.orderBy === 'descending') {
                sortOrder.push('desc');
              }
            });

            // Sort data
            sorted = _.orderBy(records, function(record) {
              var values = [];

              fields.forEach(function(field) {
                values.push(record.data[field].toString());
              });

              return values;
            }, sortOrder);
            records = sorted;
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

              filters.forEach(function(filter) {
                var condition = filter.condition;

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
                  return ;
                }
                if (operators[condition](record.data[filter.column], filter.value)) {
                  matched++;
                  return ;
                }
              });

              return matched > 0 ? true : false;
            });
            records = filtered;
          }

          // Make rows available Globally
          listItems = records;

          // Get user profile
          if (myUserData) {
            // Create flag for current user
            records.forEach(function(el, idx) {
              if (el.data[emailField] === (myUserData[emailField] || myUserData['email'])) {
                records[idx].isCurrentUser = true;
              }
            });

            myProfileData = _.filter(records, function(row) {
              return row.isCurrentUser;
            });

            // Remove current user from list on entries
            /*
            _.remove(records, function(row) {
              return row.isCurrentUser;
            });
            */
          }
          
          // Render Loop HTML
          _this.renderLoopHTML(records);

          // Render user profile
          if (myProfileData.length) {
            var myProfileTemplate = Fliplet.Widget.Templates[layoutMapping[_this.data.layout]['user-profile']];
            var myProfileTemplateCompiled = Handlebars.compile(myProfileTemplate());
            $('.my-profile-placeholder').html(myProfileTemplateCompiled(myProfileData[0]));

            var profileIconTemplate = Fliplet.Widget.Templates[layoutMapping[_this.data.layout]['profile-icon']];
            var profileIconTemplateCompiled = Handlebars.compile(profileIconTemplate());
            $('.my-profile-icon').html(profileIconTemplateCompiled(myProfileData[0]));

            $('.section-top-wrapper').removeClass('profile-disabled');
          }
          
          return;
        })
        .then(function() {
          // Listeners and Ready
          _this.attachObservers();
          _this.onReady();
        });
    },
    connectToDataSource: function() {
      var options = {
        offline: true
      }

      return Fliplet.DataSources.connect(_this.data.dataSourceId, options)
        .then(function (connection) {
          // If you want to do specific queries to return your rows
          // See the documentation here: https://developers.fliplet.com/API/fliplet-datasources.html
          return connection.find();
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
    },
    renderBaseHTML: function() {
      // Function that renders the List container

      var baseHTML = '';

      if (typeof _this.data.layout !== 'undefined') {
        baseHTML = Fliplet.Widget.Templates[layoutMapping[_this.data.layout]['base']];
      }

      var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
      ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
      : Handlebars.compile(baseHTML());

      debugger;
      $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(_this.data));
    },
    renderLoopHTML: function(records) {
      // Function that renders the List template

      var loopHTML = '';
      var modifiedData = _this.convertCategories(records);

      if (typeof _this.data.layout !== 'undefined') {
        loopHTML = Fliplet.Widget.Templates[layoutMapping[_this.data.layout]['loop']];
      }

      var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
      ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
      : Handlebars.compile(loopHTML());

      _this.$container.find('#small-card-list-wrapper-' + _this.data.id).html(template(modifiedData));
      _this.addFilters(modifiedData);
    },
    addFilters: function(data) {
      // Function that renders the filters

      var filters = [];

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

      filtersTemplate = Fliplet.Widget.Templates['templates.build.' + _this.data.layout + '-filters'];
      var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
      ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
      : Handlebars.compile(filtersTemplate());

      _this.$container.find('.filter-holder').html(template(allFilters));
    },
    convertCategories: function(data) {
      // Function that get and converts the categories for the filters to work

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
    },
    searchData: function(value) {
      // Function called when user executes a search

      // Removes cards
      _this.$container.find('#small-card-list-wrapper-' + _this.data.id).html('');
      // Remove filters
      _this.$container.find('.filter-holder').html('');
      // Adds search query to HTML
      _this.$container.find('.current-query').html(value);
      
      // Search
      var searchedData = [];
      var filteredData;

      if (_this.data.searchEnabled && _this.data.searchFields.length) {
        _this.data.searchFields.forEach(function(field) {    
          filteredData = _.filter(listItems, function(obj) {
            if (obj.data[field] !== null) {
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

        if (!searchedData.length) {
          _this.$container.find('.hidden-filter-controls').addClass('no-results');
          return;
        }

        mixer.destroy();
        clusterize.destroy();
        // Remove duplicates
        searchedData = _.uniq(searchedData);
        _this.renderLoopHTML(searchedData);
        _this.onReady();
      }, 500);
    },
    backToSearch: function() {
      // Function that is called when user wants to return
      // to the search input after searching for a value first

      _this.$container.find('.hidden-filter-controls').removeClass('is-searching search-results');
    },
    clearSearch: function() {
      // Function called when user clears the search field

      // Removes value from search box
      _this.$container.find('.search-field').find('input').val('').blur();
      // Resets all classes related to search
      _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results search-results searching');

      // Resets list
      mixer.destroy();
      clusterize.destroy();
      _this.renderLoopHTML(listItems);
      _this.onReady();
    },
    onReady: function() {
      // Function called when it's ready to show the list and remove the Loading
      _this.initializeClusterize();
      if (_this.data.filtersEnabled) {
        _this.initializeMixer();
      }
      // Ready
      _this.$container.find('.small-card-list-container').addClass('ready');
    },
    initializeMixer: function() {
      // Function that initializes MixItUP
      // Plugin used for filtering

      mixer = mixitup('#small-card-list-wrapper-' + _this.data.id, {
        selectors: {
          control: '[data-mixitup-control]',
          target: '.small-card-list-item'
        },
        multifilter: {
          enable: true // enable the multifilter extension for the mixer
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
        }
      });
    },
    initializeClusterize: function() {
      // Function that initializes Clusterize
      // Plugin used for making long lists render smoothly

      $('body').addClass('clusterize-scroll');
      _this.$container.find('#small-card-list-wrapper-' + _this.data.id).addClass('clusterize-content');

      clusterize = new Clusterize({
        scrollElem: document.body,
        contentId: 'small-card-list-wrapper-' + _this.data.id
      });
    },
    expandElement: function(elementToExpand) {
      // Function called when a list item is tapped to expand

      //check to see if element is already expanded
      if (!elementToExpand.hasClass('open')) {
        var currentPosition = elementToExpand.offset();
        var elementScrollTop = $(window).scrollTop();
        var netOffset = currentPosition.top - elementScrollTop;

        var expandPosition = $('body').offset();
        var expandTop = expandPosition.top;
        var expandLeft = expandPosition.left;
        var expandWidth = $('body').outerWidth();
        var expandHeight = $('body').outerHeight();

        var directoryDetailImageWrapper = elementToExpand.find('.small-card-list-detail-image-wrapper');
        var directoryDetailImage = elementToExpand.find('.small-card-list-detail-image');

        // freeze the current scroll position of the background content
        $('body').addClass('lock');

        // convert the expand-item to fixed position with a high z-index without moving it 
        elementToExpand.css({
          'top': netOffset,
          'left': currentPosition.left,
          'height': elementToExpand.height(),
          'width': elementToExpand.width(),
          'max-width': expandWidth,
          'position': 'fixed',
          'z-index': 11,
        });

        elementToExpand.animate({
          'left': expandLeft,
          'top': expandTop,
          'height': expandHeight,
          'width': expandWidth,
          'max-width': expandWidth
        }, 200, 'swing');

        elementToExpand.addClass('open');
        elementToExpand.find('.small-card-list-detail-close-btn').addClass('open');
        elementToExpand.find('.small-card-list-detail-content-scroll-wrapper').addClass('open');

        directoryDetailImageWrapper.css({
          height: directoryDetailImageWrapper.outerHeight(),
          'z-index': 12
        });

        directoryDetailImageWrapper.animate({
          height: '100vw'
        },
        200,
        'swing'
        );

        directoryDetailImage.css({
          height: directoryDetailImage.outerHeight(),
          'z-index': 12
        });

        directoryDetailImage.animate({
          height: '100vw'
        }, 200, 'swing');
      }
    },
    collapseElement: function(elementToCollapse) {
      // Function called when a list item is tapped to close

      $('body').removeClass('lock');

      var directoryDetailImageWrapper = elementToCollapse.find('.small-card-list-detail-image-wrapper');
      var directoryDetailImage = elementToCollapse.find('.small-card-list-detail-image');

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
      });

      elementToCollapse.removeClass('open');
      elementToCollapse.find('.small-card-list-detail-close-btn').removeClass('open');
      elementToCollapse.find('.small-card-list-detail-content-scroll-wrapper').removeClass('open');
    }
  }

  return SmallCardsLayoutInline;
})();