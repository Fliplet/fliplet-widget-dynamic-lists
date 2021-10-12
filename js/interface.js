// eslint-disable-next-line no-unused-vars
var DynamicLists = (function() {
  var _this;

  var organizationId = Fliplet.Env.get('organizationId');
  var appName = Fliplet.Env.get('appName');
  var dataSourceProvider = null;
  var userDataSourceProvider = null;
  var listLayout;
  var allDataSources = [];
  var newDataSource;
  var dataSourceColumns;
  var userDataSourceColumns;
  var resetToDefaults = false;
  var fromStart;
  var accessRules = [
    {
      allow: 'all',
      type: [
        'select'
      ]
    }
  ];

  var $filterAccordionContainer = $('#filter-accordion');
  var $sortAccordionContainer = $('#sort-accordion');
  var filterPanelTemplate = Fliplet.Widget.Templates['templates.interface.filter-panels'];
  var sortPanelTemplate = Fliplet.Widget.Templates['templates.interface.sort-panels'];
  var $summaryRowContainer = $('.summary-table-panels-holder');
  var summaryRowTemplate = Fliplet.Widget.Templates['templates.interface.summary-view-panels'];
  var $detailsRowContainer = $('.detail-table-panels-holder');
  var detailsRowTemplate = Fliplet.Widget.Templates['templates.interface.detail-view-panels'];
  var tokenField = Fliplet.Widget.Templates['templates.interface.field-token'];

  // ADD NEW MAPPING FOR ALL NEW STYLES THAT ARE ADDED
  var layoutsTemplate = Fliplet.Widget.Templates['templates.interface.layouts'];
  var listLayouts = window.flWidgetLayout;
  var layoutMapping = window.flLayoutMapping;

  var baseTemplateEditor;
  var loopTemplateEditor;
  var searchResultsTemplateEditor;
  var detailTemplateEditor;
  var filterLoopTemplateEditor;
  var otherLoopTemplateEditor;
  var templateEditors = {};
  var cssStyleEditor;
  var javascriptEditor;

  var baseTemplateCode = '';
  var loopTemplateCode = '';
  var searchResultsTemplateCode = '';
  var detailTemplateCode = '';
  var filterLoopTemplateCode = '';
  var otherLoopTemplateCode = '';
  var cssCode = '';
  var jsCode = '';

  var $dataSources = $('#select_datasource');
  var $newUserDataSource = $('#select_user_datasource');
  var defaultSettings = window.flListLayoutConfig;
  var defaultColumns = window.flListLayoutTableColumnConfig;
  var defaultEntries = window.flListLayoutTableConfig;

  // Constructor
  function DynamicLists(configuration) {
    _this = this;

    _this.config = $.extend(true, {
      sortOptions: [],
      filterOptions: [],
      detailViewOptions: [],
      social: {},
      advancedSettings: {}
    }, configuration);

    _this.widgetId = configuration.id;
    _this.isLoaded = false;

    _this.attachListeners();
    _this.init();

    Fliplet.Registry.set('datasource-provider', function() {
      return dataSourceProvider;
    });
  }

  function initDataSourceProvider(currentDataSourceId) {
    if (dataSourceProvider) {
      return;
    }

    var dataSourceData = {
      dataSourceTitle: 'Your list data',
      dataSourceId: currentDataSourceId,
      appId: Fliplet.Env.get('appId'),
      default: {
        name: appName + ' - ' + layoutMapping[listLayout].name,
        definition: {
          bundleImages: true
        },
        entries: defaultEntries[listLayout],
        columns: defaultColumns[listLayout]
      },
      accessRules: accessRules
    };
    var $document = $(document);

    dataSourceProvider = Fliplet.Widget.open('com.fliplet.data-source-provider', {
      selector: '#dataSourceProvider',
      data: dataSourceData,
      onEvent: function(event, dataSource) {
        if (event === 'dataSourceSelect') {
          _this.config.dataSourceId = dataSource.id;

          if (dataSource.columns) {
            dataSourceColumns = dataSource.columns;
            _this.updateSummaryRowContainer();
            _this.updateDetailsRowContainer();
            _this.renderSortColumns();
            _this.renderFilterColumns();
            _this.updateFieldsWithColumns(dataSourceColumns);

            $document.trigger('datasource-selected');
          }
        }
      }
    });

    $document.trigger('datasource-initialized');
  }

  DynamicLists.prototype = {
    // Public functions
    constructor: DynamicLists,

    toggleCustomImageFields: function($row, field, type) {
      if (type === 'image' && ['none', 'custom', 'empty'].indexOf(field) === -1) {
        $row.find('.image-type-select').removeClass('hidden');
      } else {
        $row.find('.image-type-select').addClass('hidden');
      }

      if (field === 'custom') {
        $row.find('.custom-field-input').removeClass('hidden');
      } else {
        $row.find('.custom-field-input').addClass('hidden');
      }
    },

    attachListeners: function() {
      window.addEventListener('resize', _this.resizeCodeEditors);

      $(document)
        .on('click', '.layout-holder', function() {
          listLayout = $(this).data('layout');

          Fliplet.Studio.emit('page-preview-send-event', {
            type: 'dynamicListLayout',
            data: {
              layout: listLayout,
              id: _this.widgetId
            }
          });

          $('.state.present').addClass('is-loading');
          // Create data source
          _this.loadDataFromLayout()
            .then(function() {
              return _this.loadData();
            })
            .then(function() {
              _this.saveLists(true);
            });
        })
        .on('click', '[data-advanced]', function() {
          _this.goToAdvanced();
        })
        .on('click', '[data-relations-fields]', function() {
          _this.goToRelations();
        })
        .on('click', '.go-back', function() {
          var context = $(this).data('back-settings');

          _this.goToSettings(context);
        })
        .on('click', '[data-create-datasource]', _this.createDataSourceData)
        .on('click', '#manage-data, [data-edit-datasource]', _this.manageAppData)
        .on('click', '[data-reset-template]', function() {
          var id = $('.advanced-tabs-level-two li.active a').data('template-id');
          var name = $('.advanced-tabs-level-two li.active').text().trim().toLowerCase();

          _this.resetTemplate(id, name);
        })
        .on('click', '[data-reset-default]', function() {
          var buttonId = $(this).data('id');

          _this.resetToDefaults(buttonId);
        })
        .on('click', '[data-add-sort-panel]', function() {
          var item = {};

          item.id = _this.makeid(8);
          item.title = 'Sort condition ' + ($('#sort-accordion .panel').length + 1);
          item.column = 'none';
          item.sortBy = 'none';
          item.orderBy = 'none';
          item.columns = dataSourceColumns;
          _this.config.sortOptions.push(item);

          _this.addSortItem(item);
          _this.checkSortPanelLength();
        })
        .on('change', '.sort-panels-holder select', function() {
          var value = $(this).val();
          var type = $(this).data('field');

          if (type === 'field') {
            $(this).parents('.sort-panel').find('.panel-title-text .column').html(value === 'none' ? '(Field)' : value);
          }

          if (type === 'sort') {
            $(this).parents('.sort-panel').find('.panel-title-text .sort-by').html(value === 'none' ? '(Sort)' : value);
          }

          if (type === 'order') {
            $(this).parents('.sort-panel').find('.panel-title-text .order-by').html(value === 'none' ? '(Order)' : value);
          }
        })
        .on('click', '[data-add-filter-panel]', function() {
          var item = {};

          item.id = _this.makeid(8);
          item.column = 'none';
          item.logic = '==';
          item.value = '';
          item.valueField = 'Value';
          item.valueType = 'enter-value';
          item.dateValue = 'today';
          item.useDeviceTimezone = false;
          item.columns = dataSourceColumns;
          _this.config.filterOptions.push(item);

          _this.addFilterItem(item);
          _this.checkFilterPanelLength();
        })
        .on('change', '.filter-panels-holder select', function() {
          var value = $(this).val();
          var type = $(this).data('field');
          var $selector = $(this).parents('.filter-panel');
          var id = $(this).attr('filter-item-id');
          var $dateField = $('#date-field-' + id).val();
          var $dateFieldFrom = $('#date-from-' + id).val();
          var $dateFieldTo = $('#date-to-' + id).val();

          switch (type) {
            case 'field':
              $selector.find('.panel-title-text .column').html(value === 'none' ? '(Field)' : value);
              break;

            case 'date':
              $('#date-number-default-' + id).toggleClass('hidden', _this.showOffsetField($dateField));
              $('#enable-timezone-default-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField(value));
              break;

            case 'date-from':
              $('#date-number-from-' + id).toggleClass('hidden', _this.showOffsetField($dateFieldFrom));
              $('#enable-timezone-from-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField(value));
              break;

            case 'date-to':
              $('#date-number-to-' + id).toggleClass('hidden', _this.showOffsetField($dateFieldTo));
              $('#enable-timezone-to-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField(value));
              break;

            case 'logic':
              var hideValueFields = _this.showValueFields(value);
              var isDateLogic  = ['dateis', 'datebefore', 'dateafter'].indexOf(value) !== -1;
              var isBetween = value === 'between';
              var isDateBetween = value === 'datebetween';

              $('#filter-value-' + id).toggleClass('hidden', hideValueFields);
              $('#filter-value-type-' + id).toggleClass('hidden', hideValueFields);

              $('#logic-comparison-' + id).toggleClass('hidden', !isBetween);
              $('#date-logic-' + id).toggleClass('hidden', !isDateLogic );
              $('#date-between-' + id).toggleClass('hidden', !isDateBetween);

              if (isDateBetween) {
                $('#date-number-default-' + id).toggleClass('hidden', _this.showOffsetField($dateField));
                $('#date-number-from-' + id).toggleClass('hidden', _this.showOffsetField($dateFieldFrom));
                $('#date-number-to-' + id).toggleClass('hidden', _this.showOffsetField($dateFieldTo));
              }

              $('#enable-timezone-default-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField($dateField));
              $('#enable-timezone-from-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField($dateFieldFrom));
              $('#enable-timezone-to-' + id).parents('.checkbox').toggleClass('hidden', !_this.showTimezoneField($dateFieldTo));

              break;

            case 'valueType':
              $('#filter-value-' + id + ' label').html(value !== 'enter-value' ? ' Value for (required)' : 'Value');
              break;

            default:
              break;
          }
        })
        .on('keyup', '.filter-panels-holder input', function() {
          var value = $(this).val();
          var type = $(this).data('field');

          if (type === 'value') {
            $(this).parents('.filter-panel').find('.panel-title-text .value').html(value === '' ? '(Value)' : value);
          }
        })
        .on('click', '.sort-panel .icon-delete', function() {
          var $item = $(this).closest('[data-id], .panel');
          var id = $item.data('id');

          _.remove(_this.config.sortOptions, {
            id: id
          });

          $(this).parents('.panel').remove();
          _this.checkSortPanelLength();
        })
        .on('click', '.filter-panel .icon-delete', function() {
          var $item = $(this).closest('[data-id], .panel');
          var id = $item.data('id');

          _.remove(_this.config.filterOptions, {
            id: id
          });

          $(this).parents('.panel').remove();
          _this.checkFilterPanelLength();
        })
        .on('show.bs.collapse', '.panel-collapse, .permissions-collapse, .social-collapse', function() {
          $(this).siblings('.panel-heading').find('.fa-chevron-down').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        })
        .on('hide.bs.collapse', '.panel-collapse, .permissions-collapse, .social-collapse', function() {
          $(this).siblings('.panel-heading').find('.fa-chevron-up').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        })
        .on('shown.bs.tab', '#templates a[data-toggle="tab"]', function(event) {
          $('#reset-template-name').html(event.target.innerHTML.trim().toLowerCase());
          $('[data-reset-template]').removeClass('hidden');
          $('[data-reset-template-success]').addClass('hidden');
        })
        .on('change', '.advanced-tab input[type="checkbox"]', function() {
          var $input = $(this);
          var inputId = $(this).attr('id');

          if (!$(this).is(':checked')) {
            $('[data-id="' + inputId + '"]').addClass('hidden');
            $('.editor-holder.' + inputId).addClass('disabled');

            return;
          }

          var listTemplate = $('.advanced-tabs-level-two li.active').text().trim().toLowerCase();

          if (!resetToDefaults) {
            Fliplet.Modal.confirm({
              title: 'Important',
              message: '<p>With this option enabled you will take responsibility for maintaining the code. If Fliplet updates the component, those changes might not be applied to your component.<br><br><strong>You can always revert back to the original components code.</strong></p><p>Are you sure you want to continue?</p>'
            }).then(function(result) {
              if (!result) {
                $input.prop('checked', false);

                return;
              }

              $('#reset-template-name').html(listTemplate);

              $('[data-id="' + inputId + '"]').removeClass('hidden');
              $('.editor-holder.' + inputId).removeClass('disabled');
            });

            return;
          }

          $('#reset-template-name').html(listTemplate);

          $('[data-id="' + inputId + '"]').removeClass('hidden');
          $('.editor-holder.' + inputId).removeClass('disabled');
        })
        .on('change', '#enable-search', function() {
          if ($(this).is(':checked')) {
            $('.search-fields').removeClass('hidden');
            $('#search-column-fields-tokenfield').tokenfield('update');
          } else {
            $('.search-fields').addClass('hidden');
          }
        })
        .on('change', '#enable-sort', function() {
          if ($(this).is(':checked')) {
            $('.sort-fields').removeClass('hidden');
            $('#sort-column-fields-tokenfield').tokenfield('update');
          } else {
            $('.sort-fields').addClass('hidden');
          }
        })
        .on('change', '#enable-filters', function() {
          if ($(this).is(':checked')) {
            $('.filter-fields').removeClass('hidden');
            $('.filter-in-overlay').removeClass('hidden');
            $('#filter-column-fields-tokenfield').tokenfield('update');
          } else {
            $('.filter-fields').addClass('hidden');
            $('#enable-filter-overlay').prop('checked', false);
            $('.filter-in-overlay').addClass('hidden');
          }
        })
        .on('change', '#enable-poll', function() {
          $(this).parents('.checkbox').find('.hidden-settings')[$(this).is(':checked') ? 'addClass' : 'removeClass']('active');
        })
        .on('change', '#enable-survey', function() {
          $(this).parents('.checkbox').find('.hidden-settings')[$(this).is(':checked') ? 'addClass' : 'removeClass']('active');
        })
        .on('change', '#enable-questions', function() {
          $(this).parents('.checkbox').find('.hidden-settings')[$(this).is(':checked') ? 'addClass' : 'removeClass']('active');
        })
        .on('change', '#enable-comments', function() {
          _this.config.social.comments = $(this).is(':checked');

          _this.initUserDatasourceProvider(_this.config.userDataSourceId, _this.config.social.comments);
          $('.select-user-photo-holder').toggleClass('hidden', !_this.config.social.comments);
        })
        .on('change', '[name="select_user_photo"]', function() {
          var value = $(this).val();

          if (value === 'none') {
            $('.select-photo-folder-type').addClass('hidden');
          } else {
            $('.select-photo-folder-type').removeClass('hidden');
          }
        })
        .on('change', '[name="select_user_folder_type"]', function() {
          var value = $(this).val();

          if (value === 'all-folders') {
            $('.select-photo-folder').removeClass('hidden');
          } else {
            $('.select-photo-folder').addClass('hidden');
          }
        })
        .on('change', '[name="list-control"]', function() {
          _this.updatePermission('list');
        })
        .on('change', '[name="add-permissions"]', function() {
          _this.updatePermission('add');
        })
        .on('change', '[name="edit-permissions"]', function() {
          _this.updatePermission('edit');
        })
        .on('change', '[name="delete-permissions"]', function() {
          _this.updatePermission('delete');
        })
        .on('change', '[name="detail-view-action"]', function() {
          var value = $('[name="detail-view-action"]:checked').val();

          if (value === 'show') {
            $('.detail-view-table').removeClass('hidden');
            $('.detail-link-action').addClass('hidden');
          } else {
            $('.detail-view-table').addClass('hidden');
            $('.detail-link-action').removeClass('hidden');
          }
        })
        .on('change', '[name="summary_select_field"], [name="detail_select_field"]', function() {
          var field = $(this).val();
          var $row = $(this).parents('.rTableRow');
          var type = $row.find('[name="summary_field_type"], [name="detail_field_type"]').val();

          _this.toggleCustomImageFields($row, field, type);
        })
        .on('change', '[name="summary_field_type"], [name="detail_field_type"]', function() {
          var type = $(this).val();
          var $row = $(this).parents('.rTableRow');
          var field = $row.find('[name="summary_select_field"], [name="detail_select_field"]').val();

          _this.toggleCustomImageFields($row, field, type);
        })
        .on('change', '[name="select_field_label"]', function() {
          var value = $(this).val();

          if (value === 'custom-label') {
            $(this).parents('.rTableRow').find('.custom-label-input').removeClass('hidden');
          } else {
            $(this).parents('.rTableRow').find('.custom-label-input').addClass('hidden');
          }
        })
        .on('change', '[name="image_type_select"]', function() {
          var dataType = $(this).val();

          switch (dataType) {
            case 'all-folders':
              $(this).parents('.rTableRow')
                .find('.picker-provider-button, .folders-only').removeClass('hidden').end()
                .find('.url-only').addClass('hidden');
              break;
            case 'url':
              $(this).parents('.rTableRow')
                .find('.picker-provider-button, .folders-only').addClass('hidden').end()
                .find('.url-only').removeClass('hidden');
              break;
            default:
              $(this).parents('.rTableRow')
                .find('.picker-provider-button, .url-only').addClass('hidden').end()
                .find('.folders-only').removeClass('hidden');
          }
        })
        .on('click', '.rTableCell.delete', function() {
          var fieldId = $(this).parents('.rTableRow').data('id');
          var $row = $(this).parents('.rTableRow');

          _.remove(_this.config.detailViewOptions, function(option) {
            return option.id === fieldId;
          });

          $row.remove();
        })
        .on('click', '.add-data-field', function() {
          var item = {
            id: _this.makeid(8),
            columns: dataSourceColumns,
            column: 'none',
            type: 'text',
            fieldLabel: 'column-name',
            editable: true
          };

          _this.config.detailViewOptions.push(item);
          item = _this.updateWithFoldersInfo(item, 'details');
          _this.addDetailItem(item);
        });

      $dataSources.on( 'change', function() {
        var selectedDataSourceId = $(this).val();

        if (selectedDataSourceId === 'none') {
          return;
        }

        if (selectedDataSourceId === 'new') {
          $('.create-holder').addClass('hidden');
          $('.edit-holder').removeClass('hidden');
          $('.select-datasource-holder').addClass('hidden');
          _this.createDataSource();

          return;
        }

        $('.create-holder').addClass('hidden');
        $('.edit-holder').removeClass('hidden');
        $('.select-datasource-holder').addClass('hidden');
        _this.getColumns(selectedDataSourceId);
      });

      $newUserDataSource.on( 'change', function() {
        var selectedDataSourceId = $(this).val();

        if (selectedDataSourceId === 'none' || selectedDataSourceId === '') {
          $('.select-user-firstname-holder').addClass('hidden');
          $('.select-user-lastname-holder').addClass('hidden');
          $('.select-user-email-holder').addClass('hidden');
          $('.select-user-photo-holder').addClass('hidden');
          $('.select-photo-folder-type').addClass('hidden');
          $('.select-user-admin-holder').addClass('hidden');

          return;
        }

        _this.getUserColumns(selectedDataSourceId);
      });

      Fliplet.Studio.onMessage(function(event) {
        if (event.data && event.data.event === 'overlay-close' && event.data.data && event.data.data.dataSourceId) {
          // Saving user data before reload interface
          _this.saveLists();
          _this.reloadDataSources().then(function(dataSources) {
            if (!_this.config.dataAlertSeen) {
              return Fliplet.Modal.confirm({
                title: 'Data changes',
                message: 'If you have updated the column names of your data table, please ensure that all your settings are selecting the right fields.',
                buttons: {
                  confirm: {
                    label: 'OK',
                    className: 'btn-primary'
                  },
                  cancel: {
                    label: 'Don\'t show this again',
                    className: 'btn-secondary'
                  }
                }
              }).then(function(result) {
                if (!result) {
                  _this.config.dataAlertSeen = true;
                }

                allDataSources = dataSources;
                _this.getColumns(_this.config.dataSourceId);
                _this.initSelect2(allDataSources);
                _this.initSecondSelect2(allDataSources);
                Fliplet.Studio.emit('reload-widget-instance', _this.widgetId);
              });
            }

            allDataSources = dataSources;
            _this.getColumns(_this.config.dataSourceId);
            _this.initSelect2(allDataSources);
            _this.initSecondSelect2(allDataSources);
            Fliplet.Studio.emit('reload-widget-instance', _this.widgetId);
          });
        }

        if (event.data === 'save-widget') {
          userDataSourceProvider.emit('validation');
        }
      });
    },
    manageAppData: function() {
      var dataSourceId = newDataSource.id;

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
    managePermissionList: function(options) {
      $('.add-entry-checkbox').find('.hidden-settings').toggleClass('active', options.isAddEntryActive);
      $('.edit-entry-checkbox').find('.hidden-settings').toggleClass('active', options.isEditEntryActive);
      $('.delete-entry-checkbox').find('.hidden-settings').toggleClass('active', options.isDeleteEntryActive);

      this.toggleRuleTypes({
        insert: options.isAddEntryActive,
        update: options.isEditEntryActive,
        delete: options.isDeleteEntryActive
      });

      if (dataSourceProvider) {
        dataSourceProvider.emit('update-security-rules', { accessRules: accessRules });
      }
    },
    showOffsetField: function(value) {
      return ['today', 'now'].indexOf(value) !== -1;
    },
    showTimezoneField: function(value) {
      return [
        'now',
        'nowaddminutes',
        'nowaddhours',
        'nowsubtractminutes',
        'nowsubtracthours'
      ].indexOf(value) !== -1;
    },
    showValueFields: function(value) {
      return [
        'empty',
        'notempty',
        'between',
        'dateis',
        'datebefore',
        'dateafter',
        'datebetween'
      ].indexOf(value) !== -1;
    },
    toggleUserEmail: function(showUserEmailList) {
      $('.select-user-email-list-holder').toggleClass('hidden', !showUserEmailList);
    },
    toggleAdminIdentification: function(showUserAdminHolder) {
      $('.select-user-admin-holder').toggleClass('hidden', !showUserAdminHolder);
    },
    updatePermission: function(permissionType) {
      var controlValues = [];

      $('[name="list-control"]:checked').each(function() {
        controlValues.push($(this).val());
      });

      var isAddEntryActive = controlValues.indexOf('add-entry') !== -1;
      var isEditEntryActive = controlValues.indexOf('edit-entry') !== -1;
      var isDeleteEntryActive = controlValues.indexOf('delete-entry') !== -1;
      var canAddEntry = $('[name="add-permissions"]:checked').val();
      var canEditEntry = $('[name="edit-permissions"]:checked').val();
      var canDeleteEntry = $('[name="delete-permissions"]:checked').val();
      var isAdminsCanAddEntry = canAddEntry === 'admins' && isAddEntryActive;
      var isAdminsCanEditEntry = (canEditEntry === 'admins' || canEditEntry === 'users-admins') && isEditEntryActive;
      var isAdminsCanDeleteEntry =
        (canDeleteEntry === 'admins' || canDeleteEntry === 'users-admins') && isDeleteEntryActive;
      var isUsersCanEditEntry = (canEditEntry === 'user' || canEditEntry === 'users-admins') && isEditEntryActive;
      var isUsersCanDeleteEntry =
        (canDeleteEntry === 'user' || canDeleteEntry === 'users-admins') && isDeleteEntryActive;
      var showUserEmailList = isUsersCanEditEntry || isUsersCanDeleteEntry;
      var showUserAdminHolder = isAdminsCanAddEntry
        || isAdminsCanEditEntry
        || isAdminsCanDeleteEntry;
      var showUsersDataSource = isAdminsCanAddEntry
        || isAdminsCanEditEntry
        || isAdminsCanDeleteEntry
        || isUsersCanEditEntry
        || isUsersCanDeleteEntry
        || (this.config.social && this.config.social.comments);

      switch (permissionType) {
        case 'list':
          this.managePermissionList({
            isAddEntryActive: isAddEntryActive,
            isEditEntryActive: isEditEntryActive,
            isDeleteEntryActive: isDeleteEntryActive
          });
        // eslint-disable-next-line no-fallthrough
        case 'edit':
        case 'delete':
          this.toggleAdminIdentification(showUserAdminHolder);
          this.toggleUserEmail(showUserEmailList);
          this.initUserDatasourceProvider(this.config.userDataSourceId, showUsersDataSource);
          break;
        case 'add':
          this.toggleUserEmail(showUserEmailList);
          this.initUserDatasourceProvider(this.config.userDataSourceId, showUsersDataSource);
          break;
        default:
          break;
      }
    },
    initUserDatasourceProvider: function(dataSourceId, showUsersDataSource) {
      $('.user-datasource-options').toggleClass('hidden', !showUsersDataSource);

      if (showUsersDataSource && !userDataSourceProvider) {
        var dataSourceData = {
          dataSourceTitle: 'User data (required)',
          dataSourceId: dataSourceId === 'none' ? null : dataSourceId,
          appId: Fliplet.Env.get('appId'),
          default: {
            name: appName + ' - ' + layoutMapping[listLayout].name,
            definition: {
              bundleImages: true
            },
            entries: defaultEntries[listLayout],
            columns: defaultColumns[listLayout]
          },
          accessRules: []
        };
        var _this = this;

        userDataSourceProvider = Fliplet.Widget.open('com.fliplet.data-source-provider', {
          selector: '#user_data_source_provider',
          data: dataSourceData,
          onEvent: function(event, dataSource) {
            switch (event) {
              case 'dataSourceSelect':
                _this.config.userDataSourceId = dataSource && dataSource.id;

                if (_this.config.userDataSourceId === 'none' || _this.config.userDataSourceId === '') {
                  $(
                    '.select-user-firstname-holder, .select-user-lastname-holder, .select-user-email-holder, .select-user-photo-holder, .select-photo-folder-type, .select-user-admin-holder'
                  ).addClass('hidden');

                  return;
                }

                if (dataSource.columns && dataSource.columns.length) {
                  userDataSourceColumns = dataSource.columns;
                  _this.setUpUserTokenFields();
                  _this.updateUserFieldsWithColumns(dataSource.columns);
                }

                break;
              default:
                break;
            }
          }
        });
      } else if (userDataSourceProvider && !showUsersDataSource) {
        userDataSourceProvider.close();

        userDataSourceProvider = null;
      }
    },
    toggleRuleTypes: function(options) {
      for (var type in options) {
        if (!options.hasOwnProperty(type)) {
          continue;
        }

        var defaultRule = {
          allow: 'all',
          type: []
        };
        var accessRuleIndex = -1;

        // eslint-disable-next-line no-loop-func
        accessRules.forEach(function(item, index) {
          var typeIndex = item.type.indexOf(type);

          if (typeIndex !== -1) {
            accessRuleIndex = index;
          }
        });

        if (options[type] && accessRuleIndex === -1) {
          defaultRule.type = [type];
          accessRules.push(defaultRule);
        } else if (!options[type] && accessRuleIndex > -1) {
          accessRules.splice(accessRuleIndex, 1);
        }
      }
    },
    renderFilterColumns: function() {
      $filterAccordionContainer.empty();
      _.forEach(_this.config.filterOptions, function(item) {
        item.fromLoading = true; // Flag to close accordions
        item.columns = dataSourceColumns;
        _this.addFilterItem(item);

        $('#select-data-field-' + item.id).val(item.column);
        $('#logic-field-' + item.id).val(item.logic);

        if (item.logic !== 'between' && item.logic !== 'datebetween') {
          $('#date-field-' + item.id).val(item.dateValue);
          $('#number-field-' + item.id).val(item.offsetValue);
          $('#enable-timezone-default-' + item.id).prop('checked', item.useDeviceTimezone).trigger('change');
          $('#value-field-' + item.id).val(item.fieldValue || item.value );
          $('#value-type-field-' + item.id).val(!item.valueType ? 'enter-value' : item.valueType);

          return;
        }

        if (item.logic === 'datebetween') {
          $('#date-from-' + item.id).val(item.dateFilterModifiers.from.value);
          $('#date-to-' + item.id).val(item.dateFilterModifiers.to.value);
          $('#number-field-from-' + item.id).val(item.dateFilterModifiers.from.offset);
          $('#number-field-to-' + item.id).val(item.dateFilterModifiers.to.offset);
          $('#enable-timezone-from-' + item.id).prop('checked', item.dateFilterModifiers.from.useDeviceTimezone).trigger('change');
          $('#enable-timezone-to-' + item.id).prop('checked', item.dateFilterModifiers.to.useDeviceTimezone).trigger('change');
        } else if (item.logic === 'between') {
          $('#value-type-field-from-' + item.id).val(item.valueType.from);
          $('#value-type-field-to-' + item.id).val(item.valueType.to);
          $('#value-field-from-' + item.id).val(item.value.from);
          $('#value-field-to-' + item.id).val(item.value.to);
        }
      });
    },
    renderSortColumns: function() {
      dataSourceColumns = dataSourceColumns || _this.config.dataSourceColumns || _this.config.defaultColumns;
      $sortAccordionContainer.empty();
      _.forEach(_this.config.sortOptions, function(item) {
        item.fromLoading = true; // Flag to close accordions
        item.columns = dataSourceColumns;
        _this.addSortItem(item);
        $('#select-data-field-' + item.id).val(item.column);
        $('#sort-by-field-' + item.id).val(item.sortBy);
        $('#order-by-field-' + item.id).val(item.orderBy);
      });
    },
    validateImageFieldOption: function(value) {
      if (!value) {
        return 'url';
      }

      if (['all-folders', 'url'].indexOf(value) === -1) {
        return 'url';
      }

      return value;
    },
    setupLayoutSelector: function() {
      if (_this.config.layout) {
        return;
      }

      $('.layouts-flex').html(layoutsTemplate(listLayouts));
      Fliplet.Studio.emit('widget-mode', 'wide');
      $('.state').removeClass('loading is-loading');
    },
    init: function() {
      _this.toggleRuleTypes({
        insert: _this.config.addEntry,
        update: _this.config.editEntry,
        delete: _this.config.deleteEntry
      });
      _this.setupLayoutSelector();

      return _this.getDataSources()
        .then(function() {
          return _this.setupCodeEditors();
        })
        .then(function() {
          return _this.loadData();
        })
        .then(function() {
          _this.isLoaded = true;
          _this.initializeFilterSortable();
          _this.initializeSortSortable();
          _this.initializeDetailViewSortable();
        });
    },
    initDefaultDatasourceProvider: function() {
      _this.updateFieldsWithColumns(_this.config.defaultColumns);
      initDataSourceProvider(_this.config.dataSourceId);
    },
    loadData: function() {
      if (!_this.config.layout) {
        return Promise.resolve();
      }

      _this.config['style-specific'] = _.get(flListLayoutConfig, [_this.config.layout, 'style-specific'], []);

      _.forEach(_this.config['style-specific'], function(item) {
        $('.' + item).removeClass('hidden');

        switch (item) {
          case 'list-likes':
          case 'list-bookmark':
          case 'list-comments':
            $('#social-accordion').removeClass('hidden');
            break;
          case 'list-agenda-options':
            $('#agenda-accordion').removeClass('hidden');
            break;
          default:
            break;
        }
      });

      if (_this.config.layout === 'small-h-card') {
        // Force Add button to be hidden
        $('.add-entry-checkbox').addClass('hidden');
        $('#add_entry').prop('checked', false).trigger('change');
        _this.config.addEntry = false;
      }

      // Load
      var loadingPromise;
      var $document = $(document);

      $('.form-group').removeClass('disabled');

      // Select layout
      listLayout = _this.config.layout;

      loadingPromise = new Promise(function(resolve) {
        if (!_this.config.dataSourceId) {
          _this.initDefaultDatasourceProvider();

          resolve();
        } else {
          // Check data source
          _this.getDataSourceById(_this.config.dataSourceId).then(function() {
            $document.on('datasource-selected', function() {
              resolve();
            });

            initDataSourceProvider(_this.config.dataSourceId);
          }).catch(function() {
            _this.initDefaultDatasourceProvider();

            resolve();
          });
        }
      });

      return loadingPromise
        .then(function() {
          // Load sort options
          _this.renderSortColumns();
          _this.checkSortPanelLength();

          // Load filter options
          _this.renderFilterColumns();
          _this.checkFilterPanelLength();

          $('#items-number').val(_this.config.limitEntries);

          // Load Search/Filter fields
          $('#enable-search').prop('checked', _this.config.searchEnabled).trigger('change');
          $('#enable-sort').prop('checked', _this.config.sortEnabled).trigger('change');
          $('#enable-filters').prop('checked', _this.config.filtersEnabled).trigger('change');
          $('#enable-filter-overlay').prop('checked', _this.config.filtersInOverlay).trigger('change');

          // Load agenda feature
          $('#enable-poll').prop('checked', _this.config.pollEnabled).trigger('change');
          $('#enable-survey').prop('checked', _this.config.surveyEnabled).trigger('change');
          $('#enable-questions').prop('checked', _this.config.questionsEnabled).trigger('change');

          $('#select_poll_data').val(_this.config.pollColumn || 'none');
          $('#select_survey_data').val(_this.config.surveyColumn || 'none');
          $('#select_questions_data').val(_this.config.questionsColumn || 'none');

          // Load social feature
          $('#enable-likes').prop('checked', _this.config.social.likes);
          $('#enable-bookmarks').prop('checked', _this.config.social.bookmark);
          $('#enable-comments').prop('checked', _this.config.social.comments);

          _this.toggleRuleTypes({
            insert: _this.config.addEntry,
            update: _this.config.editEntry,
            delete: _this.config.deleteEntry
          });

          $('.layout-holder[data-layout="' + _this.config.layout + '"]').addClass('active');

          // Load Add. Edit, Delete
          $('#add_entry')
            .prop('checked', _this.config.addEntry)
            .parent()
            .find('.hidden-settings')
            .toggleClass('active', !!_this.config.addEntry);

          $('#edit_entry')
            .prop('checked', _this.config.editEntry)
            .parent()
            .find('.hidden-settings')
            .toggleClass('active', !!_this.config.editEntry);

          $('#delete_entry')
            .prop('checked', _this.config.deleteEntry)
            .parent()
            .find('.hidden-settings')
            .toggleClass('active', !!_this.config.deleteEntry);

          _this.updatePermission();

          var addPermission = _this.config.addPermissions || 'everyone';
          var editPermission = _this.config.editPermissions || 'everyone';
          var deletePermission = _this.config.deletePermissions || 'everyone';

          $('[name="add-permissions"][value="' + addPermission + '"]').prop('checked', true).trigger('change');
          $('[name="edit-permissions"][value="' + editPermission + '"]').prop('checked', true).trigger('change');
          $('[name="delete-permissions"][value="' + deletePermission + '"]').prop('checked', true).trigger('change');

          // Load code editor tabs
          switch (listLayout) {
            case 'small-card':
            case 'news-feed':
            case 'simple-list':
              $('.filter-loop-item, .detail-view-item, .items-number').removeClass('hidden');
              break;
            case 'agenda':
              $('.filter-loop-item, .date-loop-item, .detail-view-item, .search-results-item').removeClass('hidden');
              break;
            case 'small-h-card':
              $('.detail-view-item, .items-number').removeClass('hidden');
              break;
            default:
              break;
          }

          // Load advanced settings
          if (_this.config.advancedSettings.htmlEnabled || _this.config.advancedSettings.cssEnabled || _this.config.advancedSettings.jsEnabled) {
            resetToDefaults = true;
            $('input#enable-templates').prop('checked', _this.config.advancedSettings.htmlEnabled).trigger('change');
            $('input#enable-css').prop('checked', _this.config.advancedSettings.cssEnabled).trigger('change');
            $('input#enable-javascript').prop('checked', _this.config.advancedSettings.jsEnabled).trigger('change');
            resetToDefaults = false;
          }
        })
        .then(function() {
          if (_this.config.userDataSourceId && _this.config.userDataSourceId !== 'none') {
            return _this.getUserColumns(_this.config.userDataSourceId);
          }
        })
        .then(function() {
          var defaultDetailFields = defaultSettings[listLayout]['detail-fields'] || [];

          dataSourceColumns = dataSourceColumns || _this.config.dataSourceColumns || _this.config.defaultColumns;

          // Sets up the data view settings
          if (typeof _this.config['summary-fields'] === 'undefined') {
            _this.config['summary-fields'] = defaultSettings[listLayout]['summary-fields'];
          }

          var actionValue = _this.config.summaryLinkOption || 'show';

          $('[name="detail-view-action"][value="' + actionValue + '"]').prop('checked', true).trigger('change');

          $('#select_field_link').val(_this.config.summaryLinkAction && _this.config.summaryLinkAction.column || 'none');
          $('#select_type_link').val(_this.config.summaryLinkAction && _this.config.summaryLinkAction.type || 'url');

          _this.updateSummaryRowContainer();

          if (!_this.config.detailViewOptions.length && !defaultSettings[listLayout]['detail-fields-disabled']) {
            fromStart = true;
            _.forEach(dataSourceColumns, function(column, index) {
              var item = {
                id: index + 1,
                columns: dataSourceColumns,
                column: column,
                type: 'text',
                fieldLabel: 'column-name',
                editable: true
              };

              _this.config.detailViewOptions.push(item);
            });
          }

          if (fromStart && defaultDetailFields.length) {
            defaultDetailFields.forEach(function(field) {
              var item = {
                id: field.id,
                columns: dataSourceColumns,
                column: field.column,
                type: field.type,
                fieldLabel: 'column-name',
                location: field.location,
                editable: !field.paranoid,
                helper: field.helper
              };

              var foundMatch = _.find(_this.config.detailViewOptions, function(detailField) {
                return detailField.column === item.column;
              });

              if (foundMatch) {
                foundMatch.fieldLabel = 'no-label';
                foundMatch.location = item.location;
                foundMatch.editable = item.editable;
                foundMatch.type = item.type;
                foundMatch.helper = item.helper;
              } else {
                _this.config.detailViewOptions.push(item);
              }
            });
          }

          if (_this.config.detailViewAutoUpdate) {
            _.forEach(dataSourceColumns, function(column) {
              var foundColumn = _.find(_this.config.detailViewOptions, function(item) {
                return column === item.column;
              });

              if (foundColumn) {
                return;
              }

              var item = {
                id: _this.config.detailViewOptions.length + 1,
                columns: dataSourceColumns,
                column: column,
                type: 'text',
                fieldLabel: 'column-name',
                editable: true
              };

              _this.config.detailViewOptions.push(item);
            });
          }

          // Remove fields from detail view that are to be ignored - Only on first load
          if (fromStart && defaultSettings[listLayout]['detail-fields-ignore']) {
            _.remove(_this.config.detailViewOptions, function(field) {
              return defaultSettings[listLayout]['detail-fields-ignore'].indexOf(field.column) >= 0;
            });
          }

          if (fromStart && !defaultSettings[listLayout]['showSummaryFieldsInDetailView']) {
            // Duplicates are removed from detail view because all summary view fields
            // are rendered at the top of the detail view by default - Only on first load
            _this.config['summary-fields'].forEach(function(field) {
              if (!field.column || field.column === 'none' || field.column === 'custom') {
                return;
              }

              _.remove(_this.config.detailViewOptions, function(option) {
                return !option.paranoid && field.column === option.column;
              });
            });
          }

          // TRY TO RESTORE LOST LOCKED FIELDS
          var foundLockedFields = [];
          var foundLockedFieldsIndices = [];
          var defaultLockedFields = _.filter(defaultDetailFields, { paranoid: true });

          if (defaultLockedFields.length) {
            // Tries to find each location in the saved detail fields
            // For each found location we save the object and the index for later
            defaultLockedFields.forEach(function(field) {
              _this.config.detailViewOptions.some(function(option, index) {
                if (option.location !== field.location) {
                  return false;
                }

                foundLockedFields.push(option);
                foundLockedFieldsIndices.push(index);

                return true;
              });
            });

            // If the found fields are less than the default fields
            if (foundLockedFields.length < defaultLockedFields.length) {
              // Normalize default fields
              defaultLockedFields.forEach(function(field) {
                field.columns = dataSourceColumns;
                field.fieldLabel = 'no-label';
                field.editable = !field.paranoid;
              });

              // We extend the found fields with the missing defaults
              foundLockedFields = _.map(defaultLockedFields, function(field) {
                return _.merge(field, _.find(foundLockedFields, { location: field.location }));
              });

              // Prepend locked fields in the beginning
              _this.config.detailViewOptions = _.concat(
                foundLockedFields,
                _.filter(_this.config.detailViewOptions, function(option, index) {
                  return foundLockedFieldsIndices.indexOf(index) === -1;
                })
              );
            }
          }

          _this.updateDetailsRowContainer();

          $('input#enable-auto-update').prop('checked', _this.config.detailViewAutoUpdate);

          return;
        })
        .then(function() {
          if (_this.config.social.comments || _this.config.userDataSourceId) {
            $('#select_user_fname').val(_this.config.userFirstNameColumn ? _this.config.userFirstNameColumn : 'none');
            $('#select_user_lname').val(_this.config.userLastNameColumn ? _this.config.userLastNameColumn : 'none');
            $('#select_user_email').val(_this.config.userEmailColumn ? _this.config.userEmailColumn : 'none');
            $('#select_user_photo').val(_this.config.userPhotoColumn ? _this.config.userPhotoColumn : 'none').trigger('change');
            $('#select_user_admin').val(_this.config.userAdminColumn ? _this.config.userAdminColumn : 'none');
            $('#select_user_email_data').val(_this.config.userListEmailColumn ? _this.config.userListEmailColumn : 'none');
            $('#select_user_folder_type').val(_this.config.userFolderOption ? _this.config.userFolderOption : 'url').trigger('change');
            $('.select-photo-folder .file-picker-btn').text(_this.config.userFolder && _this.config.userFolder.folder ? 'Replace folder' : 'Select a folder');
            $('.select-photo-folder .selected-user-folder span').text(
              _this.config.userFolder && _this.config.userFolder.folder
                ? _this.config.userFolder.folder.selectFiles[0].name
                : '');
            $('.select-photo-folder .selected-user-folder')[
              _this.config.userFolder && _this.config.userFolder.folder
                ? 'removeClass'
                : 'addClass']('hidden');
            $newUserDataSource.val(_this.config.userDataSourceId ? _this.config.userDataSourceId : 'none').trigger('change');

            if (_this.config.social.comments) {
              _this.initUserDatasourceProvider(_this.config.userDataSourceId, true);
            }
          }

          _this.setupCodeEditors(listLayout);
          _this.goToSettings('layouts');
          $('.state').removeClass('loading is-loading');
        })
        .catch(function(error) {
          if (!error) {
            return;
          }

          // Load Search/Filter fields
          $('#enable-search').prop('checked', _this.config.searchEnabled).trigger('change');
          $('#enable-sort').prop('checked', _this.config.sortEnabled).trigger('change');
          $('#enable-filters').prop('checked', _this.config.filtersEnabled).trigger('change');
          $('#enable-filter-overlay').prop('checked', _this.config.filtersInOverlay).trigger('change');

          // Load agenda feature
          $('#enable-poll').prop('checked', _this.config.pollEnabled);
          $('#enable-survey').prop('checked', _this.config.surveyEnabled);
          $('#enable-questions').prop('checked', _this.config.questionsEnabled);

          // Load social feature
          $('#enable-likes').prop('checked', _this.config.social.likes);
          $('#enable-bookmarks').prop('checked', _this.config.social.bookmark);
          $('#enable-comments').prop('checked', _this.config.social.comments);

          // Select layout
          listLayout = _this.config.layout;
          $('.layout-holder[data-layout="' + _this.config.layout + '"]').addClass('active');

          // Load code editor tabs
          switch (listLayout) {
            case 'small-card':
              $('.filter-loop-item').removeClass('hidden');
              $('.detail-view-item').removeClass('hidden');
              break;
            case 'news-feed':
              $('.filter-loop-item').removeClass('hidden');
              $('.detail-view-item').removeClass('hidden');
              break;
            case 'agenda':
              $('.filter-loop-item').removeClass('hidden');
              $('.date-loop-item').removeClass('hidden');
              $('.detail-view-item').removeClass('hidden');
              break;
            case 'small-h-card':
              $('.detail-view-item').removeClass('hidden');
              break;
            case 'simple-list':
              $('.filter-loop-item').removeClass('hidden');
              $('.detail-view-item').removeClass('hidden');
              break;
            default:
              break;
          }

          // Load advanced settings
          if (_this.config.advancedSettings.htmlEnabled || _this.config.advancedSettings.cssEnabled || _this.config.advancedSettings.jsEnabled) {
            resetToDefaults = true;
            $('input#enable-templates').prop('checked', _this.config.advancedSettings.htmlEnabled).trigger('change');
            $('input#enable-css').prop('checked', _this.config.advancedSettings.cssEnabled).trigger('change');
            $('input#enable-javascript').prop('checked', _this.config.advancedSettings.jsEnabled).trigger('change');
            resetToDefaults = false;
          }

          $('.create-holder').addClass('hidden');
          $('.edit-holder').removeClass('hidden');
          $('.form-group').removeClass('disabled');

          // Continue
          _this.setupCodeEditors(listLayout);
          _this.goToSettings('layouts');
        });
    },
    updateSummaryRowContainer: function() {
      $summaryRowContainer.empty();
      _.forEach(_this.config['summary-fields'], function(item) {
        // Backwards compatibility
        if (typeof item.interfaceName === 'undefined') {
          var defaultInterfaceName = _.find(defaultSettings[listLayout]['summary-fields'], function(defaultItem) {
            return defaultItem.location === item.location;
          });

          item.interfaceName = defaultInterfaceName.interfaceName;
        }

        item.columns = dataSourceColumns || _this.config.defaultColumns;
        item.column = _this.validateColumn({
          column: item.column,
          columns: item.columns
        });
        item = _this.updateWithFoldersInfo(item, 'summary');
        _this.addSummaryItem(item);

        $('#summary_select_field_' + item.id).val(item.column).trigger('change');
        $('#summary_select_type_' + item.id).val(item.type || 'text').trigger('change');
        $('#summary_custom_field_' + item.id).val(item.customField || '');
        item.imageField = _this.validateImageFieldOption(item.imageField);
        $('#summary_image_field_type_' + item.id).val(item.imageField).trigger('change');

        if (item.imageField === 'all-folders' && item.folder) {
          $summaryRowContainer.find('[data-id="' + item.id + '"]')
            .find('.file-picker-btn').text('Replace folder').end()
            .find('.selected-folder span').text(item.folder.selectFiles[0].name).end()
            .find('.selected-folder').removeClass('hidden');
        }
      });
    },
    updateDetailsRowContainer: function() {
      $detailsRowContainer.empty();
      _.forEach(_this.config.detailViewOptions, function(item) {
        item.columns = dataSourceColumns;
        item.column = _this.validateColumn({
          column: item.column,
          columns: item.columns
        });
        item = _this.updateWithFoldersInfo(item, 'details');
        _this.addDetailItem(item);

        $('#detail_select_field_' + item.id).val(item.column).trigger('change');
        $('#detail_select_type_' + item.id).val(item.type || 'text').trigger('change');
        $('#detail_select_label_' + item.id).val(item.fieldLabel || 'column-name').trigger('change');
        $('#detail_custom_field_' + item.id).val(item.customField || '');
        $('#detail_custom_field_name_' + item.id).val(item.customFieldLabel || '');
        item.imageField = _this.validateImageFieldOption(item.imageField);
        $('#detail_image_field_type_' + item.id).val(item.imageField).trigger('change');

        if (item.imageField === 'all-folders' && item.folder) {
          $detailsRowContainer.find('[data-id="' + item.id + '"]')
            .find('.file-picker-btn').text('Replace folder').end()
            .find('.selected-folder span').text(item.folder.selectFiles[0].name).end()
            .find('.selected-folder').removeClass('hidden');
        }
      });
    },
    /**
     * Validates a column name from field settings
     *
     * @param {Object} item - object with settings for sort list items
     *        keys:
     *          column {String} - selected column name
     *          columns {Array} - array datasource or default columns
     * @returns {String} column name
     */
    validateColumn: function(item) {
      if (item.columns.indexOf(item.column) !== -1 || item.column === 'empty' || item.column === 'custom') {
        return item.column;
      }

      return 'none';
    },
    loadTokenFields: function() {
      if (_this.config.searchEnabled) {
        $('#search-column-fields-tokenfield').tokenfield('setTokens', _this.config.searchFields );
      }

      if (_this.config.filtersEnabled) {
        $('#filter-column-fields-tokenfield').tokenfield('setTokens', _this.config.filterFields );
      }

      if (_this.config.sortEnabled) {
        $('#sort-column-fields-tokenfield').tokenfield('setTokens', _this.config.sortFields );
      }
    },
    loadUserTokenFields: function() {
      if (_this.config.userNameFields) {
        $('#user-name-column-fields-tokenfield').tokenfield('setTokens', _this.config.userNameFields );
      }
    },
    goToSettings: function(context) {
      if (context === 'advanced') {
        $('.advanced-tab').removeClass('present').addClass('future');
      }

      if (context === 'relations') {
        $('.relations-tab').removeClass('present').addClass('future');

        _this.saveSummaryViewOptions();
        _this.saveDetailedViewOptions();
        _this.saveTokenFields();

        dataSourceProvider.close();
        dataSourceProvider = null;

        initDataSourceProvider(_this.config.dataSourceId);
      }

      if (context === 'layouts') {
        $('.settings-tab').removeClass('future').addClass('present');
      }

      Fliplet.Studio.emit('widget-mode', 'normal');
    },
    goToAdvanced: function() {
      $('.advanced-tab').removeClass('future').addClass('present');
      Fliplet.Studio.emit('widget-mode', 'wide');
    },
    goToRelations: function() {
      $('.relations-tab').removeClass('future').addClass('present');
      Fliplet.Studio.emit('widget-mode', 'wide');
    },
    setUpTokenFields: function() {
      $('.search-fields').html(tokenField({
        name: 'search-column-fields',
        id: 'search-column-fields-tokenfield',
        createTokensOnBlur: false
      }));
      $('#search-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: dataSourceColumns || _this.config.defaultColumns,
          delay: 100
        },
        showAutocompleteOnFocus: true,
        createTokensOnBlur: false
      });
      $('.sort-fields').html(tokenField({
        name: 'sort-column-fields',
        id: 'sort-column-fields-tokenfield',
        createTokensOnBlur: false
      }));
      $('#sort-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: dataSourceColumns || _this.config.defaultColumns,
          delay: 100
        },
        showAutocompleteOnFocus: true,
        createTokensOnBlur: false
      });
      $('.filter-fields').html(tokenField({
        name: 'filter-column-fields',
        id: 'filter-column-fields-tokenfield',
        createTokensOnBlur: false
      }));
      $('#filter-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: dataSourceColumns || _this.config.defaultColumns,
          delay: 100
        },
        showAutocompleteOnFocus: true,
        createTokensOnBlur: false
      });

      _this.handleTokensSelection();
      _this.loadTokenFields();
    },
    removeFocusFromTokenInput: function() {
      $('input.token-input.ui-autocomplete-input').blur();
    },
    handleTokensSelection: function() {
      $('input.tokenfield').on('tokenfield:createdtoken tokenfield:removedtoken', function() {
        var field = $(this);
        var currentTokens = field.tokenfield('getTokens');
        var originalSource = field.data('bs.tokenfield').options.autocomplete.source;

        // Remove the token from the newSource
        var newSource = _.xorBy(originalSource, currentTokens, function(item) {
          return item.label || item;
        });

        // Update source
        field.data('bs.tokenfield').$input.autocomplete({ source: newSource });
        _this.removeFocusFromTokenInput();
      });

      $('input.tokenfield').on('tokenfield:createtoken', function(event) {
        var currentTokens = $(this).tokenfield('getTokens');
        var tokenExists = _.some(currentTokens, function(item) {
          return item.label === event.attrs.label;
        });

        if (tokenExists) {
          event.preventDefault();
        }
      });
    },
    setUpUserTokenFields: function() {
      $('.user-name-fields').html(tokenField({
        name: 'user-name-column-fields',
        id: 'user-name-column-fields-tokenfield'
      }));

      $('#user-name-column-fields-tokenfield').tokenfield('destroy').tokenfield({
        autocomplete: {
          source: userDataSourceColumns || [],
          delay: 100
        },
        showAutocompleteOnFocus: true,
        createTokensOnBlur: false
      });

      _this.handleTokensSelection();
      _this.loadUserTokenFields();
    },
    getColumns: function(dataSourceId) {
      if (dataSourceId && dataSourceId !== '') {
        return Fliplet.DataSources.getById(dataSourceId, {
          cache: false
        }).then(function(dataSource) {
          newDataSource = dataSource;
          dataSourceColumns = dataSource.columns;
          _this.updateFieldsWithColumns(dataSourceColumns);

          return;
        });
      }
    },
    getUserColumns: function(dataSourceId) {
      if (dataSourceId && dataSourceId !== '' && dataSourceId !== 'none') {
        return Fliplet.DataSources.getById(dataSourceId, {
          cache: false
        }).then(function(dataSource) {
          userDataSourceColumns = dataSource.columns;
          _this.updateUserFieldsWithColumns(userDataSourceColumns);
        });
      }

      return Promise.resolve();
    },
    updateFieldsWithColumns: function(dataSourceColumns) {
      if (!dataSourceColumns) {
        return;
      }

      $('[data-field="field"]').each(function(index, obj) {
        var oldValue = $(obj).val();
        var options = [];

        $(obj).html('');
        $(obj).append('<option value="none">-- Select a data field</option>');

        dataSourceColumns.forEach(function(value) {
          options.push('<option value="' + value + '">' + value + '</option>');
        });
        $(obj).append(options.join(''));

        if (oldValue && oldValue.length) {
          $(obj).val(oldValue);
        }
      });

      var emailOldValue = $('#select_user_email_data').val();
      var options = [];

      $('#select_user_email_data').html('');
      $('#select_user_email_data').append('<option value="none">-- Select a data field</option>');
      dataSourceColumns.forEach(function(value) {
        options.push('<option value="' + value + '">' + value + '</option>');
      });
      $('#select_user_email_data').append(options.join(''));

      if (emailOldValue && emailOldValue.length) {
        $('#select_user_email_data').val(emailOldValue);
      }

      // Summary link field
      var linkFieldValue = $('#select_field_link').val();
      var linkOptions = [];

      $('#select_field_link').html('');
      linkOptions.push('<option value="none">-- Select a data field</option>');
      linkOptions.push('<option disabled>------</option>');
      dataSourceColumns.forEach(function(value) {
        linkOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('#select_field_link').append(options.join(''));

      if (linkFieldValue && linkFieldValue.length) {
        $('#select_field_link').val(linkFieldValue);
      }

      // Summary fields
      $('[name="summary_select_field"]').each(function() {
        var oldValue = $(this).val();
        var defaultOptions = [
          '<option value="none">-- Select a data field</option>',
          '<option disabled>------</option>',
          '<option value="empty">None</option>',
          '<option value="custom">Custom</option>',
          '<option disabled>------</option>'
        ];
        var options = _.concat(defaultOptions, _.map(dataSourceColumns, function(value) {
          return '<option value="' + value + '">' + value + '</option>';
        }));

        $(this).html(options.join(''));

        if (oldValue && oldValue.length) {
          $(this).val(oldValue);
        }
      });

      // Detail fields
      $('[name="detail_select_field"]').each(function() {
        var oldValue = $(this).val();
        var defaultOptions = [
          '<option value="none">-- Select a data field</option>',
          '<option disabled>------</option>',
          '<option value="custom">Custom</option>',
          '<option disabled>------</option>'
        ];
        var options = _.concat(defaultOptions, _.map(dataSourceColumns, function(value) {
          return '<option value="' + value + '">' + value + '</option>';
        }));

        $(this).html(options.join(''));

        if (oldValue && oldValue.length) {
          $(this).val(oldValue);
        }
      });

      // Pool data field
      var poolFieldValue = $('#select_poll_data').val();
      var poolFieldOptions = [];

      $('#select_poll_data').html('');
      poolFieldOptions.push('<option value="none">-- Select a field</option>');
      poolFieldOptions.push('<option disabled>------</option>');
      dataSourceColumns.forEach(function(value) {
        poolFieldOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('#select_poll_data').append(poolFieldOptions.join(''));

      if (poolFieldValue && poolFieldValue.length) {
        $('#select_poll_data').val(poolFieldValue);
      } else {
        $('#select_poll_data').val('none');
      }

      // Survey data field
      var surveyFieldValue = $('#select_survey_data').val();
      var surveyFieldOptions = [];

      $('#select_survey_data').html('');
      surveyFieldOptions.push('<option value="none">-- Select a field</option>');
      surveyFieldOptions.push('<option disabled>------</option>');
      dataSourceColumns.forEach(function(value) {
        surveyFieldOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('#select_survey_data').append(surveyFieldOptions.join(''));

      if (surveyFieldValue && surveyFieldValue.length) {
        $('#select_survey_data').val(surveyFieldValue);
      } else {
        $('#select_survey_data').val('none');
      }

      // Questions data field
      var questionsFieldValue = $('#select_questions_data').val();
      var questionsFieldOptions = [];

      $('#select_questions_data').html('');
      questionsFieldOptions.push('<option value="none">-- Select a field</option>');
      questionsFieldOptions.push('<option disabled>------</option>');
      dataSourceColumns.forEach(function(value) {
        questionsFieldOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('#select_questions_data').append(questionsFieldOptions.join(''));

      if (questionsFieldValue && questionsFieldValue.length) {
        $('#select_questions_data').val(questionsFieldValue);
      } else {
        $('#select_questions_data').val('none');
      }

      _this.setUpTokenFields();
    },
    updateUserFieldsWithColumns: function(userDataSourceColumns) {
      userDataSourceColumns = userDataSourceColumns || [];

      var fOptions = [];
      var lOptions = [];
      var eOptions = [];
      var pOptions = [];
      var aOptions = [];

      // Get old values
      var oldFirstNameValue = $('.select-user-firstname-holder select').val();
      var oldLastNameValue = $('.select-user-lastname-holder select').val();
      var oldEmailValue = $('.select-user-email-holder select').val();
      var oldPhotoValue = $('.select-user-photo-holder select').val();
      var oldAdminValue = $('.select-user-admin-holder select').val();

      // Reset
      $('.select-user-firstname-holder select').html('');
      $('.select-user-lastname-holder select').html('');
      $('.select-user-email-holder select').html('');
      $('.select-user-photo-holder select').html('');
      $('.select-user-admin-holder select').html('');

      // Append options
      // First Name
      $('.select-user-firstname-holder select').append('<option value="none">-- Select the first name data field</option>');
      $('.select-user-firstname-holder select').append('<option disabled>------</option>');
      userDataSourceColumns.forEach(function(value) {
        fOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('.select-user-firstname-holder select').append(fOptions.join(''));
      $('.select-user-firstname-holder select').val(oldFirstNameValue);

      // Last Name
      $('.select-user-lastname-holder select').append('<option value="none">-- Select the last name data field</option>');
      $('.select-user-lastname-holder select').append('<option disabled>------</option>');
      userDataSourceColumns.forEach(function(value) {
        lOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('.select-user-lastname-holder select').append(lOptions.join(''));
      $('.select-user-lastname-holder select').val(oldLastNameValue);

      // Email
      $('.select-user-email-holder select').append('<option value="none">-- Select the email data field</option>');
      $('.select-user-email-holder select').append('<option disabled>------</option>');
      userDataSourceColumns.forEach(function(value) {
        eOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('.select-user-email-holder select').append(eOptions.join(''));
      $('.select-user-email-holder select').val(oldEmailValue);

      // Photo
      $('.select-user-photo-holder select').append('<option value="none">Don\'t show user photos</option>');
      $('.select-user-photo-holder select').append('<option disabled>-- Select user photo data field</option>');
      userDataSourceColumns.forEach(function(value) {
        pOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('.select-user-photo-holder select').append(pOptions.join(''));
      $('.select-user-photo-holder select').val(oldPhotoValue);

      // Admin
      $('.select-user-admin-holder select').append('<option value="none">-- Select the admin field</option>');
      $('.select-user-admin-holder select').append('<option disabled>------</option>');
      userDataSourceColumns.forEach(function(value) {
        aOptions.push('<option value="' + value + '">' + value + '</option>');
      });
      $('.select-user-admin-holder select').append(aOptions.join(''));
      $('.select-user-admin-holder select').val(oldAdminValue);

      // Show select fields
      $('.select-user-firstname-holder').removeClass('hidden');
      $('.select-user-lastname-holder').removeClass('hidden');
      $('.select-user-email-holder').removeClass('hidden');

      if (_this.config.social && _this.config.social.comments) {
        $('.select-user-photo-holder').removeClass('hidden');
      }

      if (_this.config.addPermissions === 'admins'
        || _this.config.editPermissions === 'admins'
        || _this.config.editPermissions === 'users-admins'
        || _this.config.detelePermissions === 'admins'
        || _this.config.detelePermissions === 'users-admins') {
        $('.select-user-admin-holder').removeClass('hidden');
      }

      _this.setUpUserTokenFields();
    },
    updateWithFoldersInfo: function(item, from) {
      item.from = from;

      return item;
    },
    reloadDataSources: function() {
      return Fliplet.DataSources.get({
        roles: 'publisher,editor',
        type: null
      }, {
        cache: false
      });
    },
    formatState: function(state) {
      if (state.id === 'none') {
        return $(
          '<span class="select2-value-holder">' + state.text + '</span>'
        );
      }

      if (state.id === 'new') {
        return $(
          '<span class="select2-value-holder">' + state.text + '</span>'
        );
      }

      if (state.id === '------') {
        return $(
          '<span class="select2-value-holder">' + state.text + '</span>'
        );
      }

      if (typeof state.name === 'undefined' && typeof state.text !== 'undefined') {
        return $(
          '<span class="select2-value-holder">' + state.text + ' <small>ID: ' + state.id + '</small></span>'
        );
      }

      return $(
        '<span class="select2-value-holder">' + state.name + ' <small>ID: ' + state.id + '</small></span>'
      );
    },
    customDsSearch: function(params, data) {
      // If there are no search terms, return all of the data
      if ($.trim(params.term) === '') {
        return data;
      }

      // Do not display the item if there is no 'text' property
      if (typeof data.text === 'undefined' || typeof data.name === 'undefined' || typeof data.id === 'undefined') {
        return null;
      }

      var name = data.name.toLowerCase();
      var id = data.id.toString();
      var term = params.term.toLowerCase();

      if (name.indexOf(term) > -1 || id.indexOf(term) > -1) {
        var modifiedData = $.extend({}, data, true);

        // You can return modified objects from here
        // This includes matching the `children` how you want in nested data sets
        return modifiedData;
      }

      // Return `null` if the term should not be displayed
      return null;
    },
    initSelect2: function(dataSources) {
      $dataSources.select2({
        data: dataSources,
        placeholder: '-- Select a data source',
        templateResult: _this.formatState,
        templateSelection: _this.formatState,
        width: '100%',
        matcher: _this.customDsSearch,
        dropdownAutoWidth: true
      });
    },
    initSecondSelect2: function(dataSources) {
      $newUserDataSource.select2({
        data: dataSources,
        placeholder: '-- Select a data source',
        templateResult: _this.formatState,
        templateSelection: _this.formatState,
        width: '100%',
        matcher: _this.customDsSearch,
        dropdownAutoWidth: true
      });
    },
    getDataSourceById: function(id) {
      return Fliplet.DataSources.getById(id);
    },
    getDataSources: function() {
      // Load the data source
      return Fliplet.DataSources.get({
        roles: 'publisher,editor',
        type: null
      }, {
        cache: false
      }).then(function(dataSources) {
        allDataSources = dataSources;
        _this.initSelect2(allDataSources);
        _this.initSecondSelect2(allDataSources);
      });
    },
    createDataSource: function() {
      event.preventDefault();
      Fliplet.Modal.prompt({
        title: 'Please type a name for your data source:',
        value: appName + ' - ' + layoutMapping[listLayout].name
      }).then(function(name) {
        if (name === null) {
          $dataSources.val('none').trigger('change');

          return;
        }

        if (name === '') {
          $dataSources.val('none').trigger('change');
          Fliplet.Modal.alert({ message: 'You must enter a data source name' });

          return;
        }

        Fliplet.DataSources.create({
          name: name,
          organizationId: organizationId,
          entries: defaultEntries[listLayout],
          columns: defaultColumns[listLayout],
          bundle: true,
          definition: {
            bundleImages: true
          }
        }).then(function(ds) {
          allDataSources.push(ds);

          var newOption = new Option(ds.name, ds.id, true, true);

          $dataSources.append(newOption).trigger('change');
          _this.config.dataSourceId = ds.id;
          _this.getColumns(ds.id);
        });
      });
    },
    loadDataFromLayout: function() {
      return Fliplet.DataSources.get({
        roles: 'publisher,editor',
        type: null
      }, {
        cache: false
      }).then(function() {
        _this.config.layout = listLayout;
        _this.config.dataSourceId = undefined;
        _this.config.defaultEntries = [];
        defaultEntries[listLayout].forEach(function(entry, index) {
          _this.config.defaultEntries.push({
            id: index,
            data: entry
          });
        });
        _this.config.defaultColumns = defaultColumns[listLayout];
        _this.config = $.extend(true, _this.config, defaultSettings[listLayout]);

        return;
      });
    },
    createDataSourceData: function() {
      var name = appName + ' - List - ' + layoutMapping[listLayout].name;

      Fliplet.Modal.prompt({
        title: 'Please type a name for your data source:',
        value: name
      }).then(function(name) {
        if (name === null || name === '') {
          return Promise.reject();
        }

        return name;
      }).then(function(name) {
        return Fliplet.DataSources.create({
          name: name,
          organizationId: organizationId,
          appId: Fliplet.Env.get('appId'),
          entries: defaultEntries[listLayout],
          columns: defaultColumns[listLayout],
          bundle: true,
          definition: {
            bundleImages: true
          }
        });
      }).then(function(ds) {
        allDataSources.push(ds);
        _this.config.dataSourceId = ds.id;
      }).then(function() {
        return _this.loadData();
      })
        .then(function() {
          _this.saveLists(true);
        });
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
      var text = '';
      var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

      for (var i = 0; i < length; i++) {text += possible.charAt(Math.floor(Math.random() * possible.length));}

      return text;
    },
    addSortItem: function(data) {
      data.columnLabel = data.column === 'none'
        ? '(Field)'
        : data.column;
      data.sortByLabel = data.sortBy === 'none'
        ? '(Sort)'
        : data.sortBy;
      data.orderByLabel = data.orderBy === 'none'
        ? '(Order)'
        : data.orderBy;

      var $newPanel = $(sortPanelTemplate(data));

      $sortAccordionContainer.append($newPanel);
    },
    addFilterItem: function(data) {
      data.columnLabel = data.column === 'none'
        ? '(Field)'
        : data.column;
      data.valueField = data.valueType === 'enter-value'
        ? 'Value'
        : 'Value for (required)';

      var $newPanel = $(filterPanelTemplate(data));

      $filterAccordionContainer.append($newPanel);

      if (_this.showValueFields(data.logic)) {
        $('#filter-value-type-' + data.id).addClass('hidden');
        $('#filter-value-' + data.id).addClass('hidden');
      }

      if (data.logic !== 'between') {
        $('#logic-comparison-' + data.id).addClass('hidden');
      }

      if (data.logic !== 'datebetween') {
        $('#date-between-' + data.id).addClass('hidden');
      }

      if (_this.showTimezoneField(data.dateValue)) {
        $('#enable-timezone-default-' + data.id).parents('.checkbox').removeClass('hidden');
      }

      if (!_this.showOffsetField(data.dateValue)) {
        $('#date-number-default-' + data.id).removeClass('hidden');
      }

      if (['dateis', 'dateafter', 'datebefore'].indexOf(data.logic) === -1 || data.logic === 'datebetween') {
        $('#date-logic-' + data.id).addClass('hidden');

        if (data.dateFilterModifiers && data.dateFilterModifiers.from) {
          if (_this.showTimezoneField(data.dateFilterModifiers.from.value)) {
            $('#enable-timezone-from-' + data.id).parents('.checkbox').removeClass('hidden');
          }

          if (!_this.showOffsetField(data.dateFilterModifiers.from.value)) {
            $('#date-number-from-' + data.id).removeClass('hidden');
          }
        }

        if (data.dateFilterModifiers && data.dateFilterModifiers.to) {
          if (_this.showTimezoneField(data.dateFilterModifiers.to.value)) {
            $('#enable-timezone-to-' + data.id).parents('.checkbox').removeClass('hidden');
          }

          if (!_this.showOffsetField(data.dateFilterModifiers.to.value)) {
            $('#date-number-to-' + data.id).removeClass('hidden');
          }
        }
      }
    },
    addSummaryItem: function(data) {
      var now = new Date();

      data.date = TD(now, { format: 'll' });
      data.time = TD(now, { format: 'LT' });

      var $newPanel = $(summaryRowTemplate(data));

      $summaryRowContainer.append($newPanel);
    },
    addDetailItem: function(data) {
      var now = new Date();

      data.date = TD(now, { format: 'll' });

      var $newPanel = $(detailsRowTemplate(data));

      $detailsRowContainer.append($newPanel);
    },
    initializeDetailViewSortable: function() {
      $detailsRowContainer.sortable({
        items: '.rTableRow.editable',
        handle: '.reorder-handle',
        tolerance: 'pointer',
        placeholder: 'rTableRow clearfix placeholder',
        cursor: '-webkit-grabbing; -moz-grabbing;',
        axis: 'y',
        forcePlaceholderSize: true,
        start: function(event, ui) {
          ui.item.parents('.detail-table-panels-holder').addClass('sorting');
        },
        stop: function(event, ui) {
          var sortedIds = $detailsRowContainer.sortable('toArray', {
            attribute: 'data-id'
          });

          ui.item.parents('.detail-table-panels-holder').removeClass('sorting');
          _this.config.detailViewOptions = _.concat.apply(this, _(_this.config.detailViewOptions)
            .partition(function(option) {
              return !option.editable;
            })
            .map(function(items, i) {
              if (i === 0) {
                // Keep non-editable items as is
                return items;
              }

              // Sort editable items by sorted IDs
              return _.sortBy(items, function(item) {
                return sortedIds.indexOf(item.id.toString());
              });
            })
            .value());
        }
      });
    },
    initializeSortSortable: function() {
      $('#sort-accordion').sortable({
        handle: '.panel-heading',
        cancel: '.icon-delete',
        tolerance: 'pointer',
        placeholder: 'panel panel-default placeholder tile',
        cursor: '-webkit-grabbing; -moz-grabbing;',
        axis: 'y',
        start: function(event, ui) {
          $('.panel-collapse.in').collapse('hide');
          ui.item.addClass('focus').css('height', ui.helper.find('.panel-heading').outerHeight() + 2);
          $('.panel').not(ui.item).addClass('faded');
        },
        stop: function(event, ui) {
          ui.item.removeClass('focus');

          var sortedIds = $('#sort-accordion').sortable('toArray', {
            attribute: 'data-id'
          });

          _this.config.sortOptions = _.sortBy(_this.config.sortOptions, function(item) {
            return sortedIds.indexOf(item.id);
          });
          $('.panel').not(ui.item).removeClass('faded');
        },
        sort: function() {
          $('#sort-accordion').sortable('refresh');
        }
      });
    },
    initializeFilterSortable: function() {
      $('#filter-accordion').sortable({
        handle: '.panel-heading',
        cancel: '.icon-delete',
        tolerance: 'pointer',
        placeholder: 'panel panel-default placeholder tile',
        cursor: '-webkit-grabbing; -moz-grabbing;',
        axis: 'y',
        start: function(event, ui) {
          $('.panel-collapse.in').collapse('hide');
          ui.item.addClass('focus').css('height', ui.helper.find('.panel-heading').outerHeight() + 2);
          $('.panel').not(ui.item).addClass('faded');
        },
        stop: function(event, ui) {
          ui.item.removeClass('focus');

          var sortedIds = $('#filter-accordion').sortable('toArray', {
            attribute: 'data-id'
          });

          _this.config.filterOptions = _.sortBy(_this.config.filterOptions, function(item) {
            return sortedIds.indexOf(item.id);
          });
          $('.panel').not(ui.item).removeClass('faded');
        },
        sort: function() {
          $('#filter-accordion').sortable('refresh');
        }
      });
    },
    getSelectedRange: function(editor) {
      return {
        from: editor.getCursor(true),
        to: editor.getCursor(false)
      };
    },
    autoFormatSelection: function(editor) {
      if (editor && typeof editor === 'boolean') {
        if (baseTemplateEditor) {
          var totalLinesBaseTemplateEditor = baseTemplateEditor.lineCount();
          var totalCharsBaseTemplateEditor = baseTemplateEditor.getTextArea().value.length;

          baseTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesBaseTemplateEditor, ch: totalCharsBaseTemplateEditor }
          );
          // Remove selection
          baseTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (loopTemplateEditor) {
          var totalLinesLoopTemplateEditor = loopTemplateEditor.lineCount();
          var totalCharsLoopTemplateEditor = loopTemplateEditor.getTextArea().value.length;

          loopTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesLoopTemplateEditor, ch: totalCharsLoopTemplateEditor }
          );
          // Remove selection
          loopTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (searchResultsTemplateEditor) {
          var totalLinesSearchResultsTemplateEditor = searchResultsTemplateEditor.lineCount();
          var totalCharsSearchResultsTemplateEditor = searchResultsTemplateEditor.getTextArea().value.length;

          searchResultsTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesSearchResultsTemplateEditor, ch: totalCharsSearchResultsTemplateEditor }
          );
          // Remove selection
          searchResultsTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (detailTemplateEditor) {
          var totalLinesDetailTemplateEditor = detailTemplateEditor.lineCount();
          var totalCharsDetailTemplateEditor = detailTemplateEditor.getTextArea().value.length;

          detailTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesDetailTemplateEditor, ch: totalCharsDetailTemplateEditor }
          );
          // Remove selection
          detailTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (filterLoopTemplateEditor) {
          var totalLinesFilterLoopTemplateEditor = filterLoopTemplateEditor.lineCount();
          var totalCharsFilterLoopTemplateEditor = filterLoopTemplateEditor.getTextArea().value.length;

          filterLoopTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesFilterLoopTemplateEditor, ch: totalCharsFilterLoopTemplateEditor }
          );
          // Remove selection
          filterLoopTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (otherLoopTemplateEditor) {
          var totalLinesOtherLoopTemplateEditor = otherLoopTemplateEditor.lineCount();
          var totalCharsOtherLoopTemplateEditor = otherLoopTemplateEditor.getTextArea().value.length;

          otherLoopTemplateEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesOtherLoopTemplateEditor, ch: totalCharsOtherLoopTemplateEditor }
          );
          // Remove selection
          otherLoopTemplateEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (cssStyleEditor) {
          var totalLinesCssStyleEditor = cssStyleEditor.lineCount();
          var totalCharsCssStyleEditor = cssStyleEditor.getTextArea().value.length;

          cssStyleEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesCssStyleEditor, ch: totalCharsCssStyleEditor }
          );
          // Remove selection
          cssStyleEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        if (javascriptEditor) {
          var totalLinesJavascriptEditor = javascriptEditor.lineCount();
          var totalCharsJavascriptEditor = javascriptEditor.getTextArea().value.length;

          javascriptEditor.autoFormatRange(
            { line: 0, ch: 0 },
            { line: totalLinesJavascriptEditor, ch: totalCharsJavascriptEditor }
          );
          // Remove selection
          javascriptEditor.setSelection(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 }
          );
        }

        return;
      }

      var range = _this.getSelectedRange(editor);

      editor.autoFormatRange(range.from, range.to);
      // Remove selection
      editor.setSelection(
        { line: 0, ch: 0 },
        { line: 0, ch: 0 }
      );
    },
    commentSelection: function(editor) {
      var range = _this.getSelectedRange(editor);

      editor.commentRange(true, range.from, range.to);
    },
    removeCommentSelection: function(editor) {
      var range = _this.getSelectedRange(editor);

      editor.commentRange(false, range.from, range.to);
    },
    codeMirrorConfig: function(mode) {
      return {
        mode: {
          name: mode
        },
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
      };
    },
    getCodeEditorData: function(selectedLayout, fromReset) {
      var basePromise = new Promise(function(resolve) {
        var baseTemplateCompiler;

        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].base) {
          baseTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout].base];
        }

        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.baseHTML !== 'undefined') {
          baseTemplateCode = !fromReset ? _this.config.advancedSettings.baseHTML : baseTemplateEditor.getValue();
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
          loopTemplateCode = !fromReset ? _this.config.advancedSettings.loopHTML : loopTemplateEditor.getValue();
        } else if (typeof loopTemplateCompiler !== 'undefined') {
          loopTemplateCode = loopTemplateCompiler();
        } else {
          loopTemplateCode = '';
        }

        resolve();
      });

      var detailPromise = new Promise(function(resolve) {
        var detailTemplateCompiler;

        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].detail) {
          detailTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout].detail];
        }

        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.detailHTML !== 'undefined') {
          detailTemplateCode = !fromReset ? _this.config.advancedSettings.detailHTML : detailTemplateEditor.getValue();
        } else if (typeof detailTemplateCompiler !== 'undefined') {
          detailTemplateCode = detailTemplateCompiler();
        } else {
          detailTemplateCode = '';
        }

        resolve();
      });

      var filterLoopPromise = new Promise(function(resolve) {
        var filterLoopTemplateCompiler;

        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].filter) {
          filterLoopTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout].filter];
        }

        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.filterHTML !== 'undefined') {
          filterLoopTemplateCode = !fromReset ? _this.config.advancedSettings.filterHTML : filterLoopTemplateEditor.getValue();
        } else if (typeof filterLoopTemplateCompiler !== 'undefined') {
          filterLoopTemplateCode = filterLoopTemplateCompiler();
        } else {
          filterLoopTemplateCode = '';
        }

        resolve();
      });

      var otherLoopPromise = new Promise(function(resolve) {
        var otherLoopTemplateCompiler;

        if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout]['other-loop']) {
          otherLoopTemplateCompiler = Fliplet.Widget.Templates[layoutMapping[selectedLayout]['other-loop']];
        }

        if (_this.config.advancedSettings.htmlEnabled && typeof _this.config.advancedSettings.otherLoopHTML !== 'undefined') {
          otherLoopTemplateCode = !fromReset ? _this.config.advancedSettings.otherLoopHTML : otherLoopTemplateEditor.getValue();
        } else if (typeof otherLoopTemplateCompiler !== 'undefined') {
          otherLoopTemplateCode = otherLoopTemplateCompiler();
        } else {
          otherLoopTemplateCode = '';
        }

        resolve();
      });

      if (_this.config.advancedSettings.cssEnabled && typeof _this.config.advancedSettings.cssCode !== 'undefined') {
        cssCode = !fromReset ? _this.config.advancedSettings.cssCode : cssStyleEditor.getValue();
      } else if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].css) {
        var cssUrl = $('[data-' + layoutMapping[selectedLayout].css + '-css-url]').data(layoutMapping[selectedLayout].css + '-css-url');
        var cssPromise = Fliplet.API.request('v1/communicate/proxy/' + cssUrl).then(function(response) {
          cssCode = response;

          return;
        });
      }

      if (_this.config.advancedSettings.jsEnabled && typeof _this.config.advancedSettings.jsCode !== 'undefined') {
        jsCode = !fromReset ? _this.config.advancedSettings.jsCode : javascriptEditor.getValue();
      } else if (layoutMapping[selectedLayout] && layoutMapping[selectedLayout].js) {
        var jsUrl = $('[data-' + layoutMapping[selectedLayout].js + '-js-url]').data(layoutMapping[selectedLayout].js + '-js-url');
        var jsPromise = Fliplet.API.request('v1/communicate/proxy/' + jsUrl )
          .then(function(response) {
            jsCode = response;
          });
      }

      return Promise.all([basePromise, loopPromise, detailPromise, filterLoopPromise, otherLoopPromise, cssPromise, jsPromise]);
    },
    setupCodeEditors: function(selectedLayout, fromReset) {
      var baseTemplate = document.getElementById('base-template');
      var baseTemplateType = $(baseTemplate).data('type');
      var loopTemplate = document.getElementById('loop-template');
      var loopTemplateType = $(loopTemplate).data('type');
      var searchResultsTemplate = document.getElementById('search-results-template');
      var searchResultsTemplateType = $(searchResultsTemplate).data('type');
      var detailTemplate = document.getElementById('detail-view-template');
      var detailTemplateType = $(detailTemplate).data('type');
      var filterLoopTemplate = document.getElementById('filter-loop-template');
      var filterLoopTemplateType = $(filterLoopTemplate).data('type');
      var otherLoopTemplate = document.getElementById('other-loop-template');
      var otherLoopTemplateType = $(otherLoopTemplate).data('type');
      var cssStyle = document.getElementById('css-styles');
      var cssStyleType = $(cssStyle).data('type');
      var javascript = document.getElementById('js-code');
      var javascriptType = $(javascript).data('type');

      return _this.getCodeEditorData(selectedLayout, fromReset).then(function() {
        var baseTemplatePromise = new Promise(function(resolve) {
          if (baseTemplateEditor) {
            baseTemplateEditor.getDoc().setValue(baseTemplateCode);
          } else if (baseTemplate) {
            baseTemplateEditor = CodeMirror.fromTextArea(
              baseTemplate,
              _this.codeMirrorConfig(baseTemplateType)
            );
            templateEditors['base'] = baseTemplateEditor;
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
            );
            templateEditors['loop'] = loopTemplateEditor;
          }

          if (loopTemplateEditor) {
            resolve();
          }
        });

        var searchResultsTemplatePromise = new Promise(function(resolve) {
          if (searchResultsTemplateEditor) {
            searchResultsTemplateEditor.getDoc().setValue(searchResultsTemplateCode);
          } else if (searchResultsTemplate) {
            searchResultsTemplateEditor = CodeMirror.fromTextArea(
              searchResultsTemplate,
              _this.codeMirrorConfig(searchResultsTemplateType)
            );
            templateEditors['search-results'] = searchResultsTemplateEditor;
          }

          if (searchResultsTemplateEditor) {
            resolve();
          }
        });

        var detailTemplatePromise = new Promise(function(resolve) {
          if (detailTemplateEditor) {
            detailTemplateEditor.getDoc().setValue(detailTemplateCode);
          } else if (detailTemplate) {
            detailTemplateEditor = CodeMirror.fromTextArea(
              detailTemplate,
              _this.codeMirrorConfig(detailTemplateType)
            );
            templateEditors['detail'] = detailTemplateEditor;
          }

          if (detailTemplateEditor) {
            resolve();
          }
        });

        var filterLoopTemplatePromise = new Promise(function(resolve) {
          if (filterLoopTemplateEditor) {
            filterLoopTemplateEditor.getDoc().setValue(filterLoopTemplateCode);
          } else if (filterLoopTemplate) {
            filterLoopTemplateEditor = CodeMirror.fromTextArea(
              filterLoopTemplate,
              _this.codeMirrorConfig(filterLoopTemplateType)
            );
            templateEditors['filter'] = filterLoopTemplateEditor;
          }

          if (filterLoopTemplateEditor) {
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
            );
            templateEditors['other-loop'] = otherLoopTemplateEditor;
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
            );
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
            );
          }

          if (javascriptEditor) {
            resolve();
          }
        });

        return Promise.all([baseTemplatePromise, loopTemplatePromise, searchResultsTemplatePromise, detailTemplatePromise, filterLoopTemplatePromise, otherLoopTemplatePromise, cssStylePromise, javascriptPromise])
          .then(function() {
            _this.resizeCodeEditors();
          });
      });
    },
    resizeCodeEditors: function() {
      var baseContentHeight = $('.action-control-holder').outerHeight(true) + $('.advanced-tabs-level-one').outerHeight(true) + $('.advanced-tabs-level-two').outerHeight(true);
      var contentHeight = $('.action-control-holder').outerHeight(true) + $('.advanced-tabs-level-one').outerHeight(true);
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
    resetTemplate: function(id, name) {
      if (!id || !name) {
        return;
      }

      var originalTemplate = Fliplet.Widget.Templates[layoutMapping[listLayout][id]];
      var editor = templateEditors[id];


      if (!originalTemplate || !editor) {
        return;
      }

      Fliplet.Modal.confirm({
        title: 'Reset ' + name + ' to default',
        message: '<p>You will lose all the changes you made to ' + name + '.</p><p>Are you sure you want to continue?</p>',
        buttons: {
          confirm: {
            label: 'Reset ' + name,
            className: 'btn-danger'
          }
        }
      }).then(function(confirmed) {
        if (!confirmed) {
          return;
        }

        editor.setValue(originalTemplate());

        $('[data-reset-template]').addClass('hidden');
        $('[data-reset-template-success]').removeClass('hidden');

        setTimeout(function() {
          $('[data-reset-template]').removeClass('hidden');
          $('[data-reset-template-success]').addClass('hidden');
        }, 2000);
      });
    },
    resetToDefaults: function(id) {
      var confirmOptions = {
        'enable-templates': {
          title: 'Reset all HTML to default',
          message: '<p>You will lose the changes you made to all the HTML templates.</p><p>Are you sure you want to continue?</p>',
          confirmLabel: 'Reset all HTML'
        },
        'enable-css': {
          title: 'Reset CSS to default',
          message: '<p>You will lose all the changes you made.</p><p>Are you sure you want to continue?</p>',
          confirmLabel: 'Reset CSS'
        },
        'enable-javascript': {
          title: 'Reset JavaScript to default',
          message: '<p>You will lose all the changes you made.</p><p>Are you sure you want to continue?</p>',
          confirmLabel: 'Reset JavaScript'
        }
      };

      Fliplet.Modal.confirm({
        title: confirmOptions[id].title,
        message: confirmOptions[id].message,
        buttons: {
          confirm: {
            label: confirmOptions[id].confirmLabel,
            className: 'btn-danger'
          }
        }
      }).then(function(confirmed) {
        if (!confirmed) {
          return;
        }

        resetToDefaults = true;
        // Uncheck checkbox
        $('input#' + id).prop('checked', false).trigger('change');

        // Reset settings
        if (id === 'enable-templates') {
          _this.config.advancedSettings.baseHTML = undefined;
          _this.config.advancedSettings.loopHTML = undefined;

          switch (listLayout) {
            case 'small-card':
              _this.config.advancedSettings.filterHTML = undefined;
              _this.config.advancedSettings.detailHTML = undefined;
              break;
            case 'news-feed':
              _this.config.advancedSettings.filterHTML = undefined;
              _this.config.advancedSettings.detailHTML = undefined;
              break;
            case 'agenda':
              _this.config.advancedSettings.searchResultsHTML = undefined;
              _this.config.advancedSettings.filterHTML = undefined;
              _this.config.advancedSettings.otherLoopHTML = undefined;
              _this.config.advancedSettings.detailHTML = undefined;
              break;
            case 'small-h-card':
              _this.config.advancedSettings.detailHTML = undefined;
              break;
            case 'simple-list':
              _this.config.advancedSettings.filterHTML = undefined;
              _this.config.advancedSettings.detailHTML = undefined;
              break;
            default:
              break;
          }

          _this.config.advancedSettings.htmlEnabled = false;
        }

        if (id === 'enable-css') {
          _this.config.advancedSettings.cssCode = undefined;
          _this.config.advancedSettings.cssEnabled = false;
        }

        if (id === 'enable-javascript') {
          _this.config.advancedSettings.jsCode = undefined;
          _this.config.advancedSettings.jsEnabled = false;
        }

        // Update codeeditor
        _this.setupCodeEditors(listLayout, true);
        resetToDefaults = false;
      });
    },
    saveLists: function(toReload) {
      var likesPromise;
      var bookmarksPromise;
      var commentsPromise;
      var data = _this.config;

      data.advancedSettings = {};

      data.layout = listLayout;
      data.dataSourceId = !toReload && newDataSource ? newDataSource.id : _this.config.dataSourceId || undefined;
      data.dataSourceColumns = dataSourceColumns;
      data.defaultData = toReload || !data.dataSourceId ? true : false;

      // Get sorting options
      _.forEach(_this.config.sortOptions, function(item) {
        item.column = $('#select-data-field-' + item.id).val();
        item.sortBy = $('#sort-by-field-' + item.id).val();
        item.orderBy = $('#order-by-field-' + item.id).val();
      });

      // Get filter options
      _.forEach(_this.config.filterOptions, function(item) {
        item.fieldValue = $('#value-field-' + item.id).val();
        item.column = $('#select-data-field-' + item.id).val();
        item.logic = $('#logic-field-' + item.id).val();
        item.valueType = $('#value-type-field-' + item.id).val();
        item.dateValue =  $('#date-field-' + item.id).val();
        item.offsetValue = $('#number-field-' + item.id).val() || null;
        item.useDeviceTimezone = $('#enable-timezone-default-' + item.id).prop('checked');

        if (item.valueType === 'enter-value') {
          item.value = item.fieldValue;
        }

        if (item.logic === 'empty' || item.logic === 'notempty') {
          item.valueType = '';
          item.value = '';
        }

        if (item.logic === 'datebetween') {
          var valueDateFrom = $('#date-from-' + item.id).val();
          var valueNumberFrom = $('#number-field-from-' + item.id).val();
          var useDeviceTimezoneFrom = $('#enable-timezone-from-' + item.id).prop('checked');

          var valueDateTo = $('#date-to-' + item.id).val();
          var valueNumberTo = $('#number-field-to-' + item.id).val();
          var useDeviceTimezoneTo = $('#enable-timezone-to-' + item.id).prop('checked');

          item.dateFilterModifiers = {
            from: {
              value: valueDateFrom,
              offset: valueNumberFrom || null,
              useDeviceTimezone: useDeviceTimezoneFrom
            },
            to: {
              value: valueDateTo,
              offset: valueNumberTo || null,
              useDeviceTimezone: useDeviceTimezoneTo
            }
          };
        }

        if (item.logic === 'between') {
          var valueTypeFrom = $('#value-type-field-from-' + item.id).val();
          var valueTypeTo = $('#value-type-field-to-' + item.id).val();
          var valueFrom = $('#value-field-from-' + item.id).val();
          var valueTo = $('#value-field-to-' + item.id).val();

          item.valueType = { from: valueTypeFrom, to: valueTypeTo };
          item.value = { from: valueFrom, to: valueTo };
        }
      });

      data.sortOptions = _this.config.sortOptions;
      data.filterOptions = _this.config.filterOptions;

      data.summaryLinkOption = $('[name="detail-view-action"]:checked').val();
      data.summaryLinkAction = {
        column: $('#select_field_link').val(),
        type: $('#select_type_link').val()
      };

      _this.saveSummaryViewOptions();

      _this.saveDetailedViewOptions();

      data.detailViewAutoUpdate = $('input#enable-auto-update').is(':checked');

      // Get search and filter
      data.searchEnabled = $('#enable-search').is(':checked');
      data.filtersEnabled = $('#enable-filters').is(':checked');
      data.sortEnabled = $('#enable-sort').is(':checked');
      _this.saveTokenFields();

      // Number of list items
      var limit = $('#items-number').val().trim();

      if (limit && limit.length && /^\d+$/.test(limit)) {
        data.enabledLimitEntries = true;
        data.limitEntries = parseInt(limit, 10);
      } else {
        data.enabledLimitEntries = false;
        data.limitEntries = '';
      }

      // Advanced Settings

      data.advancedSettings.htmlEnabled = $('input#enable-templates').is(':checked');
      data.advancedSettings.cssEnabled = $('input#enable-css').is(':checked');
      data.advancedSettings.jsEnabled = $('input#enable-javascript').is(':checked');

      if (data.advancedSettings.htmlEnabled) {
        data.advancedSettings.loopHTML = loopTemplateEditor.getValue();
        data.advancedSettings.baseHTML = baseTemplateEditor.getValue();

        switch (listLayout) {
          case 'small-card':
          case 'news-feed':
          case 'simple-list':
            data.advancedSettings.detailHTML = detailTemplateEditor.getValue();
            data.advancedSettings.filterHTML = filterLoopTemplateEditor.getValue();
            break;
          case 'agenda':
            data.advancedSettings.searchResultsHTML = searchResultsTemplateEditor.getValue();
            data.advancedSettings.filterHTML = filterLoopTemplateEditor.getValue();
            data.advancedSettings.otherLoopHTML = otherLoopTemplateEditor.getValue();
            data.advancedSettings.detailHTML = detailTemplateEditor.getValue();
            break;
          case 'small-h-card':
            data.advancedSettings.detailHTML = detailTemplateEditor.getValue();
            break;
          default:
            break;
        }
      }

      if (data.advancedSettings.cssEnabled) {
        data.advancedSettings.cssCode = cssStyleEditor.getValue();
      }

      if (data.advancedSettings.jsEnabled) {
        data.advancedSettings.jsCode = javascriptEditor.getValue();
      }

      // Get agenda feature
      _this.config.pollEnabled = $('#enable-poll').is(':checked');
      _this.config.surveyEnabled = $('#enable-survey').is(':checked');
      _this.config.questionsEnabled = $('#enable-questions').is(':checked');
      _this.config.pollColumn = $('#select_poll_data').val();
      _this.config.surveyColumn = $('#select_survey_data').val();
      _this.config.questionsColumn = $('#select_questions_data').val();

      _this.config.agendaButtonsEnabled = _this.config.pollEnabled || _this.config.surveyEnabled || _this.config.questionsEnabled;

      // Get social feature
      _this.config.social.bookmark = $('#enable-bookmarks').is(':checked');
      _this.config.social.comments = $('#enable-comments').is(':checked');
      _this.config.social.likes = $('#enable-likes').is(':checked');

      data.social = _this.config.social;

      data.userDataSourceId = _this.config.userDataSourceId;
      data.userNameFields = typeof $('#user-name-column-fields-tokenfield').val()  !== 'undefined' ?
        $('#user-name-column-fields-tokenfield').val().split(',').map(function(x) { return x.trim(); }) : [];
      data.userEmailColumn = $('#select_user_email').val();
      data.userPhotoColumn = $('#select_user_photo').val();
      data.userFolderOption = $('#select_user_folder_type').val();
      data.userAppFolder = data.userFolderOption === 'app' ? $('#select_user_folder_type [data-app-option]').data('app-id') : undefined;
      data.userOrgFolder = data.userFolderOption === 'organization' ? $('#select_user_folder_type [data-org-option]').data('org-id') : undefined;
      data.userAdminColumn = $('#select_user_admin').val();
      data.userListEmailColumn = $('#select_user_email_data').val();

      if (_this.config.social.likes && (!_this.config.likesDataSourceId || _this.config.likesDataSourceId === '')) {
        // Create likes data source
        likesPromise = Fliplet.DataSources.create({
          name: appName + ' - Likes',
          bundle: false,
          type: 'likes',
          organizationId: organizationId,
          accessRules: [
            { type: ['select', 'insert', 'update', 'delete'], allow: 'all' }
          ]
        }).then(function(dataSource) {
          _this.config.likesDataSourceId = dataSource.id;
        });
      } else if (!_this.config.social.likes && _this.config.likesDataSourceId) {
        _this.config.likesDataSourceId = '';
      }

      if (_this.config.social.bookmark && (!_this.config.bookmarkDataSourceId || _this.config.bookmarkDataSourceId === '')) {
        // Create bookmarks data source
        bookmarksPromise = Fliplet.DataSources.create({
          name: appName + ' - Bookmarks',
          bundle: false,
          type: 'bookmarks',
          organizationId: organizationId,
          definition: {
            views: [
              {
                name: 'userBookmarks',
                bundle: true,
                filter: {
                  user: {
                    $or: [
                      // Guest users
                      { uuid: 'session.uuid' },

                      // Logged in users
                      { email: 'session.email' },

                      // Legacy support just in case
                      { dataSourceEntryId: 'session.id' }
                    ]
                  }
                }
              }
            ]
          },
          accessRules: [
            { type: ['select', 'insert', 'update', 'delete'], allow: 'all' }
          ]
        }).then(function(dataSource) {
          _this.config.bookmarkDataSourceId = dataSource.id;
          _this.config.dataSourceViews = _this.config.dataSourceViews || [];

          _this.config.dataSourceViews.push({
            id: dataSource.id,
            view: 'userBookmarks',
            bundle: true
          });

          // Ensure we don't store the same view twice
          _this.config.dataSourceViews = _.uniqWith(_this.config.dataSourceViews, _.isEqual);
        });
      } else if (!_this.config.social.bookmark && _this.config.bookmarkDataSourceId) {
        _this.config.bookmarkDataSourceId = '';
      }

      if (_this.config.social.comments && (!_this.config.commentsDataSourceId || _this.config.commentsDataSourceId === '')) {
        // Create comments data source
        commentsPromise = Fliplet.DataSources.create({
          name: appName + ' - Comments',
          bundle: false,
          type: 'comments',
          organizationId: organizationId,
          accessRules: [
            { type: ['select', 'insert', 'update', 'delete'], allow: 'all' }
          ]
        }).then(function(dataSource) {
          _this.config.commentsDataSourceId = dataSource.id;
        });
      } else if (!_this.config.social.comments && _this.config.commentsDataSourceId) {
        _this.config.commentsDataSourceId = '';
      }

      // Add, edit, delete options
      var profileValues = [];

      $('[name="list-control"]:checked').each(function() {
        profileValues.push($(this).val());
      });
      data.addEntry = profileValues.indexOf('add-entry') !== -1;
      data.editEntry = profileValues.indexOf('edit-entry') !== -1;
      data.deleteEntry = profileValues.indexOf('delete-entry') !== -1;

      data.addPermissions = $('[name="add-permissions"]:checked').val();
      data.editPermissions = $('[name="edit-permissions"]:checked').val();
      data.deletePermissions = $('[name="delete-permissions"]:checked').val();

      if (toReload) {
        return Promise.all([likesPromise, bookmarksPromise, commentsPromise])
          .then(function() {
            _this.config = data;

            Fliplet.Widget.save(_this.config).then(function() {
              Fliplet.Studio.emit('reload-widget-instance', _this.widgetId);
            });

            return;
          });
      }

      _this.config = data;

      return Promise.all([likesPromise, bookmarksPromise, commentsPromise]);
    },
    saveSummaryViewOptions: function() {
      _.forEach(_this.config['summary-fields'], function(item) {
        item.column = $('#summary_select_field_' + item.id).val();
        item.type = $('#summary_select_type_' + item.id).val();
        item.customFieldEnabled = item.column === 'custom';
        item.customField = $('#summary_custom_field_' + item.id).val();

        // Delete unnecessary attributes before saving each item
        // ...including some legacy settings that are no longer supported
        delete item.currentApp;
        delete item.userOrganization;
        delete item.organizationFolderId;
        delete item.appFolderId;
        delete item.imageField;

        if (item.type !== 'image') {
          delete item.folder;

          return;
        }

        item.imageField = $('#summary_image_field_type_' + item.id).val();

        if (item.imageField !== 'all-folders') {
          delete item.folder;
        }
      });
    },
    saveDetailedViewOptions: function() {
      _.forEach(_this.config.detailViewOptions, function(item) {
        item.column = $('#detail_select_field_' + item.id).val();
        item.type = $('#detail_select_type_' + item.id).val();
        item.fieldLabel = $('#detail_select_label_' + item.id).val();
        item.customField = $('#detail_custom_field_' + item.id).val();
        item.customFieldEnabled = item.column === 'custom';
        item.customFieldLabelEnabled = item.fieldLabel === 'custom-label';
        item.customFieldLabel = $('#detail_custom_field_name_' + item.id).val();
        item.fieldLabelDisabled = item.fieldLabel === 'no-label';

        // Delete unnecessary attributes before saving each item
        // ...including some legacy settings that are no longer supported
        delete item.currentApp;
        delete item.userOrganization;
        delete item.organizationFolderId;
        delete item.appFolderId;
        delete item.imageField;

        if (item.type !== 'image') {
          delete item.folder;

          return;
        }

        item.imageField = $('#detail_image_field_type_' + item.id).val();

        if (item.imageField !== 'all-folders') {
          delete item.folder;
        }
      });
    },
    saveTokenFields: function() {
      _this.config.searchFields = typeof $('#search-column-fields-tokenfield').val() !== 'undefined' ?
        $('#search-column-fields-tokenfield').val().split(',').map(function(x) { return x.trim(); }) : [];
      _this.config.sortFields = typeof $('#sort-column-fields-tokenfield').val() !== 'undefined' ?
        $('#sort-column-fields-tokenfield').val().split(',').map(function(x) { return x.trim(); }) : [];
      _this.config.filterFields = typeof $('#filter-column-fields-tokenfield').val()  !== 'undefined' ?
        $('#filter-column-fields-tokenfield').val().split(',').map(function(x) { return x.trim(); }) : [];
      _this.config.filtersInOverlay = $('#enable-filter-overlay').is(':checked');
    }
  };

  return DynamicLists;
})();
