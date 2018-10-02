var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('comflipletdynamic-lists-1-3-1', function (data) {
  var id = $(this).data('comflipletdynamic-lists-1-3-1-id');
  var layoutType = !data.layout ? 'general' : data.layout;

  if (data.advancedSettings && !data.advancedSettings.jsEnabled) {
    var DynamicList = Fliplet.Registry.get('comflipletdynamic-list:1.3.1:' + layoutType);
    dynamicLists[id] = new DynamicList(id, data);
  }
});
