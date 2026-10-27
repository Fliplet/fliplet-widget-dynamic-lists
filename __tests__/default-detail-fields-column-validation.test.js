/**
 * Covers the "Detail view fields are pre-filled with issues in settings view" half of
 * Yuliia Solodka's PS-1879 QA report (2026-06-11). js/default-configs/layouts-config.js
 * hardcodes the columns of the widget's own demo dataset ('Email'/'Telephone'/'Linkedin'
 * on the card layouts, 'Full Date'/'Content' on agenda, 'Image'/'Description' on
 * simple-list), and interface.js added a row for each of them whatever the connected
 * data source looked like. updateDetailsRowContainer()'s validateColumn() then coerced
 * the missing column to 'none', so the user was left with spurious empty rows to delete.
 * (The other half of the report is covered by detail-view-auto-update.test.js.)
 *
 * The important distinction, and the reason this is not a plain "drop the field"
 * filter: a locked default (paranoid: true) is a template SLOT. Its `location` names
 * a fixed position in the layout's detail template and its `column` is whichever data
 * source column the user maps into it, so 'Work Email' -> the Email action button is
 * a supported configuration. "Add field" only creates rows without a `location`, so a
 * dropped slot can never be recreated from the interface. Locked slots are therefore
 * kept and merely unmapped ('none'); plain defaults, which own no slot and can be
 * re-added by hand, are dropped when their column is missing.
 *
 * These tests exercise the shipped helper (NativeUtils.normalizeDefaultDetailFields
 * in js/native-utils.js) against the real defaults in js/default-configs/, not a copy
 * of the logic.
 */

/* eslint-env jest */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var INTERFACE_PATH = path.join(ROOT, 'js', 'interface.js');

// The config files and native-utils.js all assign onto `window`.
global.window = global.window || {};

// layouts-table-config.js builds its demo entries with moment(); only the column
// lists matter here, so a minimal chainable stub is enough to load the file.
global.moment = global.moment || function() {
  var chain = {
    locale: function() { return chain; },
    subtract: function() { return chain; },
    add: function() { return chain; },
    format: function() { return '2026-01-01'; }
  };

  return chain;
};

require(path.join(ROOT, 'js', 'native-utils.js'));
require(path.join(ROOT, 'js', 'default-configs', 'layouts-config.js'));
require(path.join(ROOT, 'js', 'default-table-data', 'layouts-table-config.js'));

var NativeUtils = global.window.NativeUtils;
var LAYOUTS = global.window.flListLayoutConfig;
var DEMO_COLUMNS = global.window.flListLayoutTableColumnConfig;

function defaultsFor(layout) {
  return LAYOUTS[layout]['detail-fields'] || [];
}

// A realistic custom data source: none of the hardcoded default column names.
var CUSTOM_COLUMNS = ['Name', 'Work Email', 'Phone', 'LinkedIn URL'];

describe('PS-1879 follow-up — the tests target the shipped implementation', function() {
  it('exposes normalizeDefaultDetailFields from js/native-utils.js', function() {
    expect(typeof NativeUtils.normalizeDefaultDetailFields).toBe('function');
  });

  it('is actually wired into js/interface.js (guards against the helper being bypassed)', function() {
    var source = fs.readFileSync(INTERFACE_PATH, 'utf8');

    expect(source).toContain('NativeUtils.normalizeDefaultDetailFields(');
    // The superseded inline filter must not come back.
    expect(source).not.toContain('defaultDetailFields.filter(function(field) {');
  });

  it('reads the real layout defaults, not a fixture copy', function() {
    expect(defaultsFor('small-card').map(function(f) { return f.column; }))
      .toEqual(['Email', 'Telephone', 'Linkedin']);
    expect(defaultsFor('small-card').every(function(f) { return f.paranoid === true; })).toBe(true);
  });
});

