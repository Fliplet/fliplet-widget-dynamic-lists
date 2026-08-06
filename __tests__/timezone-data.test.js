/**
 * Tests for DEV-1686: the bundled moment-timezone data must not silently expire.
 *
 * The widget ships its own moment-timezone build and it wins the load order on any
 * screen containing a list, so whatever data it carries becomes the data every other
 * script on that screen sees. The original bug was a 10-year-range build from 2021
 * whose DST table ran out in November 2026 — no error, no console warning, just times
 * an hour early for every zone that observes DST.
 *
 * The replacement is a custom span (see the header comment in the vendor file). A span
 * is still a cliff, just a distant one, so these tests fail loudly long before it
 * arrives rather than leaving it to be rediscovered by a customer.
 *
 * If this test fails with "horizon too close", regenerate the vendor file from a
 * current moment-timezone release using the command in its header comment.
 */

/* eslint-env jest */

var fs = require('fs');
var path = require('path');

var VENDOR_FILE = path.join(__dirname, '..', 'vendor', 'moment-timezone-with-data.min.js');

// Minimum years of DST data that must remain ahead of today. Chosen so the test starts
// failing roughly a decade before anything renders wrongly, leaving ample time to react.
var MIN_YEARS_AHEAD = 20;

// The widget's own moment.tz call sites (js/utils.js) need history too — date filters
// compare against stored record dates, which can be older than the app itself.
var MAX_HISTORY_START_YEAR = 2016;

// Upstream moment-timezone 0.6.3 advertises 597 names. A custom build must not quietly
// ship fewer: dropping aliases means those zones fall back to browser-local time.
var MIN_ZONE_NAMES = 590;

var moment = require('moment');

global.moment = moment;
require(VENDOR_FILE);

var source = fs.readFileSync(VENDOR_FILE, 'utf8');

describe('DEV-1686 — bundled moment-timezone data', function() {
  it('loads and reports both a library version and an IANA data version', function() {
    expect(typeof moment.tz).toBe('function');
    expect(moment.tz.version).toMatch(/^\d+\.\d+\.\d+$/);
    // An empty dataVersion means the no-data build got bundled by mistake.
    expect(moment.tz.dataVersion).toMatch(/^\d{4}[a-z]$/);
  });

  it('declares its version and span in a header comment', function() {
    var header = source.slice(0, 400);

    expect(header).toContain('moment-timezone ' + moment.tz.version);
    expect(header).toContain('IANA ' + moment.tz.dataVersion);
    expect(header).toMatch(/DST data span \d{4}-\d{4}/);
  });

  it('has a DST horizon at least ' + MIN_YEARS_AHEAD + ' years ahead of today', function() {
    var zone = moment.tz.zone('America/New_York');
    var finite = zone.untils.filter(function(until) {
      return until !== null && isFinite(until);
    });
    var horizonYear = new Date(finite[finite.length - 1]).getUTCFullYear();
    var required = new Date().getUTCFullYear() + MIN_YEARS_AHEAD;

    // Regenerate the vendor file if this fails — see the header comment in it.
    expect(horizonYear).toBeGreaterThanOrEqual(required);
  });

  it('still covers historical dates back to at least ' + MAX_HISTORY_START_YEAR, function() {
    var zone = moment.tz.zone('America/New_York');
    var firstYear = new Date(zone.untils[0]).getUTCFullYear();

    expect(firstYear).toBeLessThanOrEqual(MAX_HISTORY_START_YEAR);
  });

  describe('zone coverage', function() {
    // Regression guard for the defect caught in review on PR #795.
    //
    // filterLinkPack() carries upstream's links through verbatim and then appends links it
    // derives for zones that became duplicates after year-filtering, without reconciling the
    // two. That leaves chains ("A|B" plus "B|C"), and getZone resolves only ONE level of
    // indirection, so every chained name resolves to null. 139 zones vanished silently.
    //
    // NOTE: asserting that names() contains no unresolvable entries does NOT catch this.
    // names() itself filters to `zones[i] || zones[links[i]]` — one level — so broken zones
    // are omitted from the list rather than appearing in it and failing. The count floor and
    // the explicit alias assertions below are what actually catch it.
    it('advertises at least ' + MIN_ZONE_NAMES + ' zone names', function() {
      expect(moment.tz.names().length).toBeGreaterThanOrEqual(MIN_ZONE_NAMES);
    });

    it('resolves every name it advertises', function() {
      var unresolved = moment.tz.names().filter(function(name) {
        return !moment.tz.zone(name);
      });

      expect(unresolved).toEqual([]);
    });

    it('resolves link zones, not just base zones', function() {
      // Each of these is an alias that sat behind a broken link chain.
      var aliases = [
        'America/Toronto', 'Europe/Amsterdam', 'Asia/Taipei', 'America/Winnipeg',
        'Europe/Warsaw', 'America/Regina', 'Europe/Zurich', 'Europe/Rome',
        'Europe/Stockholm', 'Europe/Copenhagen', 'Asia/Riyadh', 'Canada/Eastern',
        'US/Eastern', 'GMT', 'Etc/GMT', 'Jamaica'
      ];
      var missing = aliases.filter(function(name) {
        return !moment.tz.zone(name);
      });

      expect(missing).toEqual([]);
    });

    it('converts correctly through an alias', function() {
      expect(moment('2029-06-12T14:00:00Z').tz('America/Toronto').format('HH:mm Z'))
        .toBe('10:00 -04:00');
      expect(moment('2029-06-12T14:00:00Z').tz('Europe/Amsterdam').format('HH:mm Z'))
        .toBe('16:00 +02:00');
      expect(moment('2029-06-12T14:00:00Z').tz('Asia/Taipei').format('HH:mm Z'))
        .toBe('22:00 +08:00');
    });
  });

  describe('DST conversions are correct across the span', function() {
    // The canary from the DEV-1686 report. 12 June is inside US daylight time, so
    // 14:00Z is 10:00 EDT (-04:00). The broken build returned 09:00 -05:00 because
    // its table ended before the 2029 transitions existed.
    it('converts the DEV-1686 reproduction case correctly', function() {
      expect(moment('2029-06-12T14:00:00Z').tz('America/New_York').format('HH:mm Z'))
        .toBe('10:00 -04:00');
    });

    it('applies summer time in Europe/London well past the old 2026 cliff', function() {
      expect(moment('2030-07-01T12:00:00Z').tz('Europe/London').format('HH:mm Z'))
        .toBe('13:00 +01:00');
    });

    it('applies southern-hemisphere DST in Australia/Sydney', function() {
      expect(moment('2030-01-15T00:00:00Z').tz('Australia/Sydney').format('HH:mm Z'))
        .toBe('11:00 +11:00');
    });

    it('leaves non-DST zones alone', function() {
      expect(moment('2030-06-12T14:00:00Z').tz('Asia/Tokyo').format('HH:mm Z'))
        .toBe('23:00 +09:00');
    });
  });

  describe('the call sites in js/utils.js keep working', function() {
    // js/utils.js:1188 and :1476 — device-timezone date filters.
    it('resolves a zone name via moment.tz.guess()', function() {
      expect(typeof moment.tz.guess()).toBe('string');
      expect(moment.tz.guess().length).toBeGreaterThan(3);
    });

    // js/utils.js:1150 — moment.tz(<local string>, 'UTC') for filter comparisons.
    it('constructs a moment in an explicit zone', function() {
      expect(moment.tz('2029-01-01 12:00', 'UTC').format('HH:mm Z')).toBe('12:00 +00:00');
    });
  });
});
