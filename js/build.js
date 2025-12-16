var dynamicLists = dynamicLists || {};

/**
 * Creates a new instance of the Dynamic Lists widget.
 * @param {object} data - The widget data.
 * @param {number} data.id - The widget instance ID.
 * @param {string} [data.layout] - The selected layout for the list.
 */
Fliplet.Widget.instance('dynamic-lists', function(data) {
  var container = this;
  var id = data.id;

  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});

/**
 * Listens for events from Fliplet Studio.
 * Updates the widget's layout attribute when a 'dynamicListLayout' event is received.
 * @param {object} event - The event object from Fliplet Studio.
 * @param {object} event.detail - The event detail object.
 * @param {string} event.detail.type - The type of the event.
 * @param {object} event.detail.data - The data associated with the event.
 * @param {number} event.detail.data.id - The widget instance ID.
 * @param {string} event.detail.data.layout - The new layout name.
 */
Fliplet.Studio.onEvent(function(event) {
  var eventDetail = event.detail;

  if (eventDetail.type === 'dynamicListLayout') {
    $('.fl-widget-instance[data-id="' + eventDetail.data.id + '"]').attr('data-settings-layout', eventDetail.data.layout);
  }
});
