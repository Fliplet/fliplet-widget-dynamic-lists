var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('dynamic-lists-1-3-0', function (data) {
  var id = $(this).data('dynamic-lists-1-3-0-id');
  var layoutType = !data.layout ? 'general' : data.layout;

  if (data.advancedSettings && !data.advancedSettings.jsEnabled) {
    var DynamicList = Fliplet.Registry.get('dynamic-list:1.3.0:' + layoutType);
    dynamicLists[id] = new DynamicList(id, data);
  }
});
