var dynamicLists = dynamicLists || {};
$('[data-dynamic-lists-id]').each(function(){
  var container = this;
  var id = $(this).data('dynamic-lists-id');
  var data = Fliplet.Widget.getData(id);

  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});
