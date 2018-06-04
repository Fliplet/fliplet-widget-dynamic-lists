var dynamicLists = {};

$('[data-dynamic-lists-id]').each(function(){
  var container = this;
  var id = $(this).data('dynamic-lists-id');
  var uuid = $(this).data('dynamic-lists-uuid');
  var data = Fliplet.Widget.getData(id);

  if (data.layout === 'small-card' && !data.advancedSettings.jsEnabled) {
    dynamicLists[id] = new SmallCardsLayout(data, container);
    return;
  }
  if (data.layout === 'small-card' && data.advancedSettings.jsEnabled) {
    dynamicLists[id] = new SmallCardsLayoutInline(data, container);
    return;
  }

  dynamicLists[id] = new DynamicLists(data, container);
});



