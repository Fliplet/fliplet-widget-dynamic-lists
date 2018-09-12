var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('dynamic-lists-1-2-0', function (data) {
  var container = this;
  var id = $(this).data('dynamic-lists-1-2-0-id');
  var layoutType = !data.layout ? 'general' : data.layout;
  var DynamicList = Fliplet.Registry.get('dynamic-list:1.2.0:' + layoutType);

  dynamicLists[id] = new DynamicList(id, data, container);
});
