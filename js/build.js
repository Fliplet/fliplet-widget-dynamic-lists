// Global container for all dynamic list instances
var dynamicLists = dynamicLists || {};

/**
 * Main widget initialization function
 * Creates a new DynamicLists instance for each widget on the page
 * @param {Object} data - Widget configuration data including id, layout, and other settings
 */
Fliplet.Widget.instance('dynamic-lists', function(data) {
  var container = this; // Widget container element
  var id = data.id; // Unique widget instance ID

  // Only initialize if no specific layout is set (normal runtime mode)
  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});

/**
 * Listen for studio events to handle layout changes
 * Updates widget attributes when layout is changed in the studio
 */
Fliplet.Studio.onEvent(function(event) {
  var eventDetail = event.detail;

  // Handle dynamic list layout change events
  if (eventDetail.type === 'dynamicListLayout') {
    // Update the widget instance's layout attribute
    $('.fl-widget-instance[data-id="' + eventDetail.data.id + '"]').attr('data-settings-layout', eventDetail.data.layout);
  }
});
