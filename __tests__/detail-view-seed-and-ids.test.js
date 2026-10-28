/**
 * PS-1879 review of PR #800 (QA evidence pack on PS-1879, 21 Oct): two acceptance
 * criteria still failed on the settings interface.
 *
 * AC-6 / LFD-18 — "Detail view fields are pre-filled with issues". Picking a layout seeds
 * the detail fields from the layout's demo columns. Choosing an existing data source
 * afterwards only re-validated those rows, so every demo column the data source lacks
 * became a blank "-- Select a data field" row. The seed now records a fingerprint
 * (NativeUtils.applyDetailViewSeed), and on a data source change
 * NativeUtils.rebuildSeededDetailViewOptions seeds untouched options again for the new
 * columns.
 *
 * AC-3 / LFD-15 — an auto-added column took `detailViewOptions.length + 1` as its id.
 * After a deletion that id could belong to an existing field, and the settings rows are
 * looked up by id, so the new column replaced that field (news-feed lost Image; the
 * Directory Email button opened `mailto:<new value>`). NativeUtils.nextDetailViewOptionId
 * now picks one more than the highest numeric id.
 *
 * Review of PR #805 (Arpan Jokhakar, 2026-10-28): a data source change on an edited list
 * added none of the new columns, and the save then marked them as known, so they never
 * appeared. NativeUtils.changeDetailViewDataSource now runs the auto-update merge before
 * that save. And a list the user had emptied was seeded again on reopen.
 *
 * Everything below calls the shipped helpers in js/native-utils.js against the real
 * layout defaults: the load (prepareDetailViewOptions) and the data source change
 * (changeDetailViewDataSource) that js/interface.js calls, which the last block
 * checks. Only the interface's DOM round trip is reproduced here (validatedSummary,
 * asSaved).
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

// The data source QA chose in the evidence pack: none of the demo column names.
var CUSTOM_COLUMNS = ['Name', 'Role', 'Office', 'Work Email', 'Mobile', 'Profile URL', 'About', 'Team', 'Start Date'];
var SEEDED_LAYOUTS = ['small-card', 'small-h-card', 'agenda', 'simple-list'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function columnsOf(options) {
  return options.map(function(option) { return option.column; });
}

function idsOf(options) {
  return options.map(function(option) { return option.id; });
}

/**
 * What updateSummaryRowContainer() leaves in the config once a data source is chosen:
 * every summary column the data source lacks becomes 'none'.
 * @param {Array} summaryFields - The list's summary fields
 * @param {Array} columns - Columns of the chosen data source
 * @returns {Array} New summary field objects
 */
function validatedSummary(summaryFields, columns) {
  return clone(summaryFields).map(function(field) {
    if (columns.indexOf(field.column) === -1 && field.column !== 'empty' && field.column !== 'custom') {
      field.column = 'none';
    }

    return field;
  });
}

/**
 * The stored shape after a save: saveDetailedViewOptions() reads every row back from
 * the interface and writes these keys, whatever the user touched.
 * @param {Array} options - Detail view options as built by the interface
 * @returns {Array} New option objects as they are saved
 */
function asSaved(options) {
  return clone(options).map(function(item) {
    item.customField = '';
    item.customFieldEnabled = false;
    item.customFieldLabelEnabled = false;
    item.customFieldLabel = '';
    item.fieldLabelDisabled = item.fieldLabel === 'no-label';

    if (item.type === 'image') {
      item.imageField = 'url';
    }

    return item;
  });
}

/**
 * A list right after its layout is picked: seeded on the layout's demo columns, then
 * auto-saved by the layout click handler (saveLists(true)).
 * @param {string} layout - Layout key
 * @returns {Object} Widget config
 */
function pickLayout(layout) {
  var config = { 'summary-fields': clone(LAYOUTS[layout]['summary-fields']), detailViewOptions: [] };

  NativeUtils.prepareDetailViewOptions(config, LAYOUTS[layout], DEMO_COLUMNS[layout]);
  config.detailViewOptions = asSaved(config.detailViewOptions);

  return config;
}

