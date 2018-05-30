var DynamicLists = (function() {
  var _this;

  var organizationId = Fliplet.Env.get('organizationId');
  var appName = Fliplet.Env.get('appName');
  var pageTitle = Fliplet.Env.get('pageTitle');
  var listLayout;
  var isLayoutSelected = false;
  var allDataSources = [];
  var newDataSource;
  var dataSourceColumns;
  var resetToDefaults = false;

  var $filterAccordionContainer = $('#filter-accordion');
  var $sortAccordionContainer = $('#sort-accordion');
  var filterPanelTemplate = Fliplet.Widget.Templates['templates.interface.filter-panels'];
  var sortPanelTemplate = Fliplet.Widget.Templates['templates.interface.sort-panels'];

  var tokenField = Fliplet.Widget.Templates['templates.interface.field-token'];

  // ADD NEW MAPPING FOR ALL NEW STYLES THAT ARE ADDED
  var layoutMapping = {
    'news-feed': {
      'base': 'templates.build.cards-desc-base',
      'loop': 'templates.build.cards-desc-loop',
      'css': 'news-feed',
      'js': 'news-feed'
    },
    'card-feed': {
      'base': 'templates.build.cards-full-desc-base',
      'loop': 'templates.build.cards-full-desc-loop',
      'css': 'card-feed',
      'js': 'card-feed'
    },
    'agenda': {
      'base': 'templates.build.agenda-base',
      'loop': 'templates.build.agenda-loop',
      'other-loop': 'templates.build.agenda-date-loop',
      'css': 'agenda',
      'js': 'agenda'
    },
    'small-card': {
      'base': 'templates.build.small-card-base',
      'loop': 'templates.build.small-card-loop',
      'css': 'small-card',
      'js': 'small-card'
    },
    'horizontal-card': {
      'base': 'templates.build.horizontal-card-base',
      'loop': 'templates.build.horizontal-card-loop',
      'css': 'horizontal-card',
      'js': 'horizontal-card'
    }
  }
  
  var baseTemplateEditor;
  var loopTemplateEditor;
  var otherLoopTemplateEditor;
  var cssStyleEditor
  var javascriptEditor

  var baseTemplateCode = '';
  var loopTemplateCode = '';
  var otherLoopTemplateCode = '';
  var cssCode = '';
  var jsCode = '';

  var $dataSources = $('[name="dataSource"]');
  var defaultEntries = [
    {
      'Title': 'Welcome to the event',
      'Date': 'Mon Apr 07 2018 11:52:58 GMT+0100 (BST)',
      'Category': 'Welcome',
      'Thumbnail': 'https://cdn.fliplet.com/apps/2659/1a29147f6fc247f69498b6caf2fe7b2c047-535-2457.jpg',
      'Content': '<p>It\'s going to be a storm! We\'ve got a line-up of great speakers, social events and of course our very own prize ceremony.</p>'
    },
    {
      'Title': 'Transport to and from',
      'Date': 'Tue Apr 04 2018 11:52:58 GMT+0100 (BST)',
      'Category': 'Transport',
      'Thumbnail': 'https://cdn.fliplet.com/apps/2659/a0dd3ee6704619d292fba82dd6ec6c09062-448-5819.jpg',
      'Content': '<p>Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Nulla vitae elit libero, a pharetra augue.</p>'
    },
    {
      'Title': 'Event highlights',
      'Date': 'Mon Apr 02 2018 11:52:58 GMT+0100 (BST)',
      'Category': 'Event',
      'Thumbnail': 'https://cdn.fliplet.com/apps/2659/869c03d45f1abae359236fd2f6ac427e839-065-5941.jpg',
      'Content': '<p>Donec id elit non mi porta gravida at eget metus. Maecenas faucibus mollis interdum.</p>'
    }
  ];
  var defaultColumns = ['Title', 'Date', 'Category', 'Thumbnail', 'Content'];

  // Constructor
  function DynamicLists(configuration) {
    _this = this;

    this.config = $.extend(true, {
      sortOptions: [],
      filterOptions: [],
      social: {
        likes: false,
        bookmark: false,
        comments: false
      },
      advancedSettings: {}
    }, configuration);

    this.attachListeners();
    this.init();
  }

  DynamicLists.prototype = {
    // Public functions
    constructor: DynamicLists,

    attachListeners: function() {
      window.addEventListener('resize', _this.resizeCodeEditors);

      $(document)
        .on('click', '.layout-holder', function() {
          listLayout = $(this).data('layout');
          isLayoutSelected = true;

          $('.state.present').addClass('is-loading');
          // Create data source
          _this.createDataSourceFromLayout().then(function() {
            // Then go to settings
            _this.goToSettings();
          });
        })
        .on('click', '[data-advanced]', function() {
          _this.goToAdvanced();
        })
        .on('click', '[data-back-settings]', _this.goToSettings)
        .on('click', '#manage-data, [data-edit-datasource]', _this.manageAppData)
        .on('click', '[data-reset-default]', _this.resetToDefaults)
        .on('click', '[data-add-sort-panel]', function() {
          var item = {};
          item.id = _this.makeid(8);
          item.title = 'Sort condition ' + ($('#sort-accordion .panel').length + 1);
          item.columns = dataSourceColumns;
          _this.config.sortOptions.push(item);

          _this.addSortItem(item);
          _this.checkSortPanelLength();
        })
        .on('click', '[data-add-filter-panel]', function() {
          var item = {};
          item.id = _this.makeid(8);
          item.title = 'Filter ' + ($('#filter-accordion .panel').length + 1);
          item.columns = dataSourceColumns;
          _this.config.filterOptions.push(item);

          _this.addFilterItem(item);
          _this.checkFilterPanelLength();
        })
        .on('click', '.sort-panel .icon-delete', function() {
          var $item = $(this).closest("[data-id], .panel"),
            id = $item.data('id');

          _.remove(_this.config.sortOptions, {
            id: id
          });

          $(this).parents('.panel').remove();
          _this.checkSortPanelLength();
        })
        .on('click', '.filter-panel .icon-delete', function() {
          var $item = $(this).closest("[data-id], .panel"),
            id = $item.data('id');

          _.remove(_this.config.filterOptions, {
            id: id
          });

          $(this).parents('.panel').remove();
          _this.checkFilterPanelLength();
        })
        .on('show.bs.collapse', '.panel-collapse', function() {
          $(this).siblings('.panel-heading').find('.fa-chevron-right').removeClass('fa-chevron-right').addClass('fa-chevron-down');
        })
        .on('hide.bs.collapse', '.panel-collapse', function() {
          $(this).siblings('.panel-heading').find('.fa-chevron-down').removeClass('fa-chevron-down').addClass('fa-chevron-right');
        })
        .on('change', '.advanced-tab input[type="checkbox"]', function() {
          var input = $(this).attr('id');
          var activateWarning = 'Important\nYou will be responsible for any changes you make, and any bugs that Fliplet fixes might not be applied to your list.\n\nAre you sure you want to continue?';
          var deactivateWarning = 'Deactivating this option will revert back to use the component\'s original code.\n\nAre you sure you want to continue?';

          if ( $(this).is(":checked") && !resetToDefaults) {
            var activate = confirm(activateWarning);
            if (!activate) {
              $(this).prop('checked', false);
              return;
            }
            $('.editor-holder.' + input).removeClass('disabled');
            return;
          }

          if ( $(this).is(":checked") && resetToDefaults ) {
            $('.editor-holder.' + input).removeClass('disabled');
            return;
          }

          if ( !$(this).is(":checked") && !resetToDefaults ) {
            var deactivate = confirm(deactivateWarning);
            if (!deactivate) {
              $(this).prop('checked', true);
              return;
            }
            $('.editor-holder.' + input).addClass('disabled');
            return;
          }

          if ( !$(this).is(":checked") && resetToDefaults ) {
            $('.editor-holder.' + input).addClass('disabled');
            return;
          }
        })
        .on('change', '#enable-search', function() {
          if ( $(this).is(":checked") ) {
            $('.search-fields').removeClass('hidden');
          } else {
            $('.search-fields').addClass('hidden');
          }
        })
        .on('change', '#enable-filters', function() {
          if ( $(this).is(":checked") ) {
            $('.filter-fields').removeClass('hidden');
          } else {
            $('.filter-fields').addClass('hidden');
          }
        });

      $dataSources.on( 'change', function() {
        var selectedDataSourceId = $(this).val();
        if (selectedDataSourceId === 'none') {
          $('#manage-data').addClass('hidden');
          return;
        }
        if (selectedDataSourceId === 'new') {
          $('#manage-data').addClass('hidden');
          _this.createDataSource();
          return;
        }
        _this.getColumns(selectedDataSourceId);
      });
    },
    manageAppData: function() {
      var dataSourceId = $dataSources.val();
      if (!dataSourceId) {
        dataSourceId = newDataSource.id;
      }
      Fliplet.Studio.emit('overlay', {
        name: 'widget',
        options: {
          size: 'large',
          package: 'com.fliplet.data-sources',
          title: 'Edit Data Sources',
          classes: 'data-source-overlay',
          data: {
            context: 'overlay',
            dataSourceId: dataSourceId
          }
        }
      });
    },
    init: function() {
      //_this.getDataSources();
      _this.loadData();
      _this.initializeSortSortable();
      _this.setupCodeEditors();
    },
    loadData: function() {
      if (!_this.config.layout) {
        Fliplet.Studio.emit('widget-mode', 'wide');
      } else {
        // Load data source
        _this.changeCreateDsButton(_this.config.dataSource);

        // Load sort options
        _.forEach(_this.config.sortOptions, function(item) {
          item.fromLoading = true; // Flag to close accordions
          _this.addSortItem(item);
          item.column = $('#sort-accordion #select-data-field-' + item.id).val(item.column);
          item.sortBy = $('#sort-accordion #sort-by-field-' + item.id).val(item.sortBy);
          item.orderBy = $('#sort-accordion #order-by-field-' + item.id).val(item.orderBy);
        });
        _this.checkSortPanelLength();

        // Load filter options
        _.forEach(_this.config.filterOptions, function(item) {
          item.fromLoading = true; // Flag to close accordions
          _this.addFilterItem(item);
          $('#filter-accordion #select-data-field-' + item.id).val(item.column);
          $('#filter-accordion #logic-field-' + item.id).val(item.logic);
          $('#filter-accordion #value-field-' + item.id).val(item.value);
        });
        _this.checkFilterPanelLength();

        // Load Search/Filter fields
        $('#enable-search').prop('checked', _this.config.searchEnabled).trigger('change');
        $('#enable-filters').prop('checked', _this.config.filtersEnabled).trigger('change');

        // Load social feature
        $('#enable-likes').prop('checked', _this.config.social.likes);
        $('#enable-bookmarks').prop('checked', _this.config.social.bookmark);
        $('#enable-comments').prop('checked', _this.config.social.comments);

        // Select layout
        listLayout = _this.config.layout;
        isLayoutSelected = true;
        $('.layout-holder[data-layout="' + _this.config.layout + '"]').addClass('active');

        // Load advanced settings
        if (_this.config.advancedSettings.htmlEnabled || _this.config.advancedSettings.cssEnabled || _this.config.advancedSettings.jsEnabled) {
          $('input#enable-templates').prop('checked', _this.config.advancedSettings.htmlEnabled).trigger('change');
          $('input#enable-css').prop('checked', _this.config.advancedSettings.cssEnabled).trigger('change');
          $('input#enable-javascript').prop('checked', _this.config.advancedSettings.jsEnabled).trigger('change');
          _this.goToAdvanced();
          return;
        }

        _this.goToSettings();
      }

      setTimeout(function() {
        $('.state').removeClass('loading');  
      }, 300);
    },
    loadTokenFields: function() {
      if (_this.config.searchEnabled) {
        $('#search-column-fields-tokenfield').tokenfield('setTokens', _this.config.searchFields );
      }
      
      if (_this.config.filtersEnabled) {
        $('#filter-column-fields-tokenfield').tokenfield('setTokens', _this.config.filterFields );
      }
    },
    goToSettings: function() {
      var countOfPanels = $('.state').length;
      var indexOfActive = $('.state.present').index();

      if (indexOfActive === 0) {
        $('.state.present').removeClass('present').addClass('past');
        $('.settings-tab').removeClass('future').addClass('present');
      }

      if (indexOfActive === countOfPanels - 1) {
        $('.state.present').removeClass('present').addClass('future');
        $('.settings-tab').removeClass('past').addClass('present');
      }

      Fliplet.Studio.emit('widget-mode', 'normal');
      if (listLayout === 'agenda') {
        $('.date-loop-item').removeClass('hidden');
      }
      _this.setupCodeEditors(listLayout);
    },
    goToAdvanced: function() {
      $('.state.present').removeClass('present').addClass('past');
      $('.settings-tab').removeClass('future').addClass('past');
      $('.advanced-tab').removeClass('future').addClass('present');
      _this.setupCodeEditors(listLayout);

      Fliplet.Studio.emit('widget-mode', 'wide');
    },
    setUpTokenFields: function() {
      $('.search-fields').html(tokenField({
        name: 'search-column-fields',
        id: 'search-column-fields-tokenfield'
      }));
      $('#search-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: dataSourceColumns,
          delay: 100
        },
        showAutocompleteOnFocus: true
      });
      $('.filter-fields').html(tokenField({
        name: 'filter-column-fields',
        id: 'filter-column-fields-tokenfield'
      }));
      $('#filter-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: dataSourceColumns,
          delay: 100
        },
        showAutocompleteOnFocus: true
      });

      _this.loadTokenFields();
    },
    getColumns: function(dataSourceId) {
      if (dataSourceId && dataSourceId !== '') {
        Fliplet.DataSources.getById(dataSourceId, {
          cache: false
        }).then(function (dataSource) {
          dataSourceColumns = dataSource.columns;
          _this.setUpTokenFields();
        });
      }
    },
    reloadDataSources: function(dataSourceId) {
      return Fliplet.DataSources.get({
        type: null
      }, {
        cache: false
      }).then(function(results) {
        allDataSources = results;
        $dataSources.html('<option value="none">-- Select a data source</option><option disabled>------</option><option value="new">Create a new data source</option><option disabled>------</option>');
        allDataSources.forEach(function (d) {
          $dataSources.append('<option value="' + d.id + '">' + d.name + '</option>');
        });

        if (dataSourceId) {
          $dataSources.val(dataSourceId);
        }
        $dataSources.trigger('change');
      });
    },
    getDataSources: function() {
      // Load the data source
      Fliplet.DataSources.get({
        organizationId: organizationId
      }).then(function (dataSources) {
        allDataSources = dataSources;
        dataSources.forEach(function (d) {
          $dataSources.append('<option value="' + d.id + '">' + d.name + '</option>');
        });

        if (widgetData.data && widgetData.data.dataSourceId) {
          $dataSources.val(widgetData.data.dataSourceId);
        }
        $dataSources.trigger('change');

        $dataSources.prop('disabled', '');
      });
    },
    createDataSource: function() {
      event.preventDefault();
      var name = prompt('Please type a name for your data source:', appName + ' - ' + pageTitle);

      if (name === null) {
        $('#manage-data').addClass('hidden');
        $dataSources.val('none').trigger('change');
        return;
      }

      if (name === '') {
        $('#manage-data').addClass('hidden');
        $dataSources.val('none').trigger('change');
        alert('You must enter a data source name');
        return;
      }

      Fliplet.DataSources.create({
        name: name,
        organizationId: organizationId,
        entries: defaultEntries,
        columns: defaultColumns,
        definition: {'bundleImages': true}
      }).then(function(ds) {
        allDataSources.push(ds);
        $dataSources.append('<option value="' + ds.id + '">' + ds.name + '</option>');
        $dataSources.val(ds.id).trigger('change');
      });
    },
    createDataSourceFromLayout: function() {
      var name = appName + ' - Advanced List';

      return Fliplet.DataSources.create({
        name: name,
        organizationId: organizationId,
        entries: defaultEntries,
        columns: defaultColumns,
        definition: {'bundleImages': true}
      }).then(function(ds) {
        allDataSources.push(ds);
        _this.changeCreateDsButton(ds);
        return ds;
      });
    },
    changeCreateDsButton: function(dataSource) {
      newDataSource = dataSource;
      _this.getColumns(dataSource.id);

      $('.selected-datasource span').html(dataSource.name);
      $('.create-holder').addClass('hidden');
      $('.edit-holder').removeClass('hidden');
      $('.form-group').removeClass('disabled');
    },
    checkSortPanelLength: function() {
      if ($('#sort-accordion .panel').length) {
        $('.sort-panels-holder').removeClass('empty');
      } else {
        $('.sort-panels-holder').addClass('empty');
      }
    },
    checkFilterPanelLength: function() {
      if ($('#filter-accordion .panel').length) {
        $('.filter-panels-holder').removeClass('empty');
      } else {
        $('.filter-panels-holder').addClass('empty');
      }
    },
    makeid: function(length) {
      var text = "";
      var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

      return text;
    },
    addSortItem: function(data) {
      var $newPanel = $(sortPanelTemplate(data));
      $sortAccordionContainer.append($newPanel);
    },
    addFilterItem: function(data) {
      var $newPanel = $(filterPanelTemplate(data));
      $filterAccordionContainer.append($newPanel);
    },
    initializeSortSortable: function() {
      $('#sort-accordion').sortable({
        handle: ".panel-heading",
        cancel: ".icon-delete",
        tolerance: 'pointer',
        revert: 150,
        placeholder: 'panel panel-default placeholder tile',
        cursor: '-webkit-grabbing; -moz-grabbing;',
        axis: 'y',
        start: function(event, ui) {
          var itemId = $(ui.item).data('id');

          $('.panel-collapse.in').collapse('hide');
          ui.item.addClass('focus').css('height', ui.helper.find('.panel-heading').outerHeight() + 2);
          $('.panel').not(ui.item).addClass('faded');
        },
        stop: function(event, ui) {
          var itemId = $(ui.item).data('id');
          var movedItem = _.find(_this.config.sortOptions, function(item) {
            return item.id === itemId;
          });

          ui.item.removeClass('focus');

          var sortedIds = $("#sort-accordion").sortable("toArray", {
            attribute: 'data-id'
          });
          _this.config.sortOptions = _.sortBy(_this.config.sortOptions, function(item) {
            return sortedIds.indexOf(item.id);
          });
          $('.panel').not(ui.item).removeClass('faded');
        },
        sort: function(event, ui) {
          $('#sort-accordion').sortable('refresh');
        }
      });
    },
    initializeFilterSortable: function() {
      $('#filter-accordion').sortable({
        handle: ".panel-heading",
        cancel: ".icon-delete",
        tolerance: 'pointer',
        revert: 150,
        placeholder: 'panel panel-default placeholder tile',
        cursor: '-webkit-grabbing; -moz-grabbing;',
        axis: 'y',
        start: function(event, ui) {
          var itemId = $(ui.item).data('id');

          $('.panel-collapse.in').collapse('hide');
          ui.item.addClass('focus').css('height', ui.helper.find('.panel-heading').outerHeight() + 2);
          $('.panel').not(ui.item).addClass('faded');
        },
        stop: function(event, ui) {
          var itemId = $(ui.item).data('id');
          var movedItem = _.find(_this.config.filterOptions, function(item) {
            return item.id === itemId;
          });

          ui.item.removeClass('focus');

          var sortedIds = $("#filter-accordion").sortable("toArray", {
            attribute: 'data-id'
          });
          _this.config.filterOptions = _.sortBy(_this.config.filterOptions, function(item) {
            return sortedIds.indexOf(item.id);
          });
          $('.panel').not(ui.item).removeClass('faded');
        },
        sort: function(event, ui) {
          $('#filter-accordion').sortable('refresh');
        }
      });
    },
    getSelectedRange: function(editor) {
      return {
        from: editor.getCursor(true),
        to: editor.getCursor(false)
      }
    },
    autoFormatSelection: function(editor) {
      if (editor && typeof editor === 'boolean') {
        if (baseTemplateEditor) {
          var totalLinesBaseTemplateEditor = baseTemplateEditor.lineCount()
          var totalCharsBaseTemplateEditor = baseTemplateEditor.getTextArea().value.length
          baseTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesBaseTemplateEditor, ch: totalCharsBaseTemplateEditor }
          )
          // Remove selection
          baseTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          )
        }

        if (loopTemplateEditor) {
          var totalLinesLoopTemplateEditor = loopTemplateEditor.lineCount()
          var totalCharsLoopTemplateEditor = loopTemplateEditor.getTextArea().value.length
          loopTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesLoopTemplateEditor, ch: totalCharsLoopTemplateEditor }
          )
          // Remove selection
          loopTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          )
        }

        if (otherLoopTemplateEditor) {
          var totalLinesOtherLoopTemplateEditor = otherLoopTemplateEditor.lineCount()
          var totalCharsOtherLoopTemplateEditor = otherLoopTemplateEditor.getTextArea().value.length
          otherLoopTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesOtherLoopTemplateEditor, ch: totalCharsOtherLoopTemplateEditor }
          )
          // Remove selection
          otherLoopTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          )
        }
        return
      }

      const range = _this.getSelectedRange(editor)
      editor.autoFormatRange(range.from, range.to)
      // Remove selection
      editor.setSelection(
        { line: 0, ch: 0 },
        { line: 0, ch: 0 }
      )
    },
    commentSelection: function(editor) {
      var range = _this.getSelectedRange(editor)
      editor.commentRange(true, range.from, range.to)
    },
    removeCommentSelection: function(editor) {
      var range = _this.getSelectedRange(editor)
      editor.commentRange(false, range.from, range.to)
    },
    codeMirrorConfig: function(mode) {
      return {
        mode,
        lineNumbers: true,
        autoRefresh: true,
        lineWrapping: true,
        tabSize: 2,
        matchBrackets: true,
        styleActiveLine: true,
        foldGutter: true,
        gutters: ['CodeMirror-lint-markers', 'CodeMirror-foldgutter'],
        extraKeys: {
          'Cmd-B': _this.autoFormatSelection,
          'Cmd-/': _this.commentSelection,
          'Cmd-;': _this.removeCommentSelection,
          'Ctrl-/': _this.commentSelection,
          'Ctrl-;': _this.removeCommentSelection
        }
      }
    },
    getCodeEditorData: function(selectedLayout) {
      var basePromise = new Promise(function(resolve) {
        var baseTemplateCompiler;
        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].base) {
          baseTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout].base];
        }
        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.baseHTML !== 'undefined') {
          baseTemplateCode = _this.config.advancedSettings.baseHTML;
        } else if (typeof baseTemplateCompiler !== 'undefined') {
          baseTemplateCode = baseTemplateCompiler();
        } else {
          baseTemplateCode = '';
        }

        resolve();
      });

      var loopPromise = new Promise(function(resolve) {
        var loopTemplateCompiler;
        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].loop) {
          loopTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout].loop];
        }
        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.loopHTML !== 'undefined') {
          loopTemplateCode = _this.config.advancedSettings.loopHTML;
        } else if (typeof loopTemplateCompiler !== 'undefined') {
          loopTemplateCode = loopTemplateCompiler();
        } else {
          loopTemplateCode = '';
        }

        resolve();
      });

      var otherLoopPromise = new Promise(function(resolve) {
        var otherLoopTemplateCompiler;
        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout]['other-loop']) {
          otherLoopTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout]['other-loop']];
        }
        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.otherLoopHTML !== 'undefined') {
          otherLoopTemplateCode = _this.config.advancedSettings.otherLoopHTML;
        } else if (typeof otherLoopTemplateCompiler !== 'undefined') {
          otherLoopTemplateCode = otherLoopTemplateCompiler();
        } else {
          otherLoopTemplateCode = '';
        }

        resolve();
      });

      if (_this.config.advancedSettings.cssEnabled && typeof _this.config.advancedSettings.cssCode !== 'undefined') {
        cssCode = _this.config.advancedSettings.cssCode;
      } else if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].css) {
        var cssUrl = $('[data-' + layoutMapping[selectedLayout].css + '-css-url]').data(layoutMapping[selectedLayout].css + '-css-url');
        var cssPromise = Fliplet.API.request('v1/communicate/proxy/' + cssUrl).then(function(response) {
          cssCode = response;
          return;
        });
      }

      if (_this.config.advancedSettings.jsEnabled && typeof _this.config.advancedSettings.jsCode !== 'undefined') {
        jsCode = _this.config.advancedSettings.jsCode;
      } else if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].js) {
        var jsUrl = $('[data-' + layoutMapping[selectedLayout].js + '-js-url]').data(layoutMapping[selectedLayout].js + '-js-url');
        var jsPromise = Fliplet.API.request('v1/communicate/proxy/' + jsUrl).then(function(response) {
          jsCode = response;
          return;
        });
      }

      return Promise.all([basePromise, loopPromise, otherLoopPromise, cssPromise, jsPromise]);
    },
    setupCodeEditors: function(selectedLayout) {
      var baseTemplate = document.getElementById('base-template');
      var baseTemplateType = $(baseTemplate).data('type');
      var loopTemplate = document.getElementById('loop-template');
      var loopTemplateType = $(loopTemplate).data('type');
      var otherLoopTemplate = document.getElementById('other-loop-template');
      var otherLoopTemplateType = $(otherLoopTemplate).data('type');
      var cssStyle = document.getElementById('css-styles');
      var cssStyleType = $(cssStyle).data('type');
      var javascript = document.getElementById('js-code');
      var javascriptType = $(javascript).data('type');

      _this.getCodeEditorData(selectedLayout).then(function() {
        var baseTemplatePromise = new Promise(function(resolve) {
          if (baseTemplateEditor) {
            baseTemplateEditor.getDoc().setValue(baseTemplateCode);
          } else if (baseTemplate) {
            baseTemplateEditor = CodeMirror.fromTextArea(
              baseTemplate,
              _this.codeMirrorConfig(baseTemplateType)
            )
            baseTemplateEditor.on('change', function() {
              // Do stuff
            });
          }

          if (baseTemplateEditor) {
            resolve();
          }
        });

        var loopTemplatePromise = new Promise(function(resolve) {
          if (loopTemplateEditor) {
            loopTemplateEditor.getDoc().setValue(loopTemplateCode);
          } else if (loopTemplate) {
            loopTemplateEditor = CodeMirror.fromTextArea(
              loopTemplate,
              _this.codeMirrorConfig(loopTemplateType)
            )
            loopTemplateEditor.on('change', function() {
              // Do stuff
            });
          }

          if (loopTemplateEditor) {
            resolve();
          }
        });

        var otherLoopTemplatePromise = new Promise(function(resolve) {
          if (otherLoopTemplateEditor) {
            otherLoopTemplateEditor.getDoc().setValue(otherLoopTemplateCode);
          } else if (otherLoopTemplate) {
            otherLoopTemplateEditor = CodeMirror.fromTextArea(
              otherLoopTemplate,
              _this.codeMirrorConfig(otherLoopTemplateType)
            )
            otherLoopTemplateEditor.on('change', function() {
              // Do stuff
            });
          }

          if (otherLoopTemplateEditor) {
            resolve();
          }
        });

        var cssStylePromise = new Promise(function(resolve) {
          if (cssStyleEditor) {
            cssStyleEditor.getDoc().setValue(cssCode);
          } else if (cssStyle) {
            cssStyleEditor = CodeMirror.fromTextArea(
              cssStyle,
              _this.codeMirrorConfig(cssStyleType)
            )
            cssStyleEditor.on('change', function() {
              // Do stuff
            });
          }

          if (cssStyleEditor) {
            resolve();
          }
        });

        var javascriptPromise = new Promise(function(resolve) {
          if (javascriptEditor) {
            javascriptEditor.getDoc().setValue(jsCode);
          } else if (cssStyle) {
            javascriptEditor = CodeMirror.fromTextArea(
              javascript,
              _this.codeMirrorConfig(javascriptType)
            )
            javascriptEditor.on('change', function() {
              // Do stuff
            });
          }

          if (javascriptEditor) {
            resolve();
          }
        });

        Promise.all([baseTemplatePromise, loopTemplatePromise, otherLoopTemplatePromise, cssStylePromise, javascriptPromise])
          .then(function() {
            _this.resizeCodeEditors();
          });
      });
    },
    resizeCodeEditors: function() {
      var baseContentHeight = $('.advanced-tab .alert').outerHeight(true) + $('.advanced-tab .checkbox').outerHeight(true) - 10 + $('.advanced-tabs-level-one').outerHeight(true) + $('.advanced-tabs-level-two').outerHeight(true);
      var contentHeight = $('.advanced-tab .alert').outerHeight(true) + $('.advanced-tab .checkbox').outerHeight(true) - 10 + $('.advanced-tabs-level-one').outerHeight(true);
      var containerHeight = $('.advanced-tab .state-wrapper').height();
      var baseDiff = (containerHeight - baseContentHeight) / 1;
      var diff = (containerHeight - contentHeight) / 1;

      setTimeout(function() {
        $('#templates .CodeMirror').each(function(idx, el) {
          $(el).css({
            'height': baseDiff
          });
        });
        $('#css .CodeMirror, #javascript .CodeMirror').each(function(idx, el) {
          $(el).css({
            'height': diff
          });
        });
      }, 1);
    },
    resetToDefaults: function() {
      var confirmationDialog = confirm('You will lose all the changes you made.\n\nAre you sure you want to continue?');
      if (!confirmationDialog) {
        return;
      }

      resetToDefaults = true;
      $('input#enable-templates').prop('checked', false).trigger('change');
      $('input#enable-css').prop('checked', false).trigger('change');
      $('input#enable-javascript').prop('checked', false).trigger('change');
      _this.config.advancedSettings = {};
      _this.getCodeEditorData(listLayout);
      resetToDefaults = false;
    },
    saveLists: function() {
      var data = {};
      data.advancedSettings = {};

      data.layout = listLayout;
      data.dataSource = newDataSource;
      data.dataSourceId = newDataSource.id;

      // Get sorting options
      _.forEach(_this.config.sortOptions, function(item) {
        item.column = $('#sort-accordion #select-data-field-' + item.id).val();
        item.sortBy = $('#sort-accordion #sort-by-field-' + item.id).val();
        item.orderBy = $('#sort-accordion #order-by-field-' + item.id).val();
      });

      // Get filter options
      _.forEach(_this.config.filterOptions, function(item) {
        item.column = $('#filter-accordion #select-data-field-' + item.id).val();
        item.logic = $('#filter-accordion #logic-field-' + item.id).val();
        item.value = $('#filter-accordion #value-field-' + item.id).val();
      });

      data.sortOptions = _this.config.sortOptions;
      data.filterOptions = _this.config.filterOptions;

      // Get search and filter
      data.searchEnabled = $('#enable-search').is(":checked");
      data.filtersEnabled = $('#enable-filters').is(":checked");
      data.searchFields = typeof $('#search-column-fields-tokenfield').val() !== 'undefined' ?
        $('#search-column-fields-tokenfield').val().split(',').map(function(x){ return x.trim(); }) : [];
      data.filterFields = typeof $('#filter-column-fields-tokenfield').val()  !== 'undefined' ?
        $('#filter-column-fields-tokenfield').val().split(',').map(function(x){ return x.trim(); }) : [];

      // Get social feature
      _this.config.social.likes = $('#enable-likes').is(":checked");
      _this.config.social.bookmark = $('#enable-bookmarks').is(":checked");
      _this.config.social.comments = $('#enable-comments').is(":checked");
      data.social = _this.config.social;

      // Advanced Settings
      var advancedInUse;
      data.advancedSettings.htmlEnabled = $('input#enable-templates').is(":checked");
      data.advancedSettings.cssEnabled = $('input#enable-css').is(":checked");
      data.advancedSettings.jsEnabled = $('input#enable-javascript').is(":checked");
      
      if (data.advancedSettings.htmlEnabled) {
        data.advancedSettings.loopHTML = loopTemplateEditor.getValue();
        data.advancedSettings.baseHTML = baseTemplateEditor.getValue();
        if (data.layout === 'agenda') {
          _this.config.advancedSettings.otherLoopHTML = otherLoopTemplateEditor.getValue();
        }
      }

      if (data.advancedSettings.cssEnabled) {
        data.advancedSettings.cssCode = cssStyleEditor.getValue();
      }

      if (data.advancedSettings.jsEnabled) {
        data.advancedSettings.jsCode = javascriptEditor.getValue();
      }

      _this.config = data;
    },
    deleteDataSource: function(id) {
      return Fliplet.DataSources.delete(id);
    },
    getCurrentDataSource: function() {
      return newDataSource;
    }
  }

  return DynamicLists;
})();