var dynamicLists = dynamicLists || {};
$('[data-dynamic-lists-id]').each(function(){
  var container = this;
  var id = $(this).data('dynamic-lists-id');
  var data = Fliplet.Widget.getData(id);

  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }

  if (data.layout === 'simple-list' || data.layout === 'news-feed') {
    var showLines = Modernizr.ie11 ? 4 : 3;
    var descriptionSelector = data.layout === 'simple-list' ? '.list-item-description' : '.news-feed-item-description';
    var awaitForDom = setInterval(function() {
      if ($(descriptionSelector).length) {
        clearInterval(awaitForDom);
        var descriptions = document.querySelectorAll(descriptionSelector);
        for (var i = 0; i < descriptions.length; i++) {
          $clamp(descriptions[i], {clamp: showLines});
        }
      }
    }, 200);
  }

});