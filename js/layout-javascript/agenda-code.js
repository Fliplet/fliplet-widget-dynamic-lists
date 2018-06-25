var agendaLayoutMapping = {
  'agenda': {
    'base': 'templates.build.agenda-base',
    'loop': 'templates.build.agenda-cards-loop',
    'other-loop': 'templates.build.agenda-dates-loop'
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
  this.hammer;
  this.mixer= [];
  this.bookmarkButtons = [];
  this.animatingForward = false;
  this.animatingBack = false;
  this.activeSlideIndex;
  this.sliderCount;
  this.scrollValue = 0;
  this.copyOfScrollValue = _this.scrollValue;
  this.isPanning = false;

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
    _this.centerDate();
  });

  _this.$container
    .on('touchstart', '.agenda-list-controls', function(event) {
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-controls', function(e) {
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-controls', function() {
      $(this).removeClass('hover');
    })
    .on('touchstart', '.agenda-list-item', function(event) {
      event.stopPropagation();
      $(this).addClass('hover');
    })
    .on('touchmove', '.agenda-list-item', function(e) {
      allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.agenda-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        allowClick = true;
      }, 100);
    })
    .on('click', '.agenda-list-item', function(event) {
      if (_this.isPanning && !_this.allowClick && $(this).hasClass('open')) {
        return;
      }

      event.stopPropagation();
      var elementToExpand = $(this).find('.agenda-list-item-content');
      _this.expandElement(elementToExpand);
    })
    .on('click', '.agenda-list-item .agenda-item-close-btn', function(event) {
      event.stopPropagation();
      _this.collapseElement($(this));
    })
    .on('keydown', function(e) {
      if (e.keyCode === 39) {
        if ($('.agenda-date-selector li.active').next().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
        var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active').next());
        var indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.moveForwardDate(indexOfClickedDate, indexDifference);
        return;
      }
      if (e.keyCode === 37) {
        if ($('.agenda-date-selector li.active').prev().hasClass('.placeholder')) {
          return;
        }

        var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
        var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active').prev());
        var indexDifference = indexOfClickedDate - indexOfActiveDate;

        _this.moveBackDate(indexOfClickedDate, indexDifference);
        return;
      }
    })
    .on('click', '.agenda-date-selector li', function() {
      // prevents clicking the active one
      // prevents clicking the placeholder
      if ($(this).hasClass('active') || $(this).hasClass('placeholder')) {
        return;
      }

      var indexOfActiveDate = $('.agenda-date-selector li').not('.placeholder').index($('.agenda-date-selector li.active'));
      var indexOfClickedDate = $('.agenda-date-selector li').not('.placeholder').index(this);
      var indexDifference = indexOfClickedDate - indexOfActiveDate

      if (indexDifference < indexOfActiveDate) {
        _this.moveBackDate(indexOfClickedDate, indexDifference);
        return;
      }

      if (indexDifference >= indexOfActiveDate) {
        _this.moveForwardDate(indexOfClickedDate, indexDifference);
        return;
      }
    });

  _this.bookmarkButtons.forEach(function(button) {
    button.btn.on('liked', function(data){
      this.$btn.parents('.agenda-list-item').addClass('bookmarked');
    });

    button.btn.on('unliked', function(data){
      this.$btn.parents('.agenda-list-item').removeClass('bookmarked');
    });
  });
}

