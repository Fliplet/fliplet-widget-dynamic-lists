/**
 * Tests that addDetailViewData does not throw when an entry has no originalData.
 *
 * Each layout defines its own addDetailViewData. The test extracts the function
 * from each layout file and calls it with an entry that has no originalData.
 */

/* eslint-env jest */

var fs = require('fs');
var path = require('path');

global.window = global.window || {};
require(path.join(__dirname, '..', 'js', 'native-utils.js'));

var NativeUtils = global.window.NativeUtils;

var LAYOUTS = [
  'agenda-code.js',
  'news-feed-code.js',
  'simple-list-code.js',
  'small-card-code.js',
  'small-h-card-code.js'
];

function loadAddDetailViewData(file) {
  var source = fs.readFileSync(path.join(__dirname, '..', 'js', 'layout-javascript', file), 'utf8');
  var start = source.indexOf('DynamicList.prototype.addDetailViewData = function');
  var end = source.indexOf('\n};\n', start) + 3;
  var DynamicList = function() {};
  var Handlebars = {
    SafeString: function(value) { this.value = value; },
    compile: function() { return function() { return ''; }; }
  };

  new Function('DynamicList', 'NativeUtils', 'Handlebars', source.slice(start, end))( // eslint-disable-line no-new-func
    DynamicList, NativeUtils, Handlebars
  );

  return DynamicList.prototype.addDetailViewData;
}

function createContext() {
  return {
    data: {
      filterFields: ['Tags'],
      detailViewOptions: [
        { id: 1, location: 'title', column: 'Name', editable: false },
        { id: 2, location: 'subtitle', column: 'Tags', editable: false },
        { id: 3, column: 'Email', editable: true, fieldLabel: 'column-name', type: 'text' },
        { id: 4, column: 'Photo', editable: true, fieldLabel: 'column-name', type: 'image' }
      ]
    },
    imagesData: {},
    Utils: {
      String: {
        splitByCommas: function(value) { return value ? String(value).split(',') : []; },
        toFormattedString: function(value) { return value; }
      },
      Record: {
        getImageContent: function() { return { imagesData: {} }; },
        assignImageContent: function() {}
      }
    }
  };
}

describe('addDetailViewData with no originalData', function() {
  LAYOUTS.forEach(function(file) {
    it(file + ' renders empty fields and does not throw', function() {
      var addDetailViewData = loadAddDetailViewData(file);
      var entry = { id: 1 };
      var result;

      expect(function() {
        result = addDetailViewData.call(createContext(), entry, []);
      }).not.toThrow();

      expect(result.originalData).toEqual({});
    });
  });
});
