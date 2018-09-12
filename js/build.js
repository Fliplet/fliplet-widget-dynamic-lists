// Include your namespaced libraries
var dynamicLists = new Fliplet.Registry.get('dynamic-lists:1.2.0');

// This function will run for each instance found in the page
Fliplet.Widget.instance('dynamic-lists-1-2-0', function (data) {
  // The HTML element for each instance. You can use $(element) to use jQuery functions on it
  var container = this;

  if (!data.layout) {
    var dynamicList = new dynamicLists(container, data);
    dynamicList.start();
  }
});