DynamicList.prototype.scrollEvent = function() {
  var _this = this;
  var lastScrollTop = 0;
  var threshold = 50;

  _this.$container.find('.agenda-list-day-holder').scroll(function(event){
     var st = $(this).scrollTop();
     var scrollHeight = $(this).innerHeight();
     
     if (st > lastScrollTop && st > threshold){
        // downscroll code
        _this.$container.find('.agenda-date-selector').addClass('slim');
        _this.centerDate();
     } else if (st < lastScrollTop && st < threshold) {
        // upscroll code
        _this.$container.find('.agenda-date-selector').removeClass('slim');
        _this.centerDate();
     }
     lastScrollTop = st;
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

      var calendarDates = [];
      var firstDate;
      var lastDate;
      var numberOfPlacholderDays = 3;

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

      // set first date in agenda
      firstDate = new Date(records[0].data['Date']).toUTCString();

      // set last date in agenda
      lastDate = new Date(records[records.length - 1].data['Date']).toUTCString();

      // Make rows available Globally
      _this.listItems = records;

      // Adds 5 days before the first date
      // Save them in an array
      for (var i = 0; i < numberOfPlacholderDays; i++) { 
        var newDate = {
          week: moment(firstDate).utc().subtract(i, 'days').format("ddd"),
          day: moment(firstDate).utc().subtract(i, 'days').format("DD"),
          month: moment(firstDate).utc().subtract(i, 'days').format("MMM"),
          placeholder: true
        }
        calendarDates.unshift(newDate);
      }

      // Get only the unique dates
      var uniqueDates = _.uniqBy(records, function(obj) {
        return obj.data['Date'];
      });

      // Get the event dates
      // Save in an array
      uniqueDates.forEach(function(obj) {
        var newDate = new Date(obj.data['Date']).toUTCString();
        var newDateObject = {
          week: moment(newDate).utc().format("ddd"),
          day: moment(newDate).utc().format("DD"),
          month: moment(newDate).utc().format("MMM"),
          placeholder: false
        }
        calendarDates.push(newDateObject);
      });

      // Adds 5 days after the last date
      // Save them in an array
      for (var i = 0; i < numberOfPlacholderDays; i++) { 
        var newDate = {
          week: moment(lastDate).utc().add(i, 'days').format("ddd"),
          day: moment(lastDate).utc().add(i, 'days').format("DD"),
          month: moment(lastDate).utc().add(i, 'days').format("MMM"),
          placeholder: true
        }
        calendarDates.push(newDate);
      }

      // Converts date format
      records.forEach(function(obj, index) {
        var newDate = new Date(obj.data['Date']).toUTCString();
        records[index].data['Date'] = moment(newDate).utc().format("ddd Do MMM");
      });

      var newRecords = _.values(_.groupBy(records, function(row) {
        return row.data['Date'];
      }));

      // Render dates HTML
      _this.renderDatesHTML(calendarDates);

      // Render Loop HTML
      _this.renderLoopHTML(newRecords);
      
      return;
    })
    .then(function() {
      // Listeners and Ready
      _this.setupCards();
      _this.attachObservers();
      _this.scrollEvent();
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
    baseHTML = Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['base']];
  }

  var template = _this.data.advancedSettings && _this.data.advancedSettings.baseHTML
  ? Handlebars.compile(_this.data.advancedSettings.baseHTML)
  : Handlebars.compile(baseHTML());

  $('[data-dynamic-lists-id="' + _this.data.id + '"]').html(template(_this.data));
}

DynamicList.prototype.renderLoopHTML = function(records) {
  // Function that renders the List template
  var _this = this;

  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
  ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['loop']]());

  _this.$container.find('#agenda-cards-wrapper-' + _this.data.id + ' .agenda-list-holder').html(template(records));
}

DynamicList.prototype.renderDatesHTML = function(dates) {
  // Function that renders the Dates template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.otherLoopHTML
  ? Handlebars.compile(_this.data.advancedSettings.otherLoopHTML)
  : Handlebars.compile(Fliplet.Widget.Templates[agendaLayoutMapping[_this.data.layout]['other-loop']]());

  _this.$container.find('.agenda-date-selector ul').html(template(dates));
  // Selects the first date
  $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[0]).addClass('active');
  _this.centerDate();
}

DynamicList.prototype.setupCards = function() {
  var _this = this;

  _this.initializeMixer();
  _this.setCardHeight();
  _this.bindChatTouchEvents();

  // Sets up the like and bookmark buttons
  if (_this.data.social && _this.data.social.bookmark) {
    _this.$container.find('.agenda-list-item').each(function(index, element) {
      _this.prepareSetupBookmark(element);
    });
  }
}

DynamicList.prototype.onReady = function() {
  // Function called when it's ready to show the list and remove the Loading
  var _this = this;

  // Ready
  _this.$container.find('.agenda-list-container').removeClass('loading').addClass('ready');
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

/* ANIMATION FOR DATES BACK AND FORWARD */
// animates dates forward
DynamicList.prototype.animateDateForward = function(nextDateElement, nextDateElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '+=' + nextDateElementWidth 
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-date-selector li.active').removeClass('active');
      nextDateElement.addClass('active');
      resolve();
    });
  });
}

