Fliplet.Registry.set('dynamicListUtils', (function() {
  var isoDateWarningIssued = false;
  var cachedFiles = {};
  var Static = {
    RegExp: {
      httpUrl: /^https?:\/\//i,
      base64Image: /^data:image\/[^;]+;base64,/i,
      dataSourcesPath: /^datasources\//i,
      number: /^\d+$/i,
      linebreak: /(\r\n|\n|\r)/gm,
      email: /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/gm,
      phone: /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,8}/gm,
      url: /(?:^|[^@\.\w-])([a-z0-9]+:\/\/)?(\w(?!ailto:)\w+:\w+@)?([\w.-]+\.[a-z]{2,32})(:[0-9]+)?(\/.*)?(?=$|[^@\.\w-])/ig,
      mention: /\B@[a-z0-9_-]+/ig,
      date: /^[0-9]{4}-([0]?[1-9]|[1][0-2])-([0]?[1-9]|[1|2][0-9]|[3][0|1])$/
    },
    refArraySeparator: '.$.'
  };
  var computedFieldClashes = [];
  var div = document.createElement('DIV');
  var currentDate = {};
  var LOCAL_FORMAT = 'YYYY-MM-DD';
  var parsedDates = {};
  var parsedNumbers = {};

  function isValidImageUrl(str) {
    return Static.RegExp.httpUrl.test(str)
      || Static.RegExp.base64Image.test(str)
      || Static.RegExp.dataSourcesPath.test(str);
  }

  function smartParseFloat(value) {
    // Convert strings to numbers where possible so that
    // strings that represent numbers are compared as numbers
    if (!_.isString(value)) {
      return value;
    }

    if (isNaN(parseFloat(value.trim()))) {
      return value;
    }

    if (parseFloat(value.trim()).toString() !== value.trim()) {
      return value;
    }

    return parseFloat(value);
  }

  function sortFilesByName(a, b) {
    var aFileName = a.name.toUpperCase();
    var bFileName = b.name.toUpperCase();

    if (aFileName < bFileName) {
      return -1;
    }

    if (aFileName > bFileName) {
      return 1;
    }

    return 0;
  }

  function getFilesInfo(options) {
    var entry = options.entryData;
    var detailViewFileOptions = _.filter(options.detailViewOptions, { type: 'file' });

    var formFilesInfoInDetailViewOptions = detailViewFileOptions.map(function(detailViewFileOption) {
      return new Promise(function(resolve, reject) {
        var label = '';
        var labelEnabled = true;
        var files = typeof entry.originalData[detailViewFileOption.column] === 'string'
          ? splitByCommas(entry.originalData[detailViewFileOption.column])
          : entry.originalData[detailViewFileOption.column];

        if (!files) {
          return resolve();
        }

        switch (detailViewFileOption.fieldLabel) {
          case 'column-name':
            if (detailViewFileOption.column !== 'custom') {
              label = detailViewFileOption.column;
            }

            break;
          case 'custom-label':
            label = new Handlebars.SafeString(Handlebars.compile(detailViewFileOption.customFieldLabel)(entry.originalData));

            break;
          case 'no-label':
            labelEnabled = false;

            break;
          default:
            break;
        }

        var fileIDs = files.map(function(file) {
          var url = typeof file === 'string'
            ? file
            : file.url;

          return Fliplet.Media.getIdFromRemoteUrl(url);
        });

        Fliplet.Media.Files.getAll({
          files: fileIDs,
          fields: ['name', 'url', 'metadata', 'createdAt']
        }).then(function(files) {
          var filesInfo = files.map(function(file) {
            return {
              name: file.name,
              size: file.metadata.size,
              uploaded: file.createdAt,
              url: file.url
            };
          }).sort(sortFilesByName);

          resolve({
            id: detailViewFileOption.id,
            content: filesInfo,
            label: label,
            labelEnabled: labelEnabled,
            type: detailViewFileOption.type
          });
        }).catch(reject);
      });
    });

    return Promise.all(formFilesInfoInDetailViewOptions);
  }

  function getDataViewContent(options) {
    options = options || {};

    var record = options.record || { data: {} };
    var field = options.field || {};
    var filterFields = options.filterFields || [];

    var content = field.column === 'custom'
      // Use custom template as provided
      ? Handlebars.compile(field.customField)(record.data)
      : record.data[field.column];

    switch (field.type) {
      case 'image':
        content = getImageContent(content, true);
        break;
      case 'number':
        content = TN(content, { forceNumber: false });
        break;
      case 'time':
        content = TD(content, { format: 'LT' });
        break;
      case 'date':
        content = TD(content, { format: 'll' });
        break;
      case 'html':
        content = Fliplet.Media.authenticate(content);
        break;
      case 'text':
      default:
        // If the field is also used as a filter, separate the filter values using comma
        if (filterFields.indexOf(field.column) > -1) {
          content = splitByCommas(content).join(', ');
        }

        break;
    }

    // No need to escape content if it's using custom template or set as HTML type
    // undefined and null are skipped to avoid rendering them as strings
    if (!_.isNil(content) && (field.column === 'custom' || field.type === 'html')) {
      content = new Handlebars.SafeString(content);
    }

    return toFormattedString(content);
  }

  /**
   * This function is preparing image original data to display images in the detail view
   *
   * @param {String | Array} content - content data that we get from originalData
   * @param {Boolean} isSummary - flag that show us from where this function was called
   * @returns {Object | String} in case isSummary is true then we will return only the first image URL.
   *  And when it false we will return an Object with keys 'imageContent' {String} to display single image in detail view
   *  And 'imagesArray' {Array} to display multiple images in the detail view
   */
  function getImageContent(content, isSummary) {
    var imageContent;
    var imagesArray = [];
    var isString = typeof content === 'string';

    if (isString) {
      imagesArray = getImagesUrlsByRegex(content);
    } else {
      imagesArray = content;
    }

    imageContent = imagesArray
      ? imagesArray[0]
      : '';

    if (isSummary) {
      return imageContent;
    }

    var imagesData = {
      images: [],
      options: {
        index: null
      }
    };

    imagesData.images = _.map(imagesArray, function(imgUrl) {
      return { url: imgUrl };
    });

    return {
      imageContent: imageContent,
      imagesArray: imagesArray,
      imagesData: imagesData
    };
  }

  /**
   * This function adds selected LFD item's images to the layout context
   *
   * @param {Object} ctx - current layout context
   * @param {Object} entry - selected LFD entry
   * @return {void} this function doesn't return anything it commits modifications to layout context
   */
  function assignImageContent(ctx, entry) {
    var dynamicData = _.filter(ctx.data.detailViewOptions, function(option) {
      return option.editable;
    });

    if (!dynamicData.length) {
      return;
    }

    dynamicData.forEach(function(dynamicDataObj) {
      if (dynamicDataObj.type === 'image') {
        var imagesContentData = getImageContent(entry.originalData[dynamicDataObj.column]);

        ctx.imagesData[dynamicDataObj.id] = imagesContentData.imagesData;
      }
    });
  }

  /**
   * Determine filter types based on configuration
   * @param {Object} options - A map of options for the function
   * @param {Object} options.instance - Instance of the layout
   * @returns {Object} A map of filter types
   */
  function getFilterTypes(options) {
    options = options || {};

    var instance = options.instance;
    var config = instance.data;

    var filterFields = _.concat(config.filterFields, _.get(instance, 'pvFilterQuery.column'));
    var dataViewFields = _.concat(config['summary-fields'], config.detailViewOptions);
    var filterTypes = _.zipObject(filterFields, _.map(filterFields, function(field) {
      if (_.find(dataViewFields, { column: field, type: 'date' })) {
        return 'date';
      }

      if (_.find(dataViewFields, { column: field, type: 'number' })) {
        return 'number';
      }

      return 'toggle';
    }));

    return filterTypes;
  }

  function registerHandlebarsHelpers() {
    Handlebars.registerHelper('humanFileSize', function(bytes) {
      if (!bytes) {
        return null;
      }

      var unitCapacity = 1000;
      var decimals = 1;

      if (Math.abs(bytes) < unitCapacity) {
        return bytes + ' B';
      }

      var units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      var unitIndex = -1;
      var round  = 10 * decimals;

      do {
        bytes /= unitCapacity;
        ++unitIndex;
      } while (Math.round(Math.abs(bytes) * round ) / round  >= unitCapacity && unitIndex < units.length - 1);

      return bytes.toFixed(decimals) + ' ' + units[unitIndex];
    });

    Handlebars.registerHelper('formatDate', function(context, block) {
      if (!context) {
        return '';
      }

      if (context && context.hash) {
        block = _.cloneDeep(context);
        context = undefined;
      }

      var date = getMomentDate(context);

      if (!date.isValid()) {
        return context;
      }

      return block.hash.format
        ? date.format(block.hash.format)
        : TD(date, { format: 'll' });
    });

    Handlebars.registerHelper('formatCSV', function(context) {
      if (!context) {
        return '';
      }

      return splitByCommas(context).join(', ');
    });

    Handlebars.registerHelper('validateImage', validateImageUrl);

    Handlebars.registerHelper('formatComment', function(text) {
      var res = text;

      /* capture email addresses and turn into mailto links */
      res = res.replace(Static.RegExp.email, '<a href="mailto:$&">$&</a>');

      /* capture phone numbers and turn into tel links */
      res = res.replace(Static.RegExp.phone, '<a href="tel:$&">$&</a>');

      /* capture URLs and turn into links */
      res = res.replace(Static.RegExp.url, function(match, p1, p2, p3, p4, p5, offset, string) {
        return Static.RegExp.linebreak.test(string) ? ' <a href="' + (typeof p1 !== 'undefined' ? p1 : 'http://') + p3 + (typeof p5 !== 'undefined' ? p5 : '') + '">' + (typeof p1 !== 'undefined' ? p1 : '') + p3 + (typeof p5 !== 'undefined' ? p5 : '') + '</a><br>' :
          ' <a href="' + (typeof p1 !== 'undefined' ? p1 : 'http://') + p3 + (typeof p5 !== 'undefined' ? p5 : '') + '">' + (typeof p1 !== 'undefined' ? p1 : '') + p3 + (typeof p5 !== 'undefined' ? p5 : '') + '</a>';
      });

      res = res.replace(Static.RegExp.mention, '<strong>$&</strong>');

      /* capture line break and turn into <br> */
      res = res.replace(Static.RegExp.linebreak, '<br>');

      return new Handlebars.SafeString(res);
    });

    Handlebars.registerHelper('isSingle', function(value) {
      return value.length === 1;
    });

    Handlebars.registerHelper('formatFilename', function(filename) {
      var index = filename.indexOf('contents/');
      var formattedName = filename.substring(index + 9);

      return formattedName;
    });

    Handlebars.registerPartial('filter', Fliplet.Widget.Templates['templates.build.filter']());
  }

  function splitByCommas(str, returnNilAsArray) {
    if (str === undefined || str === null) {
      return returnNilAsArray === false ? str : [];
    }

    if (_.isArray(str)) {
      return _.flatten(_.map(str, splitByCommas));
    }

    if (typeof str !== 'string') {
      return [str];
    }

    // Split a string by commas but ignore commas within double-quotes
    // Turn values within square brackets into a nested array
    // Adapted from: https://stackoverflow.com/questions/11456850/split-a-string-by-commas-but-ignore-commas-within-double-quotes-using-javascript

    var csvArrayPattern = /(".*?"|\[.*?\]|[^",\[\]]+)(?=\s*,|\s*$)/g;
    var arrayPattern = /^(?:\[[\w\W]*\])$/;
    var arr = [];
    var res = csvArrayPattern.exec(str);

    while (res !== null) {
      if (arrayPattern.test(res[0])) {
        arr.push(splitByCommas(res[0].replace(/(?:^\[)|(?:\]$)/g, '').trim()));
      } else {
        arr.push(res[0].replace(/(?:^")|(?:"$)/g, '').trim());
      }

      res = csvArrayPattern.exec(str);
    }

    return _.filter(_.map(arr, function(value) {
      if (_.isArray(value)) {
        return value;
      }

      return ('' + value).trim();
    }), function(value) {
      return _.isArray(value) || [undefined, null, '', NaN].indexOf(value) === -1;
    });
  }

  function validateImageUrl(url) {
    if (_.isArray(url)) {
      return _.map(url, function(val) {
        return validateImageUrl(val);
      });
    }

    if (!url) {
      return '';
    }

    // Validate thumbnail against URL and Base64 patterns
    if (!Static.RegExp.httpUrl.test(url) && !Static.RegExp.base64Image.test(url)) {
      return url;
    }

    return new Handlebars.SafeString(Fliplet.Media.authenticate(url));
  }

  /**
   * Append a URL query with additional queries
   * @param {String} query Original query
   * @param {String} newQuery Additional query
   * @returns {String} Result query with both sets of queries
   */
  function appendUrlQuery(query, newQuery) {
    var queryParts = _.concat(
      // Replace ? with & to avoid multiple ? characters
      _.split((query || '').replace(/\?/g, '&'), '&'),
      _.split((newQuery || '').replace(/\?/g, '&'), '&')
    );

    return _.join(_.compact(queryParts), '&');
  }

  function getMomentDate(date) {
    if (!date) {
      return moment();
    }

    if (_.get(date, '_isAMomentObject') === true) {
      // Moment object
      return date;
    }

    if (date.constructor.name === 'Date') {
      // Date object
      return moment(date);
    }

    if (typeof date === 'number') {
      // Number
      return moment(date);
    }

    if (_.isFunction(_.get(date, 'toString'))) {
      date = date.toString();
    }

    if (date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return moment(new Date(date.substr(0, 10))).utc();
    } else if (!isoDateWarningIssued) {
      /* eslint-disable-next-line no-console */
      console.warn('Date input is not provided in ISO format. This may create inconsistency in the app. We recommend ensuring the date is formatted in ISO format, e.g. ' + new Date().toISOString().substr(0, 10));
      isoDateWarningIssued = true;
    }

    return moment(new Date(date));
  }

  /**
   * Checks if the value is a valid date string in YYYY-MM-DD format
   * @param {String} value - Date string
   * @returns {Boolean} Returns TRUE if the date is a valid date string
   */
  function isValidDate(value) {
    return value.match(Static.RegExp.date) && moment(value).isValid();
  }

  /**
   * Validate filter queries
   * @param {Object} options - A map of options for the function
   * @param {Object} options.query - Filter queries
   * @param {Object} options.filterTypes - A map of filter types
   * @returns {undefined}
   */
  function validateFilterQueries(options) {
    options = options || {};

    var query = options.query || {};
    var filterTypes = options.filterTypes || {};

    if (!Array.isArray(query.value)) {
      query.value = [query.value];
    }

    _.forEach(query.column, function(field, index) {
      if (typeof query.value[index] === 'undefined') {
        delete query.column[index];
        delete query.value[index];

        return;
      }

      var type = filterTypes[field];

      // Toggle queries don't need to be further validated
      if (type === 'toggle' || typeof type === 'undefined') {
        if (!Array.isArray(query.value[index])) {
          query.value[index] = [query.value[index]];
        }

        return;
      }

      // Validate range queries
      if (query.value[index].indexOf('..') === -1) {
        delete query.column[index];
        delete query.value[index];

        return;
      }

      var parts = query.value[index].split('..');
      var from = parts[0];
      var to = parts[1];

      if (type === 'date') {
        if (!isValidDate(from) || !isValidDate(to)) {
          delete query.column[index];
          delete query.value[index];

          return;
        }

        // Set the range values as an array and reverse them if necessary
        query.value[index] = from <= to ? [from, to] : [to, from];
      } else if (type === 'number') {
        from = Fliplet.parseNumber(from);
        to = Fliplet.parseNumber(to);

        if (typeof from !== 'number' || typeof to !== 'number') {
          delete query.column[index];
          delete query.value[index];

          return;
        }

        // Set the range values as an array and reverse them if necessary
        query.value[index] = from <= to ? [from, to] : [to, from];
      }
    });

    // Remove undefined values
    query.column = _.compact(query.column);
    query.value = _.compact(query.value);

    return query;
  }

  /**
   * Generate a list of jQuery selectors for the filter elements based on the filter query
   * @param {Object} options - A map of options for the function
   * @param {Object} options.query - Filter queries
   * @param {Object} options.filterTypes - A map of filter types
   * @returns {Array} A list of jQuery selectors
   */
  function getFilterQuerySelectors(options) {
    options = options || {};

    var query = validateFilterQueries(options);
    var filterTypes = options.filterTypes || {};

    if (!_.get(query, 'value', []).length) {
      return [];
    }

    if (!_.get(query, 'column', []).length) {
      return _.map(_.flatten(query.value), function(value) {
        return '[data-value="' + value + '"]';
      });
    }

    var selectors = [];

    // Select filters using column-specific methods
    query.column.forEach(function(field, index) {
      var type = filterTypes[field];

      if (['date', 'number'].indexOf(type) > -1) {
        selectors.push('.hidden-filter-controls-filter[data-field="' + field + '"][data-type="' + type + '"]');

        return;
      }

      query.value[index].forEach(function(value) {
        selectors.push('.hidden-filter-controls-filter[data-field="' + field + '"][data-value="' + value + '"]');
      });
    });

    return selectors;
  }

  /**
   * Update the number of selected filters
   * @param {Object} options - A map of options for the function
   * @param {Boolean} options.filtersInOverlay - If TRUE, filters are displayed in an overlay
   * @param {jQuery} options.$target - jQuery instance on which user has pressed
   * @returns {undefined}
   */
  function updateActiveFilterCount(options) {
    if (!options.filtersInOverlay || !options.$target || !options.$target.length) {
      return;
    }

    var $filterPanel = options.$target.parents('.panel');
    var activeFilterCount  = $filterPanel.find('[data-filter-group] .mixitup-control-active').length;
    var $count = $filterPanel.find('.panel-heading .panel-title .active-filter-count');
    var filtersAmountText = activeFilterCount ? '(' + activeFilterCount + ')' : '';

    $count.text(filtersAmountText);
  }

  /**
   * Gets the active filters
   * @param {Object} options - A map of options for the function
   * @param {jQuery} options.$container - Container node for the layout instance
   * @returns {Object} Active filters
   */
  function getActiveFilters(options) {
    options = options || {};

    var $container = options.$container;
    var activeFilters = _($container.find('[data-filter-group] .hidden-filter-controls-filter.mixitup-control-active').not('[data-type="date"], [data-type="number"]'))
      .map(function(el) {
        return _.pickBy({
          class: el.dataset.toggle,
          field: el.dataset.field,
          value: el.dataset.value
        });
      })
      .groupBy('field')
      .mapValues(function(filters) {
        return _.map(filters, function(filter) {
          return _.has(filter, 'field') && _.has(filter, 'value')
            ? filter.value
            : filter.class;
        });
      })
      .value();

    var inputDataNames = {
      date: 'flDatePicker',
      number: 'flNumberInput'
    };
    var rangeFilters = _($container.find('[data-filter-group] .hidden-filter-controls-filter.mixitup-control-active').filter('[data-type="date"], [data-type="number"]'))
      .map(function(el) {
        var $el = $(el);
        var type = $el.data('type');

        return _.omitBy({
          field: el.dataset.field,
          type: type,
          value: $el.data(inputDataNames[type]).get()
        }, _.isNil);
      })
      .groupBy('field')
      .mapValues(function(filters) {
        // Sort the values to assume the FROM value is not after the TO value
        var values = _.map(filters, 'value');
        var type = filters && filters[0] && filters[0].type;

        return type === 'date'
          ? values.sort()
          : values.sort(function(a, b) {
            return a - b;
          });
      })
      .value();

    // Clean up invalid date filter values
    _.forIn(rangeFilters, function(values, field) {
      if (!values || values.length !== 2) {
        delete rangeFilters[field];
      }
    });

    _.assign(activeFilters, rangeFilters);

    return activeFilters;
  }

  /**
   * Process changes in filter ranges. This should be triggered whenever a filter range is updated.
   * @param {Object} options - A map of options for the function
   * @param {*} value - New value for the updated filter
   * @param {*} instance - Instance of the layout
   * @returns {undefined}
   */
  function onFilterRangeChange(options) {
    options = options || {};

    var value = options.value;

    // Invalid value. Do nothing.
    if (_.isNil(value) || value === false) {
      return;
    }

    var instance = options.instance;
    var $filter = options.$filter;
    var $filterGroup = $filter.closest('[data-filter-group]');
    var type = $filterGroup.data('type');
    var inputDataNames = {
      date: 'flDatePicker',
      number: 'flNumberInput'
    };
    var $from = $filterGroup.find('.hidden-filter-controls-filter.filter-' + type + '-from').data(inputDataNames[type]);
    var $to = $filterGroup.find('.hidden-filter-controls-filter.filter-' + type + '-to').data(inputDataNames[type]);
    var fromValue = $from && $from.get();
    var toValue = $to && $to.get();

    var valuesAreValid = type === 'number'
      ? !isNaN(fromValue) && !isNaN(toValue)
      : fromValue && toValue;

    // Validate range values to ensure FROM is not greater than TO
    if (valuesAreValid && fromValue > toValue) {
      if ($filter.hasClass('filter-' + type + '-from')) {
        $to.set(fromValue, false);
      } else if ($filter.hasClass('filter-' + type + '-to')) {
        $from.set(toValue, false);
      }
    }

    instance.toggleFilterElement($filter, true);

    if ($filter.parents('.inline-filter-holder').length) {
      // @HACK Skip an execution loop to allow custom handlers to update the filters
      setTimeout(function() {
        instance.searchData();
      }, 0);
    }
  }

  /**
   * Renders filters and initializes range filter UI
   * @param {Object} options - A map of options for the function
   * @param {Object} options.instance - Instance of the layout
   * @param {String} options.html - Filter HTML
   * @returns {undefined}
   */
  function renderFilters(options) {
    options = options || {};

    var instance = options.instance;
    var html = options.html;

    instance.$container
      .find('.filter-holder').html(html)
      .find('.fl-date-picker').each(function(i, el) {
        // Initialize date pickers
        var picker = Fliplet.UI.DatePicker(el, { required: true });

        picker.change(function(value) {
          var isFrom = this.$el.closest('.hidden-filter-controls-filter').hasClass('filter-date-from');

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + instance.data.layout,
            action: 'filter',
            label: isFrom ? 'FROM_DATE' : 'TO_DATE'
          });

          onFilterRangeChange({
            value: value,
            instance: instance,
            $filter: this.$el
          });
        });
      }).end()
      .find('.fl-number-input').each(function(i, el) {
        // Initialize number inputs
        var input = Fliplet.UI.NumberInput(el, { required: true });

        input.change(function(value) {
          var isFrom = this.$el.closest('.hidden-filter-controls-filter').hasClass('filter-number-from');

          Fliplet.Analytics.trackEvent({
            category: 'list_dynamic_' + instance.data.layout,
            action: 'filter',
            label: isFrom ? 'FROM_NUMBER' : 'TO_NUMBER'
          });

          onFilterRangeChange({
            value: value,
            instance: instance,
            $filter: this.$el
          });
        });
      });
  }

  /**
   * Clears filters and re-render data
   * @param {Object} options - A map of options for the function
   * @param {Object} options.instance - Instance of the layout
   * @returns {undefined}
   */
  function clearFilters(options) {
    options = options || {};

    var instance = options.instance;

    instance.$container.find('.hidden-filter-controls-filter.mixitup-control-active').filter('.fl-date-picker[data-type="date"], .fl-number-input[data-type="number"]').each(function() {
      var $filter = $(this);
      var type = $filter.data('type');
      var inputDataNames = {
        date: 'flDatePicker',
        number: 'flNumberInput'
      };

      $filter.data(inputDataNames[type]).set($filter.data('default'), false);
    }).end().each(function() {
      instance.toggleFilterElement(this, false);
    });

    return instance.searchData();
  }

  /**
   * Process the filter queries and prepare the filter UI accordingly
   * @param {Object} options - A map of options for the function
   * @param {Object} options.instance - Instance of the layout
   * @returns {undefined}
   */
  function parseFilterQueries(options) {
    options = options || {};

    var instance = options.instance;

    if (!instance) {
      return;
    }

    var filterSelectors = getFilterQuerySelectors({
      query: instance.pvFilterQuery,
      filterTypes: instance.filterTypes
    });
    var $filters = instance.$container.find(filterSelectors.join(','));

    if (!$filters.length) {
      return;
    }

    $filters.each(function() {
      var $filter = $(this);
      var type = $filter.data('type');

      if (['date', 'number'].indexOf(type) > -1) {
        var queryIndex = _.get(instance, 'pvFilterQuery.column', []).indexOf($filter.data('field'));
        var rangeValues = _.get(instance, ['pvFilterQuery', 'value', queryIndex], []);
        var value = $filter.hasClass('filter-' + type + '-from') ? rangeValues[0] : rangeValues[1];

        if (type === 'date') {
          Fliplet.UI.DatePicker.get($filter).set(value, false);
        } else if (type === 'number') {
          Fliplet.UI.NumberInput.get($filter).set(value, false);
        }
      }

      instance.toggleFilterElement($filter, true);
    });

    instance.$container.find('.hidden-filter-controls-filter-container').removeClass('hidden');

    if (instance.data.filtersInOverlay) {
      $filters.closest('.panel-collapse').addClass('in');
    }

    if (!_.get(instance.pvFilterQuery, 'hideControls', false)) {
      instance.$container.find('.hidden-filter-controls').addClass('active');

      if (!instance.data.filtersInOverlay) {
        instance.$container.find('.list-search-cancel').addClass('active');
        instance.$container.find('.list-search-icon .fa-sliders').addClass('active');

        instance.calculateFiltersHeight();
      }
    }
  }

  function fetchAndCache(options) {
    options = options || {};

    var request;

    if (options.request instanceof Promise) {
      request = options.request;
    } else if (typeof options.request === 'function') {
      request = options.request();

      if (!(request instanceof Promise)) {
        request = Promise.resolve(request);
      }
    } else {
      request = Promise.resolve(request);
    }

    return new Promise(function(resolve, reject) {
      request.then(function(results) {
        Fliplet.App.Storage.set(options.key, results);

        resolve({
          fromCache: false,
          data: results
        });
      }).catch(reject);

      if (options.waitFor === false || options.waitFor < 0) {
        return;
      }

      setTimeout(function() {
        Fliplet.App.Storage.get(options.key).then(function(results) {
          if (!results) {
            return;
          }

          resolve({
            fromCache: true,
            data: results
          });
        });
      }, options.waitFor);
    });
  }

  /**
   * Determines why pre-filters are applied client-side instead of using data source query
   * @param {Object} options - A map of options for the function
   * @param {Object} options.config - Configuration settings for the instance
   * @returns {Array} A list of reasons
   */
  function getQueryAllReasons(options) {
    options = options || {};

    var config = options.config || {};
    var reasons = [];

    if (config.useApiFilters) {
      return reasons;
    }

    if (!config.apiFiltersAvailable) {
      reasons.push('legacyGetData');

      return reasons;
    }

    if (['function', 'object'].includes(typeof config.dataQuery)) {
      reasons.push('dataQuery');
    }

    if (typeof config.getData === 'function') {
      reasons.push('getData');
    }

    if (!_.isEmpty(config.computedFields)) {
      reasons.push('computedFields');
    }

    if (Fliplet.Hooks.has('flListDataAfterGetData')) {
      reasons.push('afterGetDataHook');
    }

    return reasons;
  }

  /**
   * Determines if data source API request needs to apply query data
   * @param {Object} options - A map of options for the function
   * @param {Object} options.config - Configuration settings for the instance
   * @returns {Boolean} Returns TRUE if data source query needs to apply query data
   */
  function needsApiQueryData(options) {
    return !getQueryAllReasons(options).length;
  }

  /**
   * Check that a filter configuration is a date typed filter
   * @param {Object} filter - Filter configuration
   * @returns {Boolean} Returns TRUE of the filter condition is a date condition logic
   */
  function filterIsDateCondition(filter) {
    return filter
      && ['dateis', 'datebefore', 'dateafter', 'datebetween'].indexOf(filter.condition) > -1;
  }

  /**
   * Returns filter data that's unique to date filter conditions
   * @param {Object} filter - Filter configuration
   * @returns {Object} - Additional date filter data
   */
  function getDateFilterData(filter) {
    filter = filter || {};

    if (filter.condition === 'datebetween') {
      return {
        from: getDateFilterData(filter.from),
        to: getDateFilterData(filter.to)
      };
    }

    var DATE_FORMAT = 'YYYY-MM-DD';
    var DATETIME_LOCAL_FORMAT = 'YYYY-MM-DD HH:mm';
    // Create current moment value based on timezone, if required
    var date = filter.useDeviceTimezone
      ? moment.tz(moment().format(DATETIME_LOCAL_FORMAT), 'UTC')
      : moment.utc();
    var adjustedDatePattern = /^(now|today)(add|subtract|plus|minus)(second|minute|hour|day|month|week|year)s?$/i;
    var dateAdjustParts = filter.value.match(adjustedDatePattern);
    var offsetUnit = dateAdjustParts && dateAdjustParts[3];

    if (adjustedDatePattern.test(filter.value) && offsetUnit) {
      var offset = filter.offset || 0;

      switch (dateAdjustParts[2]) {
        case 'add':
        case 'plus':
          date.add(offset, offsetUnit);
          break;
        case 'subtract':
        case 'minus':
          date.subtract(offset, offsetUnit);
          break;
        default:
          break;
      }
    }

    var data = {};

    // Format date HTML5 format before using it for filters
    // Provide a unit for comparison based on comparison value granularity
    if (filter.value && filter.value.indexOf('today') === 0) {
      data.value = date.format(DATE_FORMAT);
      data.unit = 'day';
    } else {
      data.value = date.format(DATETIME_LOCAL_FORMAT);
      data.unit = 'minute';
    }


    // Add timezone to data if necessary (for analysis)
    if (filter.useDeviceTimezone) {
      data.timezone = moment.tz.guess();
    }

    return data;
  }

  /**
   * Computes the query data object based on pre-filter settings
   * @param {Object} options - A map of options for the function
   * @param {Object} options.config - Configuration settings for the instance
   * @param {Array} [options.filterQueries] - Filters set using query parameters
   * @returns {Object} Query data to be passed to data source queries
   */
  function getQueryData(options) {
    options = options || {};

    var config = options.config;
    var filterQueries = options.filterQueries;

    if (!Array.isArray(config.filterOptions)) {
      config.filterOptions = [config.filterOptions];
    }

    // Filter data based on filter options and filter queries
    var filters = _.compact(_.concat(config.filterOptions, filterQueries));

    filters = _.map(filters, function(option) {
      var filter = {
        column: option.column,
        condition: option.logic,
        value: option.value
      };

      // Set up date filter values
      if (filterIsDateCondition(filter)) {
        // Value will be set with date filter, if required
        delete filter.value;

        Object.assign(filter, getDateFilterData({
          value: option.dateValue,
          condition: option.logic,
          offset: option.offsetValue,
          useDeviceTimezone: option.useDeviceTimezone,
          from: _.get(option, 'dateFilterModifiers.from'),
          to: _.get(option, 'dateFilterModifiers.to')
        }));
      }

      return filter;
    });

    return filters.length
      ? {
        where: {
          $filters: filters
        }
      }
      : undefined;
  }

  function removeSymbols(str) {
    // Remove commonly used symbols in text that should be ignored for string matching
    return ('' + str).replace(/[&\/\\#+()$~%.`'‘’"“”:*?<>{}]+/g, '');
  }

  function recordContains(record, value) {
    if (_.isNil(record)) {
      return false;
    }

    if (_.isArray(record)) {
      return _.some(record, function(el) {
        return recordContains(el, value);
      });
    }

    if (_.isObject(record)) {
      return _.some(_.values(record), function(el) {
        return recordContains(el, value);
      });
    }

    // Remove HTML entities
    record = record.replace(/&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-f]{1,6});/ig, '');

    // Attempt to strip HTML if any potential HTML tag is detected
    if (record.match(/<[a-z0-9]+?>/i)) {
      div.innerHTML = record;
      record = div.innerText;
    }

    record = removeSymbols(record).toLowerCase();
    value = removeSymbols(value).toLowerCase().trim();

    return record.indexOf(value) > -1;
  }

  function recordIsEditable(record, config, userData) {
    if (_.isNil(config.editEntry) || _.isNil(config.editPermissions)) {
      return false;
    }

    if (!config.editEntry) {
      return false;
    }

    switch (config.editPermissions) {
      case 'everyone':
        return true;
      case 'user':
        return recordIsCurrentUser(record, config, userData);
      case 'users-admins':
        return recordIsCurrentUser(record, config, userData) || userIsAdmin(config, userData);
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  function isExecute(event) {
    return event.which === 13 || event.which === 32 || event.type === 'click';
  }

  function recordIsDeletable(record, config, userData) {
    if (_.isNil(config.deleteEntry) || _.isNil(config.deletePermissions)) {
      return false;
    }

    if (!config.deleteEntry) {
      return false;
    }

    switch (config.deletePermissions) {
      case 'everyone':
        return true;
      case 'user':
        return recordIsCurrentUser(record, config, userData);
      case 'users-admins':
        return recordIsCurrentUser(record, config, userData) || userIsAdmin(config, userData);
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  function moveAddButtonPosition(options) {
    var $addButton = options.$container.find('.dynamic-list-add-item');
    var layout = options.data.layout;
    var listClasses = {
      'agenda': '.agenda-list-card-holder',
      'news-feed': '.news-feed-list-wrapper',
      'simple-list': '.simple-list-wrapper',
      'small-card': '.small-card-list-wrapper'
    };
    var elementSpace = 20;
    var addButtonWidth = $addButton.innerWidth();
    var halfListWrapperWidth = Math.floor(options.$container.find(listClasses[layout]).innerWidth() / 2);
    var screenCenter = Math.floor($('body').innerWidth() / 2);
    var rightPosition = screenCenter - (halfListWrapperWidth + elementSpace + addButtonWidth);

    $addButton.css('right', rightPosition);
  }

  function resetAddButtonPosition(options) {
    options.$container.find('.dynamic-list-add-item').css('right', '');
  }

  function adjustAddButtonPosition(options) {
    if (options.data.addEntry && Modernizr.tablet) {
      moveAddButtonPosition(options);
    } else if (options.data.addEntry && !Modernizr.tablet) {
      resetAddButtonPosition(options);
    }
  }

  function getInputDate(date, getDate, timeOnly, dateOnly) {
    var inputDate = null;

    if (!dateOnly) {
      inputDate = timeOnly
        ? getDate(date, 'HH:mm')
        : getDate(date, LOCAL_FORMAT);
    }

    return inputDate;
  }

  function getDateModifiedValues(options) {
    var timestamp = options.date;
    var timeOnly = /^([0-1][0-9]|[2][0-3]):([0-5][0-9])$/.test(timestamp);
    var dateOnly = !/[:]/.test(timestamp);
    var deviceTimeZone = moment.tz.guess();
    var getDate = options.useDeviceTimezone ? moment.tz.setDefault(deviceTimeZone) : moment.utc;

    switch (options.dateFilterModifiers) {
      case 'today':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'now':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, null, getDate),
          entryDate: getInputDate(options.date, getDate, timeOnly, dateOnly)
        };

      case 'nowaddminutes':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: getInputDate(options.date, getDate, timeOnly, dateOnly)
        };

      case 'nowaddhours':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: getInputDate(options.date, getDate, timeOnly, dateOnly)
        };

      case 'todayadddays':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'todayaddmonths':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'todayaddyears':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'nowsubtractminutes':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: getInputDate(options.date, getDate, timeOnly, dateOnly)
        };

      case 'nowsubtracthours':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: getInputDate(options.date, getDate, timeOnly, dateOnly)
        };

      case 'todayminusdays':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'todayminusmonths':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      case 'todayminusyears':
        return {
          comparisonDate: getCachedDate(options.dateFilterModifiers, options.offsetValue, getDate),
          entryDate: timeOnly
            ? null
            : moment(options.date, LOCAL_FORMAT).startOf('day')
        };

      default:
        break;
    }
  }

  function getCachedDate(offsetType, offsetValue, getDate) {
    // Memoization method was used in this function

    var offsetTypes = ['minute', 'hour', 'month', 'year', 'day'];

    if (offsetType in currentDate) {
      return currentDate[offsetType];
    }

    var period = offsetTypes.find(function(item) {
      return offsetType.indexOf(item) !== -1;
    });

    if (offsetType === 'now') {
      currentDate[offsetType] = getDate().startOf('minute');
    } else if (offsetType === 'today') {
      currentDate[offsetType] = moment().startOf('day');
    }

    if (offsetType !== 'now' && offsetType.indexOf('now') !== -1) {
      currentDate[offsetType] = offsetType.indexOf('add') !== -1
        ? getDate().add(period, smartParseFloat(offsetValue)).startOf('minute')
        : getDate().subtract(period, smartParseFloat(offsetValue)).startOf('minute');
    } else if (offsetType.indexOf('today') !== -1) {
      currentDate[offsetType] = offsetType.indexOf('add') !== -1
        ? moment().add(period, smartParseFloat(offsetValue)).startOf('day')
        : moment().subtract(period, smartParseFloat(offsetValue)).startOf('day');
    }

    return currentDate[offsetType];
  }

  function isDateMatches(options) {
    if (options) {
      var result = getDateModifiedValues({
        date: options.date,
        dateFilterModifiers: options.dateValue,
        offsetValue: options.offsetValue,
        useDeviceTimezone: options.useDeviceTimezone
      });

      switch (options.condition) {
        case 'dateis':
          return moment(result.entryDate).isSame(result.comparisonDate);

        case 'datebefore':
          return  moment(result.entryDate).isBefore(result.comparisonDate);

        case 'dateafter':
          return moment(result.entryDate).isAfter(result.comparisonDate);

        case 'datebetween':
          var comparisonDateFrom = getDateModifiedValues({
            date: options.date,
            dateFilterModifiers: options.dateFilterModifiers.from.value,
            offsetValue: options.dateFilterModifiers.from.offset,
            useDeviceTimezone: options.dateFilterModifiers.from.useDeviceTimezone
          }).comparisonDate;

          var comparisonDateTo = getDateModifiedValues({
            date: options.date,
            dateFilterModifiers: options.dateFilterModifiers.to.value,
            offsetValue: options.dateFilterModifiers.to.offset,
            useDeviceTimezone: options.dateFilterModifiers.to.useDeviceTimezone
          }).comparisonDate;

          var entryDate = getDateModifiedValues({
            date: options.date,
            dateFilterModifiers: options.dateFilterModifiers.from.value,
            offsetValue: options.dateFilterModifiers.from.offset,
            useDeviceTimezone: options.dateFilterModifiers.from.useDeviceTimezone
          }).entryDate;

          return moment(entryDate).isBetween(comparisonDateFrom, comparisonDateTo, null, '[]');
        default:
          break;
      }
    }
  }

  /**
   * Connect to data source and retrieves data
   * @param {Object} connectionOptions - Connection options for connecting to the data source
   * @param {Object} options - A mapping of options for this function
   * @returns {Promise} Promise resolves when data is retrieved
   */
  function getDataFromDataSource(connectionOptions, options) {
    connectionOptions = connectionOptions || { offline: true };
    options = options || {};

    var config = options.config;

    if (config.defaultData && !config.dataSourceId) {
      return Promise.resolve(config.defaultEntries);
    }

    return Fliplet.DataSources.connect(config.dataSourceId, connectionOptions)
      .then(function(connection) {
        // If you want to do specific queries to return your rows
        // See the documentation here: https://developers.fliplet.com/API/fliplet-datasources.html
        var query;

        if (typeof config.dataQuery === 'function') {
          query = config.dataQuery({
            config: config,
            id: config.id,
            uuid: config.uuid,
            container: options.container
          });
        } else if (typeof config.dataQuery === 'object') {
          query = config.dataQuery;
        } else if (needsApiQueryData({ config: config })) {
          query = getQueryData({
            config: config,
            filterQueries: options.filterQueries
          });
        }

        var reasons = getQueryAllReasons({ config: config });

        // Add reasons for not using queries
        if (reasons.length) {
          query = query || {};
          query._tags = {
            queryAllReasons: reasons.join(',')
          };
        }

        return connection.find(query);
      });
  }

  /**
   * Load data for the list
   * @param {Object} options - A mapping of options for this function
   * @returns {Promise} Promise resolves when data is loaded
   */
  function loadData(options) {
    options = options || {};

    var config = options.config;

    return Fliplet.Hooks.run('flListDataBeforeGetData', {
      instance: options.instance,
      config: config,
      id: options.id,
      uuid: options.uuid,
      container: options.$container
    }).then(function() {
      var getData;

      if (typeof config.getData === 'function') {
        getData = config.getData;
      } else {
        getData = getDataFromDataSource;
      }

      var connectionOptions = {
        offline: true
      };

      if (config.hasOwnProperty('cache')) {
        connectionOptions.offline = config.cache;
      }

      return getData(connectionOptions, {
        config: config,
        filterQueries: options.filterQueries,
        container: options.$container
      });
    }).catch(function(error) {
      Fliplet.UI.Toast.error(error, {
        message: 'Error loading data'
      });
    });
  }

  function runRecordFilters(records, filters) {
    if (!filters || _.isEmpty(filters)) {
      return records;
    }

    var operators = {
      '==': function(a, b) { return a == b; }, // eslint-disable-line eqeqeq
      '!=': function(a, b) { return a != b; }, // eslint-disable-line eqeqeq
      '>': function(a, b) { return smartParseFloat(a) > smartParseFloat(b); },
      '>=': function(a, b) { return smartParseFloat(a) >= smartParseFloat(b); },
      '<': function(a, b) { return smartParseFloat(a) < smartParseFloat(b); },
      '<=': function(a, b) { return smartParseFloat(a) <= smartParseFloat(b); }
    };

    return _.filter(records, function(record) {
      return _.every(filters, function(filter) {
        var condition = filter.condition;
        var rowData = _.get(record, ['data', filter.column], null);
        var splittedFilterValue = splitByCommas(filter.value);

        if (condition === 'none' || filter.column === 'none') {
          // Filter isn't configured correctly
          return true;
        }

        if (condition === 'empty') {
          return _.isEmpty(rowData) && !_.isFinite(rowData) && typeof rowData !== 'boolean';
        }

        if (condition === 'notempty') {
          return !_.isEmpty(rowData) || _.isFinite(rowData) || typeof rowData === 'boolean';
        }

        if (condition === 'between') {
          return rowData >= smartParseFloat(filter.value.from.trim()) && (rowData <= (smartParseFloat(filter.value.to.trim()) || rowData));
        }

        if (condition === 'oneof') {
          var splittedRowData = _.isArray(rowData) ? _.flatten(rowData) : splitByCommas(rowData);

          return splittedFilterValue.includes(rowData)
            || !!_.intersectionWith(splittedFilterValue, splittedRowData, _.isEqual).length;
        }

        if (['dateis', 'datebefore', 'dateafter', 'datebetween'].indexOf(condition) !== -1) {
          return isDateMatches({
            date: rowData,
            condition: condition,
            dateValue: filter.dateValue,
            offsetValue: filter.offsetValue,
            useDeviceTimezone: filter.useDeviceTimezone,
            dateFilterModifiers: filter.dateFilterModifiers
          });
        }

        if (!filter.value) {
          // Value is not configured
          return true;
        }

        // Case insensitive
        if (typeof filter.value === 'string') {
          filter.value = filter.value.toLowerCase();
        }

        if (!_.isNull(rowData)) {
          rowData = record.data[filter.column].toString().toLowerCase();
        }

        switch (condition) {
          case 'contains':
            return rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) > -1;
          case 'notcontain':
            return rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) === -1;
          case 'regex':
            var pattern = new RegExp(filter.value, 'gi');

            return pattern.test(rowData);
          default:
            return _.isFunction(operators[condition])
              ? operators[condition](rowData, filter.value)
              : true;
        }
      });
    });
  }

  function runRecordSearch(options) {
    options = options || {};

    var value = options.value || '';
    var records = options.records || [];
    var fields = options.fields || [];
    var config = options.config || {};
    var activeFilters = options.activeFilters || {};
    var filterTypes = options.filterTypes || {};
    var showBookmarks = _.get(config, 'social.bookmark') && options.showBookmarks;
    var limit = _.get(options, 'limit', -1);

    if (!Array.isArray(fields)) {
      fields = _.compact([fields]);
    }

    if (typeof config.searchData === 'function') {
      var runSearch = config.searchData({
        config: config,
        query: value,
        activeFilters: activeFilters,
        records: records,
        showBookmarks: showBookmarks,
        filterTypes: filterTypes,
        limit: limit
      });

      if (!(runSearch instanceof Promise)) {
        runSearch = Promise.resolve(runSearch);
      }

      return runSearch;
    }

    var searchResults = [];
    var truncated = _.some(records, function(record) {
      if (limit > -1 && searchResults.length >= limit) {
        // Search results reached limit
        return true;
      }

      // Check for bookmark status
      if (showBookmarks && !record.bookmarked) {
        return;
      }

      // Check against filters
      if (!recordMatchesFilters({
        record: record,
        filters: activeFilters,
        config: config,
        filterTypes: filterTypes
      })) {
        return;
      }

      // No string
      if (value === '') {
        searchResults.push(record);

        return;
      }

      // Use custom string match function
      if (typeof config.searchMatch === 'function') {
        var matchesSearch = config.searchMatch({
          record: record,
          value: value,
          fields: fields
        });

        if (!matchesSearch) {
          return;
        }

        searchResults.push(record);

        return;
      }

      // Check if record contains value in the search fields
      var containsSearch = _.some(fields, function(field) {
        return recordContains(record.data[field], value);
      });

      if (!containsSearch) {
        return;
      }

      searchResults.push(record);
    });

    // Sort results
    searchResults = sortByField(_.assign({}, options, { records: searchResults }));

    return Promise.resolve({
      records: searchResults,
      truncated: truncated
    });
  }

  function getRecordFields(records, key) {
    records = records || [];

    var cachedFields = {};
    var fields;

    if (key && cachedFields[key]) {
      return Promise.resolve(cachedFields[key]);
    }

    records.unshift({});
    fields = _.keys(_.extend.apply({}, _.map(records, 'data')));
    records.shift();

    if (key) {
      cachedFields[key] = fields;
    }

    return Promise.resolve(fields);
  }

  function convertData(data) {
    // Converts data as jQuery.data() does when reading data attributes
    // Source: https://github.com/jquery/jquery/blob/master/src/data.js
    var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;

    if (data === 'true') {
      return true;
    }

    if (data === 'false') {
      return false;
    }

    if (data === 'null') {
      return null;
    }

    // Only convert to a number if it doesn't change the string
    if (data === +data + '') {
      return +data;
    }

    if (rbrace.test(data)) {
      // Returned parsed object/array if it starts with { or [
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }

    return data;
  }

  /**
   * Parse and cache values into date objects
   * @param {*} value - Input to be parsed into moment objects
   * @returns {moment} Parsed moment object
   */
  function parseDate(value)  {
    if (typeof parsedDates[value] === 'undefined') {
      parsedDates[value] = moment(value);
    }

    return parsedDates[value];
  }

  /**
   * Parse and cache values into numbers
   * @param {*} value - Input to be parsed into numbers
   * @returns {Number} Parsed number value
   */
  function parseNumber(value) {
    if (typeof parsedNumbers[value] === 'undefined') {
      parsedNumbers[value] = Fliplet.parseNumber(value, true);
    }

    return parsedNumbers[value];
  }

  function recordMatchesFilters(options) {
    options = options || {};

    var record = options.record;
    var filters = options.filters;
    var config = options.config || {};
    var filterTypes = options.filterTypes || {};

    var recordFieldValues = _.mapValues(filters, function(values, field) {
      return _.map(_.uniq(getRecordField({
        record: record,
        field: field,
        useData: true,
        filterTypes: filterTypes
      })), convertData);
    });

    // Returns true if record matches all of provided filters
    return _.every(_.keys(filters), function(field) {
      // For date filters, record passes filter if it's within range
      if (filterTypes[field] === 'date') {
        // Invalid date filter values, fail silently by passing the filter
        if (!filters[field] || filters[field].length !== 2) {
          return true;
        }

        return _.some(_.get(recordFieldValues, field), function(recordFieldValue) {
          var date = parseDate(recordFieldValue);

          return date.isValid() && date.isBetween(filters[field][0], filters[field][1], undefined, '[]');
        });
      }

      if (filterTypes[field] === 'number') {
        // Invalid number filter values, fail silently by passing the filter
        if (!filters[field] || filters[field].length !== 2) {
          return true;
        }

        return _.some(_.get(recordFieldValues, field), function(recordFieldValue) {
          var value = parseNumber(recordFieldValue);

          return !isNaN(value) && value >= filters[field][0] && value <= filters[field][1];
        });
      }

      // Record passes filter if it matches one of the values
      return _[config.filterMatch === 'all' ? 'every' : 'some'](filters[field], function(value) {
        if (field === 'undefined') {
          // Legacy class-based filters
          return _.includes(_.map(_.get(record, 'data.flFilters'), 'data.class'), value);
        }

        // Filter UI contains data-field, i.e. uses new field-based filters
        return _.some(_.get(recordFieldValues, field), function(recordFieldValue) {
          // Loosely typed comparison is used to make filtering more predictable for users
          // eslint-disable-next-line eqeqeq
          return recordFieldValue == value;
        });
      });
    });
  }

  function getRecordUniqueId(options) {
    options = options || {};

    var primaryKey = _.get(options, 'config.dataPrimaryKey');

    if (typeof primaryKey === 'function') {
      return primaryKey({
        record: options.record,
        config: options.config
      });
    }

    if (typeof primaryKey === 'string' && primaryKey.length) {
      return _.get(options, ['record', 'data', primaryKey]);
    }

    return _.get(options, ['record', 'id']);
  }

  function getRecordFieldValues(records, fields) {
    // Extract a list of filter values based on a list of records and filter fields
    if (_.isUndefined(fields) || _.isNull(fields)) {
      return [];
    }

    if (!_.isArray(fields)) {
      fields = [fields];
    }

    return _.zipObject(fields, _.map(fields, function(field) {
      return _.sortBy(_.uniq(splitByCommas(_.map(records, ['data', field]))));
    }));
  }

  /**
   * Gets the minimum and maximum values from a list of filter values
   * @param {Array} values - List of filter values
   * @returns {Object} Minimum and maximum values
   */
  function getMinMaxFilterValues(values) {
    var min = _.minBy(values, function(value) {
      return value.data.value;
    });

    if (typeof min === 'undefined') {
      return {};
    }

    return {
      min: min.data.value,
      max: _.maxBy(values, function(value) {
        return value.data.value;
      }).data.value
    };
  }

  /**
   * Takes the list of data records and the page query parameter to return a list of filter and filter options to render
   * @param {Object} options - A mapping of options for this function
   * @param {Object[]} options.records - Records from which to derive the filter values
   * @param {Object[]} options.filters - List of filters configured by the user
   * @param {Number} options.id - Widget instance ID
   * @param {Object} [options.query] - Filter query found in the page URL
   * @returns {Object[]} An array of filters and possible values, ready to be rendered through Handlebars template
   */
  function parseRecordFilters(options) {
    // NOTE: Do not change signature and behavior of function
    // because it could be used by legacy customized layout script
    options = options || {};

    var records = options.records || [];
    var filters = options.filters || [];
    var id = options.id;
    var query = options.query;
    var filterTypes = options.filterTypes || {};
    var hasFilterQuery = query && query.value.length;

    // Add a fake entry into records to represent the filters from the query
    // to ensure all filter options from the query are rendered in the filter UI
    if (hasFilterQuery) {
      var flFilters = [];

      // When filter columns are unspecified, apply the values to all columns
      if (!query.column.length) {
        query.column = filters;
        query.value = _.fill(Array(filters.length), query.value);
      }

      _.forEach(query.column, function(field, i) {
        var value = query.value[i];

        if (!Array.isArray(value)) {
          value = [value];
        }

        _.forEach(value, function(value) {
          if (typeof value === 'undefined') {
            return;
          }

          flFilters.push({
            type: field,
            data: {
              name: value,
              class: _.kebabCase(value)
            }
          });
        });
      });

      records.push({
        data: {
          flFilters: flFilters
        }
      });
    }

    // Parse legacy flFilters from records to generate a list of filter values
    var result = _(records)
      .map(function(record) {
        return (record.data && record.data.flFilters) || record.flFilters;
      })
      .flatten()
      .uniqBy(function(filter) {
        // Ignore the filter class name when computing unique filter values
        if (filter.data && filter.data.class) {
          delete filter.data.class;
        }

        // _.uniqBy iteratee, ignoring classes
        return JSON.stringify(filter);
      })
      .orderBy(function(obj) {
        return (_.get(obj, ['data', 'name'], '') + '').toLowerCase();
      })
      .groupBy('type')
      .map(function(values, field) {
        // _.map iteratee for defining of each filter field
        var filter  = {
          id: id,
          name: field,
          data: _.map(values, 'data'),
          type: filterTypes[field]
        };

        switch (filter.type) {
          case 'date':
          case 'number':
            _.assign(filter, getMinMaxFilterValues(values));

            // If min/max values can't be found, render the filter as a toggle
            if (!_.has(filter, 'min') || !_.has(filter, 'max')) {
              filterTypes[field] = 'toggle';
              filter.type = 'toggle';
            }

            break;
          case 'toggle':
          default:
            break;
        }

        return filter;
      })
      .filter(function(filter) {
        return filter.name && _.size(filter.data);
      })
      .orderBy(function(filter) {
        // _.orderBy iteratee
        return _.indexOf(filters, filter.name);
      })
      .value();

    // Remove the fake entry added from filter query
    if (hasFilterQuery) {
      records.pop();
    }

    return result;
  }

  function getRecordField(options) {
    options = options || {};

    var record = options.record;
    var field = options.field;
    var useData = options.useData;
    var filterTypes = options.filterTypes;

    if (!field) {
      return [];
    }

    if (typeof field === 'function') {
      return field(record);
    }

    if (Array.isArray(field)) {
      var path = field.shift();

      if (field.length) {
        var arr = _.get(record, (useData ? ['data', path] : [path]));

        return _.map(arr, function(item) {
          return getRecordField({
            record: item,
            field: _.clone(field),
            useData: false,
            filterTypes: filterTypes
          });
        });
      }

      return getRecordField({
        record: record,
        field: path,
        useData: useData,
        filterTypes: filterTypes
      });
    }

    if (typeof field === 'string') {
      var value = _.get(record, (useData ? ['data', field] : [field]));

      // Avoid splitting values by comma if the field is used as a date/number filter
      if (filterTypes && ['date', 'number'].indexOf(filterTypes[field]) > -1) {
        return Array.isArray(value) ? value : [value];
      }

      return splitByCommas(value);
    }

    return [];
  }

  function addRecordFilterProperties(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};
    var filterFields = config.filterFields || [];
    var filterTypes = options.filterTypes || {};
    var filterQuery = options.filterQuery;
    var locale = moment.locale();

    if (filterQuery) {
      filterFields = filterFields.concat(filterQuery.column);
    }

    // Temporarily switch locale to EN to ensure correct formatting and sorting
    moment.locale('en');

    // Function that get and converts the categories for the filters to work
    records.forEach(function(record) {
      if (_.isArray(_.get(record, ['data', 'flFilters'])) && !options.force) {
        // If filters are already present, skip unless it's forced
        return;
      }

      var classes = [];

      record.data['flFilters'] = [];
      _.forEach(filterFields, function(field) {
        _.forEach(getRecordField({
          record: record,
          field: field,
          useData: true,
          filterTypes: filterTypes
        }), function(value) {
          var filterData = {
            type: field,
            data: {
              name: value
            }
          };

          if (filterTypes[field] === 'date') {
            if (!value) {
              return;
            }

            var date = getMomentDate(value);

            if (date.isValid()) {
              filterData.data.value = date.format('YYYY-MM-DD');
            }

            record.data['flFilters'].push(filterData);
          } else if (filterTypes[field] === 'number') {
            if (typeof value === 'undefined' || value === null) {
              return;
            }

            var number = Fliplet.parseNumber(value, true);

            if (typeof number === 'number' && !_.isNaN(number)) {
              filterData.data.value = number;
            }

            record.data['flFilters'].push(filterData);
          } else {
            var filterClass = _.kebabCase(value);

            filterData.data.class = filterClass;

            if (classes.indexOf(filterClass) === -1) {
              classes.push(filterClass);
            }

            record.data['flFilters'].push(filterData);
          }
        });
      });

      var existingClasses = _.get(record, ['data', 'flClasses'], []);

      if (typeof existingClasses === 'string') {
        existingClasses = existingClasses.split(' ');
      }

      classes = _.concat(classes, existingClasses);
      record.data['flClasses'] = _.compact(_.uniq(classes)).join(' ');
    });

    moment.locale(locale);

    return records;
  }

  /**
   * Function to strip query params from the url string
   *
   * @param {String} url - incoming url string with query params
   * @returns {String} returns url without query params
   */
  function stripQueryParametersFromUrl(url) {
    return url.split('?')[0];
  }

  function getFiles(data) {
    var cacheKey = JSON.stringify(data.query);

    if (!cachedFiles[cacheKey]) {
      cachedFiles[cacheKey] = Fliplet.Media.Folders.get(data.query)
        .then(function(response) {
          response.files.forEach(function(file) {
            if (file.isEncrypted) {
              file.url = Fliplet.Media.authenticate(file.url);
            }
          });

          return response;
        })
        .catch(function(error) {
          /* eslint-disable-next-line no-console */
          console.warn('Error retrieving files', error, data);

          return Promise.resolve({ files: [], folders: [] });
        });
    }

    return cachedFiles[cacheKey]
      .then(function(response) {
        var image = _.get(data, ['record', 'data', data.field.column]);

        if (!data.field) {
          return data.record;
        }

        var fileExtensionRegex = /(.+?)(?:\.[^\.]*$|$)/;

        if (data.field.from === 'details') {
          var imageFiles = [];
          var images;
          var fileNameRegex = /[^\\\/]+$/igm;

          if (typeof image === 'string') {
            images = splitByCommas(image);
          } else {
            images = image;
          }

          _.forEach(response.files, function(file) {
            var fileName = file.name.match(fileExtensionRegex)[1];

            _.forEach(images, function(image) {
              /* The regular expression below matches any of these on a Fliplet domain:
              * - /v1/media/files/123/contents
              * - /v1/media/files/123/contents?
              * - /v1/media/files/123/contents/fileName
              * - /v1/media/files/123/contents/filename?
              */
              var imageIdFromURL = Fliplet.Media.getIdFromRemoteUrl(image);
              var imageNameFromURL = image.match(fileNameRegex);
              var imageName = imageNameFromURL
                ? stripQueryParametersFromUrl(imageNameFromURL[0])
                : stripQueryParametersFromUrl(image);
              var matchMethod = imageIdFromURL || Static.RegExp.number.test(image)  ? 'id' : 'name';

              if (matchMethod === 'id') {
                // Image ID extracted from URL matches file ID
                if (imageIdFromURL && imageIdFromURL === file.id) {
                  imageFiles.push(file.url);
                } else if (parseInt(image, 10) === file.id) {
                  // Image is an ID and matches file ID
                  imageFiles.push(file.url);
                }
              } else if (imageName && (file.name === imageName || fileName === imageName)) {
                // File ID not found. Use file name matching.
                // Image name extracted from URL matches file name

                // NOTE - This could lead to all files in the folder that matches the entry data to be shown
                // Perhaps this should only check for non-remote URL data
                imageFiles.push(file.url);
              }
            });
          });

          _.set(data, ['record', 'data', data.field.column], imageFiles);
        } else {
          if (_.isArray(image)) {
            image = _.compact(image)[0];
          }

          if (isValidImageUrl(image)) {
          // Record data doesn't need updating
            return data.record;
          }

          var urlEdited = _.some(response.files, function(file) {
            // remove file extension
            var fileName = file.name.match(fileExtensionRegex)[1];

            if (image && (file.name === image || fileName === image)) {
              // File found
              _.set(data, ['record', 'data', data.field.column], file.url);

              return true;
            } else if (Static.RegExp.number.test(image)
            && parseInt(image, 10) === file.id) {
              _.set(data, ['record', 'data', data.field.column], file.url);

              return true;
            }
          });

          if (!urlEdited) {
            _.set(data, ['record', 'data', data.field.column], '');
          }
        }

        return data.record;
      });
  }

  function getAppliedFilterNode(options) {
    switch (options.type) {
      case 'date':
      case 'number':
        var values;

        values = options.type === 'date'
          ? options.$container.find('.fl-date-picker[data-type="' + options.type + '"][data-field="' + options.field + '"]').map(function() {
            return Fliplet.UI.DatePicker.get(this).get(true);
          }).get()
          : options.$container.find('.fl-number-input[data-type="' + options.type + '"][data-field="' + options.field + '"]').map(function() {
            return Fliplet.UI.NumberInput.get(this).get();
          }).get();

        return '<div class="btn hidden-filter-controls-filter mixitup-control-active applied-filter"'
          + ' data-type="' + options.type + '"'
          + ' data-field="' + options.field + '"'
          + '>' + values.join(' to ')
          + '<div data-remove-filter class="filter-item-remove" tabindex="0"><span class="fa fa-times"></span></div>'
          + '</div>';
      case 'toggle':
      default:
        return '<div class="btn hidden-filter-controls-filter mixitup-control-active applied-filter"'
          + ' data-type="toggle"'
          + ' data-field="' + options.field + '"'
          + ' data-value="' + options.value + '"'
          + '>' + options.value
          + '<div data-remove-filter class="filter-item-remove" tabindex="0"><span class="fa fa-times"></span></div>'
          + '</div>';
    }
  }

  function onActiveFilterClick(options) {
    var $target = options.$target;
    var $container = options.$container;
    var filterToggleSelector = ['date', 'number'].indexOf($target.data('type')) > -1
      ? options.filterOverlayClass + ' [data-filter-group][data-field="' + $target.data('field') + '"] .filter-range-reset'
      : options.filterOverlayClass + ' [data-filter-group] .mixitup-control-active[data-field="' + $target.data('field') + '"][data-value="' + $target.data('value') + '"]';
    var $filterToggle = $container.find(filterToggleSelector);

    // Toggle filter
    $filterToggle.trigger('click');

    var $applyBtn = $container.find('.filter-header-holder .filter-header-btn-controls .apply-filters');

    // Allow UI update before we click apply button
    setTimeout(function() {
      $applyBtn.trigger('click');
    }, 0);
  }

  /**
   * This function designed to show users filters that were activated in the filters overlay
   *
   * @param {Object} options - A map of options for the function
   * @param {Object} options.context - The layout instance
   * @param {Boolean} options.filtersInOverlay - If TRUE, the filters are configured to be shown in an overlay
   * @param {String} options.filterOverlayClass - CSS class of the layout filter overlay
   * @returns {undefined}
   */
  function updateActiveFilters(options) {
    if (!options.filtersInOverlay) {
      return;
    }

    var $container = options.$container;
    var activeFilters = getActiveFilters({ $container: $container });
    var filterTypes = options.filterTypes || {};

    var $activeFiltersHolder = $container.find('.active-filters');
    var $filtersGroup = $activeFiltersHolder.find('[data-filter-active-group]');

    if (!_.keys(activeFilters).length) {
      $activeFiltersHolder.addClass('hidden');

      return;
    }

    var appliedFilterNodes = [];

    _.forIn(activeFilters, function(values, field) {
      if (['date', 'number'].indexOf(filterTypes[field]) > -1) {
        var node = getAppliedFilterNode({
          $container: $container,
          field: field,
          value: values,
          type: filterTypes[field]
        });

        appliedFilterNodes.push(node);

        return;
      }

      _.forEach(values, function(value) {
        var node = getAppliedFilterNode({
          $container: $container,
          field: field,
          value: value,
          type: filterTypes[field]
        });

        appliedFilterNodes.push(node);
      });
    });

    $filtersGroup.html(appliedFilterNodes.join(''));
    $activeFiltersHolder.removeClass('hidden');

    $filtersGroup.find('[data-remove-filter]').on('click keydown', function(event) {
      if (!isExecute(event)) {
        return;
      }

      options.$target = $(event.target).closest('.hidden-filter-controls-filter');

      onActiveFilterClick(options);
    });
  }

  function updateRecordFiles(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};
    var forComments = !!options.forComments;

    if (forComments && !config.userPhotoColumn) {
      return Promise.resolve(records);
    }

    var filePromises = [];

    _.forEach(records, function(record) {
      var defaultData = {
        query: {},
        record: record,
        field: undefined
      };

      if (!forComments) {
        _.forEach([config['summary-fields'], config.detailViewOptions], function(fields) {
          _.forEach(fields, function(field) {
            if (field.type !== 'image') {
              return;
            }

            switch (field.imageField) {
              case 'app':
                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    appId: field.appFolderId
                  },
                  field: field
                })));
                break;
              case 'organization':
                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    organizationId: field.organizationFolderId
                  },
                  field: field
                })));
                break;
              case 'all-folders':
                var folderId = _.get(field, 'folder.selectFiles.0.id');

                if (!folderId) {
                  return;
                }

                filePromises.push(getFiles(_.assign({}, defaultData, {
                  query: {
                    folderId: folderId
                  },
                  field: field
                })));
                break;
              case 'url':
                if (!isValidImageUrl(record.data[field.column])) {
                  record.data[field.column] = '';
                }

                break;
              default:
                break;
            }
          });
        });
      } else {
        switch (config.userFolderOption) {
          case 'app':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                appId: config.userAppFolder
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'organization':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                organizationId: config.userOrgFolder
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'all-folders':
            filePromises.push(getFiles(_.assign({}, defaultData, {
              query: {
                folderId: _.get(config, 'userFolder.folder.selectFiles.0.id')
              },
              field: {
                column: config.userPhotoColumn
              }
            })));
            break;
          case 'url':
            if (!isValidImageUrl(record.data[config.userPhotoColumn])) {
              record.data[config.userPhotoColumn] = '';
            }

            break;
          default:
            break;
        }
      }
    });

    if (filePromises.length) {
      return Promise.all(filePromises);
    }

    return Promise.resolve(records);
  }

  /**
   * Sort items by field witch user have selected
   *
   * @param {Object} options - object with settings for sort list items
   *        keys:
   *          sortField {String} - name of the field to sort
   *          sortOrder {String} - sort order of
   *          records {Array} - array of records to sort
   * @returns {Array} - sorted by field array
   */
  function sortByField(options) {
    options = options || {};

    // If user doesn't set sorting do nothing
    // Or if we have no records (empty search results)
    if (!options.sortField || !options.records.length || ['asc', 'desc'].indexOf(options.sortOrder) === -1) {
      Fliplet.Page.Context.remove(['dynamicListSortColumn', 'dynamicListSortOrder']);

      return options.records;
    }

    // Saving sort parameters so when users come back to the page through BACK navigation, the sort order is restored
    Fliplet.Page.Context.update({
      dynamicListSortColumn: options.sortField,
      dynamicListSortOrder: options.sortOrder
    });

    var records = _.clone(options.records);
    var isSortAsc = options.sortOrder === 'asc';
    var sortField = options.sortField;
    var startsWithAlphabet = /^[A-Z,a-z]/;
    var sortType = getFieldType(records[0].data ? records[0].data[sortField] : records[0][sortField]);

    return records.sort(function(a, b) {
      var aValue = a.data ? a.data[sortField] : a[sortField];
      var bValue = b.data ? b.data[sortField] : b[sortField];

      switch (sortType) {
        case 'string':
          /**
           * By adding '{' to the start of the string we are pushing that string to the end the sort order,
           * and when we are adding '}' we push it even further to the end
          */
          aValue = aValue ? aValue.toUpperCase() : '}';
          bValue = bValue ? bValue.toUpperCase() : '}';

          if (!startsWithAlphabet.test(bValue)) {
            bValue = '{' + bValue;
          }

          if (!startsWithAlphabet.test(aValue)) {
            aValue = '{' + aValue;
          }

          if (aValue < bValue) {
            return isSortAsc ? -1 : 1;
          }

          if (aValue > bValue) {
            return isSortAsc ? 1 : -1;
          }

          return 0;
        case 'number':
          if (!parseFloat(aValue, 10) &&  parseFloat(aValue, 10) !== 0) {
            return isSortAsc ? -1 : 1;
          }

          if (!parseFloat(bValue, 10) && parseFloat(bValue, 10) !== 0) {
            return isSortAsc ? 1 : -1;
          }

          if (isSortAsc) {
            return aValue - bValue;
          }

          return bValue - aValue;
        case 'time':
          if (!aValue) {
            return isSortAsc ? 1 : -1;
          }

          if (!bValue) {
            return isSortAsc ? -1 : 1;
          }

          if (aValue < bValue) {
            return isSortAsc ? -1 : 1;
          }

          if (aValue > bValue) {
            return isSortAsc ? 1 : -1;
          }

          return 0;
        case 'date':
          aValue = moment(aValue).valueOf();
          bValue = moment(bValue).valueOf();

          if (!aValue) {
            return isSortAsc ? 1 : -1;
          }

          if (!bValue) {
            return isSortAsc ? -1 : 1;
          }

          if (isSortAsc) {
            return aValue - bValue;
          }

          return bValue - aValue;
        default:
          if (isSortAsc) {
            return aValue - bValue;
          }

          return bValue - aValue;
      }
    });
  }

  // No longer used but kept to support customized layout JS
  function sortRecordsByField(options) {
    var sortedRecords = sortByField(options);

    if (options.sortHTMLElements === false) {
      return sortedRecords;
    }

    sortHTMLElements({
      $layoutContainer: options.$container,
      $listContainer: options.$listContainer,
      listItem: options.listItem,
      sortedRecords: sortedRecords
    });

    return sortedRecords;
  }

  function sortHTMLElements(options) {
    var sortedItemsList = [];
    var $prevElement = options.$listContainer.prev();
    var $detachedList = options.$listContainer.detach();
    var $listItems = $detachedList.find(options.listItem).detach();

    $listItems.each(function() {
      var $listItem = $(this);
      var itemId = parseInt($listItem.data('entry-id'), 10);
      var itemSortedIndex = _.findIndex(options.sortedRecords, function(record) {
        return record.id === itemId;
      });

      if (itemSortedIndex !== -1) {
        sortedItemsList[itemSortedIndex] = $listItem;
      }
    });

    options.$listContainer.html(sortedItemsList);
    options.$listContainer.insertAfter($prevElement);
  }

  function getFieldType(value) {
    var valueType = typeof value;
    var timeRegex = /^[0-9]{1,2}:[0-9]{1,2}$/;

    if (valueType === 'string') {
      if (!isNaN(value)) {
        return 'number';
      }

      if (timeRegex.test(value)) {
        return 'time';
      }

      if (moment(value).isValid()) {
        return 'date';
      }

      return 'string';
    }

    if (valueType === 'undefined' || valueType === 'null') {
      return 'string';
    }

    return valueType;
  }

  function prepareRecordsData(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config || {};

    if (!_.isArray(config.filterOptions) && _.isObject(config.filterOptions)) {
      config.filterOptions = [config.filterOptions];
    }

    // Filter data based on filter options and filter queries
    var queryData = !needsApiQueryData({ config: config })
      ? getQueryData({
        config: config,
        filterQueries: options.filterQueries
      })
      : undefined;

    if (queryData && typeof queryData.where  === 'object') {
      try {
        var totalRows = records.length;
        var reasons = getQueryAllReasons({ config: config });

        records = window.sift({ data: queryData.where }, records);

        var removedRows = totalRows - records.length;

        // Track event to understand why client-side filters are run
        Fliplet.Analytics.trackEvent({
          category: 'list_dynamic',
          action: 'client_prefilter',
          label: reasons.join(','),
          value: removedRows,
          nonInteraction: true
        });
      } catch (error) {
        var message = '[LFD] Error executing pre-filters';

        console.error(message, Fliplet.parseError(error));

        // Client-side filter errors are logged for assessment
        if (typeof Raven !== 'undefined' && Raven.captureMessage) {
          Raven.captureMessage(message, {
            extra: {
              reasons: reasons.join(','),
              query: queryData,
              error: error
            }
          });
        }

        throw new Error(error);
      }
    }

    currentDate = {};

    var locale = moment.locale();

    // Temporarily switch locale to EN to ensure correct formatting and sorting
    moment.locale('en');

    if (config.sortOptions.length) {
      var sortFields = _.map(config.sortOptions, function(option) {
        return {
          column: option.column,
          type: option.sortBy
        };
      });

      // Modify a clone of the records for sorting
      var modifiedRecords = _.map(_.clone(records), function(record) {
        sortFields.forEach(function(field) {
          var sortField = 'modified_' + field.column;

          record.data[sortField] = (record.data[field.column] || '').toString().toUpperCase();

          // Modify field values based on sort types
          switch (field.type) {
            case 'alphabetical':
              record.data[sortField] = record.data[sortField].normalize('NFD').match(/[A-Za-z]/)
                ? record.data[sortField].normalize('NFD')
                : '{' + record.data[sortField];
              break;
            case 'numerical':
              record.data[sortField] = record.data[sortField].match(/[0-9]/)
                ? parseInt(record.data[sortField], 10)
                : record.data[sortField];
              break;
            case 'date':
              // If an incorrect date format is used, the entry will be pushed at the end
              record.data[sortField] = getMomentDate(record.data[sortField]).format('YYYY-MM-DD');
              break;
            case 'time':
              record.data[sortField] = record.data[sortField];
              break;
            default:
              break;
          }
        });

        return record;
      });

      var sortColumns = _.map(sortFields, function(field) {
        return 'data[modified_' + field.column + ']';
      });

      var sortOrders = _.map(config.sortOptions, function(option) {
        switch (option.orderBy) {
          case 'descending':
            return 'desc';
          case 'ascending':
          default:
            return 'asc';
        }
      });

      // Sort data
      records = _.orderBy(modifiedRecords, sortColumns, sortOrders);
    }

    moment.locale(locale);

    // Add flag for social features
    records.forEach(function(record) {
      // Add likes flag
      record.likesEnabled = config.social && config.social.likes;

      // Add bookmarks flag
      record.bookmarksEnabled = config.social && config.social.bookmark;

      // Add comments flag
      record.commentsEnabled = config.social && config.social.comments;
    });

    return records;
  }

  function addRecordComputedFields(options) {
    options = options || {};

    var record = options.record || {};
    var computedFields = options.computedFields || {};

    _.forIn(computedFields, function(getter, field) {
      if (_.has(record, ['data', field]) && computedFieldClashes.indexOf(field) === -1) {
        computedFieldClashes.push(field);
      }

      _.set(record, ['data', field], getRecordField({
        record: record,
        field: typeof getter === 'string' ? getter.split(Static.refArraySeparator) : getter,
        useData: true,
        filterTypes: options.filterTypes
      }));
    });
  }

  function addRecordsComputedFields(options) {
    options = options || {};

    var records = options.records || [];
    var config = options.config;

    if (_.isEmpty(config.computedFields)) {
      return;
    }

    _.forEach(records, function(record) {
      addRecordComputedFields({
        record: record,
        computedFields: config.computedFields,
        filterTypes: options.filterTypes
      });
    });

    if (computedFieldClashes.length) {
      var clashedFields = computedFieldClashes.sort().join(', ');

      /* eslint-disable-next-line no-console */
      console.warn('Computed field(s) "' + clashedFields + '" are already defined as a property for one or more records. All computed fields will overwrite existing properties. Use a different computed field name if you want to prevent the data from being overwritten.');
    }
  }

  function userIsAdmin(config, userData) {
    var adminValue = _.get(userData, config.userAdminColumn);

    // No valid comparison value is given
    if (_.isNil(config.userAdminValue) || config.userAdminValue === '') {
      // User is admin if adminValue is truthy or has at least one truthy value in an array
      return Array.isArray(adminValue)
        ? !!_.find(adminValue)
        : !!adminValue;
    }

    // User is admin if adminValue matches comparison value
    if (_.isArray(adminValue)) {
      return adminValue.indexOf(config.userAdminValue) > -1;
    }

    return adminValue === config.userAdminValue;
  }

  function recordIsCurrentUser(record, config, userData) {
    return config.userEmailColumn !== 'none'
      && !_.isEmpty(_.get(userData, config.userEmailColumn))
      && !_.isEmpty(_.get(record, ['data', config.userListEmailColumn]))
      && _.get(userData, config.userEmailColumn) === _.get(record, ['data', config.userListEmailColumn]);
  }

  function userCanAddRecord(config, userData) {
    if (_.isNil(config.addEntry) || _.isNil(config.addPermissions)) {
      return false;
    }

    if (!config.addEntry) {
      return false;
    }

    switch (config.addPermissions) {
      case 'everyone':
        return true;
      case 'admins':
        return userIsAdmin(config, userData);
      default:
        return false;
    }
  }

  function getjQueryObjects(target) {
    if (target instanceof jQuery) {
      return target;
    }

    var $target = $();

    // target is a DOM element or a selector string
    if (target.tagName || typeof target === 'string') {
      $target = $(target);
    }

    // target is expected as an array of DOM elements
    if (target instanceof NodeList || target instanceof Array) {
      // Non-DOM elements in the array are removed
      target = _.filter(target, function(element) {
        return element.tagName;
      });

      $target = $(target);
    }

    return $target;
  }

  function updateSearchContext(options) {
    options = options || {};

    // Update page context for navigation
    var filterTypes = options.filterTypes || {};
    var pageCtx = {};
    var filterColumns = _.map(_.toPairs(options.activeFilters), 0).join(',');
    var filterValues = _.map(_.toPairs(options.activeFilters), function(filter) {
      switch (filterTypes[filter[0]]) {
        case 'date':
        case 'number':
          return filter[1].join('..');
        case 'toggle':
        default:
          return filter[1].length > 1 ? '[' + filter[1].join(',') + ']' : filter[1].join(',');
      }
    }).join(',');

    if (!options.searchValue) {
      Fliplet.Page.Context.remove('dynamicListSearchValue');
    } else if (Fliplet.Page.Context.get('dynamicListSearchValue') !== options.searchValue) {
      pageCtx.dynamicListSearchValue = options.searchValue;
    }

    if (!filterColumns) {
      Fliplet.Page.Context.remove('dynamicListFilterColumn');
    } else if (Fliplet.Page.Context.get('dynamicListFilterColumn') !== filterColumns) {
      pageCtx.dynamicListFilterColumn = filterColumns;
    }

    if (!filterValues) {
      Fliplet.Page.Context.remove('dynamicListFilterValue');
    } else if (Fliplet.Page.Context.get('dynamicListFilterValue') !== filterValues) {
      pageCtx.dynamicListFilterValue = filterValues;
    }

    if (options.filterControlsActive) {
      Fliplet.Page.Context.remove('dynamicListFilterHideControls');
    } else if (filterColumns || filterValues) {
      pageCtx.dynamicListFilterHideControls = true;
    }

    Fliplet.Page.Context.update(pageCtx);
  }

  function updateFilterControlsContext() {
    if (Fliplet.Navigate.query.dynamicListFilterColumn || Fliplet.Navigate.query.dynamicListFilterValue) {
      Fliplet.Page.Context.update({
        dynamicListFilterHideControls: true
      });
    }
  }

  function resetSortIcons(options) {
    options.$sortList.each(function() {
      var $listitem = $(this);

      $listitem.attr('data-sort-order', 'none');
    });
  }

  /**
   * Function is formatting the input values to string
   * @param {*} value Input values that can be of any type
   * @returns The formatted input value into string value
   */

  function toFormattedString(value) {
    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'boolean':
        return value.toString();
      case 'object':
        if (!value) {
          return '';
        } else if (Array.isArray(value)) {
          if (!value.length) {
            return '';
          }

          value = _.filter(_.map(value, toFormattedString), function(part) { return part.trim().length; });

          return value.join(', ');
        } else if (value instanceof Handlebars.SafeString) {
          // Return Handlebars SafeString objects as they are for templates to render
          return value;
        }

        return JSON.stringify(value);
      default:
        return '';
    }
  }

  function getUsersToMention(options) {
    options = options || {};

    var allUsers = options.allUsers;
    var config = options.config;

    return _.map(allUsers, function(user) {
      var userName = '';
      var userNickname = '';
      var counter = 1;

      if (config.userNameFields && config.userNameFields.length > 1) {
        config.userNameFields.forEach(function(name) {
          userName += user.data[name] + ' ';
          userNickname += counter === 1
            ? (user.data[name] || '').toLowerCase().charAt(0) + ' '
            : (user.data[name] || '').toLowerCase().replace(/\s/g, '') + ' ';
        });
        userName = userName.trim();
        userNickname = userNickname.trim();

        counter++;
      } else {
        userName = user.data[config.userNameFields[0]] || '';
        userNickname = (user.data[config.userNameFields[0]] || '').toLowerCase().replace(/\s/g, '');
      }

      return {
        id: user.id,
        username: userNickname,
        name: userName,
        image: user.data[config.userPhotoColumn] || ''
      };
    });
  }

  function setFilterValues(options) {
    var sessionData;

    options = options || {};

    if (!options.config) {
      return Promise.resolve();
    }

    return Promise.all(_.map(options.config.filterOptions, function(item) {
      return new Promise(function(resolve) {
        switch (item.valueType) {
          case 'user-profile-data':
            if (!sessionData) {
              sessionData = Fliplet.User.getCachedSession();
            }

            sessionData.then(function(session) {
              var entries = session.entries;

              if (session && entries) {
                if (entries.dataSource && entries.dataSource.data) {
                  item.value = entries.dataSource.data[item.fieldValue];
                  resolve();
                }

                if (entries.saml2 && entries.saml2.data) {
                  item.value = entries.saml2.data[item.fieldValue];
                  resolve();
                }

                if (entries.flipletLogin && entries.flipletLogin.data) {
                  item.value = entries.flipletLogin.data[item.fieldValue];
                  resolve();
                }
              }

              if (!item.value) {
                Fliplet.Profile.get(item.fieldValue)
                  .then(function(result) {
                    item.value = result || '';
                    resolve();
                  });
              }
            });
            break;

          case 'link-query-parameter':
            item.value = Fliplet.Navigate.query[item.fieldValue];
            resolve();
            break;

          case 'app-storage-data':
            Fliplet.App.Storage.get(item.fieldValue)
              .then(function(result) {
                item.value = result;
                resolve();
              });
            break;

          default:
            resolve();
        }
      });
    }));
  }

  /**
   * Assesses a string input and return it as an array if it's a valid image URL
   * @param {String} str - String to be assessed
   * @returns {Array|null} An array of a single image URL or null if input is not an image URL
   */
  function getImagesUrlsByRegex(str) {
    // Regex to detect if line contains URL
    return isValidImageUrl(str) ? [str] : null;
  }

  function openLinkAction(options) {
    if (!options.summaryLinkAction || !options.summaryLinkAction.column || !options.summaryLinkAction.type) {
      return;
    }

    var entry = _.find(options.records, function(entry) {
      return entry.id === options.recordId;
    });

    if (!entry) {
      return;
    }

    var value = entry.data[options.summaryLinkAction.column];
    var query = entry.data[options.summaryLinkAction.queryColumn];

    if (Array.isArray(value)) {
      value = _.first(value);
    }

    if (!value) {
      return;
    }

    if (options.summaryLinkAction.type === 'file') {
      Fliplet.Navigate.file(value);
    } else if (options.summaryLinkAction.type === 'url') {
      Fliplet.Navigate.url(value);
    } else {
      var opt = { transition: 'fade' };

      if (query) {
        opt.query = query;
      }

      Fliplet.Navigate.screen(parseInt(value, 10), opt);
    }
  }

  return {
    getFilterTypes: getFilterTypes,
    registerHandlebarsHelpers: registerHandlebarsHelpers,
    accessibilityHelpers: {
      isExecute: isExecute
    },
    DOM: {
      $: getjQueryObjects,
      resetSortIcons: resetSortIcons,
      adjustAddButtonPosition: adjustAddButtonPosition
    },
    Page: {
      updateActiveFilters: updateActiveFilters,
      updateSearchContext: updateSearchContext,
      updateFilterControlsContext: updateFilterControlsContext,
      updateActiveFilterCount: updateActiveFilterCount,
      getActiveFilters: getActiveFilters,
      renderFilters: renderFilters,
      clearFilters: clearFilters,
      parseFilterQueries: parseFilterQueries
    },
    String: {
      splitByCommas: splitByCommas,
      validateImageUrl: validateImageUrl,
      toFormattedString: toFormattedString,
      appendUrlQuery: appendUrlQuery
    },
    Date: {
      moment: getMomentDate
    },
    Query: {
      getFilterSelectors: getFilterQuerySelectors,
      fetchAndCache: fetchAndCache
    },
    Navigate: {
      openLinkAction: openLinkAction
    },
    Record: {
      contains: recordContains,
      isEditable: recordIsEditable,
      isDeletable: recordIsDeletable,
      isCurrentUser: recordIsCurrentUser,
      matchesFilters: recordMatchesFilters,
      getUniqueId: getRecordUniqueId,
      getDataViewContent: getDataViewContent,
      getImageContent: getImageContent,
      assignImageContent: assignImageContent
    },
    Records: {
      loadData: loadData,
      runFilters: runRecordFilters,
      runSearch: runRecordSearch,
      getFields: getRecordFields,
      getFieldValues: getRecordFieldValues,
      parseFilters: parseRecordFilters,
      setFilterValues: setFilterValues,
      addFilterProperties: addRecordFilterProperties,
      updateFiles: updateRecordFiles,
      prepareData: prepareRecordsData,
      addComputedFields: addRecordsComputedFields,
      getFilesInfo: getFilesInfo,
      sortByField: sortRecordsByField
    },
    User: {
      isAdmin: userIsAdmin,
      canAddRecord: userCanAddRecord
    },
    Users: {
      getUsersToMention: getUsersToMention
    }
  };
}()));
