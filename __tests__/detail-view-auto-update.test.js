/**
 * PS-1879 — "auto update when new fields are added" must add only genuinely new columns.
 *
 * Original report (Alexandra Aberlem, repro confirmed by Illia Kolosov 2026-05-05):
 * with the checkbox on, detail-view fields the user deleted reappeared on reopen and
 * re-rendered at runtime, because the merge re-added ANY data source column missing
 * from detailViewOptions.
 *
 * QA follow-up (Yuliia Solodka, 2026-06-11): "Detail view fields are not pre-filled in
 * settings, however fields are available in the Preview mode in detail view" — the
 * 'news-feed' layout is 'detail-fields-disabled', so interface.js's first-load seed
 * never runs for it and this merge is its only way to ever gain a field. A save made
 * while the list was still empty snapshotted every column as already known, so the list
 * could never populate, while news-feed's built-in detail template kept rendering in
 * Preview.
 *
 * These tests call the shipped helpers in js/native-utils.js directly: the settings
 * interface's merge (NativeUtils.appendNewDetailViewColumns), the runtime layouts' merge
 * (NativeUtils.newDetailViewColumns) and the keys written on save
 * (NativeUtils.detailViewSaveState). js/interface.js and the five layouts are thin calls
 * into them, which the last block checks at source level.
 */

/* eslint-env jest */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var INTERFACE_PATH = path.join(ROOT, 'js', 'interface.js');
var LAYOUT_FILES = ['agenda', 'news-feed', 'simple-list', 'small-card', 'small-h-card']
  .map(function(layout) { return path.join(ROOT, 'js', 'layout-javascript', layout + '-code.js'); });

// native-utils.js assigns to `window.NativeUtils`; expose `window` then require it.
global.window = global.window || {};
require(path.join(ROOT, 'js', 'native-utils.js'));

var NativeUtils = global.window.NativeUtils;

/**
 * Reopen the settings interface: runs the real merge and returns the column names of
 * the resulting detail view options.
 * @param {Object} config - Widget config (detailViewOptions/KnownColumns/Seeded)
 * @param {Array} dataSourceColumns - Columns of the connected data source
 * @returns {Array} detailViewOptions column names after the merge
 */
function mergeInInterface(config, dataSourceColumns) {
  return NativeUtils.appendNewDetailViewColumns(config, dataSourceColumns)
    .map(function(item) { return item.column; });
}

/**
 * Render a detail view at runtime: the extra columns the real helper appends on top of
 * the saved options.
 * @param {Object} data - Runtime data (detailViewOptions/KnownColumns/Seeded)
 * @param {Array} dataSourceColumns - Columns of the connected data source
 * @returns {Array} The extra column names rendered in the detail view
 */
function mergeAtRuntime(data, dataSourceColumns) {
  var savedColumns = data.detailViewOptions.map(function(option) { return option.column; });

  return NativeUtils.newDetailViewColumns(data, dataSourceColumns, savedColumns);
}

/**
 * Save & Close: applies the real save-state helper, as the save handler does.
 * @param {Object} config - Widget config, mutated in place as the save handler does
 * @param {Array} dataSourceColumns - Columns of the connected data source
 * @returns {Object} The same config object
 */
function save(config, dataSourceColumns) {
  return Object.assign(config, NativeUtils.detailViewSaveState(config, dataSourceColumns));
}

function columnsAsOptions(columns) {
  return columns.map(function(column) { return { column: column }; });
}

var DS_COLUMNS = ['Title', 'Order', 'Buttons', 'Popular', 'Description'];

