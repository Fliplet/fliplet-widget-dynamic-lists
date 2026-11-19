/* eslint-env jest */

/**
 * The bookmarks cache in App.Storage is keyed on the cached session user.
 *
 * Before the fix every user on the device shared the key 'bookmarks-<dsId>', so after
 * a sign-in that replaced the user, a slow bookmarks request let the previous user's
 * cached bookmarks show for the new user. Keying on Fliplet.Profile.uuid still missed
 * a session switch that left the profile on the previous email.
 *
 * utils.js and each layout's getAllBookmarks are loaded from the widget source into a
 * vm context with NativeUtils and a stubbed Fliplet, and called.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var DS_ID = 1074;
var SHARED_KEY = 'bookmarks-' + DS_ID;
var LAYOUTS = ['small-card', 'agenda', 'news-feed', 'simple-list'];

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8').replace(/\r\n/g, '\n');
}

function getAllBookmarksSource(code) {
  var start = code.indexOf('DynamicList.prototype.getAllBookmarks = function');
  var end = code.indexOf('\nDynamicList.prototype.', start + 1);

  expect(start).toBeGreaterThan(-1);

  return code.slice(start, end > -1 ? end : undefined);
}

function bookmark(entryId) {
  return { data: { content: { entryId: entryId + '-bookmark' } } };
}

function createStorage(initial) {
  var store = Object.assign({}, initial);

  return {
    store: store,
    get: function(key) {
      return Promise.resolve(store[key]);
    },
    set: function(key, value) {
      store[key] = value;

      return Promise.resolve(value);
    },
    remove: function(key) {
      delete store[key];

      return Promise.resolve();
    }
  };
}

function dataSourceSession(email, extras) {
  extras = extras || {};

  return {
    client: { uuid: extras.uuid || 'device-1' },
    entries: {
      dataSource: {
        id: extras.entryId || 11,
        data: extras.data || { Email: email }
      }
    }
  };
}

/**
 * Creates a vm context with NativeUtils, a stubbed Fliplet and the real utils.js loaded.
 * @param {object} options - session (value or function for getCachedSession), storage, serverData, delay
 * @returns {object} The vm context, with Utils set to the registered dynamicListUtils
 */
function context(options) {
  options = options || {};

  var registry = {};
  var profile = { Content: function() {
    return Promise.resolve({
      query: function() {
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(options.serverData || []);
          }, options.delay || 0);
        });
      }
    });
  } };

  if (options.profileEmail) {
    profile.get = function(key) {
      return Promise.resolve(key === 'email' ? options.profileEmail : undefined);
    };

    profile.uuid = function() {
      return Promise.resolve({ email: options.profileEmail, uuid: 'device-1' });
    };
  }

  var user = {};

  if (options.session === undefined) {
    user.getCachedSession = undefined;
  } else if (typeof options.session === 'function') {
    user.getCachedSession = options.session;
  } else {
    user.getCachedSession = function() {
      return Promise.resolve(options.session);
    };
  }

  var ctx = vm.createContext({
    window: {},
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    Fliplet: {
      Registry: {
        set: function(key, value) {
          registry[key] = value;
        },
        get: function(key) {
          return registry[key];
        }
      },
      Profile: profile,
      User: user,
      App: {
        Storage: options.storage || createStorage()
      }
    }
  });

  vm.runInContext(read('native-utils.js'), ctx);
  ctx.NativeUtils = ctx.window.NativeUtils;
  vm.runInContext(read('utils.js'), ctx);
  ctx.Utils = registry.dynamicListUtils;

  return ctx;
}

describe('getBookmarksCacheKey', function() {
  function key(session) {
    var ctx = context({ session: session });

    expect(typeof ctx.Utils.Query.getBookmarksCacheKey).toBe('function');

    return ctx.Utils.Query.getBookmarksCacheKey(DS_ID);
  }

  it('uses the lower-cased Email of the cached session data source entry', function() {
    return key(dataSourceSession('Alice@Example.COM')).then(function(value) {
      expect(value).toBe('bookmarks-1074-alice@example.com');
    });
  });

  it('uses data.email when Email is not set', function() {
    return key(dataSourceSession(null, { data: { email: 'b@example.com' } })).then(function(value) {
      expect(value).toBe('bookmarks-1074-b@example.com');
    });
  });

  it('uses the data source entry id when the row has no email', function() {
    return key(dataSourceSession(null, { entryId: 99, data: { Name: 'SSO' } })).then(function(value) {
      expect(value).toBe('bookmarks-1074-99');
    });
  });

  it('uses the session client uuid of a guest', function() {
    return key({ client: { uuid: 'guest-uuid-1' } }).then(function(value) {
      expect(value).toBe('bookmarks-1074-guest-uuid-1');
    });
  });

  it('uses "guest" when there is no session identity', function() {
    return key({}).then(function(value) {
      expect(value).toBe('bookmarks-1074-guest');
    });
  });

  it('uses "guest" when Fliplet.User.getCachedSession rejects', function() {
    return key(function() {
      return Promise.reject(new Error('no session'));
    }).then(function(value) {
      expect(value).toBe('bookmarks-1074-guest');
    });
  });

  it('uses "guest" when Fliplet.User.getCachedSession throws', function() {
    return key(function() {
      throw new Error('boom');
    }).then(function(value) {
      expect(value).toBe('bookmarks-1074-guest');
    });
  });

  it('uses "guest" when Fliplet.User.getCachedSession is missing', function() {
    return key(undefined).then(function(value) {
      expect(value).toBe('bookmarks-1074-guest');
    });
  });

  it('gives different users different keys and ignores email case', function() {
    return Promise.all([
      key(dataSourceSession('a@example.com')),
      key(dataSourceSession('b@example.com')),
      key(dataSourceSession('A@Example.com'))
    ]).then(function(values) {
      expect(values[0]).not.toBe(values[1]);
      expect(values[2]).toBe(values[0]);
    });
  });

  it('follows the session data source entry, not a stale profile email', function() {
    var ctx = context({
      session: dataSourceSession('b@example.com'),
      profileEmail: 'a@example.com'
    });

    return ctx.Utils.Query.getBookmarksCacheKey(DS_ID).then(function(value) {
      expect(value).toBe('bookmarks-1074-b@example.com');
    });
  });

  it('uses the SAML2 email when there is no data source entry', function() {
    return key({
      client: { uuid: 'device-1' },
      entries: { saml2: { user: { email: 'saml@example.com' } } }
    }).then(function(value) {
      expect(value).toBe('bookmarks-1074-saml@example.com');
    });
  });
});

