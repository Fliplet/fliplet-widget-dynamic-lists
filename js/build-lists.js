Fliplet.Registry.set('dynamic-list:1.2.0:general', (function () {
  var DynamicLists = function(id, data, container) {
    var _this = this;

    this.data = data;
    this.$container = $(container);
    
    return this;
  }
  return DynamicLists;
})());