describe('PS-1879 — the reported bug: deleted fields must not come back', function() {
  // Illia Kolosov's repro: delete Buttons/Order/Popular, Save & Close, reopen.
  var afterDeletion = ['Title', 'Description'];

  it('does not re-add deleted fields when the settings overlay is reopened', function() {
    var config = save({
      detailViewOptions: columnsAsOptions(afterDeletion),
      detailViewAutoUpdate: true
    }, DS_COLUMNS);

    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(afterDeletion);
  });

  it('does not re-render deleted fields at runtime', function() {
    var data = save({
      detailViewOptions: columnsAsOptions(afterDeletion),
      detailViewAutoUpdate: true
    }, DS_COLUMNS);

    expect(mergeAtRuntime(data, DS_COLUMNS)).toEqual([]);
  });

  it('keeps deleted fields gone across repeated save/reopen cycles', function() {
    var config = { detailViewOptions: columnsAsOptions(afterDeletion), detailViewAutoUpdate: true };

    for (var cycle = 0; cycle < 3; cycle++) {
      save(config, DS_COLUMNS);
      expect(mergeInInterface(config, DS_COLUMNS)).toEqual(afterDeletion);
    }
  });

  it('does not re-add deleted fields on an existing app that has no snapshot yet', function() {
    // Legacy config saved before PS-1879 shipped: no detailViewKnownColumns, no marker.
    var config = { detailViewOptions: columnsAsOptions(afterDeletion), detailViewAutoUpdate: true };

    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(afterDeletion);
    expect(mergeAtRuntime(config, DS_COLUMNS)).toEqual([]);
  });

  it('does not re-add deleted fields when a save landed before the columns loaded', function() {
    // Arpan Jokhakar's review of PR #794: an empty snapshot is truthy and must not be
    // read as "no column is known".
    var config = {
      detailViewOptions: columnsAsOptions(afterDeletion),
      detailViewKnownColumns: [],
      detailViewSeeded: true,
      detailViewAutoUpdate: true
    };

    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(afterDeletion);
    expect(mergeAtRuntime(config, DS_COLUMNS)).toEqual([]);
  });
});

describe('PS-1879 — a genuinely new data source column still appears', function() {
  it('adds a column created after the last save, in settings and at runtime', function() {
    var config = save({
      detailViewOptions: columnsAsOptions(['Title', 'Description']),
      detailViewAutoUpdate: true
    }, ['Title', 'Description']);

    var withNewColumn = ['Title', 'Description', 'Venue'];

    expect(mergeInInterface(config, withNewColumn)).toEqual(['Title', 'Description', 'Venue']);
    expect(mergeAtRuntime(config, withNewColumn)).toEqual(['Venue']);
  });

  it('adds a new column without resurrecting a deleted one in the same pass', function() {
    var config = save({
      detailViewOptions: columnsAsOptions(['Title']),
      detailViewAutoUpdate: true
    }, ['Title', 'Order']); // Order deleted by the user before this save

    expect(mergeInInterface(config, ['Title', 'Order', 'Venue'])).toEqual(['Title', 'Venue']);
  });

  it('adds nothing when the checkbox is off (the merge never runs)', function() {
    // The settings load and every layout guard the merge with detailViewAutoUpdate, so
    // an off checkbox cannot add a column regardless of what the snapshot says.
    var config = { detailViewOptions: columnsAsOptions(['Title']), detailViewAutoUpdate: false };

    NativeUtils.prepareDetailViewOptions(config, {}, ['Title', 'Venue']);

    expect(config.detailViewOptions.map(function(item) { return item.column; })).toEqual(['Title']);

    LAYOUT_FILES.forEach(function(file) {
      expect(fs.readFileSync(file, 'utf8')).toContain('if (_this.data.detailViewAutoUpdate) {');
    });
  });
});

