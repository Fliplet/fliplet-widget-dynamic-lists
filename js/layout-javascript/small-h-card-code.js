// Constructor
function DynamicList(id, data) {
  var _this = this;

  this.flListLayoutConfig = window.flListLayoutConfig;
  this.layoutMapping = {
    'small-h-card': {
      'base': 'templates.build.small-h-card-base',
      'loop': 'templates.build.small-h-card-loop',
      'detail': 'templates.build.small-h-card-detail'
    }
  };

  // Makes data and the component container available to Public functions
  this.data = data;
  this.data['summary-fields'] = this.data['summary-fields'] || this.flListLayoutConfig[this.data.layout]['summary-fields'];
  this.data.computedFields = this.data.computedFields || {};
  this.$container = $('[data-dynamic-lists-id="' + id + '"]');

  // Other variables
  // Global variables
  this.allowClick = true;

  this.emailField = 'Email';
  this.myProfileData;
  this.modifiedProfileData;
  this.myUserData = {};

  this.listItems;
  this.modifiedListItems;
  this.dataSourceColumns;
  this.directoryDetailWrapper;

  this.queryOpen = false;
  this.queryPreFilter = false;
  this.pvPreviousScreen;
  this.pvPreFilterQuery;
  this.pvOpenQuery;
  this.openedEntryOnQuery = false;
  this.imagesData = {};

  /**
   * this specifies the batch size to be used when rendering in chunks
   */
  this.INCREMENTAL_RENDERING_BATCH_SIZE = 100;

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

DynamicList.prototype.attachObservers = function() {
  var _this = this;

  // Attach your event listeners here
  Fliplet.Hooks.on('beforePageView', function(options) {
    if (options.addToHistory === false) {
      _this.closeDetails();
    }
  });

  _this.$container
    .on('click keydown', '.small-h-card-list-detail-button a', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var _that = $(this);

      Fliplet.Analytics.trackEvent({
        category: 'list_dynamic_' + _this.data.layout,
        action: 'profile_buttons',
        label: _that.find('.small-h-card-list-detail-button-text').text().trim()
      });
    })
    .on('touchstart', '.small-h-card-list-item', function(event) {
      event.stopPropagation();

      if (!$(this).hasClass('open')) {
        $(this).addClass('hover');
      }
    })
    .on('touchmove', '.small-h-card-list-item', function() {
      _this.allowClick = false;
      $(this).removeClass('hover');
    })
    .on('touchend touchcancel', '.small-h-card-list-item', function() {
      $(this).removeClass('hover');
      // Delay to compensate for the fast click event
      setTimeout(function() {
        _this.allowClick = true;
      }, 100);
    })
    .on('click keydown', '.small-h-card-list-item', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var _that = $(this);
      var entryId = $(this).data('entry-id');
      var entryTitle = $(this).find('.small-h-card-list-item-text').text().trim();
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

        if (_this.allowClick) {
          $(event.target).parents('.small-h-card-list-wrapper').addClass('hidden');
          _this.$container.find('.dynamic-list-add-item').addClass('hidden');
        }

        // find the element to expand and expand it
        if (_this.allowClick && $(window).width() < 640) {
          _this.directoryDetailWrapper = _that.find('.small-h-card-list-detail-wrapper');
          _this.expandElement(_this.directoryDetailWrapper, entryId);
        } else if (_this.allowClick && $(window).width() >= 640) {
          _this.showDetails(entryId);
        }

        Fliplet.Page.Context.update({
          dynamicListOpenId: entryId
        });
      });
    })
    .on('click keydown', '.small-h-card-detail-overlay-close, .small-h-card-detail-overlay-screen', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      event.stopPropagation();

      var result;

      _this.$container.find('.small-h-card-list-wrapper, .dynamic-list-add-item').removeClass('hidden');

      var id = _this.$container.find('.small-h-card-detail-wrapper[data-entry-id]').data('entry-id');

      _this.$container.find('.small-h-card-list-item[data-entry-id="' + id + '"] .small-h-card-list-image').focus();

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
          console.error('Your custom function contains an error: ' + error);
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

      if ($(window).width() < 640) {
        if (typeof _this.directoryDetailWrapper === 'undefined') {
          _this.directoryDetailWrapper = _this.$container.find('.small-h-card-list-item[data-entry-id="' + id + '"] .small-h-card-list-detail-wrapper');
        }

        _this.collapseElement(_this.directoryDetailWrapper);
        _this.directoryDetailWrapper = undefined;
      } else {
        _this.closeDetails();
      }

      Fliplet.Page.Context.remove('dynamicListOpenId');
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

      var entryID = $(this).parents('.small-h-card-detail-overlay').find('.small-h-card-list-detail-content-scroll-wrapper').data('entry-id');

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
      var entryID = $(this).parents('.small-h-card-detail-overlay').find('.small-h-card-list-detail-content-scroll-wrapper').data('entry-id');
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

                  if ($(window).width() < 640) {
                    _this.collapseElement(_this.directoryDetailWrapper);
                    _this.directoryDetailWrapper = undefined;
                  } else {
                    _this.closeDetails();
                  }

                  _this.addSummaryData(_this.listItems);
                  _this.renderLoopHTML();
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
    .on('click keydown', '.multiple-images-item, .single-image-holder', function(event) {
      if (!_this.Utils.accessibilityHelpers.isExecute(event)) {
        return;
      }

      var $this = $(this);
      var id = $this.parents('[data-detail-entry-id]').data('detailEntryId');

      _this.imagesData[id].options.index = $this.index();

      Fliplet.Navigate.previewImages(_this.imagesData[id]);
    })
    .on('click', '.file-item', function(event) {
      var url = $(event.currentTarget).find('input[type=hidden]').val();

      Fliplet.Navigate.file(url);
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

DynamicList.prototype.initialize = function() {
  var _this = this;
  var shouldInitFromQuery = _this.parseQueryVars();

  // query will always have higher priority than storage
  // if we find relevant terms in the query, delete the storage so the filters do not mix and produce side-effects
  if (shouldInitFromQuery) {
    Fliplet.App.Storage.remove('flDynamicListQuery:' + _this.data.layout);
  }

  // Check if there is a query or PV for search/filter queries
  return (shouldInitFromQuery ? Promise.resolve() : _this.parsePVQueryVars())
    .then(function() {
      // Render Base HTML template
      _this.renderBaseHTML();

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
      records = _this.getPermissions(records);

      // Get user profile
      if (!_.isEmpty(_this.myUserData)) {
        // Create flag for current user
        records.forEach(function(record) {
          record.isCurrentUser = _this.Utils.Record.isCurrentUser(record, _this.data, _this.myUserData);
        });

        _this.myProfileData = _.filter(records, function(row) {
          return row.isCurrentUser;
        });
      }

      // Make rows available Globally
      _this.listItems = records;

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
      _this.listItems = _.uniqBy(response, function(item) {
        return item.id;
      });

      return _this.checkIsToOpen();
    })
    .then(function() {
      // Render Loop HTML
      _this.modifiedListItems = _this.addSummaryData(_this.listItems);
      _this.renderLoopHTML().then(function() {
        // Update selected highlight size in Edit
        Fliplet.Widget.updateHighlightDimensions(_this.data.id);

        _this.attachObservers();
      });

      return;
    });
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
      return row.data[_this.pvOpenQuery.column] === _this.pvOpenQuery.value;
    });
  }

  if (!entry) {
    Fliplet.UI.Toast('Entry not found');

    return Promise.resolve();
  }

  var modifiedData = _this.addSummaryData([entry]);

  return _this.showDetails(entry.id, modifiedData).then(function() {
    _this.openedEntryOnQuery = true;

    // Wait for overlay transition to complete
    return new Promise(function(resolve) {
      setTimeout(resolve, 250);
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

      if (_.hasIn(value, 'prefilter')) {
        _this.queryPreFilter = true;
        _this.pvPreFilterQuery = value.prefilter;
      }

      if (_.hasIn(value, 'open')) {
        _this.queryOpen = true;
        _this.pvOpenQuery = value.open;
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
  // Uses sumamry view settings set by users
  var loopData = _.map(records, function(entry) {
    var newObject = {
      id: entry.id,
      editEntry: entry.editEntry,
      deleteEntry: entry.deleteEntry,
      isCurrentUser: entry.isCurrentUser ? entry.isCurrentUser : false,
      entryDetails: [],
      originalData: entry.data
    };

    _this.data['summary-fields'].forEach(function(obj) {
      var content = '';

      if (obj.type === 'image') {
        content = _this.Utils.Record.getImageContent(entry.data[obj.column], true);
      } else if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.data));
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

DynamicList.prototype.renderLoopHTML = function(iterateeCb) {
  // Function that renders the List template
  var _this = this;
  var template = _this.data.advancedSettings && _this.data.advancedSettings.loopHTML
    ? Handlebars.compile(_this.data.advancedSettings.loopHTML)
    : Handlebars.compile(Fliplet.Widget.Templates[_this.layoutMapping[_this.data.layout]['loop']]());
  var limitedList;

  $('#small-h-card-list-wrapper-' + _this.data.id).empty();

  if (_this.data.enabledLimitEntries && _this.data.limitEntries >= 0) {
    limitedList = _this.modifiedListItems.slice(0, _this.data.limitEntries);
  }

  var renderLoopIndex = 0;
  var data = limitedList || _this.modifiedListItems;

  return Fliplet.Hooks.run('flListDataBeforeRenderList', {
    instance: _this,
    records: data,
    config: _this.data
  }).then(function() {
    return new Promise(function(resolve) {
      function render() {
        // get the next batch of items to render
        var nextBatch = data.slice(
          renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE,
          renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE
        );

        if (nextBatch.length) {
          $('#small-h-card-list-wrapper-' + _this.data.id).append(template(nextBatch));

          if (iterateeCb && typeof iterateeCb === 'function') {
            if (renderLoopIndex === 0) {
              _this.$container.find('.new-small-h-card-list-container').addClass('ready');
            }

            iterateeCb(renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE, renderLoopIndex * _this.INCREMENTAL_RENDERING_BATCH_SIZE + _this.INCREMENTAL_RENDERING_BATCH_SIZE);
          }

          renderLoopIndex++;
          // if the browser is ready, render
          requestAnimationFrame(render);
        } else {
          _this.$container.find('.new-small-h-card-list-container').addClass('ready');
          Fliplet.Hooks.run('flListDataAfterRenderList', {
            instance: _this,
            records: data,
            config: _this.data,
            initialRender: true
          });
          resolve();
        }
      }

      // Changing close icon in the fa-times-thin class for windows 7 IE11
      if (/Windows NT 6.1/g.test(navigator.appVersion) && Modernizr.ie11) {
        $('.fa-times-thin').addClass('win7');
      }

      // start the initial render
      requestAnimationFrame(render);
    });
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

DynamicList.prototype.addDetailViewData = function(entry) {
  var _this = this;

  if (_.isArray(entry.entryDetails) && entry.entryDetails.length) {
    _this.Utils.Record.assignImageContent(_this, entry);

    return entry;
  }

  var notDynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return !option.editable;
  });
  var dynamicData = _.filter(_this.data.detailViewOptions, function(option) {
    return option.editable;
  });

  entry.entryDetails = [];

  // Uses detail view settings not set by users
  notDynamicData.forEach(function(obj) {
    if (!entry[obj.location]) {
      var content = '';

      if (obj.column === 'custom') {
        content = new Handlebars.SafeString(Handlebars.compile(obj.customField)(entry.originalData));
      } else {
        content = entry.originalData[obj.column];
      }

      entry[obj.location] = content;
    }
  });

  // Uses detail view settings set by users
  dynamicData.forEach(function(dynamicDataObj) {
    var label = '';
    var labelEnabled = true;
    var content = '';

    if (dynamicDataObj.type === 'file') {
      return;
    }

    // Define label
    if (dynamicDataObj.fieldLabel === 'column-name' && dynamicDataObj.column !== 'custom') {
      label = dynamicDataObj.column;
    }

    if (dynamicDataObj.fieldLabel === 'custom-label') {
      label = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customFieldLabel)(entry.originalData));
    }

    if (dynamicDataObj.fieldLabel === 'no-label') {
      labelEnabled = false;
    }

    // Define content
    if (dynamicDataObj.customFieldEnabled) {
      content = new Handlebars.SafeString(Handlebars.compile(dynamicDataObj.customField)(entry.originalData));
    } else {
      content = entry.originalData[dynamicDataObj.column];
    }

    if (dynamicDataObj.type === 'image') {
      var imagesContentData = _this.Utils.Record.getImageContent(entry.originalData[dynamicDataObj.column]);
      var contentArray = imagesContentData.imagesArray;

      content = imagesContentData.imageContent;
      _this.imagesData[dynamicDataObj.id] = imagesContentData.imagesData;
    }

    // Define data object
    var newEntryDetail = {
      id: dynamicDataObj.id,
      content: content,
      label: label,
      labelEnabled: labelEnabled,
      type: dynamicDataObj.type
    };

    if (contentArray) {
      newEntryDetail.contentArray = contentArray;
    }

    entry.entryDetails.push(newEntryDetail);
  });

  if (_this.data.detailViewAutoUpdate) {
    var savedColumns = _.map(dynamicData, 'data');
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
  var wrapper = '<div class="small-h-card-detail-wrapper" data-entry-id="{{id}}"></div>';
  var $overlay = $('#small-h-card-detail-overlay-' + _this.data.id);
  var src = this.data.advancedSettings && this.data.advancedSettings.detailHTML
    ? this.data.advancedSettings.detailHTML
    : Fliplet.Widget.Templates[_this.layoutMapping[this.data.layout]['detail']]();

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

        $('body').addClass('lock');

        // Adds content to overlay
        $overlay.find('.small-h-card-detail-overlay-content-holder').html(wrapperTemplate(entryId));
        $overlay.find('.small-h-card-detail-wrapper').append(template(data.data || entryData));

        // Trigger animations
        _this.$container.find('.new-small-h-card-list-container').addClass('overlay-open');
        $overlay.addClass('open');
        setTimeout(function() {
          $overlay.addClass('ready');

          if (typeof _this.directoryDetailWrapper === 'undefined') {
            _this.directoryDetailWrapper = _this.$container.find('.small-h-card-list-item[data-entry-id="' + id + '"]').find('.small-h-card-list-detail-wrapper');
          }

          if (typeof _this.data.afterShowDetails === 'function') {
            _this.data.afterShowDetails({
              config: _this.data,
              src: data.src || src,
              data: data.data || entryData
            });
          }
        }, 0);
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
  var $overlay = $('#small-h-card-detail-overlay-' + _this.data.id);

  Fliplet.Page.Context.remove('dynamicListOpenId');
  $overlay.removeClass('open');
  _this.$container.find('.new-small-h-card-list-container').removeClass('overlay-open');
  $('body').removeClass('lock');

  setTimeout(function() {
    $overlay.removeClass('ready');
    // Clears overlay
    $overlay.find('.small-h-card-detail-overlay-content-holder').html('');

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    if (_this.$container.parents('.panel-group').not('.filter-overlay').length) {
      _this.$container.parents('.panel-group').not('.filter-overlay').removeClass('remove-transform');
    }

    _this.$container.find('.small-h-card-list-wrapper, .dynamic-list-add-item').removeClass('hidden');
  }, 300);
};

DynamicList.prototype.expandElement = function(elementToExpand, id) {
  // Function called when a list item is tapped to expand
  var _this = this;

  // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
  if (elementToExpand.parents('.panel-group').length) {
    elementToExpand.parents('.panel-group').addClass('remove-transform');
  }

  // check to see if element is already expanded
  if (!elementToExpand.hasClass('open')) {
    // freeze the current scroll position of the background content
    $('body').addClass('lock');

    var currentPosition = elementToExpand.offset();
    var elementScrollTop = $(window).scrollTop();
    var netOffset = currentPosition.top - elementScrollTop;

    var expandPosition = $('body').offset();
    var expandTop = expandPosition.top;
    var expandLeft = expandPosition.left;
    var expandWidth = $('body').outerWidth();
    var expandHeight = $('html').outerHeight();

    var directoryDetailImageWrapper = elementToExpand.find('.small-h-card-list-detail-image-wrapper');
    var directoryDetailImage = elementToExpand.find('.small-h-card-list-detail-image');

    // convert the expand-item to fixed position with a high z-index without moving it
    elementToExpand.css({
      'top': netOffset,
      'left': currentPosition.left,
      'height': elementToExpand.height(),
      'width': elementToExpand.width(),
      'max-width': expandWidth,
      'position': 'fixed',
      'z-index': 1010
    });

    elementToExpand.animate({
      'left': expandLeft,
      'top': expandTop,
      'height': expandHeight,
      'width': expandWidth,
      'max-width': expandWidth
    }, 200, 'linear', function() {
      _this.showDetails(id);
    });

    elementToExpand.addClass('open');
    elementToExpand.parents('.small-h-card-list-item').addClass('open');
    elementToExpand.find('.small-h-card-list-detail-content-scroll-wrapper').addClass('open');

    directoryDetailImageWrapper.css({
      height: directoryDetailImageWrapper.outerHeight(),
      'z-index': 12
    });

    directoryDetailImageWrapper.animate({
      height: '70vh'
    },
    200,
    'linear'
    );

    directoryDetailImage.css({
      height: directoryDetailImage.outerHeight(),
      'z-index': 12
    });

    directoryDetailImage.animate({
      height: '70vh'
    }, 200, 'linear');
  }
};

DynamicList.prototype.collapseElement = function(elementToCollapse) {
  // Function called when a list item is tapped to close
  var _this = this;

  $('body').removeClass('lock');
  elementToCollapse = $([]).add(elementToCollapse);

  var directoryDetailImageWrapper = elementToCollapse.find('.small-h-card-list-detail-image-wrapper');
  var directoryDetailImage = elementToCollapse.find('.small-h-card-list-detail-image');

  if (!directoryDetailImageWrapper.length || !directoryDetailImage.length) {
    _this.closeDetails();
  }

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
      'width': '100%'
    });
  });

  directoryDetailImageWrapper.animate({
    height: targetCollapseHeight
  }, 200, 'linear');

  directoryDetailImage.animate({
    height: targetCollapseHeight
  }, 200, 'linear',
  function() {
    elementToCollapse.css({ height: '100%' });
    _this.closeDetails();

    // This bit of code will only be useful if this component is added inside a Fliplet's Accordion component
    // Only happens when the closing animation finishes
    if (elementToCollapse.parents('.panel-group').length) {
      elementToCollapse.parents('.panel-group').removeClass('remove-transform');
    }
  });

  elementToCollapse.removeClass('open');
  elementToCollapse.parents('.small-h-card-list-item').removeClass('open');
  elementToCollapse.find('.small-h-card-list-detail-content-scroll-wrapper').removeClass('open');
};
