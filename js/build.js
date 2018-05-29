var dynamicLists = {};

$('[data-dynamic-lists-id]').each(function(){
  var container = this;
  var id = $(this).data('dynamic-lists-id');
  var uuid = $(this).data('dynamic-lists-uuid');
  var data = Fliplet.Widget.getData(id);

  dynamicLists[id] = new DynamicLists(data, container);
});