describe('PS-1879 follow-up — locked slots survive a custom data source (the regression)', function() {
  var normalized = NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), CUSTOM_COLUMNS);

  it('keeps every locked slot even though no column name matches', function() {
    expect(normalized).toHaveLength(3);
    expect(normalized.map(function(f) { return f.location; })).toEqual(['Email', 'Telephone', 'Linkedin']);
  });

  it('leaves each slot unmapped rather than pre-filled with a missing column', function() {
    normalized.forEach(function(field) {
      expect(field.column).toBe('none');
    });
  });

  it('preserves paranoid so the "restore lost locked fields" block still has input', function() {
    // interface.js derives defaultLockedFields from exactly this predicate; if the
    // helper dropped the locked fields, restoration could never run on a custom DS.
    var defaultLockedFields = normalized.filter(function(item) { return item.paranoid === true; });

    expect(defaultLockedFields).toHaveLength(3);
  });

  it('preserves the helper text that labels the slot in the interface', function() {
    expect(normalized.map(function(f) { return f.helper; }))
      .toEqual(['Email icon', 'Phone icon', 'LinkedIn icon']);
  });

  it('keeps the same slots for small-h-card', function() {
    var hCard = NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-h-card'), CUSTOM_COLUMNS);

    expect(hCard.map(function(f) { return f.location; })).toEqual(['Email', 'Telephone', 'Linkedin']);
    expect(hCard.every(function(f) { return f.column === 'none'; })).toBe(true);
  });
});

describe('PS-1879 follow-up — an arbitrary column can still be mapped into a slot', function() {
  it('keeps location fixed while the user picks any data source column', function() {
    var emailSlot = NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), CUSTOM_COLUMNS)[0];

    expect(emailSlot.location).toBe('Email');
    expect(emailSlot.column).toBe('none');

    // What saveDetailedViewOptions() writes back when the user picks 'Work Email'.
    emailSlot.column = 'Work Email';

    // The runtime reads the slot by location and the value by column, so this pair is
    // what makes the mailto button render.
    expect(emailSlot.location).toBe('Email');
    expect(emailSlot.column).toBe('Work Email');
  });

  it('the runtime really keys the detail template off location (why slots must survive)', function() {
    var smallCard = fs.readFileSync(path.join(ROOT, 'js', 'layout-javascript', 'small-card-code.js'), 'utf8');
    var smallHCard = fs.readFileSync(path.join(ROOT, 'js', 'layout-javascript', 'small-h-card-code.js'), 'utf8');
    var template = fs.readFileSync(path.join(ROOT, 'templates', 'build', 'small-card-detail.build.hbs'), 'utf8');

    expect(smallCard).toContain('entry[obj.location] = content;');
    expect(smallHCard).toContain('entry[obj.location] = content;');
    // Those slots are what the hardcoded action buttons read.
    expect(template).toContain('{{#if [Email]}}');
    expect(template).toContain('{{#if [Telephone]}}');
    expect(template).toContain('{{#if [Linkedin]}}');
  });
});

describe('PS-1879 follow-up — plain defaults are dropped when their column is missing', function() {
  it('drops both simple-list defaults on a data source that has neither', function() {
    // simple-list's Image/Description are not paranoid: no slot, re-addable via "Add field".
    expect(NativeUtils.normalizeDefaultDetailFields(defaultsFor('simple-list'), CUSTOM_COLUMNS)).toEqual([]);
  });

  it('keeps a plain default whose column genuinely exists', function() {
    var kept = NativeUtils.normalizeDefaultDetailFields(
      defaultsFor('simple-list'),
      ['Name', 'Description']
    );

    expect(kept).toHaveLength(1);
    expect(kept[0].column).toBe('Description');
  });

  it('keeps agenda\'s locked Full Date slot but drops its plain Content default', function() {
    var agenda = NativeUtils.normalizeDefaultDetailFields(defaultsFor('agenda'), CUSTOM_COLUMNS);

    expect(agenda).toHaveLength(1);
    expect(agenda[0].location).toBe('Full Date');
    expect(agenda[0].paranoid).toBe(true);
    expect(agenda[0].column).toBe('none');
  });
});

