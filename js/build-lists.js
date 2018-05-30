var allowClick = true;
var clusterize;
var mixer;

var DynamicLists = function(data, container) {
  var _this = this;

  this.data = data;
  this.listItems;
  this.$container = $(container);
  this.layoutMapping = {
    'news-feed': {
      'base': 'templates.build.cards-desc-base',
      'loop': 'templates.build.cards-desc-loop'
    },
    'card-feed': {
      'base': 'templates.build.cards-full-desc-base',
      'loop': 'templates.build.cards-full-desc-loop'
    },
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-loop',
      'other-loop': 'templates.build.agenda-date-loop'
    },
    'small-card': {
      'base': 'templates.build.small-card-base',
      'loop': 'templates.build.small-card-loop'
    },
    'horizontal-card': {
      'base': 'templates.build.horizontal-card-base',
      'loop': 'templates.build.horizontal-card-loop'
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

  function initialize() {
    // Render Base HTML template
    _this.renderBaseHTML();

    // Connect to data source to get rows
    _this.connectToDataSource()
      .then(function (records) {
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
              if (this.operators[condition](record.data[filter.column], filter.value)) {
                matched++;
                return ;
              }
            });

            return matched > 0 ? true : false;
          });
          records = filtered;
        }

        _this.listItems = records;
        // Render Loop HTML
        _this.renderLoopHTML(records);
        _this.attachObservers();
        _this.init();
      });
  }

  _this.registerHandlebarsHelpers();
  initialize();
  console.log(data);
  return this;
}

DynamicLists.prototype.registerHandlebarsHelpers = function() {
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
}

DynamicLists.prototype.init = function() {
  this.initializeClusterize();
  this.initializeMixer();
  // Ready
  this.$container.find('.content-section').addClass('ready');
}

DynamicLists.prototype.initializeMixer = function() {
  var _this= this;

  mixer = mixitup('#directory-longlist-wrapper-' + _this.data.id, {
    selectors: {
      target: '.longlist-item'
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
}

DynamicLists.prototype.initializeClusterize = function() {
  var _this = this;

  $('body').addClass('clusterize-scroll');
  _this.$container.find('#directory-longlist-wrapper-' + _this.data.id).addClass('clusterize-content');

  clusterize = new Clusterize({
    scrollElem: document.body,
    contentId: 'directory-longlist-wrapper-' + _this.data.id
  });
}

DynamicLists.prototype.attachObservers = function() {
  var _this = this;
  $(document)
    .on('touchstart', '.longlist-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.longlist-item', function() {
      allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.longlist-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        allowClick = true;
      }, 100);
    })
    .on('click', '.longlist-item', function(event) {
      event.stopPropagation();
      // find the element to expand and expand it
      if (allowClick) {
        var directoryDetailWrapper = $(this).find('.directory-detail-wrapper');
        _this.expandElement(directoryDetailWrapper);
      }
    })
    .on('click', '.directory-detail-close-btn', function(event) {
      event.stopPropagation();
      // find the element to collpase and collpase it
      var directoryDetailWrapper = $(this).parents('.directory-detail-wrapper');
      _this.collapseElement(directoryDetailWrapper);
    })
    .on('click', '.directory-search-icon .fa-search, .directory-search-icon .fa-filter', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.content-section');

      if (!$parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').addClass('active');
        $parentElement.find('.directory-search-apply').addClass('active');
        $parentElement.find('.directory-search-cancel').addClass('active');
        $elementClicked.addClass('active');

        var targetHeight = $parentElement.find('.hidden-filter-controls-content').outerHeight();
        $parentElement.find('.hidden-filter-controls').animate({ height: targetHeight, }, 200);
      }
    })
    .on('click', '.directory-search-cancel', function() {
      var $elementClicked = $(this);
      var $parentElement = $elementClicked.parents('.content-section');

      if ($parentElement.find('.hidden-filter-controls').hasClass('active')) {
        $parentElement.find('.hidden-filter-controls').removeClass('active');
        $elementClicked.removeClass('active');
        $parentElement.find('.directory-search-apply').removeClass('active');
        $parentElement.find('.directory-search-icon .fa-search').removeClass('active');
        $parentElement.find('.directory-search-icon .fa-filter').removeClass('active');
        $parentElement.find('.hidden-filter-controls').animate({ height: 0, }, 200);
      }
    })
    .on('keydown', '.search-holder input', function(e) {
      var $inputField = $(this);
      var $parentElement = $inputField.parents('.content-section');
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
      var $parentElement = $elementClicked.parents('.content-section');

      _this.backToSearch();
      $parentElement.find('.search-holder input').focus();
    });
}

