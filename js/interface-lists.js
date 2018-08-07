var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var dynamicLists;

var addEntryLinkAction;
var editEntryLinkAction;
var linkAddEntryProvider;
var linkEditEntryProvider;

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
    save(true);
  });
}

function initialize() {
  linkProviderInit();
  attahObservers();
  dynamicLists = new DynamicLists(widgetData);
}

function attahObservers() {
  $('form').submit(function (event) {
  event.preventDefault();
    Promise.all([
      linkAddEntryProvider.forwardSaveRequest(),
      linkEditEntryProvider.forwardSaveRequest()
    ]);
  });

  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
  });
}

function save(notifyComplete) {
  dynamicLists.saveLists()
    .then(function() {
      widgetData = dynamicLists.config;
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
    });
}

initialize();