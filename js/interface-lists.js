var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData() || {};
var dynamicLists;

function save(notifyComplete) {
  dynamicLists.saveLists();

  Fliplet.Widget.save(dynamicLists.config).then(function () {
    if (notifyComplete) {
      Fliplet.Widget.complete();
      window.location.reload();
    } else {
      Fliplet.Studio.emit('reload-widget-instance', widgetId);
    }
  });
}

$('form').submit(function (event) {
  event.preventDefault();
  save(true);
});

Fliplet.Studio.onMessage(function(event) {
  if (event.data && event.data.event === 'overlay-close') {
    dynamicLists.reloadDataSources(event.data.data.dataSourceId);
  }
});

Fliplet.Widget.onSaveRequest(function () {
  $('form').submit();
});

function initialize() {
  dynamicLists = new DynamicLists(widgetData);
}

initialize();