// animates cards forward
DynamicList.prototype.animateAgendaForward = function(nextAgendaElement, nextAgendaElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '+=' + nextAgendaElementWidth 
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      nextAgendaElement.addClass('active');
      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;
      resolve();
    });
  });
}

// animates dates back
DynamicList.prototype.animateDateBack = function(prevDateElement, prevDateElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-date-selector ul').animate({
      scrollLeft: '-=' + prevDateElementWidth
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-date-selector li.active').removeClass('active');
      prevDateElement.addClass('active');
      resolve();
    });
  });
}

// animate cards back
DynamicList.prototype.animateAgendaBack = function(prevAgendaElement, prevAgendaElementWidth) {
  var _this = this;

  return new Promise(function (resolve) {
    _this.$container.find('.agenda-cards-wrapper').animate({
      scrollLeft: '-=' + prevAgendaElementWidth
    },
    200,
    'swing',  //animation easing
    function() {
      _this.$container.find('.agenda-list-day-holder.active').removeClass('active');
      prevAgendaElement.addClass('active');
      _this.scrollValue = $(this).scrollLeft();
      _this.copyOfScrollValue = _this.scrollValue;
      resolve();
    });
  });
}

// function to move forward in time
DynamicList.prototype.moveForwardDate = function(index, difference) {
  var _this = this;
  _this.centerDate();

  var nextDateElement = $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index]);
  var nextAgendaElement = $(_this.$container.find('.agenda-list-day-holder')[index]);

  if (!nextDateElement.length || !nextAgendaElement.length || _this.animatingForward) {
    return;
  }

  _this.animatingForward = true;
  var nextDateElementWidth = Math.floor(nextDateElement.outerWidth() * difference);
  var nextAgendaElementWidth = Math.floor(nextAgendaElement.outerWidth() * difference);

  if (!_this.isPanning) {
    _this.scrollValue = 0;
  }

  Promise.all([
    _this.animateDateForward(nextDateElement, nextDateElementWidth),
    _this.animateAgendaForward(nextAgendaElement, nextAgendaElementWidth - _this.scrollValue)
  ]).then(function(){
    _this.isPanning = false;
    _this.animatingForward = false;
  });
}

// function to move back in time
DynamicList.prototype.moveBackDate = function(index, difference) {
  var _this = this;
  _this.centerDate();

  var prevDateElement = $(_this.$container.find('.agenda-date-selector li').not('.placeholder')[index])
  var prevAgendaElement = $(_this.$container.find('.agenda-list-day-holder')[index]);
  var positiveDifference = difference *= -1;
  
  if (!prevDateElement.length || !prevAgendaElement.length || _this.animatingBack) {
    return;
  }

  _this.animatingBack = true;
  var prevDateElementWidth = Math.floor(prevDateElement.outerWidth() * positiveDifference);
  var prevAgendaElementWidth = Math.floor(prevAgendaElement.outerWidth() * positiveDifference);

  if (!_this.isPanning) {
    _this.scrollValue = 0;
  }
  
  Promise.all([
    _this.animateDateBack(prevDateElement, prevDateElementWidth),
    _this.animateAgendaBack(prevAgendaElement, prevAgendaElementWidth + _this.scrollValue)
  ]).then(function(){
    _this.isPanning = false;
    _this.animatingBack = false;
  });
}

DynamicList.prototype.initializeMixer = function() {
  // Function that initializes MixItUP
  // Plugin used for filtering
  var _this = this;
  var agendaLists = document.getElementsByClassName('agenda-list-card-holder');

  for (var i = 0; i < agendaLists.length; i++) {
    var newMixer = mixitup(agendaLists[i], {
      selectors: {
        control: '[data-mixitup-control="' + _this.data.id + '"]',
        target: '.agenda-list-item'
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
        onMixEnd: function(state) {
          if (!state.show.length) {
            $(state.container).addClass('empty');
          } else {
            $(state.container).removeClass('empty');
          }
          $(state.container).removeClass('mixing');
        },
        onMixClick: function(state, originalEvent) {
          $(state.container).addClass('mixing');
        }
      }
    });

    _this.mixer.push(newMixer);
  }
}