/**
 * The dataSourceSelect handler in js/interface.js: re-validate the summary fields
 * (updateSummaryRowContainer), then the real data source change helper.
 * @param {Object} config - Widget config, mutated as the handler does
 * @param {string} layout - Layout key
 * @param {Array} previousColumns - Columns before the change
 * @param {Array} nextColumns - Columns of the chosen data source
 * @param {boolean} [autoUpdate] - Whether the auto-update checkbox is ticked
 * @returns {boolean} Whether the detail fields were rebuilt or gained a column
 */
function chooseDataSource(config, layout, previousColumns, nextColumns, autoUpdate) {
  config['summary-fields'] = validatedSummary(config['summary-fields'], nextColumns);

  return NativeUtils.changeDetailViewDataSource(config, LAYOUTS[layout], previousColumns, nextColumns, autoUpdate);
}

/**
 * Save & Close, as saveLists() writes it: the rows read back, the data source columns,
 * then the PS-1879 keys.
 * @param {Object} config - Widget config, mutated in place
 * @param {Array} columns - Columns of the connected data source
 * @returns {Object} The same config
 */
function saveSettings(config, columns) {
  config.detailViewOptions = asSaved(config.detailViewOptions);
  config.dataSourceColumns = columns;

  return Object.assign(config, NativeUtils.detailViewSaveState(config, columns));
}

/**
 * Reopen the settings interface on the real load helper.
 * @param {Object} config - Widget config, mutated in place
 * @param {string} layout - Layout key
 * @param {Array} columns - Columns of the connected data source
 * @returns {Array} The detail field columns after the load
 */
function reopen(config, layout, columns) {
  NativeUtils.prepareDetailViewOptions(config, LAYOUTS[layout], columns);

  return columnsOf(config.detailViewOptions);
}

/**
 * The detail view columns a runtime layout renders: the saved fields, then the
 * auto-update's extra columns.
 * @param {Object} data - Saved widget data
 * @param {Array} columns - Columns of the connected data source
 * @returns {Array} Column names
 */
function renderedAtRuntime(data, columns) {
  var saved = columnsOf(data.detailViewOptions);

  return saved.concat(data.detailViewAutoUpdate ? NativeUtils.newDetailViewColumns(data, columns, saved) : []);
}

function blankPlainRows(options, columns) {
  return options.filter(function(option) {
    return option.editable && columns.indexOf(option.column) === -1;
  });
}

