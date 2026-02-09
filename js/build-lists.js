/**
 * DynamicLists constructor function.
 * @param {object} data - The widget data.
 * @param {HTMLElement} container - The container element for the widget instance.
 * @returns {DynamicLists} The instance of the DynamicLists.
 */
// eslint-disable-next-line no-unused-vars
var DynamicLists = function(data, container) {
  this.data = data;
  this.$container = $(container);

  return this;
};
