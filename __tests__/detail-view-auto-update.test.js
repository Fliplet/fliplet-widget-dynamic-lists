/**
 * Tests for PS-1879: detail-view fields must not repopulate after deletion.
 *
 * When "auto update when new fields are added" is on, the merge logic only adds
 * columns that are genuinely new to the data source. A column the user removed is
 * recorded in the detailViewKnownColumns snapshot, so it is excluded from the
 * re-add. These tests cover the two primitives that combine to produce that
 * behaviour (NativeUtils.difference variadic + NativeUtils.coalesceArray) and the
 * empty-snapshot edge case that would otherwise silently resurrect the bug.
 */

/* eslint-env jest */

var path = require('path');

// native-utils.js assigns to `window.NativeUtils`; expose `window` then require it.
global.window = global.window || {};
require(path.join(__dirname, '..', 'js', 'native-utils.js'));

var NativeUtils = global.window.NativeUtils;

describe('PS-1879 — NativeUtils.difference (variadic exclusion)', function() {
  it('returns only columns absent from BOTH saved options and the known snapshot', function() {
    var dsColumns = ['name', 'email', 'phone', 'newCol'];
    var savedColumns = ['name', 'email'];
    var knownColumns = ['name', 'email', 'phone']; // phone deleted by user: known, not saved

    expect(NativeUtils.difference(dsColumns, savedColumns, knownColumns)).toEqual(['newCol']);
  });

  it('re-adds nothing when every data source column is already known', function() {
    var dsColumns = ['a', 'b'];

    expect(NativeUtils.difference(dsColumns, ['a'], ['a', 'b'])).toEqual([]);
  });
});

describe('PS-1879 — NativeUtils.coalesceArray (empty-snapshot guard)', function() {
  it('keeps a non-empty snapshot', function() {
    expect(NativeUtils.coalesceArray(['a'], ['x', 'y'])).toEqual(['a']);
  });

  it('falls back when the snapshot is an empty array (truthy-empty footgun)', function() {
    expect(NativeUtils.coalesceArray([], ['x', 'y'])).toEqual(['x', 'y']);
  });

  it('falls back when the snapshot is absent (existing apps with no snapshot)', function() {
    expect(NativeUtils.coalesceArray(undefined, ['x', 'y'])).toEqual(['x', 'y']);
    expect(NativeUtils.coalesceArray(null, ['x', 'y'])).toEqual(['x', 'y']);
  });
});

describe('PS-1879 — column resolution end to end', function() {
  // The deleted column ("phone") still exists in the data source but was removed
  // from the detail view. It must NOT be re-added on any subsequent load/render.
  // Mirrors the real gate added in interface.js / the 5 runtime layouts: the
  // known-columns exclusion only applies once savedColumns is non-empty (see the
  // 'detail-fields-disabled layout' describe block below for why).
  function newColumnsToAdd(snapshot, dsColumns, savedColumns) {
    var knownColumns = savedColumns.length ? NativeUtils.coalesceArray(snapshot, dsColumns) : [];

    return NativeUtils.difference(dsColumns, savedColumns, knownColumns);
  }

  it('does not re-add a deleted column when a real snapshot exists', function() {
    var snapshot = ['name', 'email', 'phone'];
    var dsColumns = ['name', 'email', 'phone'];
    var savedColumns = ['name', 'email']; // user deleted phone

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns)).toEqual([]);
  });

  it('does not re-add a deleted column when the snapshot is empty (the Arpan hazard)', function() {
    var snapshot = []; // persisted before columns loaded
    var dsColumns = ['name', 'email', 'phone'];
    var savedColumns = ['name', 'email']; // user deleted phone

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns)).toEqual([]);
  });

  it('still surfaces a genuinely new data source column once a snapshot exists', function() {
    var snapshot = ['name', 'email']; // columns known as of last save
    var dsColumns = ['name', 'email', 'phone']; // phone added to the DS afterwards
    var savedColumns = ['name', 'email'];

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns)).toEqual(['phone']);
  });
});

describe('PS-1879 follow-up — detail-fields-disabled layout (e.g. news-feed) must still populate', function() {
  // news-feed has 'detail-fields-disabled': true in layouts-config.js, so the
  // fromStart seed (which populates detailViewOptions for every other layout) never
  // runs for it. The auto-update merge is its ONLY way to ever get fields into
  // detailViewOptions. Before this follow-up, a save with an empty detailViewOptions
  // still wrote a full detailViewKnownColumns snapshot, and on the next load every
  // DS column was already "known" -- so nothing was ever added, permanently.
  // ("Detail view fields are not pre-filled in settings, however fields are
  // available in the Preview mode in detail view" -- Yuliia Solodka, 2026-06-11.)
  function newColumnsToAdd(snapshot, dsColumns, savedColumns) {
    var knownColumns = savedColumns.length ? NativeUtils.coalesceArray(snapshot, dsColumns) : [];

    return NativeUtils.difference(dsColumns, savedColumns, knownColumns);
  }

  it('populates every column on the very first save, even though the snapshot already equals the DS columns', function() {
    var dsColumns = ['Title', 'Date', 'Categories', 'Image', 'Content'];
    var snapshot = dsColumns.slice(); // written unconditionally by the save handler, even with 0 saved fields
    var savedColumns = []; // detailViewOptions has never been populated

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns).sort()).toEqual(dsColumns.slice().sort());
  });

  it('still respects a real deletion once the layout has been populated at least once', function() {
    var dsColumns = ['Title', 'Date', 'Categories', 'Image', 'Content'];
    var snapshot = dsColumns.slice();
    var savedColumns = ['Title', 'Date', 'Content']; // user deleted Categories and Image

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns)).toEqual([]);
  });

  it('still adds a genuinely new column once the layout has been populated at least once', function() {
    var snapshot = ['Title', 'Date', 'Content'];
    var dsColumns = ['Title', 'Date', 'Content', 'Author']; // Author added to the DS afterwards
    var savedColumns = ['Title', 'Date', 'Content'];

    expect(newColumnsToAdd(snapshot, dsColumns, savedColumns)).toEqual(['Author']);
  });
});