describe('PS-1879 review — QA\'s path: pick a layout, then choose an existing data source', function() {
  SEEDED_LAYOUTS.forEach(function(layout) {
    describe(layout, function() {
      it('starts, as QA saw, with rows for the demo columns only', function() {
        var config = pickLayout(layout);

        // The control: without the rebuild these rows would be re-validated to 'none'.
        expect(blankPlainRows(config.detailViewOptions, CUSTOM_COLUMNS).length).toBeGreaterThan(0);
      });

      it('rebuilds the detail fields for the chosen data source, with no blank rows', function() {
        var config = pickLayout(layout);

        expect(chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS)).toBe(true);
        expect(blankPlainRows(config.detailViewOptions, CUSTOM_COLUMNS)).toEqual([]);
      });

      it('keeps every locked slot, unmapped', function() {
        var config = pickLayout(layout);
        var lockedDefaults = (LAYOUTS[layout]['detail-fields'] || []).filter(function(field) { return field.paranoid; });
        var slots;

        chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS);
        slots = config.detailViewOptions.filter(function(option) { return !option.editable; });

        expect(slots.map(function(slot) { return slot.location; }))
          .toEqual(lockedDefaults.map(function(field) { return field.location; }));
        slots.forEach(function(slot) {
          expect(slot.column).toBe('none');
        });
      });

      it('ends where a list opened with that data source already attached starts', function() {
        var config = pickLayout(layout);
        var attached = {
          'summary-fields': validatedSummary(LAYOUTS[layout]['summary-fields'], CUSTOM_COLUMNS),
          detailViewOptions: []
        };

        chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS);
        NativeUtils.prepareDetailViewOptions(attached, LAYOUTS[layout], CUSTOM_COLUMNS);

        expect(config.detailViewOptions).toEqual(attached.detailViewOptions);
      });

      it('rebuilds again when a second data source is chosen in the same session', function() {
        var second = ['Title', 'Owner', 'Notes'];
        var config = pickLayout(layout);

        chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS);
        config.detailViewOptions = asSaved(config.detailViewOptions);

        expect(chooseDataSource(config, layout, CUSTOM_COLUMNS, second)).toBe(true);
        expect(blankPlainRows(config.detailViewOptions, second)).toEqual([]);
      });

      it('still rebuilds after a summary field was remapped first', function() {
        var config = pickLayout(layout);
        var summary = config['summary-fields'].find(function(field) { return field.column !== 'none'; });

        summary.column = DEMO_COLUMNS[layout][DEMO_COLUMNS[layout].length - 1];

        expect(chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS)).toBe(true);
        expect(blankPlainRows(config.detailViewOptions, CUSTOM_COLUMNS)).toEqual([]);
      });
    });
  });

  it('works the same after the list was closed and reopened before choosing', function() {
    // Reopening reads the saved settings back, fingerprint included.
    var config = clone(pickLayout('small-card'));

    expect(chooseDataSource(config, 'small-card', DEMO_COLUMNS['small-card'], CUSTOM_COLUMNS)).toBe(true);
  });

  it('keeps a locked slot when a summary field shows its column (Title mapped to Email)', function() {
    var config = pickLayout('small-card');
    var columns = ['Name', 'Email', 'Phone', 'Notes'];

    config['summary-fields'].find(function(field) { return field.column === 'Title'; }).column = 'Email';

    expect(chooseDataSource(config, 'small-card', DEMO_COLUMNS['small-card'], columns)).toBe(true);
    expect(config.detailViewOptions.filter(function(option) { return !option.editable; })
      .map(function(slot) { return slot.location + '=' + slot.column; }))
      .toEqual(['Email=Email', 'Telephone=none', 'Linkedin=none']);
  });

  it('keeps agenda\'s Full Date slot when a summary field shows Full Date', function() {
    var summary = clone(LAYOUTS.agenda['summary-fields']);

    summary[0].column = 'Full Date';

    expect(NativeUtils.seedDetailViewOptions(LAYOUTS.agenda, DEMO_COLUMNS.agenda, summary)
      .filter(function(option) { return !option.editable; })
      .map(function(slot) { return slot.location + '=' + slot.column; }))
      .toEqual(['Full Date=Full Date']);
  });

  it('leaves a list seeded before this change (no fingerprint) as it was', function() {
    var config = pickLayout('small-card');
    var before;

    delete config.detailViewSeedSignature;
    before = clone(config.detailViewOptions);

    expect(chooseDataSource(config, 'small-card', DEMO_COLUMNS['small-card'], CUSTOM_COLUMNS)).toBe(false);
    expect(config.detailViewOptions).toEqual(before);
  });
});