describe('PS-1879 QA follow-up — a never-populated field list must still populate', function() {
  // Yuliia Solodka, 2026-06-11. news-feed is the only 'detail-fields-disabled' layout,
  // so interface.js's first-load seed never runs for it.
  it('populates a news-feed widget whose empty list was already snapshotted (the stuck app)', function() {
    var config = {
      detailViewOptions: [],
      detailViewKnownColumns: DS_COLUMNS, // written by a save made while the list was empty
      detailViewAutoUpdate: true
    };

    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(DS_COLUMNS);
    expect(mergeAtRuntime(config, DS_COLUMNS)).toEqual(DS_COLUMNS);
  });

  it('populates a brand-new widget that has never been saved', function() {
    var config = { detailViewOptions: [], detailViewAutoUpdate: true };

    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(DS_COLUMNS);
  });

  it('stays populated across save and reopen instead of emptying again', function() {
    var config = { detailViewOptions: [], detailViewAutoUpdate: true };

    config.detailViewOptions = columnsAsOptions(mergeInInterface(config, DS_COLUMNS));
    save(config, DS_COLUMNS);

    expect(config.detailViewSeeded).toBe(true);
    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(DS_COLUMNS);
  });

  it('populates once the data source gains its first column', function() {
    // A data source with no entries reports no columns, so the first save snapshots [].
    var config = save({ detailViewOptions: [], detailViewAutoUpdate: true }, []);

    expect(config.detailViewSeeded).toBe(false);
    expect(mergeInInterface(config, DS_COLUMNS)).toEqual(DS_COLUMNS);
  });
});

describe('PS-1879 QA follow-up — deleting every field is still respected', function() {
  it('keeps the list empty after the user removes all fields and reopens', function() {
    var config = save({
      detailViewOptions: columnsAsOptions(DS_COLUMNS),
      detailViewAutoUpdate: true
    }, DS_COLUMNS);

    config.detailViewOptions = []; // user deletes every row
    save(config, DS_COLUMNS);

    expect(config.detailViewSeeded).toBe(true);
    expect(mergeInInterface(config, DS_COLUMNS)).toEqual([]);
    expect(mergeAtRuntime(config, DS_COLUMNS)).toEqual([]);
  });

  it('keeps the list empty across repeated save/reopen cycles', function() {
    var config = save({ detailViewOptions: columnsAsOptions(DS_COLUMNS), detailViewAutoUpdate: true }, DS_COLUMNS);

    config.detailViewOptions = [];

    for (var cycle = 0; cycle < 3; cycle++) {
      save(config, DS_COLUMNS);
      expect(mergeInInterface(config, DS_COLUMNS)).toEqual([]);
    }
  });

  it('still surfaces a genuinely new column on an emptied list', function() {
    var config = save({ detailViewOptions: columnsAsOptions(DS_COLUMNS), detailViewAutoUpdate: true }, DS_COLUMNS);

    config.detailViewOptions = [];
    save(config, DS_COLUMNS);

    expect(mergeInInterface(config, DS_COLUMNS.concat('Venue'))).toEqual(['Venue']);
  });
});

describe('PS-1879 — NativeUtils.knownDetailViewColumns', function() {
  it('treats a populated list as having been offered its snapshot', function() {
    expect(NativeUtils.knownDetailViewColumns(
      { detailViewOptions: [{ column: 'a' }], detailViewKnownColumns: ['a', 'b'] }, ['a', 'b', 'c']
    )).toEqual(['a', 'b']);
  });

  it('returns nothing known for an empty, never-seeded list', function() {
    expect(NativeUtils.knownDetailViewColumns(
      { detailViewOptions: [], detailViewKnownColumns: ['a', 'b'] }, ['a', 'b']
    )).toEqual([]);
  });

  it('keeps the snapshot for an empty list that was seeded before', function() {
    expect(NativeUtils.knownDetailViewColumns(
      { detailViewOptions: [], detailViewKnownColumns: ['a', 'b'], detailViewSeeded: true }, ['a', 'b']
    )).toEqual(['a', 'b']);
  });

  it('falls back to the current columns when the snapshot is missing or empty', function() {
    expect(NativeUtils.knownDetailViewColumns({ detailViewOptions: [{ column: 'a' }] }, ['a', 'b'])).toEqual(['a', 'b']);
    expect(NativeUtils.knownDetailViewColumns(
      { detailViewOptions: [{ column: 'a' }], detailViewKnownColumns: [] }, ['a', 'b']
    )).toEqual(['a', 'b']);
  });

  it('always returns an array, so the callers can index into it safely', function() {
    [undefined, null, {}, { detailViewOptions: 'nope' }, { detailViewSeeded: true }].forEach(function(input) {
      expect(Array.isArray(NativeUtils.knownDetailViewColumns(input, undefined))).toBe(true);
    });
  });

  it('does not mutate the config it is given', function() {
    var config = { detailViewOptions: [], detailViewKnownColumns: ['a'] };
    var snapshot = JSON.parse(JSON.stringify(config));

    NativeUtils.knownDetailViewColumns(config, ['a', 'b']);

    expect(config).toEqual(snapshot);
  });
});