describe('PS-1879 follow-up — no regression on the widget\'s own demo dataset', function() {
  it('leaves every small-card default mapped to its original column', function() {
    var normalized = NativeUtils.normalizeDefaultDetailFields(
      defaultsFor('small-card'),
      DEMO_COLUMNS['small-card']
    );

    expect(normalized.map(function(f) { return f.column; })).toEqual(['Email', 'Telephone', 'Linkedin']);
  });

  it('leaves agenda and simple-list defaults untouched on their demo datasets', function() {
    expect(
      NativeUtils.normalizeDefaultDetailFields(defaultsFor('agenda'), DEMO_COLUMNS['agenda'])
        .map(function(f) { return f.column; })
    ).toEqual(['Full Date', 'Content']);

    expect(
      NativeUtils.normalizeDefaultDetailFields(defaultsFor('simple-list'), DEMO_COLUMNS['simple-list'])
        .map(function(f) { return f.column; })
    ).toEqual(['Image', 'Description']);
  });
});

describe('PS-1879 follow-up — missing, empty and invalid column lists behave safely', function() {
  it('treats an empty array like "no columns known" and still keeps the slots', function() {
    // getColumns() assigns dataSource.columns straight through, and a data source with
    // no entries yields []. An empty array is truthy, so it survives the `||` fallback
    // chain in interface.js; the slots must not be lost because of that.
    var normalized = NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), []);

    expect(normalized).toHaveLength(3);
    expect(normalized.every(function(f) { return f.column === 'none'; })).toBe(true);
  });

  it('does not throw on undefined or null columns', function() {
    expect(function() {
      NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), undefined);
    }).not.toThrow();

    expect(NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), null)).toHaveLength(3);
  });

  it('returns an empty list when the layout has no defaults (e.g. news-feed)', function() {
    expect(NativeUtils.normalizeDefaultDetailFields(defaultsFor('news-feed'), CUSTOM_COLUMNS)).toEqual([]);
    expect(NativeUtils.normalizeDefaultDetailFields(undefined, CUSTOM_COLUMNS)).toEqual([]);
  });
});

describe('PS-1879 follow-up — the shared layout defaults are never mutated', function() {
  it('leaves window.flListLayoutConfig untouched', function() {
    // interface.js's restore block assigns field.columns / fieldLabel / editable onto
    // whatever this helper returns, so returning the shared objects would corrupt the
    // global defaults for every later load.
    var before = JSON.parse(JSON.stringify(LAYOUTS['small-card']['detail-fields']));

    NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), CUSTOM_COLUMNS)
      .forEach(function(field) {
        field.columns = CUSTOM_COLUMNS;
        field.editable = false;
        field.column = 'Work Email';
      });

    expect(LAYOUTS['small-card']['detail-fields']).toEqual(before);
  });

  it('returns copies, not references to the shared defaults', function() {
    var source = defaultsFor('small-card');
    var normalized = NativeUtils.normalizeDefaultDetailFields(source, DEMO_COLUMNS['small-card']);

    normalized.forEach(function(field, index) {
      expect(field).not.toBe(source[index]);
    });
  });
});

describe('PS-1879 follow-up — saved detail-view rows are out of scope for this helper', function() {
  it('only ever returns fields derived from the layout defaults', function() {
    // The helper takes no saved-options argument, so nothing it does can delete a row
    // the user already configured; the seeding and restore blocks only ever add.
    var savedLocations = defaultsFor('small-card').map(function(f) { return f.location; });

    NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), CUSTOM_COLUMNS)
      .forEach(function(field) {
        expect(savedLocations).toContain(field.location);
      });

    expect(NativeUtils.normalizeDefaultDetailFields.length).toBe(2);
  });
});