describe('PS-1879 review — a data source change never discards the user\'s own edits', function() {
  var layout = 'small-card';

  // True when the options were rebuilt; on false they must be exactly as they were.
  function shouldReseed(config) {
    var before = clone(config.detailViewOptions);
    var rebuilt = chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS);

    if (!rebuilt) {
      expect(config.detailViewOptions).toEqual(before);
    }

    return rebuilt;
  }

  it('keeps the options once a field has been deleted', function() {
    var config = pickLayout(layout);

    config.detailViewOptions = config.detailViewOptions.filter(function(option) { return option.column !== 'Bio'; });

    expect(shouldReseed(config)).toBe(false);
  });

  it('keeps the options once a field has been added', function() {
    var config = pickLayout(layout);

    config.detailViewOptions.push({ id: 'Xy12Ab34', column: 'none', type: 'text', fieldLabel: 'column-name', editable: true });

    expect(shouldReseed(config)).toBe(false);
  });

  it('keeps the options once the fields have been reordered', function() {
    var config = pickLayout(layout);
    var options = config.detailViewOptions;

    config.detailViewOptions = options.slice(0, 3).concat(options.slice(3).reverse());

    expect(shouldReseed(config)).toBe(false);
  });

  it('keeps the options once a type, a label or a custom value has been changed', function() {
    [
      function(option) { option.type = 'html'; },
      function(option) { option.fieldLabel = 'no-label'; },
      function(option) { option.fieldLabel = 'custom-label'; option.customFieldLabel = 'About'; },
      function(option) { option.column = 'custom'; option.customField = '{{[Bio]}}'; },
      function(option) { option.column = 'Sectors'; }
    ].forEach(function(edit) {
      var config = pickLayout(layout);

      edit(config.detailViewOptions.find(function(option) { return option.column === 'Bio'; }));

      expect(shouldReseed(config)).toBe(false);
    });
  });

  it('keeps an image field that has a folder selected', function() {
    var config = pickLayout('simple-list');
    var image = config.detailViewOptions.find(function(option) { return option.type === 'image'; });

    image.imageField = 'all-folders';
    image.folder = { selectFiles: [{ name: 'Photos' }] };

    expect(chooseDataSource(config, 'simple-list', DEMO_COLUMNS['simple-list'], CUSTOM_COLUMNS)).toBe(false);
    expect(config.detailViewOptions).toContainEqual(expect.objectContaining({ folder: { selectFiles: [{ name: 'Photos' }] } }));
  });

  it('does nothing when the chosen data source has the same columns (e.g. "Create new data source")', function() {
    var reordered = DEMO_COLUMNS[layout].slice().reverse();

    expect(chooseDataSource(pickLayout(layout), layout, DEMO_COLUMNS[layout], reordered)).toBe(false);
  });

  it('does nothing when the previous columns are not known yet', function() {
    [undefined, null, []].forEach(function(previous) {
      expect(chooseDataSource(pickLayout(layout), layout, previous, CUSTOM_COLUMNS)).toBe(false);
    });
  });

  it('does nothing on news-feed, which has no seeded fields', function() {
    var config = { 'summary-fields': clone(LAYOUTS['news-feed']['summary-fields']), detailViewOptions: [] };

    NativeUtils.prepareDetailViewOptions(config, LAYOUTS['news-feed'], DEMO_COLUMNS['news-feed']);

    expect(chooseDataSource(config, 'news-feed', DEMO_COLUMNS['news-feed'], CUSTOM_COLUMNS)).toBe(false);
  });

  it('is not fooled by a save on its own: the saved shape keeps the fingerprint', function() {
    var config = pickLayout(layout);

    expect(NativeUtils.detailViewSignature(config.detailViewOptions)).toBe(config.detailViewSeedSignature);
  });
});

