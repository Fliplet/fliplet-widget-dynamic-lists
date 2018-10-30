var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var dynamicLists;

var addEntryLinkAction;
var editEntryLinkAction;
var linkAddEntryProvider;
var linkEditEntryProvider;
var withError = false;

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
  $('[data-toggle="tooltip"]').tooltip();
  $('form').submit(function (event) {
    event.preventDefault();
    dynamicLists.saveLists()
      .then(function() {
        widgetData = dynamicLists.config;

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

        return linkAddEntryProvider.forwardSaveRequest();
      });
  });

  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
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