var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var dynamicLists;

var pollLinkAction;
var surveyLinkAction;
var questionsLinkAction;
var addEntryLinkAction;
var editEntryLinkAction;
var linkPollProvider;
var linkSurveyProvider;
var linkQuestionsProvider;
var linkAddEntryProvider;
var linkEditEntryProvider;
var filePickerPromises = [];
var withError = false;

var pollLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.pollLinkAction);
var surveyLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.surveyLinkAction);
var questionsLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.questionsLinkAction);

var addEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.addEntryLinkAction);
var editEntryLinkData = $.extend(true, {
  action: 'screen',
  page: '',
  transition: 'fade',
  options: {
    hideAction: true
  }
}, widgetData.editEntryLinkAction);

function linkProviderInit() {
  linkPollProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#poll-screen-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: pollLinkData,
    // Events fired from the provider
    onEvent: function(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkPollProvider.then(function(result) {
    pollLinkAction = result.data || {};
    linkSurveyProvider.forwardSaveRequest();
  });
  linkSurveyProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#survey-screen-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: surveyLinkData,
    // Events fired from the provider
    onEvent: function(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkSurveyProvider.then(function(result) {
    surveyLinkAction = result.data || {};
    linkQuestionsProvider.forwardSaveRequest();
  });
  linkQuestionsProvider = Fliplet.Widget.open('com.fliplet.link', {
    // If provided, the iframe will be appended here,
    // otherwise will be displayed as a full-size iframe overlay
    selector: '#questions-screen-link',
    // Also send the data I have locally, so that
    // the interface gets repopulated with the same stuff
    data: questionsLinkData,
    // Events fired from the provider
    onEvent: function(event, data) {
      if (event === 'interface-validate') {
        Fliplet.Widget.toggleSaveButton(data.isValid === true);
      }
    }
  });
  linkQuestionsProvider.then(function(result) {
    questionsLinkAction = result.data || {};
    linkAddEntryProvider.forwardSaveRequest();
  });

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

function initFilePickerProvider(field) {
  Fliplet.Widget.toggleSaveButton(field.folder && field.folder.selectFiles && field.folder.selectFiles.length > 0);

  Fliplet.Studio.emit('widget-save-label-update', {
    text: 'Select'
  });

  if (field.folder) {

  }

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
  if (value && value !== '' && value !== 'none') {
    return true;
  }

  return false;
}

function attahObservers() {
  $(document)
    .on('click', '[data-file-picker-summary]', function() {
      var fieldId = $(this).parents('.picker-provider-button').data('field-id');
      var field = _.find(widgetData['summary-fields'], { id: fieldId });

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
    });
  $('[data-toggle="tooltip"]').tooltip();
  $('form').submit(function (event) {
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
        if ((widgetData.addEntry && widgetData.addPermissions === 'admins')
          || (widgetData.editEntry && widgetData.editPermissions === 'admins')
          || (widgetData.deleteEntry && widgetData.deletePermissions === 'admins')) {
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
          values.push({
            value: widgetData.userAdminColumn,
            field: '#select_user_admin'
          });
          
          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors && errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
               $(field).addClass('has-error');
               $(field).parents('.form-group').addClass('has-error');
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
            $('.has-error').removeClass('has-error');
            $('.component-error').addClass('hidden');
          }
        }

        if ((widgetData.editEntry && widgetData.editPermissions === 'user')
          || (widgetData.deleteEntry && widgetData.deletePermissions === 'user')) {
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
          values.push({
            value: widgetData.userListEmailColumn,
            field: '#select_user_email_data'
          });

          if (!widgetData.userNameFields && !widgetData.userNameFields.length) {
            errors.push('#user-name-column-fields-tokenfield');
          }
          
          values.forEach(function(field) {
            if (!validate(field.value)) {
              errors.push(field.field);
            }
          });

          if (errors && errors.length) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            errors.forEach(function(field) {
               $(field).addClass('has-error');
               $(field).parents('.form-group').addClass('has-error');
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
            $('.has-error').removeClass('has-error');
            $('.component-error').addClass('hidden');
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
               $(field).addClass('has-error');
               $(field).parents('.form-group').addClass('has-error');
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
            $('.has-error').removeClass('has-error');
            $('.component-error').addClass('hidden');
          }
        }

        if (widgetData.layout === 'agenda') {
          return linkPollProvider.forwardSaveRequest();
        }

        return linkAddEntryProvider.forwardSaveRequest();
      });
  });

  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
  });
}

function save(notifyComplete) {
  widgetData.pollLinkAction = pollLinkAction;
  widgetData.surveyLinkAction = surveyLinkAction;
  widgetData.questionsLinkAction = questionsLinkAction;

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