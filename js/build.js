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

  if (eventDetail.type === 'layout') {
    $('[data-dynamic-lists-id="' + eventDetail.data.id + '"]').parent().attr('data-settings-layout', eventDetail.data.layout);
  }
});