describe('PS-1879 review — NativeUtils.seedDetailViewOptions matches the first-load seed', function() {
  it('builds Directory on its demo data: locked slots mapped, summary columns left out', function() {
    var options = NativeUtils.seedDetailViewOptions(LAYOUTS['small-card'], DEMO_COLUMNS['small-card'], LAYOUTS['small-card']['summary-fields']);

    expect(options.map(function(option) { return [option.id, option.column, option.location || null, option.editable]; })).toEqual([
      [6, 'Email', 'Email', false],
      [7, 'Telephone', 'Telephone', false],
      [8, 'Linkedin', 'Linkedin', false],
      [9, 'Bio', null, true],
      [10, 'Sectors', null, true],
      [11, 'Expertise', null, true]
    ]);
  });

  it('drops agenda\'s ignored columns and keeps its locked Full Date slot', function() {
    var options = NativeUtils.seedDetailViewOptions(LAYOUTS.agenda, DEMO_COLUMNS.agenda, LAYOUTS.agenda['summary-fields']);

    expect(columnsOf(options)).toEqual(['Full Date', 'Content']);
    expect(options[0].location).toBe('Full Date');
  });

  it('keeps the summary columns on simple-list, which shows them in the detail view', function() {
    var options = NativeUtils.seedDetailViewOptions(LAYOUTS['simple-list'], DEMO_COLUMNS['simple-list'], LAYOUTS['simple-list']['summary-fields']);

    expect(columnsOf(options)).toEqual(DEMO_COLUMNS['simple-list']);
  });

  it('seeds nothing on a detail-fields-disabled layout', function() {
    expect(NativeUtils.seedDetailViewOptions(LAYOUTS['news-feed'], DEMO_COLUMNS['news-feed'], [])).toEqual([]);
  });

  it('copies the layout defaults instead of mutating window.flListLayoutConfig', function() {
    var before = clone(LAYOUTS);

    NativeUtils.seedDetailViewOptions(LAYOUTS['small-card'], CUSTOM_COLUMNS, []);
    NativeUtils.seedDetailViewOptions(LAYOUTS.agenda, DEMO_COLUMNS.agenda, LAYOUTS.agenda['summary-fields']);

    expect(LAYOUTS).toEqual(before);
  });
});

describe('PS-1879 review — an auto-added column never takes an existing field\'s id', function() {
  var NEW_COLUMN = 'PS1879 New Field';

  function addColumn(config, columns) {
    return NativeUtils.appendNewDetailViewColumns(config, columns.concat(NEW_COLUMN));
  }

  function save(config, columns) {
    return Object.assign(config, NativeUtils.detailViewSaveState(config, columns));
  }

  it('news-feed: deleting Categories and Content, then adding a column, keeps Image (LFD-15)', function() {
    var columns = DEMO_COLUMNS['news-feed'];
    var config = { detailViewOptions: [], detailViewAutoUpdate: true };

    config.detailViewOptions = NativeUtils.appendNewDetailViewColumns(config, columns);
    expect(idsOf(config.detailViewOptions)).toEqual([1, 2, 3, 4, 5]);
    save(config, columns);

    config.detailViewOptions = config.detailViewOptions.filter(function(option) {
      return ['Categories', 'Content'].indexOf(option.column) === -1;
    });
    save(config, columns);

    // The old `length + 1` gave 4, which Image still holds. 5 went with Content.
    expect(config.detailViewOptions.length + 1).toBe(4);

    var options = addColumn(config, columns);

    expect(options.map(function(option) { return [option.id, option.column]; }))
      .toEqual([[1, 'Title'], [2, 'Date'], [4, 'Image'], [5, NEW_COLUMN]]);
  });

  it('Directory: deleting Bio, then adding a column, keeps the Email slot on Email (EXPL-1)', function() {
    var columns = DEMO_COLUMNS['small-card'];
    var config = {
      detailViewAutoUpdate: true,
      detailViewOptions: NativeUtils.seedDetailViewOptions(LAYOUTS['small-card'], columns, LAYOUTS['small-card']['summary-fields'])
    };

    save(config, columns);
    config.detailViewOptions = config.detailViewOptions.filter(function(option) { return option.column !== 'Bio'; });
    save(config, columns);

    // The old `length + 1` gave 6, which the Email slot already held.
    expect(config.detailViewOptions.length + 1).toBe(6);

    var options = addColumn(config, columns);
    var email = options.filter(function(option) { return option.location === 'Email'; });

    expect(email).toHaveLength(1);
    expect(email[0].column).toBe('Email');
    expect(options[options.length - 1]).toEqual(expect.objectContaining({ id: 12, column: NEW_COLUMN }));
  });

  it('gives every field a unique id after several deletions and additions', function() {
    var columns = DEMO_COLUMNS['small-card'].slice();
    var config = {
      detailViewAutoUpdate: true,
      detailViewOptions: NativeUtils.seedDetailViewOptions(LAYOUTS['small-card'], columns, LAYOUTS['small-card']['summary-fields'])
    };

    [1, 2, 3].forEach(function(round) {
      save(config, columns);
      config.detailViewOptions.splice(3, 1);
      save(config, columns);
      columns = columns.concat('Added ' + round);
      config.detailViewOptions = NativeUtils.appendNewDetailViewColumns(config, columns);

      var ids = idsOf(config.detailViewOptions).map(String);

      expect(ids.filter(function(id, index) { return ids.indexOf(id) === index; })).toEqual(ids);
    });
  });

  it('nextDetailViewOptionId counts numeric ids only', function() {
    expect(NativeUtils.nextDetailViewOptionId([])).toBe(1);
    expect(NativeUtils.nextDetailViewOptionId(undefined)).toBe(1);
    expect(NativeUtils.nextDetailViewOptionId([{ id: 1 }, { id: 2 }, { id: 4 }])).toBe(5);
    expect(NativeUtils.nextDetailViewOptionId([{ id: 'nMytReWq' }, { id: 'Xy12Ab34' }])).toBe(1);
    expect(NativeUtils.nextDetailViewOptionId([{ id: 'nMytReWq' }, { id: 3 }, { id: '12ab' }])).toBe(4);
    expect(NativeUtils.nextDetailViewOptionId([{ id: '7' }, null, {}, { id: 2 }])).toBe(8);
  });
});

