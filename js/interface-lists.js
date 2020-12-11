var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var page = Fliplet.Widget.getPage();
var dynamicLists;

var omitPages = page ? [page.id] : [];
var addEntryLinkAction;
var editEntryLinkAction;
var linkAddEntryProvider;
var linkEditEntryProvider;
var filePickerPromises = [];
var withError = false;
var selectedFieldId = [];

var addEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  omitPages: omitPages,
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.addEntryLinkAction, { action: 'screen' });
var editEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  omitPages: omitPages,
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.editEntryLinkAction, { action: 'screen' });

function linkProviderInit() {
  linkAddEntryProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#add-entry-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: addEntryLinkData,
    // Events fired from the provider
    onEvent: function(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkAddEntryProvider.then(function(result) {
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
    onEvent: function(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkEditEntryProvider.then(function(result) {
    editEntryLinkAction = result.data || {};
    if (!withError) {
      save(true);
    }
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

  var providerFilePickerInstance = Fliplet.Widget.open('com.fliplet.file-picker', {
    data: userFolder.folder,
    onEvent: function(e, data) {
      switch (e) {
        case 'widget-rendered':
          break;
        case 'widget-set-info':
          Fliplet.Widget.toggleSaveButton(!!data.length);
          var msg = data.length ? data.length + ' files selected' : 'no selected files';
          Fliplet.Widget.info(msg);
          break;
        default:
          break;
      }
    }
  });

  providerFilePickerInstance.then(function(data) {
    Fliplet.Widget.info('');
    Fliplet.Widget.toggleCancelButton(true);
    Fliplet.Widget.toggleSaveButton(true);

    userFolder.folder.selectFiles = data.data.length ? data.data : [];
    widgetData.userFolder = userFolder;

    var itemProvider = _.find(filePickerPromises, { id: userFolder.folder.provId });
    itemProvider = null;
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

  var providerFilePickerInstance = Fliplet.Widget.open('com.fliplet.file-picker', {
    data: field.folder,
    onEvent: function(e, data) {
      switch (e) {
        case 'widget-rendered':
          break;
        case 'widget-set-info':
          Fliplet.Widget.toggleSaveButton(!!data.length);
          var msg = data.length ? data.length + ' files selected' : 'no selected files';
          Fliplet.Widget.info(msg);
          break;
        default:
          break;
      }
    }
  });

  providerFilePickerInstance.then(function(data) {
    Fliplet.Widget.info('');
    Fliplet.Widget.toggleCancelButton(true);
    Fliplet.Widget.toggleSaveButton(true);

    field.folder.selectFiles = data.data.length ? data.data : [];

    if (field.from === 'summary') {
      widgetData['summary-fields'].forEach(function(item, index) {
        if (item.id === field.id) {
          widgetData['summary-fields'][index].folder = field.folder;
        }
      });
    } else if (field.from === 'details') {
      widgetData.detailViewOptions.forEach(function(item, index) {
        if (item.id === field.id) {
          widgetData.detailViewOptions[index].folder = field.folder;
        }
      });
    }

    var itemProvider = _.find(filePickerPromises, { id: field.folder.provId });
    itemProvider = null;
    _.remove(filePickerPromises, { id: field.folder.provId });
    Fliplet.Studio.emit('widget-save-label-update', {
      text: 'Save & Close'
    });
    if (field.folder.selectFiles.length) {
      $('[data-field-id="' + field.id + '"] .file-picker-btn').text('Replace folder');
      $('[data-field-id="' + field.id + '"] .selected-folder').removeClass('hidden');
      $('[data-field-id="' + field.id + '"] .selected-folder span').text(field.folder.selectFiles[0].name);
    }
  });

  providerFilePickerInstance.id = field.id;
  filePickerPromises.push(providerFilePickerInstance);
}

function initialize() {
  linkProviderInit();
  attahObservers();
  dynamicLists = new DynamicLists(widgetData);
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

function toggleError (showError, element) {
  if (showError) {
    var $element = $(element);

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
    .on('click', '[data-file-picker-user]', function() {
      var idAttr = $('#select_user_folder_type').attr('id');
      var userFolder = widgetData.userFolder || {
        id: idAttr,
        folder: {}
      };
      initUserFilePickerProvider(userFolder);
    })
    .on('click', '[data-file-picker-summary]', function() {
      var fieldId = $(this).parents('.picker-provider-button').data('field-id');
      var field = _.find(widgetData['summary-fields'], { id: fieldId });

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
      var fieldId = $(this).parents('.picker-provider-button').data('field-id');
      var field = _.find(widgetData.detailViewOptions, { id: fieldId });

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
      var $element = $(this);
      var dataType = $element.val();
      var fieldId = $element.data('current-id');

      switch (dataType) {
        case 'all-folders':
          selectedFieldId.push(fieldId);
          break;
        case 'url':
          selectedFieldId = _.filter(selectedFieldId, function(item) {
            return item !== fieldId;
          });
          break;
      }
    })
    .on('change', '[name="detail_field_type"]', function() {
      var $element = $(this);
      var fieldName = $element.val();
      var fieldId = $element.parents('.rTableRow.clearfix').data('id');
      var fieldIdInSelectedFields = selectedFieldId.indexOf(fieldId) !== -1;

      if (fieldName !== 'image' && fieldIdInSelectedFields) {
        selectedFieldId = _.filter(selectedFieldId, function(item) {
          return item != fieldId;
        });
      } else if ($('#detail_image_field_type_' + fieldId).val() === 'all-folders') {
        selectedFieldId.push(fieldId);
      }
    });

  $('[data-toggle="tooltip"]').tooltip();
  $('form').submit(function(event) {
    event.preventDefault();
    dynamicLists.saveLists()
      .then(function() {
        widgetData = dynamicLists.config;

        if (filePickerPromises.length) {
          filePickerPromises.forEach(function(promise) {
            promise.forwardSaveRequest();
          });
          return;
        }

        // Validation for required fields
        var requiredFields = {
          admins:[
            {
              value: widgetData.userDataSourceId,
              field: '#select_user_datasource'
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
          "users-admins": [
            {
              value: widgetData.userDataSourceId,
              field: '#select_user_datasource'
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
              field: '#select_user_datasource'
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
        var selectedPermissions = [];
        var managementErrors = [];

        if (widgetData.addEntry) {
          selectedPermissions.push('addPermissions');
        }

        if (widgetData.editEntry) {
          selectedPermissions.push('editPermissions');
        }

        if (widgetData.deleteEntry) {
          selectedPermissions.push('deletePermissions');
        }

        selectedPermissions.forEach(function(permission) {
          if (requiredFields[widgetData[permission]]) {
            requiredFields[widgetData[permission]].forEach(function(field) {
              if (!validate(field.value)) {
                managementErrors.push(field.field);
              }
            });
          }

          if (managementErrors.length) {
            var $componentError = $('.component-error');

            $componentError.removeClass('hidden').addClass('bounceInUp');
            managementErrors.forEach(function(field) {
              toggleError(true, field);
            });

            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }

            setTimeout(function() {
              $componentError.addClass('hidden').removeClass('bounceInUp');
            }, 4000);
          }
        });

        if (managementErrors.length) {
          return;
        }

        toggleError(false);

        if (widgetData.filterOptions.length) {
          var errors = [];
          var values = [];

          widgetData.filterOptions.forEach(function(item) {
            values.push({
              field: '#value-field-' + item.id,
              value: item.value,
            })
          })

          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          })

          if (errors.length) {
            var $errorLabels = $('#filter-value > .control-label > label');

            $('.error-holder').removeClass('hidden');

            errors.forEach(function(item) {
              $(item).addClass('has-error');
              $(item).parents('#filter-value').find('label').addClass('has-error-text');

              values.forEach(function(field) {
                if (validate(field.value)) {
                  $(field.field).parents('#filter-value').find('label').removeClass('has-error-text');
                }
              })
            })
            return;
          } else {
            $('#filter-value > .control-label > label').removeClass('has-error-text');
            $('.error-holder').addClass('hidden');

            toggleError(false);
          }
        }

        if (widgetData.social && widgetData.social.comments) {
          var errors = [];
          var values = [];

          values.push({
            value: widgetData.userDataSourceId,
            field: '#select_user_datasource'
          });
          values.push({
            value: widgetData.userEmailColumn,
            field: '#select_user_email'
          });

          if (!widgetData.userNameFields && !widgetData.userNameFields.length) {
            errors.push('#user-name-column-fields-tokenfield');
          }

          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
              toggleError(true, field);
            });
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          } else {
            toggleError(false)
          }
        }

        var imageFolderSelected = validateImageFoldersSelection();

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
          var errors = [];
          var values = [];

          values.push({
            value: widgetData.pollColumn,
            field: '#select_poll_data'
          });

          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
              toggleError(true, field)
            });
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          } else {
            toggleError(false);
          }
        }

        if (widgetData.surveyEnabled && widgetData.surveyColumn) {
          var errors = [];
          var values = [];

          values.push({
            value: widgetData.surveyColumn,
            field: '#select_survey_data'
          });

          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
              toggleError(true, field);
            });
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          } else {
            toggleError(false);
          }
        }

        if (widgetData.questionsEnabled && widgetData.questionsColumn) {
          var errors = [];
          var values = [];

          values.push({
            value: widgetData.questionsColumn,
            field: '#select_questions_data'
          });

          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
              toggleError(true, field);
            });
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          } else {
            toggleError(false);
          }
        }

        return linkAddEntryProvider.forwardSaveRequest();
      });
  });

  function highlightError(fieldIds, showError) {
    var action = showError ? 'removeClass': 'addClass';
    _.each(fieldIds, function(id) {
      $('[data-field-id="' + id + '"] .text-danger')[action]('hidden');
    });
  }

  function validateImageFoldersSelection() {
    if (!widgetData['summary-fields']) {
      highlightError(selectedFieldId, true);
      return selectedFieldId.length === 0;
    }

    var totalArray = _.concat(widgetData.detailViewOptions, widgetData['summary-fields']);
    var errorInputIds = _.filter(selectedFieldId, function(id) {
      return !_.some(totalArray, function(item) {
        return item.id === id && item.folder;
      });
    });
    highlightError(errorInputIds, true);
    return errorInputIds.length === 0;
  }

  Fliplet.Widget.onSaveRequest(function () {
    if (!dynamicLists.isLoaded) {
      Fliplet.Widget.complete();
      return;
    }

    var dataViewWindowIsOpen = $('.relations-tab').hasClass('present');
    var imageFolderSelectionIsValid = validateImageFoldersSelection();

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

  Fliplet.Widget.save(widgetData).then(function () {
    if (notifyComplete) {
      Fliplet.Widget.complete();
      window.location.reload();
    } else {
      Fliplet.Studio.emit('reload-widget-instance', widgetId);
    }
  });
}

initialize();
