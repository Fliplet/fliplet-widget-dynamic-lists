Fliplet.Registry.set('comflipletdynamic-list:1.3.1:general', (function () {
  var DynamicLists = function(id, data, container) {
    var _this = this;

    this.data = data;
    this.$container = $(container);
    
    return this;
  }
  return DynamicLists;
})());