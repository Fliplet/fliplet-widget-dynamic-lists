/* eslint-env jest */

/**
 * PS-2311: likes and bookmarks data sources are created without `update` open to all.
 * Comments keep their rules (edit uses update).
 */

var fs = require('fs');
var path = require('path');

var code = fs.readFileSync(path.join(__dirname, '..', 'js', 'interface.js'), 'utf8');

function createBlock(type) {
  var typeIndex = code.indexOf('type: \'' + type + '\'');
  var start = code.lastIndexOf('Fliplet.DataSources.create(', typeIndex);
  var end = code.indexOf('}).then(', typeIndex);

  expect(typeIndex).toBeGreaterThan(-1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(typeIndex);

  return code.slice(start, end);
}

describe('PS-2311 social data source creation rules', function() {
  ['likes', 'bookmarks'].forEach(function(type) {
    it(type + ' allows select, insert and delete only', function() {
      var block = createBlock(type);

      expect(block).toContain('{ type: [\'select\', \'insert\', \'delete\'], allow: \'all\' }');
      expect(block).not.toContain('\'update\'');
    });
  });

  it('comments keep update', function() {
    expect(createBlock('comments')).toContain('[\'select\', \'insert\', \'update\', \'delete\']');
  });
});