// Function to set the height of cards
DynamicList.prototype.setCardHeight = function() {
  var _this = this;

  _this.$container.find('.agenda-list-item').each(function(index, element) {
    var containerHeight = $(element).find('.agenda-item-inner-content').outerHeight();

    $(element).css({
      height: containerHeight
    });
  });
}

// Function to center date
DynamicList.prototype.centerDate = function() {
  // resets position - this will only be used when resizing
  var _this = this;
  _this.$container.find('.agenda-date-selector ul').scrollLeft(0);
  var halfWindowWidth = $(window).width() / 2;
  var activePosition = _this.$container.find('.agenda-date-selector li.active').position();
  var activeWidth = _this.$container.find('.agenda-date-selector li.active').outerWidth();
  var halfWidth = activeWidth / 2;

  _this.$container.find('.agenda-date-selector ul').scrollLeft(activePosition.left - (halfWindowWidth - halfWidth));
}

// Functions to setup Fliplet Like
DynamicList.prototype.setupBookmarkButton = function(id, identifier, title) {
  var _this = this;

  _this.bookmarkButtons.push({
    btn: LikeButton({
      target: '.agenda-item-bookmark-holder-' + id,
      dataSourceId: _this.data.bookmarkDataSourceId,
      content: {
        entryId: identifier,
        pageId: Fliplet.Env.get('pageId')
      },
      allowAnonymous: true,
      name: Fliplet.Env.get('pageTitle') + '/' + title,
      likeLabel: '<span class="fa fa-bookmark-o"></span>', 
      likedLabel: '<span class="fa fa-bookmark"></span>',
      likeWrapper: '<div class="bookmark-wrapper btn-bookmark"></div>',
      likedWrapper: '<div class="bookmark-wrapper btn-bookmarked"></div>',
      addType: 'prepend'
    }),
    id: id
  });
}

DynamicList.prototype.prepareSetupBookmark = function(element) {
  var _this = this;
  var cardId = $(element).data('entry-id');
  var bookmarkIndentifier = cardId + '-bookmark';
  var title = $(element).find('.agenda-item-inner-content .agenda-item-title').text();

  _this.setupBookmarkButton(cardId, bookmarkIndentifier, title);
}

// Function to add class to card marking it as bookmarked - for filtering
DynamicList.prototype.checkBookmarked = function() {
  var _this = this;

  _this.$container.find('.btn-bookmarked').each(function(idx, element) {
    $(element).parents('.agenda-list-item').addClass('bookmarked');
  });
}

DynamicList.prototype.bindChatTouchEvents = function() {
  var _this = this;
  var handle = document.getElementById('agenda-cards-wrapper-' +_this.data.id);
  _this.hammer = _this.hammer || new Hammer(handle);

  _this.hammer.on('panright panleft', function(e) {
    if (_this.checkScrollHorizontal(e)) {
      _this.isPanning = true;
      _this.sliderCount = _this.$container.find('.agenda-list-day-holder').length;
      _this.activeSlideIndex = _this.$container.find('.agenda-list-day-holder').index($('.agenda-list-day-holder.active'));
      _this.$container.find('.agenda-date-selector ul').addClass('is-panning');

      var reverse = e.deltaX - (e.deltaX * 2);
      _this.scrollValue = reverse;
      _this.$container.find('.agenda-cards-wrapper').scrollLeft(_this.copyOfScrollValue + _this.scrollValue);
    }
  });

  _this.hammer.on('panend', function(e) {
    _this.$container.find('.agenda-date-selector ul').removeClass('is-panning');
    if (_this.checkScrollHorizontal(e)) {
      if ( _this.scrollValue > 0 ) {
        _this.sliderGoTo( _this.activeSlideIndex + 1 );
      } else if ( _this.scrollValue < 0 ) {
        _this.sliderGoTo( _this.activeSlideIndex - 1 );
      }
    }
  });
}