describe('PS-1879 review — NativeUtils.prepareDetailViewOptions on load', function() {
  it('seeds an empty list and records the fingerprint', function() {
    var config = { 'summary-fields': clone(LAYOUTS['small-card']['summary-fields']), detailViewOptions: [] };

    NativeUtils.prepareDetailViewOptions(config, LAYOUTS['small-card'], DEMO_COLUMNS['small-card']);

    expect(columnsOf(config.detailViewOptions)).toEqual(['Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise']);
    expect(config.detailViewSeedSignature).toBe(NativeUtils.detailViewSignature(config.detailViewOptions));
  });

  it('does not let the auto-update re-add ignored columns to a fresh seed', function() {
    // agenda ignores Poll/Survey/Questions; the seed already holds every other column.
    // A list saved with no fields before detailViewSeeded existed is seeded on load.
    var config = {
      'summary-fields': clone(LAYOUTS.agenda['summary-fields']),
      detailViewOptions: [],
      detailViewKnownColumns: DEMO_COLUMNS.agenda.filter(function(column) { return column !== 'Poll'; }),
      detailViewAutoUpdate: true
    };

    NativeUtils.prepareDetailViewOptions(config, LAYOUTS.agenda, DEMO_COLUMNS.agenda);

    expect(columnsOf(config.detailViewOptions)).toEqual(['Full Date', 'Content']);
  });

  it('adds new columns to a saved list only when the auto-update is on', function() {
    var saved = [{ id: 1, column: 'Title' }];
    var off = { detailViewOptions: saved.slice(), detailViewKnownColumns: ['Title'], detailViewAutoUpdate: false };
    var on = { detailViewOptions: saved.slice(), detailViewKnownColumns: ['Title'], detailViewAutoUpdate: true };

    NativeUtils.prepareDetailViewOptions(off, LAYOUTS['small-card'], ['Title', 'Venue']);
    NativeUtils.prepareDetailViewOptions(on, LAYOUTS['small-card'], ['Title', 'Venue']);

    expect(columnsOf(off.detailViewOptions)).toEqual(['Title']);
    expect(columnsOf(on.detailViewOptions)).toEqual(['Title', 'Venue']);
    expect(on.detailViewSeedSignature).toBeUndefined();
  });

  it('fills news-feed through the auto-update only', function() {
    var config = { detailViewOptions: [], detailViewAutoUpdate: true };

    NativeUtils.prepareDetailViewOptions(config, LAYOUTS['news-feed'], DEMO_COLUMNS['news-feed']);

    expect(columnsOf(config.detailViewOptions)).toEqual(DEMO_COLUMNS['news-feed']);
    expect(config.detailViewSeedSignature).toBeUndefined();
  });
});

