/* eslint-env jest */

/**
 * Agenda filterRecordsWithValidDateTime: a record needs a valid date and a value
 * for every time field mapped to a column or to a non-blank custom template.
 * Time fields set to None or left unselected are not required.
 *
 * The function is loaded from the widget source into a vm context with
 * NativeUtils and a stub Handlebars, and called.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var moment = require('moment');

moment.suppressDeprecationWarnings = true;

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8').replace(/\r\n/g, '\n');
}

function fn(code, name) {
  var start = code.indexOf('DynamicList.prototype.' + name + ' = function');
  var end = code.indexOf('\nDynamicList.prototype.', start + 1);

  expect(start).toBeGreaterThan(-1);

  return code.slice(start, end > -1 ? end : undefined);
}

var compileCalls = [];

// Like Handlebars 4.7.9, compile() is lazy for strings: parse errors and missing
// helpers throw every time the template is rendered. Renders {{[Column]}}.
var Handlebars = {
  compile: function(src) {
    compileCalls.push(src);

    return function(data) {
      var block = src.match(/\{\{#(\w+)/);
      var helper = src.match(/\{\{(\w+) [^}]*\}\}/);

      if (block && src.indexOf('{{/' + block[1] + '}}') === -1) {
        throw new Error('Parse error on line 1');
      }

      if (helper) {
        throw new Error('Missing helper: "' + helper[1] + '"');
      }

      return src.replace(/\{\{\[([^\]]+)\]\}\}/g, function(match, column) {
        var value = data[column];

        return value === undefined || value === null ? '' : String(value);
      });
    };
  }
};

var ctx = vm.createContext({ window: {}, console: console, Handlebars: Handlebars });

vm.runInContext(read('native-utils.js'), ctx);
ctx.NativeUtils = ctx.window.NativeUtils;
vm.runInContext('var DynamicList = function() {};\n' + fn(read(path.join('layout-javascript', 'agenda-code.js')), 'filterRecordsWithValidDateTime'), ctx);

var START = { location: 'Start Time', type: 'time', column: 'Start Time' };
var END = { location: 'End Time', type: 'time', column: 'End Time' };
var TITLE = { location: 'Title', type: 'text', column: 'Title' };

function field(base, settings) {
  return Object.assign({}, base, settings);
}

function custom(base, template) {
  return field(base, { column: 'custom', customFieldEnabled: true, customField: template });
}

function list(summaryFields, detailViewOptions) {
  var instance = new ctx.DynamicList();

  instance.dateFieldLocation = 'Full Date';
  instance.data = {
    detailViewOptions: detailViewOptions || [{ location: 'Full Date', column: 'Full Date' }],
    'summary-fields': summaryFields
  };
  instance.Utils = { Date: { moment: moment } };

  return instance;
}

function record(id, data) {
  return { id: id, data: Object.assign({ Title: 'Session ' + id }, data) };
}

var records = [
  record(1, { 'Full Date': '2026-03-10', 'Start Time': '09:00', 'End Time': '10:00' }),
  record(2, { 'Full Date': '2026-03-10', 'Start Time': '11:00', 'End Time': '' }),
  record(3, { 'Full Date': '2026-03-11', 'Start Time': ' ', 'End Time': '12:00' }),
  record(4, { 'Start Time': '09:00', 'End Time': '10:00' }),
  record(5, { 'Full Date': 'not a date', 'Start Time': '09:00', 'End Time': '10:00' }),
  record(6, { 'Full Date': '2026-03-12', 'Start Time': '14:00' }),
  record(7, { 'Full Date': '2026-03-12' })
];

function keptIds(summaryFields, input) {
  return list(summaryFields).filterRecordsWithValidDateTime(input || records).map(function(entry) {
    return entry.id;
  });
}

beforeEach(function() {
  compileCalls.length = 0;
});

describe('PS-2438 agenda filterRecordsWithValidDateTime', function() {
  it('1. default mapping hides sessions missing the date, start or end time', function() {
    expect(keptIds([START, END, TITLE])).toEqual([1]);
  });

  it('2. End Time None requires only the date and start time', function() {
    expect(keptIds([START, field(END, { column: 'empty' }), TITLE])).toEqual([1, 2, 6]);
  });

  it('3. End Time unselected requires only the date and start time', function() {
    expect(keptIds([START, field(END, { column: 'none' }), TITLE])).toEqual([1, 2, 6]);
  });

  it('4. regression guard (passes on the old filter too): End Time with no column requires only the date and start time', function() {
    expect(keptIds([START, field(END, { column: undefined }), TITLE])).toEqual([1, 2, 6]);
    expect(keptIds([START, field(END, { column: '' }), TITLE])).toEqual([1, 2, 6]);
  });

  it('5. Start and End Time None apply only the date rule', function() {
    expect(keptIds([field(START, { column: 'empty' }), field(END, { column: 'empty' }), TITLE])).toEqual([1, 2, 3, 6, 7]);
  });

  it('6. End Time Custom hides sessions where the template renders blank', function() {
    expect(keptIds([START, custom(END, '{{[End Time]}}'), TITLE])).toEqual([1]);
    expect(keptIds([field(START, { column: 'empty' }), custom(END, '{{[End Time]}}'), TITLE])).toEqual([1, 3]);
  });

  it('7. End Time Custom with literal text keeps sessions', function() {
    expect(keptIds([START, custom(END, 'TBC'), TITLE])).toEqual([1, 2, 6]);
  });

  it('8. End Time Custom with a blank template is ignored', function() {
    expect(keptIds([START, custom(END, ''), TITLE])).toEqual([1, 2, 6]);
    expect(keptIds([START, custom(END, '  \n '), TITLE])).toEqual([1, 2, 6]);
    expect(keptIds([START, custom(END, undefined), TITLE])).toEqual([1, 2, 6]);
    expect(compileCalls).toEqual([]);
  });

  it('9. End Time Custom that throws when rendered keeps sessions', function() {
    var result;

    // Parse error
    expect(function() {
      result = keptIds([START, custom(END, '{{#if [End Time]}}oops'), TITLE]);
    }).not.toThrow();
    expect(result).toEqual([1, 2, 6]);

    // Missing helper
    expect(function() {
      result = keptIds([START, custom(END, '{{broken [End Time]}}'), TITLE]);
    }).not.toThrow();
    expect(result).toEqual([1, 2, 6]);
  });

  it('10. defensive: keeps sessions if Handlebars.compile itself throws', function() {
    var compile = Handlebars.compile;
    var result;

    Handlebars.compile = function() {
      throw new Error('You must pass a string or Handlebars AST to Handlebars.compile');
    };

    try {
      expect(function() {
        result = keptIds([START, custom(END, '{{[End Time]}}'), TITLE]);
      }).not.toThrow();
    } finally {
      Handlebars.compile = compile;
    }

    expect(result).toEqual([1, 2, 6]);
  });

  it('11. compiles each Custom template once per call', function() {
    expect(keptIds([custom(START, '{{[Start Time]}}'), custom(END, '{{[End Time]}}'), TITLE])).toEqual([1]);
    expect(compileCalls).toEqual(['{{[Start Time]}}', '{{[End Time]}}']);
  });

  it('12. only time fields are required, not blank text or Custom text fields', function() {
    var subtitle = { location: 'Secondary text', type: 'text', column: 'Subtitle' };
    var notes = custom({ location: 'Tertiary text', type: 'text' }, '{{[Notes]}}');
    var input = [
      record(11, { 'Full Date': '2026-03-10', 'Start Time': '09:00', 'End Time': '10:00', Subtitle: 'Room A', Notes: 'Bring a laptop' }),
      record(12, { 'Full Date': '2026-03-10', 'Start Time': '09:00', 'End Time': '10:00', Title: '', Subtitle: '', Notes: ' ' }),
      record(13, { 'Full Date': '2026-03-10', 'Start Time': '09:00', 'End Time': '10:00' })
    ];

    expect(keptIds([START, END, TITLE, subtitle, notes], input)).toEqual([11, 12, 13]);
    expect(compileCalls).toEqual([]);
  });

  it('13. returns the input unchanged when no date column is configured', function() {
    var instance = list([START, END, TITLE], [{ location: 'Title', column: 'Title' }]);

    expect(instance.filterRecordsWithValidDateTime(records)).toBe(records);
  });
});
