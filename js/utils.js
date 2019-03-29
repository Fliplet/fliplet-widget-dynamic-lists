Fliplet.Registry.set('dynamicListUtils', function() {
  function dataContains(data, value) {
    if (!data) {
      return false;
    }

    if (_.isArray(data)) {
      return _.some(data, function (el) {
        return el.toLowerCase().indexOf(value) > -1;
      });
    }

    if (typeof data !== 'string') {
      data = '' + data;
    }

    return data.toLowerCase().indexOf(value) > -1;
  }

  return {
    dataContains: dataContains
  };
}());