DynamicList.prototype.checkScrollHorizontal = function(e) {
  var _this = this;
  var deltaY = e.deltaY;
  var positiveDeltaY = deltaY < 0 ? deltaY *= -1 : deltaY;
  var deltaX = e.deltaX;
  var positiveDeltaX = deltaX < 0 ? deltaX *= -1 : deltaX;
  var distanceY = e.distance - positiveDeltaY;
  var distanceX = e.distance - positiveDeltaX;

  return distanceX < distanceY
}

DynamicList.prototype.sliderGoTo = function(number) {
  var _this = this;
  // Stop it from doing weird things like moving to slides that don’t exist
  if ( number < 0 ) {
    _this.activeSlideIndex = 0;
  } else if ( number > _this.sliderCount - 1 ) {
    _this.activeSlideIndex = _this.sliderCount - 1
  } else {
    if (number > _this.activeSlideIndex) {
      _this.activeSlideIndex = number;
      _this.moveForwardDate(_this.activeSlideIndex, 1);
    } else {
      _this.activeSlideIndex = number;
      _this.moveBackDate(_this.activeSlideIndex, -1);
    }
  }
};

DynamicList.prototype.expandElement = function(elementToExpand) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // Adds class 'open' to help with styling
  elementToExpand.parents('.agenda-list-item').addClass('open');

  // Prevents 'body' scroll
  _this.$container.find('.agenda-list-day-holder').addClass('lock');
  $('body').addClass('lock');
  
  // freeze the current scroll position of the background page expand-wrapper
  var elementOffset = _this.$container.find('.agenda-list-container').offset();
  var elementScrollTop = $('body').scrollTop();
  var netOffset = elementOffset.top - elementScrollTop;
  var expandPosition = _this.$container.find('.agenda-list-container').offset();
  var expandTop = expandPosition.top;
  var expandLeft = expandPosition.left;
  var expandWidth = _this.$container.find('.agenda-list-container').outerWidth();
  var expandHeight = _this.$container.find('.agenda-list-container').outerHeight();

  _this.$container.find('.agenda-list-container').css({
    'top': netOffset,
    'position': 'fixed',
    'z-index': '11'
  });

  _this.$container.find('.agenda-cards-wrapper').css({
    'z-index': '11'
  });

  // convert the expand-item to fixed position without moving it
  elementToExpand.css({
    'top' : elementToExpand.offset().top - $('body').scrollTop(),
    'left' : elementToExpand.offset().left,
    'height' : elementToExpand.height(),
    'width' : elementToExpand.width(),
    'max-width': expandWidth,
    'position' : 'fixed'
  });

  // start expand-item animation to the expand wrapper
  // expand the element with class .about-tile-bg-image
  elementToExpand.animate(
    {
      'left': expandLeft,
      'top': expandTop,
      'height': expandHeight,
      'width': expandWidth,
      'max-width': expandWidth
    },
    200, // animation timing in millisecs
    'swing',  //animation easing
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

  // find the element to collapse 
  var elementToCollpseParent = collapseButton.parents('.agenda-list-item');
  var elementToCollpse = elementToCollpseParent.find('.agenda-list-item-content');
  // find the location of the placeholder
  var elementToCollpsePlaceholder = elementToCollpse.parents('.agenda-list-item');
  var elementToCollpsePlaceholderTop = elementToCollpsePlaceholder.offset().top - $('body').scrollTop();
  var elementToCollpsePlaceholderLeft = elementToCollpsePlaceholder.offset().left;
  var elementToCollpsePlaceholderHeight = elementToCollpsePlaceholder.outerHeight();
  var elementToCollpsePlaceholderWidth = elementToCollpsePlaceholder.outerWidth();

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

  _this.$container.find('.agenda-list-container').css({
    'top': 0,
    'top': 'env(safe-area-inset-top)',
    'position': 'fixed',
    'z-index': '1'
  });

  _this.$container.find('.agenda-cards-wrapper').css({
    'z-index': '1'
  });
     
  elementToCollpse.animate(
    {
      'left': elementToCollpsePlaceholderLeft,
      'top': elementToCollpsePlaceholderTop,
      'height': elementToCollpsePlaceholderHeight,
      'width': elementToCollpsePlaceholderWidth
    },
    200, // animation timing in millisecs
    'linear',  //animation easing
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
  _this.$container.find('.agenda-list-item').removeClass('open');
  $('body').removeClass('lock');
}