DynamicLists.prototype.renderBaseHTML = function() {
  var baseHTML = '';

  if (typeof this.data.layout !== 'undefined') {
    baseHTML = Fliplet.Widget.Templates[this.layoutMapping[this.data.layout]['base']];
  }

  var template = Handlebars.compile(baseHTML());
  this.$container.html(template(this.data));
}

DynamicLists.prototype.renderLoopHTML = function(records) {
  var loopHTML = '';
  var modifiedData = this.convertCategories(records);

  if (typeof this.data.layout !== 'undefined') {
    loopHTML = Fliplet.Widget.Templates[this.layoutMapping[this.data.layout]['loop']];
  }

  var template = Handlebars.compile(loopHTML());

  this.$container.find('#directory-longlist-wrapper-' + this.data.id).html(template(modifiedData));
  this.addFilters(modifiedData);
}

DynamicLists.prototype.addFilters = function(data) {
  var _this = this;
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
  var template = Handlebars.compile(filtersTemplate());
  this.$container.find('.filter-holder').html(template(allFilters));
}

DynamicLists.prototype.connectToDataSource = function() {
  var options = {
    offline: true
  }

  return Fliplet.DataSources.connect(this.data.dataSourceId, options)
    .then(function (connection) {
      return connection.find();
    });
}

DynamicLists.prototype.convertCategories = function(data) {
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

DynamicLists.prototype.searchData = function(value) {
  var _this = this;

  // Removes cards
  _this.$container.find('#directory-longlist-wrapper-' + _this.data.id).html('');
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
  
  // Simulate that search is taking a half a second
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
    _this.init();
  }, 500);
}

DynamicLists.prototype.backToSearch = function() {
  var _this = this;
  _this.$container.find('.hidden-filter-controls').removeClass('is-searching search-results');
}

DynamicLists.prototype.clearSearch = function() {
  var _this = this;
  // Removes value from search box
  _this.$container.find('.search-field').find('input').val('').blur();
  // Resets all classes related to search
  _this.$container.find('.hidden-filter-controls').removeClass('is-searching no-results search-results searching');

  // Resets list
  mixer.destroy();
  clusterize.destroy();
  _this.renderLoopHTML(_this.listItems);
  _this.init();
}

DynamicLists.prototype.expandElement = function(elementToExpand) {
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

    var directoryDetailImageWrapper = elementToExpand.find('.directory-detail-image-wrapper');
    var directoryDetailImage = elementToExpand.find('.directory-detail-image');

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
    elementToExpand.find('.directory-detail-close-btn').addClass('open');
    elementToExpand.find('.directory-detail-content-scroll-wrapper').addClass('open');

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
}

/* Function to collapse cards */
DynamicLists.prototype.collapseElement = function(elementToCollapse) {
  $('body').removeClass('lock');

  var directoryDetailImageWrapper = elementToCollapse.find('.directory-detail-image-wrapper');
  var directoryDetailImage = elementToCollapse.find('.directory-detail-image');

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
  elementToCollapse.find('.directory-detail-close-btn').removeClass('open');
  elementToCollapse.find('.directory-detail-content-scroll-wrapper').removeClass('open');
}