describe('PS-1879 — the primitives the helper is built on', function() {
  it('difference() excludes both the saved options and the known snapshot', function() {
    expect(NativeUtils.difference(['name', 'email', 'phone', 'newCol'], ['name', 'email'], ['name', 'email', 'phone']))
      .toEqual(['newCol']);
    expect(NativeUtils.difference(['a', 'b'], ['a'], ['a', 'b'])).toEqual([]);
  });

  it('coalesceArray() keeps a real snapshot and falls back on an empty or absent one', function() {
    expect(NativeUtils.coalesceArray(['a'], ['x', 'y'])).toEqual(['a']);
    expect(NativeUtils.coalesceArray([], ['x', 'y'])).toEqual(['x', 'y']);
    expect(NativeUtils.coalesceArray(undefined, ['x', 'y'])).toEqual(['x', 'y']);
    expect(NativeUtils.coalesceArray(null, ['x', 'y'])).toEqual(['x', 'y']);
  });
});

describe('PS-1879 — every read site and the save handler use the shipped helper', function() {
  it('merges new columns through the helper in the settings overlay', function() {
    var source = fs.readFileSync(INTERFACE_PATH, 'utf8');

    // prepareDetailViewOptions runs appendNewDetailViewColumns when the box is ticked.
    expect(source).toContain('NativeUtils.prepareDetailViewOptions(_this.config, defaultSettings[listLayout], dataSourceColumns);');
    // The superseded inline merge and its colliding id must not come back.
    expect(source).not.toContain('detailViewOptions.length + 1');
    expect(source).not.toContain('coalesceArray(_this.config.detailViewKnownColumns');
  });

  it('resolves new columns through the helper in all five runtime layouts', function() {
    LAYOUT_FILES.forEach(function(file) {
      var source = fs.readFileSync(file, 'utf8');

      expect(source).toContain('NativeUtils.newDetailViewColumns(_this.data, _this.dataSourceColumns, savedColumns)');
      expect(source).not.toContain('coalesceArray(_this.data.detailViewKnownColumns');
    });
  });

  it('writes both the snapshot and the seeded marker on save', function() {
    var source = fs.readFileSync(INTERFACE_PATH, 'utf8');

    expect(source).toContain('Object.assign(data, NativeUtils.detailViewSaveState(_this.config, dataSourceColumns));');
  });

  it('keeps the marker sticky once the list has been populated', function() {
    var config = save({ detailViewOptions: columnsAsOptions(['Title']) }, DS_COLUMNS);

    expect(config.detailViewSeeded).toBe(true);

    config.detailViewOptions = [];

    expect(save(config, DS_COLUMNS).detailViewSeeded).toBe(true);
  });

  it('snapshots the fallback columns when the data source columns have not loaded', function() {
    expect(NativeUtils.detailViewSaveState({ detailViewOptions: [], defaultColumns: ['a'] }, undefined))
      .toEqual({ detailViewKnownColumns: ['a'], detailViewSeeded: false });
    expect(NativeUtils.detailViewSaveState({}, undefined))
      .toEqual({ detailViewKnownColumns: [], detailViewSeeded: false });
  });
});
