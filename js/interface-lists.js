var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var page = Fliplet.Widget.getPage();
var dynamicLists;
var dataSourceProvider;

var omitPages = page ? [page.id] : [];
var addEntryLinkAction;
var editEntryLinkAction;
var linkAddEntryProvider;
var linkEditEntryProvider;
var chatLinkProvider;
var filePickerPromises = [];
var withError = false;
var selectedFieldId = [];

var addEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  omitPages,
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.addEntryLinkAction, { action: 'screen' });
var editEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  omitPages,
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.editEntryLinkAction, { action: 'screen' });
var chatLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  omitPages,
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.chatLinkAction, { action: 'screen' });

function linkProviderInit() {
  linkAddEntryProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#add-entry-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: addEntryLinkData,
    // Events fired from the provider
    onEvent(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkAddEntryProvider.then((result) => {
    addEntryLinkAction = result.data || {};
    linkEditEntryProvider.forwardSaveRequest();
  });
  linkEditEntryProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#edit-entry-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: editEntryLinkData,
    // Events fired from the provider
    onEvent(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkEditEntryProvider.then((result) => {
    editEntryLinkAction = result.data || {};
    dataSourceProvider().forwardSaveRequest();
  });
  chatLinkProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#chat-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: chatLinkData,
    // Events fired from the provider
    onEvent(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  chatLinkProvider.then((result) => {
    editEntryLinkAction = result.data || {};
    dataSourceProvider().forwardSaveRequest();
  });
}

function initUserFilePickerProvider(userFolder) {
  Fliplet.Widget.toggleSaveButton(userFolder.folder && userFolder.folder.selectFiles && userFolder.folder.selectFiles.length > 0);
  Fliplet.Studio.emit('widget-save-label-update', {
    text: 'Select'
  });

  userFolder.folder = $.extend(true, {
    selectedFiles: {},
    selectFiles: [], // To use the restore on File Picker
    selectMultiple: false,
    type: 'folder',
    provId: userFolder.id
  }, userFolder.folder);

  const providerFilePickerInstance = Fliplet.Widget.open('com.fliplet.file-picker', {
    data: userFolder.folder,
    onEvent(e, data) {
      switch (e) {
        case 'widget-rendered':
          break;
        case 'widget-set-info':
          Fliplet.Widget.toggleSaveButton(!!data.length);

          var msg = data.length ? `${data.length} files selected` : 'no selected files';

          Fliplet.Widget.info(msg);
          break;
        default:
          break;
      }
    }
  });

  providerFilePickerInstance.then((data) => {
    Fliplet.Widget.info('');
    Fliplet.Widget.toggleCancelButton(true);
    Fliplet.Widget.toggleSaveButton(true);

    userFolder.folder.selectFiles = data.data.length ? data.data : [];
    widgetData.userFolder = userFolder;

    _.remove(filePickerPromises, { id: userFolder.folder.provId });
    Fliplet.Studio.emit('widget-save-label-update', {
      text: 'Save & Close'
    });

    if (userFolder.folder.selectFiles.length) {
      $('.select-photo-folder .file-picker-btn').text('Replace folder');
      $('.select-photo-folder .selected-user-folder span').text(userFolder.folder.selectFiles[0].name);
      $('.select-photo-folder .selected-user-folder').removeClass('hidden');
    }
  });

  providerFilePickerInstance.id = userFolder.id;
  filePickerPromises.push(providerFilePickerInstance);
}

function initFilePickerProvider(field) {
  Fliplet.Widget.toggleSaveButton(field.folder && field.folder.selectFiles && field.folder.selectFiles.length > 0);

  Fliplet.Studio.emit('widget-save-label-update', {
    text: 'Select'
  });

  field.folder = $.extend(true, {
    selectedFiles: {},
    selectFiles: [], // To use the restore on File Picker
    selectMultiple: false,
    type: 'folder',
    provId: field.id
  }, field.folder);

  const providerFilePickerInstance = Fliplet.Widget.open('com.fliplet.file-picker', {
    data: field.folder,
    onEvent(e, data) {
      switch (e) {
        case 'widget-rendered':
          break;
        case 'widget-set-info':
          Fliplet.Widget.toggleSaveButton(!!data.length);

          var msg = data.length ? `${data.length} files selected` : 'no selected files';

          Fliplet.Widget.info(msg);
          break;
        default:
          break;
      }
    }
  });

  providerFilePickerInstance.then((data) => {
    Fliplet.Widget.info('');
    Fliplet.Widget.toggleCancelButton(true);
    Fliplet.Widget.toggleSaveButton(true);

    field.folder.selectFiles = data.data.length ? data.data : [];

    if (field.from === 'summary') {
      widgetData['summary-fields'].forEach((item, index) => {
        if (item.id === field.id) {
          widgetData['summary-fields'][index].folder = field.folder;
        }
      });
    } else if (field.from === 'details') {
      widgetData.detailViewOptions.forEach((item, index) => {
        if (item.id === field.id) {
          widgetData.detailViewOptions[index].folder = field.folder;
        }
      });
    }

    _.remove(filePickerPromises, { id: field.folder.provId });
    Fliplet.Studio.emit('widget-save-label-update', {
      text: 'Save & Close'
    });

    if (field.folder.selectFiles.length) {
      $(`[data-field-id="${field.id}"] .file-picker-btn`).text('Replace folder');
      $(`[data-field-id="${field.id}"] .selected-folder`).removeClass('hidden');
      $(`[data-field-id="${field.id}"] .selected-folder span`).text(field.folder.selectFiles[0].name);
    }
  });

  providerFilePickerInstance.id = field.id;
  filePickerPromises.push(providerFilePickerInstance);
}

function initialize() {
  linkProviderInit();
  attahObservers();
  dynamicLists = new DynamicLists(widgetData);
  dataSourceProvider = Fliplet.Registry.get('datasource-provider');
}

function validate(value) {
  // token field returns always an array with one element even if we didn't past any data in the field
  // that is why we are checking a value of the first element if no data past it will be an empty
  if (Array.isArray(value)) {
    return !!value[0];
  }

  if (value && value !== '' && value !== 'none') {
    return true;
  }

  return false;
}

function toggleError(showError, element) {
  if (showError) {
    const $element = $(element);

    $element.addClass('has-error');

    // the token field has deferent structure from other elements
    // that is why we show error differently for it
    if ($element.hasClass('token-input')) {
      $element.parents('.form-control').addClass('has-error');
    } else {
      $element.parents('.form-group').addClass('has-error');
      $element.parents('.panel').addClass('panel-danger').removeClass('panel-default');
    }

    return;
  }

  $('.has-error').removeClass('has-error');
  $('.component-error').addClass('hidden');
  $('.panel-danger').removeClass('panel-danger').addClass('panel-default');
}

function attahObservers() {
  $(document)
    .on('click', '[data-file-picker-user]', () => {
      const idAttr = $('#select_user_folder_type').attr('id');
      const userFolder = widgetData.userFolder || {
        id: idAttr,
        folder: {}
      };

      initUserFilePickerProvider(userFolder);
    })
    .on('click', '[data-file-picker-summary]', function() {
      const fieldId = $(this).parents('.picker-provider-button').data('field-id');
      let field = _.find(widgetData['summary-fields'], { id: fieldId });

      highlightError(selectedFieldId, true);

      if (field) {
        initFilePickerProvider(field);
      } else {
        field = {
          id: fieldId,
          folder: {},
          from: 'summary'
        };

        initFilePickerProvider(field);
      }
    })
    .on('click', '[data-file-picker-details]', function() {
      const fieldId = $(this).parents('.picker-provider-button').data('field-id');
      let field = _.find(widgetData.detailViewOptions, { id: fieldId });

      highlightError(selectedFieldId, true);

      if (field) {
        initFilePickerProvider(field);
      } else {
        field = {
          id: fieldId,
          folder: {},
          from: 'details'
        };

        initFilePickerProvider(field);
      }
    })
    .on('change', '[name="image_type_select"]', function() {
      const $element = $(this);
      const dataType = $element.val();
      const fieldId = $element.data('current-id');

      switch (dataType) {
        case 'all-folders':
          selectedFieldId.push(fieldId);
          break;
        case 'url':
          selectedFieldId = _.filter(selectedFieldId, item => item !== fieldId);
          break;
        default:
          break;
      }
    })
    .on('change', '[name="detail_field_type"]', function() {
      const $element = $(this);
      const fieldName = $element.val();
      const fieldId = $element.parents('.rTableRow.clearfix').data('id');
      const fieldIdInSelectedFields = selectedFieldId.indexOf(fieldId) !== -1;

      if (fieldName !== 'image' && fieldIdInSelectedFields) {
        selectedFieldId = _.filter(selectedFieldId, item =>
          // eslint-disable-next-line eqeqeq
          item != fieldId
        );
      } else if ($(`#detail_image_field_type_${fieldId}`).val() === 'all-folders') {
        selectedFieldId.push(fieldId);
      }
    })
    .on('datasource-initialized', () => {
      dataSourceProvider().then((dataSource) => {
        dynamicLists.config.dataSourceId = dataSource.data.id;

        if (!withError) {
          save(true);
        }
      });
    });

  $('[data-toggle="tooltip"]').tooltip();
  $('form').submit((event) => {
    event.preventDefault();
    dynamicLists.saveLists()
      .then(() => {
        widgetData = dynamicLists.config;

        if (filePickerPromises.length) {
          filePickerPromises.forEach((promise) => {
            promise.forwardSaveRequest();
          });

          return;
        }

        // Validation for required fields
        const requiredFields = {
          admins: [
            {
              value: widgetData.userDataSourceId,
              field: '#user_data_source_provider'
            },
            {
              value: widgetData.userEmailColumn,
              field: '#select_user_email'
            },
            {
              value: widgetData.userAdminColumn,
              field: '#select_user_admin'
            }
          ],
          'users-admins': [
            {
              value: widgetData.userDataSourceId,
              field: '#user_data_source_provider'
            },
            {
              value: widgetData.userEmailColumn,
              field: '#select_user_email'
            },
            {
              value: widgetData.userAdminColumn,
              field: '#select_user_admin'
            },
            {
              value: widgetData.userNameFields,
              field: '#user-name-column-fields-tokenfield-tokenfield'
            },
            {
              value: widgetData.userListEmailColumn,
              field: '#select_user_email_data'
            }
          ],
          user: [
            {
              value: widgetData.userDataSourceId,
              field: '#user_data_source_provider'
            },
            {
              value: widgetData.userEmailColumn,
              field: '#select_user_email'
            },
            {
              value: widgetData.userNameFields,
              field: '#user-name-column-fields-tokenfield-tokenfield'
            },
            {
              value: widgetData.userListEmailColumn,
              field: '#select_user_email_data'
            }
          ]
        };
        const selectedPermissions = [];
        const managementErrors = [];

        if (widgetData.addEntry) {
          selectedPermissions.push('addPermissions');
        }

        if (widgetData.editEntry) {
          selectedPermissions.push('editPermissions');
        }

        if (widgetData.deleteEntry) {
          selectedPermissions.push('deletePermissions');
        }

        selectedPermissions.forEach((permission) => {
          if (requiredFields[widgetData[permission]]) {
            requiredFields[widgetData[permission]].forEach((field) => {
              if (!validate(field.value)) {
                managementErrors.push(field.field);
              }
            });
          }

          if (managementErrors.length) {
            const $componentError = $('.component-error');

            $componentError.removeClass('hidden').addClass('bounceInUp');
            managementErrors.forEach((field) => {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(() => {
              $componentError.addClass('hidden').removeClass('bounceInUp');
            }, 4000);
          }
        });

        if (managementErrors.length) {
          return;
        }

        toggleError(false);

        if (widgetData.filterOptions.length) {
          const filterError = [];
          const filterFieldValues = [];
          const logicOptionsWithoutValues = [
            'empty',
            'notempty',
            'dateis',
            'datebefore',
            'dateafter',
            'datebetween'
          ];

          widgetData.filterOptions.forEach((item) => {
            if (logicOptionsWithoutValues.indexOf(item.logic) !== -1) {
              return;
            }

            if (item.logic === 'between') {
              filterFieldValues.push({
                field: `#value-field-from-${item.id}`,
                value: item.value.from,
                id: item.id,
                valueType: item.valueType.from
              });

              filterFieldValues.push({
                field: `#value-field-to-${item.id}`,
                value: item.value.to,
                id: item.id,
                valueType: item.valueType.to
              });

              return;
            }

            filterFieldValues.push({
              field: `#value-field-${item.id}`,
              value: item.fieldValue,
              id: item.id,
              valueType: item.valueType
            });
          });

          filterFieldValues.forEach((field) => {
            if (field.valueType === 'enter-value') {
              $(field.field).parents('.panel-default').removeClass('filter-error');
              $(field.field).parents(`#filter-value-${field.id}`).find('label').removeClass('has-error-text');
              $(field.field).parents(`#filter-value-from-${field.id}`).find('label').removeClass('has-error-text');
              $(field.field).parents(`#filter-value-to-${field.id}`).find('label').removeClass('has-error-text');

              return;
            }

            if (!field.value || !field.value.trim()) {
              filterError.push({
                item: field.field,
                id: field.id
              });
            } else {
              $(field.field).parents('.panel-default').removeClass('filter-error');
              $(field.field).parents(`#filter-value-${field.id}`).find('label').removeClass('has-error-text');
              $(field.field).parents(`#filter-value-from-${field.id}`).find('label').removeClass('has-error-text');
              $(field.field).parents(`#filter-value-to-${field.id}`).find('label').removeClass('has-error-text');
            }
          });

          if (filterError.length) {
            $('.error-holder').removeClass('hidden');

            filterError.forEach((field) => {
              $(field.item).addClass('has-error');
              $(field.item).parents('.panel-default').addClass('filter-error');
              $(field.item).parents(`#filter-value-${field.id}`).find('label').addClass('has-error-text');
              $(field.item).parents(`#filter-value-from-${field.id}`).find('label').addClass('has-error-text');
              $(field.item).parents(`#filter-value-to-${field.id}`).find('label').addClass('has-error-text');
            });

            return;
          }

          $('#filter-value > .control-label > label').removeClass('has-error-text');
          $('.error-holder').addClass('hidden');

          toggleError(false);
        }

        let errors = [];
        let values = [];

        if (widgetData.social && widgetData.social.comments) {
          errors = [];
          values = [];

          values.push({
            value: widgetData.userDataSourceId,
            field: '#user_data_source_provider'
          });
          values.push({
            value: widgetData.userEmailColumn,
            field: '#select_user_email'
          });

          if (!widgetData.userNameFields || !_.filter(widgetData.userNameFields, name => name).length) {
            errors.push('#user-name-column-fields-tokenfield');
          }

          values.forEach((field) => {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach((field) => {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(() => {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);

            return;
          }

          toggleError(false);
        }

        const imageFolderSelected = validateImageFoldersSelection();

        if (imageFolderSelected) {
          highlightError(selectedFieldId, false);

          $('[data-relations-fields]').addClass('btn-default').removeClass('relations-error');
        } else {
          highlightError(selectedFieldId, true);

          $('[data-relations-fields]').removeClass('btn-default').addClass('relations-error');

          Fliplet.Modal.alert({
            title: 'Invalid configuration',
            message: 'Please review settings in <strong>Data view settings</strong> to continue.'
          });

          return;
        }

        if (widgetData.pollEnabled && widgetData.pollColumn) {
          values.push({
            value: widgetData.pollColumn,
            field: '#select_poll_data'
          });

          values.forEach((field) => {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach((field) => {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(() => {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);

            return;
          }

          toggleError(false);
        }

        if (widgetData.surveyEnabled && widgetData.surveyColumn) {
          values.push({
            value: widgetData.surveyColumn,
            field: '#select_survey_data'
          });

          values.forEach((field) => {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach((field) => {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(() => {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);

            return;
          }

          toggleError(false);
        }

        if (widgetData.questionsEnabled && widgetData.questionsColumn) {
          values.push({
            value: widgetData.questionsColumn,
            field: '#select_questions_data'
          });

          values.forEach((field) => {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach((field) => {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(() => {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);

            return;
          }

          toggleError(false);
        }

        return linkAddEntryProvider.forwardSaveRequest();
      });
  });

  function highlightError(fieldIds, showError) {
    const action = showError ? 'removeClass' : 'addClass';

    _.each(fieldIds, (id) => {
      $(`[data-field-id="${id}"] .text-danger`)[action]('hidden');
    });
  }

  function validateImageFoldersSelection() {
    if (!widgetData['summary-fields']) {
      highlightError(selectedFieldId, true);

      return selectedFieldId.length === 0;
    }

    const totalArray = _.concat(widgetData.detailViewOptions, widgetData['summary-fields']);
    const errorInputIds = _.filter(selectedFieldId, id => !_.some(totalArray, item => item.id === id && item.folder));

    highlightError(errorInputIds, true);

    return errorInputIds.length === 0;
  }

  Fliplet.Widget.onSaveRequest(() => {
    if (!dynamicLists.isLoaded) {
      Fliplet.Widget.complete();

      return;
    }

    const dataViewWindowIsOpen = $('.relations-tab').hasClass('present');
    const imageFolderSelectionIsValid = validateImageFoldersSelection();

    if (imageFolderSelectionIsValid || filePickerPromises.length || !dataViewWindowIsOpen) {
      highlightError(selectedFieldId, false);
      $('form').submit();

      return;
    }

    Fliplet.Modal.alert({
      title: 'Invalid configuration',
      message: 'Please review settings in <strong>Data view settings</strong> to continue.'
    });
  });
}

function save(notifyComplete) {
  widgetData.addEntryLinkAction = addEntryLinkAction;
  widgetData.editEntryLinkAction = editEntryLinkAction;

  Fliplet.Widget.save(widgetData).then(() => {
    if (notifyComplete) {
      Fliplet.Widget.complete();
      window.location.reload();
    } else {
      Fliplet.Studio.emit('reload-widget-instance', widgetId);
    }
  });
}

initialize();
