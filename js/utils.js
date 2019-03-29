Fliplet.Registry.set('dynamicListUtils', function() {
  function recordContains(record, value) {
    if (!record) {
      return false;
    }

    if (_.isArray(record)) {
      return _.some(record, function (el) {
        return recordContains(el, value);
      });
    }

    if (typeof record !== 'string') {
      record = '' + record;
    }

    return record.toLowerCase().indexOf(value) > -1;
  }

  function runRecordFilters(records, filters) {
    var operators = {
      '==': function(a, b) { return a == b },
      '!=': function(a, b) { return a != b },
      '>': function(a, b) { return a > b },
      '>=': function(a, b) { return a >= b },
      '<': function(a, b) { return a < b },
      '<=': function(a, b) { return a <= b }
    };

    return _.filter(records, function(record) {
      var matched = 0;

      _.some(filters, function(filter) {
        var condition = filter.condition;
        var rowData;
        // Case insensitive
        if (filter.value !== null && filter.value !== '' && typeof filter.value !== 'undefined') {
          filter.value = filter.value.toLowerCase();
        }
        if (record.data[filter.column] !== null && record.data[filter.column] !== '' && typeof record.data[filter.column] !== 'undefined') {
          rowData = record.data[filter.column].toString().toLowerCase();
        }

        switch (condition) {
          case 'contains':
            if (rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) > -1) {
              matched++;
              return true;
            }
            break;
          case 'notcontain':
            if (rowData !== null && typeof rowData !== 'undefined' && rowData.indexOf(filter.value) === -1) {
              matched++;
              return true;
            }
            break;
          case 'regex':
            var pattern = new RegExp(filter.value);
            if (pattern.test(rowData)){
              matched++;
              return true;
            }
            break;
          default:
            if (operators[condition](rowData, filter.value)) {
              matched++;
              return true;
            }
            break;
        }
      });

      return matched >= filters.length;
    });
  }

  return {
    Record: {
      contains: recordContains
    },
    Records: {
      runFilters: runRecordFilters
    }
  };
}());
