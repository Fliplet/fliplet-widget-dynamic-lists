var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('dynamic-lists', function(data) {
  var container = this;
  var id = data.id;

  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});

Fliplet.Studio.onEvent(function(event) {
  var eventDetail = event.detail;

  if (eventDetail.type === 'dynamicListLayout') {
    $('.fl-widget-instance[data-id="' + eventDetail.data.id + '"]').attr('data-settings-layout', eventDetail.data.layout);
  }
});