describe('PS-1879 review of #805 — a data source change with the auto-update on', function() {
  var layout = 'small-card';
  var VENUE_COLUMNS = CUSTOM_COLUMNS.concat('Venue');

  // A Directory list on QA's data source, edited since (About deleted), auto-update on.
  function configuredList() {
    var config = pickLayout(layout);

    chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS);
    config.detailViewAutoUpdate = true;
    saveSettings(config, CUSTOM_COLUMNS);
    config.detailViewOptions = config.detailViewOptions.filter(function(option) { return option.column !== 'About'; });
    saveSettings(config, CUSTOM_COLUMNS);

    return config;
  }

  function without(config, column) {
    config.detailViewOptions = config.detailViewOptions.filter(function(option) { return option.column !== column; });
  }

  it('adds the column new with the chosen data source, in settings and at runtime (Arpan\'s repro)', function() {
    var config = configuredList();

    expect(chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS, true)).toBe(true);
    expect(columnsOf(config.detailViewOptions)).toContain('Venue');

    saveSettings(config, VENUE_COLUMNS);

    expect(reopen(config, layout, VENUE_COLUMNS)).toContain('Venue');
    expect(renderedAtRuntime(config, VENUE_COLUMNS)).toContain('Venue');
    expect(renderedAtRuntime(config, VENUE_COLUMNS)).not.toContain('About');
  });

  it('does the same for a list saved before this release (no fingerprint, no snapshot)', function() {
    var config = configuredList();

    delete config.detailViewSeedSignature;
    delete config.detailViewKnownColumns;
    delete config.detailViewSeeded;

    chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS, true);
    saveSettings(config, VENUE_COLUMNS);

    expect(reopen(config, layout, VENUE_COLUMNS)).toContain('Venue');
    expect(columnsOf(config.detailViewOptions)).not.toContain('About');
  });

  it('adds nothing when the auto-update is off', function() {
    var config = configuredList();
    var before = clone(config.detailViewOptions);

    expect(chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS, false)).toBe(false);
    expect(config.detailViewOptions).toEqual(before);
  });

  it('leaves the column out once the user deletes it after the change', function() {
    var config = configuredList();

    chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS, true);
    without(config, 'Venue');
    saveSettings(config, VENUE_COLUMNS);

    expect(reopen(config, layout, VENUE_COLUMNS)).not.toContain('Venue');
    expect(renderedAtRuntime(config, VENUE_COLUMNS)).not.toContain('Venue');
  });

  it('counts the previous data source\'s columns as offered on a second change in one session', function() {
    var config = configuredList();

    chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS, true);
    without(config, 'Venue');
    chooseDataSource(config, layout, VENUE_COLUMNS, VENUE_COLUMNS.concat('Hall'), true);

    expect(columnsOf(config.detailViewOptions)).toContain('Hall');
    expect(columnsOf(config.detailViewOptions)).not.toContain('Venue');
    expect(columnsOf(config.detailViewOptions)).not.toContain('About');
  });

  it('gives the added columns ids no other field holds', function() {
    var config = configuredList();

    chooseDataSource(config, layout, CUSTOM_COLUMNS, VENUE_COLUMNS.concat('Hall'), true);

    var ids = idsOf(config.detailViewOptions);

    expect(ids.filter(function(id, index) { return ids.indexOf(id) === index; })).toEqual(ids);
  });

  it('still rebuilds untouched seeded fields instead of adding to them', function() {
    var config = pickLayout(layout);

    expect(chooseDataSource(config, layout, DEMO_COLUMNS[layout], CUSTOM_COLUMNS, true)).toBe(true);
    expect(blankPlainRows(config.detailViewOptions, CUSTOM_COLUMNS)).toEqual([]);
  });

  it('gives news-feed every column while its list has never held a field', function() {
    var config = { 'summary-fields': clone(LAYOUTS['news-feed']['summary-fields']), detailViewOptions: [] };

    expect(chooseDataSource(config, 'news-feed', DEMO_COLUMNS['news-feed'], CUSTOM_COLUMNS, true)).toBe(true);
    expect(columnsOf(config.detailViewOptions)).toEqual(CUSTOM_COLUMNS);
  });
});

