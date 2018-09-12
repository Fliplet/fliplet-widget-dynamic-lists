var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('dynamic-lists-1-2-0', function (data) {
  var id = $(this).data('dynamic-lists-1-2-0-id');
  var layoutType = !data.layout ? 'general' : data.layout;

  if (data.advancedSettings && !data.advancedSettings.jsEnabled) {
    var DynamicList = Fliplet.Registry.get('dynamic-list:1.2.0:' + layoutType);s
    dynamicLists[id] = new DynamicList(id, data);
  }
});
