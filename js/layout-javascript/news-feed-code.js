var newsFeedLayoutMapping = {
  'news-feed': {
    'base': 'templates.build.news-feed-base',
    'loop': 'templates.build.news-feed-loop',
    'filter': 'templates.build.news-feed-filters',
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
  this.clusterize;
  this.mixer;

  this.listItems;

  // Register handlebars helpers
  this.registerHandlebarsHelpers();
   // Start running the Public functions
  this.initialize();
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
    })
    .on('click', '.news-feed-item-close-btn-wrapper', function(event) {
      event.stopPropagation();
      // find the element to collpase and collpase it
      _this.collapseElement($(this));
    });
}

DynamicList.prototype.initialize = function() {
  var _this = this;
  // Render Base HTML template
  _this.renderBaseHTML();

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
              ? value
              : '{' + value;
            }

            if (field.type === "date") {
              obj.data[field.column] = moment(value).format('YYYYMMDD');
              return obj.data[field.column];
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
          records[i].data['Date'] = moment(obj.data['Date']).format("MMM DD YYYY");
        }

        // Add likes flag
        if (_this.data.social && _this.data.social.likes) {
          records[i].likesEnabled = true;
        } else {
          records[i].likesEnabled = false;
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

  filtersTemplate = Fliplet.Widget.Templates[newsFeedLayoutMapping[_this.data.layout]['filter']];
  var template = _this.data.advancedSettings && _this.data.advancedSettings.filterHTML
  ? Handlebars.compile(_this.data.advancedSettings.filterHTML)
  : Handlebars.compile(filtersTemplate());

  _this.$container.find('.filter-holder').html(template(allFilters));
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

  _this.initializeClusterize();
  if (_this.data.filtersEnabled) {
    _this.initializeMixer();
  }
  _this.setCardHeight();

  if (_this.data.social && _this.data.social.likes) {
    _this.$container.find('.news-feed-list-item').each(function(index, element) {
      var cardId = $(element).data('entry-id');
      var likeIndentifier = cardId + '-like';
      var title = $(element).find('.news-feed-item-inner-content .news-feed-item-title').text();
      _this.setupLikeButton(cardId, likeIndentifier, title);
    });
  }

  // Ready
  _this.$container.find('.news-feed-list-container').removeClass('loading').addClass('ready');
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
    }
  });
}

DynamicList.prototype.initializeClusterize = function() {
  // Function that initializes _this.clusterize
  // Plugin used for making long lists render smoothly
  var _this = this;

  $('body').addClass('clusterize-scroll');
  _this.$container.find('#news-feed-list-wrapper-' + _this.data.id).addClass('clusterize-content');

  _this.clusterize = new Clusterize({
    scrollElem: document.body,
    contentId: 'news-feed-list-wrapper-' + _this.data.id
  });
}

DynamicList.prototype.setCardHeight = function() {
  var _this = this;

  _this.$container.find('.news-feed-list-item').each(function(index, element) {
    var slideHeight = $(element).find('.slide-under').outerHeight();
    var containerHeight = $(element).find('.news-feed-item-inner-content').outerHeight();
    var contentHeight = slideHeight + containerHeight

    $(element).css({
      height: contentHeight
    });
  });
}

DynamicList.prototype.setupLikeButton = function(id, identifier, title) {
  var _this = this;

  // Sets up the like feature
  LikeButton({
    target: '.news-feed-like-holder-' + id,
    dataSourceId: _this.data.likesDataSourceId,
    identifier: { 
      entryId: identifier,
      pageId: Fliplet.Env.get('pageId')
    },
    value: Fliplet.Env.get('pageTitle') + '/' + title,
    likeLabel: '<i class="fa fa-heart-o fa-lg"></i> <span class="count">{{#if count}}{{count}}{{/if}}</span>',
    likedLabel: '<i class="fa fa-heart fa-lg animated bounceIn"></i> <span class="count">{{#if count}}{{count}}{{/if}}</span>',
    likeWrapper: '<div class="news-feed-like-wrapper btn-like"></div>',
    likedWrapper: '<div class="news-feed-like-wrapper btn-liked"></div>',
    addType: 'html'
  })
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

  var expandedHeight = elementToExpand.find('.banner').data('height-expanded');
  elementToExpand.find('.banner').animate({
      height: expandedHeight
    },
    400,
    'easeOutBack'
  );

  var expandedPosition = elementToExpand.find('.news-feed-item-inner-content').data('position-expanded');
  elementToExpand.find('.news-feed-item-inner-content').animate({
      top: expandedPosition
    },
    400,
    'easeOutBack'
  );

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

      elementToExpand.find('.slide-under').css({
        position: 'fixed'
      });
    }
  );
}

DynamicList.prototype.collapseElement = function(collapseButton) {
  // Function called when a list item is tapped to close
  var _this = this;

  var elementToCollpseParent = collapseButton.parents('.news-feed-list-item');
  var elementToCollpse = elementToCollpseParent.find('.news-feed-item-content');
  
  // find the location of the placeholder
  var elementScrollTop = $(window).scrollTop();
  var elementToCollpsePlaceholderTop = elementToCollpseParent.offset().top - elementScrollTop;
  var elementToCollpsePlaceholderLeft = elementToCollpseParent.offset().left;
  var elementToCollpsePlaceholderHeight = elementToCollpseParent.outerHeight();
  var elementToCollpsePlaceholderWidth = elementToCollpseParent.outerWidth();

  elementToCollpse.find('.slide-under').css({
    position: 'absolute'
  });

  // convert the width and height to numeric values
  elementToCollpse.css({
    'right': 'auto',
    'bottom': 'auto',
    'width': elementToCollpse.outerWidth(),
    'height': elementToCollpse.outerHeight(),
  });

  var collapsedHeight = elementToCollpse.find('.banner').data('height');
  elementToCollpse.find('.banner').animate({
      height: collapsedHeight
    },
    200,
    'linear'
  );

  var collapsedPosition = elementToCollpse.find('.news-feed-item-inner-content').data('position');
  elementToCollpse.find('.news-feed-item-inner-content').animate({
      top: collapsedPosition
    },
    200,
    'linear'
  );

  elementToCollpse.animate({
      'left': elementToCollpsePlaceholderLeft,
      'top': elementToCollpsePlaceholderTop,
      'height': elementToCollpsePlaceholderHeight,
      'width': elementToCollpsePlaceholderWidth
    },
    200, // animation timing in millisecs
    'linear', //animation easing
    function() {
      // Removes class 'open'
      elementToCollpseParent.removeClass('open');

      elementToCollpse.css({
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