describe('fetchAndCache with per-user keys', function() {
  it('does not return user A\'s cached bookmarks to user B on a slow request', function() {
    var ctx = context({ session: dataSourceSession('b@example.com') });
    var storage = ctx.Fliplet.App.Storage;
    var Query = ctx.Utils.Query;

    return Query.getBookmarksCacheKey(DS_ID).then(function(keyB) {
      storage.store['bookmarks-1074-a@example.com'] = [bookmark(1)];

      return Query.fetchAndCache({
        key: keyB,
        waitFor: 50,
        request: new Promise(function(resolve) {
          setTimeout(function() {
            resolve([bookmark(2)]);
          }, 150);
        })
      });
    }).then(function(results) {
      expect(results.fromCache).toBe(false);
      expect(JSON.parse(JSON.stringify(results.data))).toEqual([bookmark(2)]);
    });
  });
});

describe('layouts build the bookmarks cache key per session user', function() {
  LAYOUTS.forEach(function(layout) {
    var code = getAllBookmarksSource(read('layout-javascript/' + layout + '-code.js'));

    it(layout + ' does not pass the shared key to fetchAndCache', function() {
      expect(code).not.toMatch(/key:\s*'bookmarks-'\s*\+\s*_this\.data\.bookmarkDataSourceId/);
      expect(code).toContain('_this.Utils.Query.getBookmarksCache(_this.data.bookmarkDataSourceId)');
      expect(code).not.toContain('getBookmarksCacheKey');
      expect(code).not.toMatch(/DEV-\d+/);
    });

    function load(options) {
      var ctx = context({
        session: dataSourceSession('b@example.com'),
        profileEmail: options.profileEmail,
        storage: options.storage,
        serverData: options.serverData,
        delay: options.delay
      });

      vm.runInContext('function DynamicList() {}\n' + code, ctx);

      var instance = new ctx.DynamicList();

      instance.Utils = ctx.Utils;
      instance.data = {
        social: { bookmark: true },
        bookmarksEnabled: true,
        bookmarkDataSourceId: DS_ID
      };
      instance.listItems = [{ id: 1 }, { id: 2 }];

      return instance.getAllBookmarks().then(function() {
        return { instance: instance, storage: ctx.Fliplet.App.Storage };
      });
    }

    it(layout + ' shows user B the server bookmarks, not user A\'s cached ones, on a slow request', function() {
      var storage = createStorage();

      storage.store[SHARED_KEY] = [bookmark(1)];
      storage.store['bookmarks-1074-a@example.com'] = [bookmark(1)];

      return load({ storage: storage, serverData: [bookmark(2)], delay: 600 }).then(function(result) {
        expect(result.instance.listItems[0].bookmarked).toBe(false);
        expect(result.instance.listItems[1].bookmarked).toBe(true);
        expect(storage.store[SHARED_KEY]).toBeUndefined();
        expect(storage.store['bookmarks-1074-b@example.com']).toBeDefined();
        expect(storage.store['bookmarks-1074-a@example.com']).toBeDefined();
      });
    });

    it(layout + ' does not show user A\'s cache when the session is B and the profile is still A', function() {
      var storage = createStorage();

      storage.store['bookmarks-1074-a@example.com'] = [bookmark(1)];

      return load({
        storage: storage,
        serverData: [bookmark(2)],
        delay: 600,
        profileEmail: 'a@example.com'
      }).then(function(result) {
        expect(result.instance.listItems[0].bookmarked).toBe(false);
        expect(result.instance.listItems[1].bookmarked).toBe(true);
        expect(storage.store['bookmarks-1074-b@example.com']).toBeDefined();
      });
    });

    it(layout + ' still loads when removing the shared key fails', function() {
      var storage = createStorage();

      storage.store[SHARED_KEY] = [bookmark(1)];

      storage.remove = function() {
        return Promise.reject(new Error('storage error'));
      };

      return load({ storage: storage, serverData: [bookmark(2)], delay: 0 }).then(function(result) {
        expect(result.instance.listItems[1].bookmarked).toBe(true);
        expect(result.instance.fetchedAllBookmarks).toBe(true);
      });
    });
  });
});