describe('PS-1879 review of #805 — a list the user emptied is not filled again on reopen', function() {
  // Arpan Jokhakar: populate and save a simple list, delete every detail field, save and
  // reopen. prepareDetailViewOptions seeded it again because the list was empty.
  function emptied(autoUpdate) {
    var config = pickLayout('simple-list');

    chooseDataSource(config, 'simple-list', DEMO_COLUMNS['simple-list'], CUSTOM_COLUMNS);
    config.detailViewAutoUpdate = autoUpdate;
    saveSettings(config, CUSTOM_COLUMNS);
    config.detailViewOptions = [];
    saveSettings(config, CUSTOM_COLUMNS);

    return config;
  }

  it('keeps a simple list empty after save and reopen', function() {
    var config = emptied(false);

    expect(config.detailViewSeeded).toBe(true);
    expect(reopen(config, 'simple-list', CUSTOM_COLUMNS)).toEqual([]);
    expect(renderedAtRuntime(config, CUSTOM_COLUMNS)).toEqual([]);
  });

  it('keeps it empty with the auto-update on, until a column is added', function() {
    var config = emptied(true);

    expect(reopen(config, 'simple-list', CUSTOM_COLUMNS)).toEqual([]);
    expect(reopen(config, 'simple-list', CUSTOM_COLUMNS.concat('Venue'))).toEqual(['Venue']);
  });

  it('still seeds a list that has never held a field', function() {
    var config = { 'summary-fields': clone(LAYOUTS['simple-list']['summary-fields']), detailViewOptions: [] };

    expect(reopen(config, 'simple-list', CUSTOM_COLUMNS).length).toBeGreaterThan(0);
  });
});

describe('PS-1879 review — js/interface.js calls the helpers', function() {
  var source = fs.readFileSync(INTERFACE_PATH, 'utf8');

  it('rebuilds on a data source change after the summary fields are re-validated', function() {
    var handler = source.slice(source.indexOf("if (event === 'dataSourceSelect') {"));
    var previous = handler.indexOf('var previousColumns = dataSourceColumns;');
    var assign = handler.indexOf('dataSourceColumns = dataSource.columns;');
    var summary = handler.indexOf('_this.updateSummaryRowContainer();');
    var rebuild = handler.indexOf("NativeUtils.changeDetailViewDataSource(_this.config, defaultSettings[listLayout], previousColumns, dataSourceColumns, $('input#enable-auto-update').is(':checked'));");
    var render = handler.indexOf('_this.updateDetailsRowContainer();');

    expect(previous).toBeGreaterThan(-1);
    expect(previous).toBeLessThan(assign);
    expect(assign).toBeLessThan(summary);
    expect(summary).toBeLessThan(rebuild);
    expect(rebuild).toBeLessThan(render);
  });

  it('prepares the detail fields on load through the helper', function() {
    expect(source).toContain('NativeUtils.prepareDetailViewOptions(_this.config, defaultSettings[listLayout], dataSourceColumns);');
    expect(source).not.toContain('fromStart');
    expect(source).not.toContain('detailViewOptions.length + 1');
  });
});
