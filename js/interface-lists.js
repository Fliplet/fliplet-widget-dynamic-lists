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
  $('form').submit(function (event) {
    event.preventDefault();
    dynamicLists.saveLists()
      .then(function() {
        widgetData = dynamicLists.config;

        // Validation for required fields
        if (widgetData.addEntry && widgetData.addPermissions === 'admins') {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          values.push(widgetData.userAdminColumn);
          
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        }
        if (widgetData.editEntry && widgetData.editPermissions === 'admins') {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          values.push(widgetData.userAdminColumn);
          
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        } else if (widgetData.editEntry && widgetData.editPermissions === 'user') {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          values.push(widgetData.userListEmailColumn);
          
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        }
        if (widgetData.deleteEntry && widgetData.deletePermissions === 'admins') {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          values.push(widgetData.userAdminColumn);
          
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        } else if (widgetData.deleteEntry && widgetData.deletePermissions === 'user') {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          values.push(widgetData.userListEmailColumn);
          
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        }
        if (widgetData.social && widgetData.social.comments) {
          var errors = [];
          var values = [];
          values.push(widgetData.userDataSourceId);
          values.push(widgetData.userEmailColumn);
          
          errors.push(widgetData.userNameFields && widgetData.userNameFields.length ? true : false);
          values.forEach(function(value) {
            errors.push(validate(value));
          });

          if (errors.indexOf(false) > -1) {
            $('.component-error').removeClass('hidden').addClass('bounceInUp');
            if (!linkAddEntryProvider || !linkEditEntryProvider) {
              withError = true;
              linkProviderInit();
            }
            setTimeout(function() {
              $('.component-error').addClass('hidden').removeClass('bounceInUp');
            }, 4000);
            return;
          }
          $('.component-error').addClass('hidden');
        }

        return Promise.all([
          linkAddEntryProvider.forwardSaveRequest(),
          linkEditEntryProvider.forwardSaveRequest()
        ]);
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