describe('PS-1879 follow-up — the "restore lost locked fields" block on a custom data source', function() {
  // Mirrors js/interface.js: the block finds each default locked slot by `location` in the
  // saved options and prepends the ones that went missing. The naive "drop every default
  // whose column is absent" filter emptied defaultLockedFields on a custom data source, so
  // this block could never run and a lost Email/Telephone/Linkedin slot was unrecoverable
  // ("Add field" creates rows with no `location`).
  function restoreLostLockedFields(savedOptions, defaultDetailFields, dataSourceColumns) {
    var detailViewOptions = savedOptions.slice();
    var foundLockedFields = [];
    var foundLockedFieldsIndices = [];
    var defaultLockedFields = defaultDetailFields.filter(function(item) { return item.paranoid === true; });

    if (!defaultLockedFields.length) {
      return detailViewOptions;
    }

    defaultLockedFields.forEach(function(field) {
      detailViewOptions.some(function(option, index) {
        if (option.location !== field.location) {
          return false;
        }

        foundLockedFields.push(option);
        foundLockedFieldsIndices.push(index);

        return true;
      });
    });

    if (foundLockedFields.length < defaultLockedFields.length) {
      defaultLockedFields.forEach(function(field) {
        field.columns = dataSourceColumns;
        field.fieldLabel = 'no-label';
        field.editable = !field.paranoid;
      });

      foundLockedFields = defaultLockedFields.map(function(field) {
        return Object.assign({}, field, foundLockedFields.find(function(item) { return item.location === field.location; }));
      });

      detailViewOptions = [].concat(
        foundLockedFields,
        detailViewOptions.filter(function(option, index) { return foundLockedFieldsIndices.indexOf(index) === -1; })
      );
    }

    return detailViewOptions;
  }

  var normalized = NativeUtils.normalizeDefaultDetailFields(defaultsFor('small-card'), CUSTOM_COLUMNS);

  it('brings back a lost slot without disturbing the ones the user already mapped', function() {
    var saved = [
      { id: 'nMytReWq', location: 'Email', column: 'Work Email', paranoid: true },
      { id: 'XLbdTD45', location: 'Linkedin', column: 'LinkedIn URL', paranoid: true },
      { id: 1, column: 'Name' }
      // the Telephone slot went missing
    ];

    var restored = restoreLostLockedFields(saved, normalized, CUSTOM_COLUMNS);

    expect(restored.map(function(f) { return f.location; }))
      .toEqual(['Email', 'Telephone', 'Linkedin', undefined]);
    // The user's own mappings survive.
    expect(restored[0].column).toBe('Work Email');
    expect(restored[2].column).toBe('LinkedIn URL');
    // The restored slot comes back unmapped rather than pre-filled with a missing column.
    expect(restored[1].column).toBe('none');
    // The plain row the user added is kept.
    expect(restored[3].column).toBe('Name');
  });

  it('leaves a fully mapped configuration exactly as saved', function() {
    var saved = [
      { id: 'nMytReWq', location: 'Email', column: 'Work Email', paranoid: true },
      { id: 'tYrEqwMn', location: 'Telephone', column: 'Phone', paranoid: true },
      { id: 'XLbdTD45', location: 'Linkedin', column: 'LinkedIn URL', paranoid: true }
    ];

    expect(restoreLostLockedFields(saved, normalized, CUSTOM_COLUMNS)).toEqual(saved);
  });

  it('cannot run at all if the locked slots are dropped instead of unmapped', function() {
    // Guards the regression: with the superseded filter, defaultLockedFields was empty on
    // a custom data source, so a lost slot stayed lost.
    var droppedInstead = defaultsFor('small-card').filter(function(field) {
      return CUSTOM_COLUMNS.indexOf(field.column) !== -1;
    });

    expect(droppedInstead).toEqual([]);
    expect(restoreLostLockedFields([{ id: 1, column: 'Name' }], droppedInstead, CUSTOM_COLUMNS))
      .toEqual([{ id: 1, column: 'Name' }]);
  });
});
