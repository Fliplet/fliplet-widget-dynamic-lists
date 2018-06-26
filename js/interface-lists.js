var widgetId = Fliplet.Widget.getDefaultId();
var widgetData = Fliplet.Widget.getData(widgetId) || {};
var dynamicLists;

function save(notifyComplete) {
  dynamicLists.saveLists()
    .then(function() {
      widgetData = dynamicLists.config;
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

$('form').submit(function (event) {
  event.preventDefault();
  save(true);
});

Fliplet.Widget.onSaveRequest(function () {
  $('form').submit();
});

function initialize() {
  dynamicLists = new DynamicLists(widgetData);
}

initialize();