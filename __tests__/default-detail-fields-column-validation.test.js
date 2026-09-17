/**
 * Follow-up to PS-1879: default/template detail fields (e.g. 'Email', 'Telephone'
 * for card layouts) are hardcoded in js/default-configs/layouts-config.js to match
 * the widget's own demo dataset. When a custom data source without those exact
 * columns is connected, js/interface.js used to seed/restore them unconditionally,
 * producing a detail-view row with no matching dropdown option:
 *   - "Detail view fields are pre-filled with issues in settings view"
 *   - "Detail view fields are not pre-filled in settings, however fields are
 *     available in the Preview mode in detail view"
 * (Yuliia Solodka, PS-1879, 2026-06-11.)
 *
 * The fix filters defaultDetailFields down to fields whose column genuinely exists
 * in the connected data source, in one place (js/interface.js:1136-1138), before
 * that list is used both for seeding new detail fields and for the "restore lost
 * locked fields" block. This test exercises that exact filter expression.
 */

/* eslint-env jest */

function filterDefaultDetailFields(defaultDetailFields, dataSourceColumns) {
  return defaultDetailFields.filter(function(field) {
    return (dataSourceColumns || []).indexOf(field.column) !== -1;
  });
}

var SMALL_CARD_DETAIL_FIELDS = [
  { id: 'nMytReWq', location: 'Email', type: 'mail', column: 'Email', paranoid: true, helper: 'Email icon' },
  { id: 'tYrEqwMn', location: 'Telephone', type: 'tel', column: 'Telephone', paranoid: true, helper: 'Phone icon' },
  { id: 'XLbdTD45', location: 'Linkedin', type: 'url', column: 'Linkedin', paranoid: true, helper: 'LinkedIn icon' }
];

describe('PS-1879 follow-up — default detail fields must match a real DS column', function() {
  it('drops every default field when the data source has none of the expected columns (custom DS, e.g. PS-1879 Test Products)', function() {
    var dsColumns = ['Order No', 'Product Name', 'ID', 'Title', 'Description', 'Price', 'Images'];

    expect(filterDefaultDetailFields(SMALL_CARD_DETAIL_FIELDS, dsColumns)).toEqual([]);
  });

  it('keeps every default field when the data source is the widget\'s own demo dataset (no regression)', function() {
    var dsColumns = ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise'];

    expect(filterDefaultDetailFields(SMALL_CARD_DETAIL_FIELDS, dsColumns)).toEqual(SMALL_CARD_DETAIL_FIELDS);
  });

  it('keeps only the subset of default fields whose column exists (partial overlap)', function() {
    var dsColumns = ['Product Name', 'Email']; // has Email, not Telephone/Linkedin

    expect(filterDefaultDetailFields(SMALL_CARD_DETAIL_FIELDS, dsColumns)).toEqual([SMALL_CARD_DETAIL_FIELDS[0]]);
  });

  it('does not throw when dataSourceColumns is undefined (defensive — matches the || [] guard)', function() {
    expect(function() {
      filterDefaultDetailFields(SMALL_CARD_DETAIL_FIELDS, undefined);
    }).not.toThrow();
    expect(filterDefaultDetailFields(SMALL_CARD_DETAIL_FIELDS, undefined)).toEqual([]);
  });

  it('is a no-op for layouts with no default detail fields (e.g. simple-list)', function() {
    expect(filterDefaultDetailFields([], ['Order No', 'Product Name'])).toEqual([]);
  });
});
