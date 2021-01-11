var dynamicLists = dynamicLists || {};

Fliplet.Widget.instance('dynamic-lists', function(data) {
  var container = this;
  var id = data.id;

  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});
