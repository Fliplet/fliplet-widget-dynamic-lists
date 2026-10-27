/* eslint-env jest */

/**
 * PS-2312: comments need a login, store only the public user columns,
 * spot the current user's comments by the server-set email, and the comments
 * user columns are saved on the comments data source.
 *
 * The functions under test are loaded from the widget source into a vm
 * context with NativeUtils, and called.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8').replace(/\r\n/g, '\n');
}

function fn(code, name) {
  var start = code.indexOf('DynamicList.prototype.' + name + ' = function');
  var end = code.indexOf('\nDynamicList.prototype.', start + 1);

  expect(start).toBeGreaterThan(-1);

  return code.slice(start, end > -1 ? end : undefined);
}

function context(globals) {
  var ctx = vm.createContext(Object.assign({ window: {}, console: console }, globals));

  vm.runInContext(read('native-utils.js'), ctx);
  ctx.NativeUtils = ctx.window.NativeUtils;

  return ctx;
}

// Plain host-realm copy, so jest compares values and not vm-realm prototypes
function plain(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

describe('PS-2312 comments data source creation', function() {
  it('requires a login for every operation', function() {
    var code = read('interface.js');
    var typeIndex = code.indexOf('type: \'comments\'');
    var block = code.slice(code.lastIndexOf('Fliplet.DataSources.create(', typeIndex), code.indexOf('}).then(', typeIndex));

    expect(block).toContain('{ type: [\'select\', \'insert\', \'update\', \'delete\'], allow: \'loggedIn\' }');
    expect(block).not.toContain('allow: \'all\'');
  });
});

['simple-list-code.js', 'news-feed-code.js'].forEach(function(file) {
  describe('PS-2312 ' + file, function() {
    var code = read(path.join('layout-javascript', file));
    var rendered;
    var ctx = context({
      TD: function() {
        return 'date';
      },
      Handlebars: {
        compile: function() {
          return function(info) {
            rendered = info;

            return '<div></div>';
          };
        }
      },
      Fliplet: { Widget: { Templates: { tpl: function() {
        return '';
      } } } }
    });

    vm.runInContext('var DynamicList = function() {};\n' + ['pickCommentUserColumns', 'addCommentViewData', 'getCommentAuthor', 'isOwnComment', 'replaceComment'].map(function(name) {
      return fn(code, name);
    }).join('\n'), ctx);

    function list(myUserData, data) {
      var instance = new ctx.DynamicList();

      instance.myUserData = myUserData;
      instance.data = Object.assign({
        layout: 'layout',
        userEmailColumn: 'Email',
        userNameFields: ['First Name', 'Last Name'],
        userPhotoColumn: 'Photo'
      }, data);
      instance.layoutMapping = { layout: { 'single-comment': 'tpl', 'temp-comment': 'tpl' } };
      instance.$container = { find: function() {
        return { replaceWith: function() {} };
      } };

      return instance;
    }

    function isOwn(myUserData, entry) {
      return list(myUserData).isOwnComment(entry);
    }

    var redacted = { data: { settings: { fromName: 'Bob B', text: 'hi', user: { 'First Name': 'Bob', Photo: 'b.png' } } } };

    describe('isOwnComment', function() {
      it('matches the server-set data.user.email, ignoring case and spaces', function() {
        expect(isOwn({ Email: ' Ann@X.com ' }, { data: { user: { email: 'ann@x.COM' }, settings: { user: {} } } })).toBe(true);
      });

      it('matches older rows by settings.user[email column]', function() {
        expect(isOwn({ Email: 'ann@x.com' }, { data: { settings: { user: { Email: 'ANN@x.com' } } } })).toBe(true);
      });

      it('matches when either email matches', function() {
        expect(isOwn({ Email: 'ann@x.com' }, { data: { user: { email: 'other@x.com' }, settings: { user: { Email: 'ann@x.com' } } } })).toBe(true);
        expect(isOwn({ Email: 'ann@x.com' }, { data: { user: { email: 'ann@x.com' }, settings: { user: { Email: 'other@x.com' } } } })).toBe(true);
      });

      it('falls back to the email / Email profile keys', function() {
        expect(isOwn({ email: 'ann@x.com' }, { data: { user: { email: 'ann@x.com' } } })).toBe(true);
      });

      it('does not match someone else\'s redacted comment', function() {
        expect(isOwn({ Email: 'ann@x.com' }, redacted)).toBe(false);
      });

      it('does not match a different email', function() {
        expect(isOwn({ Email: 'ann@x.com' }, { data: { user: { email: 'bob@x.com' } } })).toBe(false);
      });

      it('never matches when both emails are empty', function() {
        expect(isOwn({}, { data: { settings: { user: {} } } })).toBe(false);
        expect(isOwn({ Email: ' ' }, { data: { user: { email: ' ' } } })).toBe(false);
        expect(isOwn(undefined, { data: { user: { email: '' } } })).toBe(false);
      });

      it('does not throw when settings is missing', function() {
        expect(isOwn({ Email: 'ann@x.com' }, { data: {} })).toBe(false);
        expect(isOwn({ Email: 'ann@x.com' }, { data: { user: { email: 'ann@x.com' } } })).toBe(true);
      });

      it('SAML2 compares up to the first dot of the domain', function() {
        expect(isOwn({ Email: 'ann@corp.co.uk', isSaml2: true }, { data: { settings: { user: { Email: 'ann@corp.com' } } } })).toBe(true);
        expect(isOwn({ Email: 'ann@corp.com', isSaml2: true }, { data: { user: { email: 'bob@corp.com' } } })).toBe(false);
      });

      it('SAML2 does not throw or match when the regex finds nothing', function() {
        expect(isOwn({ Email: '@', isSaml2: true }, { data: { settings: { user: { Email: '@' } } } })).toBe(false);
      });
    });

    describe('pickCommentUserColumns (sendComment settings.user)', function() {
      it('keeps only the name, photo and email columns', function() {
        var profile = { 'First Name': 'Ann', 'Last Name': 'A', Photo: 'a.png', Email: 'ann@x.com', email: 'ann@x.com', Phone: '1', Password: 'hash', none: 'x', '': 'y' };
        var picked = list({}, { userNameFields: ['First Name', '', 'none', 'Last Name'] }).pickCommentUserColumns(profile);

        expect(plain(picked)).toEqual({ 'First Name': 'Ann', 'Last Name': 'A', Photo: 'a.png', Email: 'ann@x.com' });
      });

      it('skips unset photo and email columns', function() {
        var picked = list({}, { userPhotoColumn: 'none', userEmailColumn: '' }).pickCommentUserColumns({ 'First Name': 'Ann', Photo: 'a.png', Email: 'ann@x.com', none: 'x', '': 'y' });

        expect(plain(picked)).toEqual({ 'First Name': 'Ann' });
      });

      it('sendComment stores the picked columns', function() {
        expect(fn(code, 'sendComment')).toContain('user: _this.pickCommentUserColumns(_this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData)');
      });
    });

    describe('getCommentAuthor', function() {
      it('builds the name from the name columns', function() {
        expect(plain(list({}).getCommentAuthor({ data: { settings: { fromName: 'x', user: { 'First Name': 'Ann', 'Last Name': 'A', Photo: 'a.png' } } } })))
          .toEqual({ userName: 'Ann A', photo: 'a.png' });
      });

      it('falls back to settings.fromName when the name columns are empty', function() {
        expect(list({}).getCommentAuthor({ data: { settings: { fromName: 'Bob B', user: { Photo: 'b.png' } } } }).userName).toBe('Bob B');
      });

      it('does not throw without settings.user', function() {
        expect(plain(list({}).getCommentAuthor({ data: { settings: { fromName: 'Bob B' } } }))).toEqual({ userName: 'Bob B', photo: '' });
        expect(plain(list({}).getCommentAuthor({ data: { settings: {} } }))).toEqual({ userName: '', photo: '' });
      });
    });

    describe('addCommentViewData (showComments)', function() {
      it('showComments uses it for every comment', function() {
        expect(fn(code, 'showComments')).toContain('_this.addCommentViewData(comment);');
      });

      it('sets the author name, photo, text and date', function() {
        var comment = { createdAt: '2026-01-01T00:00:00Z', data: { settings: { fromName: 'x', text: 'hi', user: { 'First Name': 'Ann', 'Last Name': 'A', Photo: 'a.png' } } } };
        var result = list({ Email: 'bob@x.com' }).addCommentViewData(comment);

        expect(result).toBe(comment);
        expect(comment.userName).toBe('Ann A');
        expect(comment.photo).toBe('a.png');
        expect(comment.text).toBe('hi');
        expect(comment.literalDate).toBe('date');
        expect(comment.timeInMilliseconds).toBe(Date.parse('2026-01-01T00:00:00Z'));
        expect(comment.currentUser).toBeUndefined();
      });

      it('falls back to fromName and does not throw without settings.user', function() {
        var comment = { createdAt: '2026-01-01', data: { settings: { fromName: 'Bob B', text: 'hi' } } };

        list({ Email: 'ann@x.com' }).addCommentViewData(comment);

        expect(comment.userName).toBe('Bob B');
        expect(comment.photo).toBe('');
        expect(comment.currentUser).toBeUndefined();
      });

      it('shows a redacted comment by its name columns', function() {
        var comment = JSON.parse(JSON.stringify(redacted));

        list({ Email: 'ann@x.com' }).addCommentViewData(comment);

        expect(comment.userName).toBe('Bob');
        expect(comment.photo).toBe('b.png');
        expect(comment.currentUser).toBeUndefined();
      });

      it('marks the current user\'s comment', function() {
        var comment = { createdAt: '2026-01-01', data: { user: { email: 'ann@x.com' }, settings: { text: '', user: { 'First Name': 'Ann' } } } };

        list({ Email: 'ann@x.com' }).addCommentViewData(comment);

        expect(comment.currentUser).toBe(true);
        expect(comment.userName).toBe('Ann');
        expect(comment.text).toBe('');
      });
    });

    describe('replaceComment', function() {
      it('renders a comment without settings.user, as someone else\'s', function() {
        rendered = undefined;
        list({ Email: 'ann@x.com' }).replaceComment('guid', { id: 1, createdAt: '2026-01-01', data: { settings: { fromName: 'Bob B', text: 'hi' } } }, 'final');

        expect(plain(rendered)).toEqual({ id: 1, literalDate: 'date', userName: 'Bob B', photo: '', text: 'hi' });
      });

      it('marks the current user\'s comment', function() {
        rendered = undefined;
        list({ Email: 'ann@x.com' }).replaceComment('guid', { id: 2, literalDate: 'd', data: { user: { email: 'ann@x.com' }, settings: { text: 'mine', user: { 'First Name': 'Ann' } } } }, 'final');

        expect(rendered.currentUser).toBe(true);
        expect(rendered.userName).toBe('Ann');
      });

      it('does not throw for SAML2 users when the regex finds nothing', function() {
        rendered = undefined;
        expect(function() {
          list({ Email: '@', isSaml2: true }).replaceComment('guid', { id: 3, literalDate: 'd', data: { settings: { text: 'x', user: { Email: '@' } } } }, 'final');
        }).not.toThrow();
        expect(rendered.currentUser).toBeUndefined();
      });
    });
  });
});

describe('PS-2312 comments settings on the comments data source', function() {
  var code = read('interface-lists.js');
  var source = code.slice(code.indexOf('function saveCommentsConfig('), code.indexOf('/**\n * Saves the widget data'));
  var config = { userDataSourceId: 12, emailColumn: 'Email', nameColumns: ['First Name', 'Last Name'], photoColumn: 'Photo' };
  var getById;
  var update;
  var warn;

  function widgetData(overrides) {
    return Object.assign({
      social: { comments: true },
      commentsDataSourceId: 9,
      userDataSourceId: '12',
      userEmailColumn: 'Email',
      userNameFields: ['First Name', '', 'none', 'Last Name'],
      userPhotoColumn: 'Photo'
    }, overrides);
  }

  function saveCommentsConfig(data, previous) {
    var ctx = context({
      widgetData: data || widgetData(),
      Promise: Promise,
      console: { warn: warn },
      Fliplet: { DataSources: { getById: getById, update: update } },
      setTimeout: function() {
        return setTimeout.apply(null, arguments);
      }
    });

    vm.runInContext(source, ctx);

    return ctx.saveCommentsConfig(previous);
  }

  function stored(definition) {
    getById = jest.fn().mockResolvedValue({ id: 9, definition: definition });
  }

  function updatedDefinition() {
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toBe(9);

    return plain(update.mock.calls[0][1].definition);
  }

  beforeEach(function() {
    jest.useFakeTimers();
    stored({});
    update = jest.fn().mockResolvedValue({});
    warn = jest.fn();
  });

  afterEach(function() {
    jest.useRealTimers();
  });

  it('save waits for it before reloading', function() {
    expect(code).toContain('var savedCommentColumns = getCommentColumns(widgetData);');
    expect(code).toContain('var commentsSaved = saveCommentsConfig(savedCommentColumns);\n\n  savedCommentColumns = getCommentColumns(widgetData);');
    expect(code).toContain('Promise.all([Fliplet.Widget.save(widgetData), commentsSaved]).then(function() {');
  });


  it('merges definition.comments into the existing definition', function() {
    stored({ views: [{ name: 'v' }], indexes: ['Email'], x: 'y' });

    return saveCommentsConfig().then(function() {
      expect(getById).toHaveBeenCalledWith(9, { cache: false });
      expect(updatedDefinition()).toEqual({ views: [{ name: 'v' }], indexes: ['Email'], x: 'y', comments: config });
    });
  });

  it('works when the data source has no definition', function() {
    getById = jest.fn().mockResolvedValue({ id: 9 });

    return saveCommentsConfig().then(function() {
      expect(updatedDefinition()).toEqual({ comments: config });
    });
  });

  it('does not update when nothing changed', function() {
    stored({ views: [], comments: config });

    return saveCommentsConfig().then(function() {
      expect(getById).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();
    });
  });

  it('stores an unset photo column as an empty string', function() {
    return saveCommentsConfig(widgetData({ userPhotoColumn: 'none' })).then(function() {
      expect(updatedDefinition().comments.photoColumn).toBe('');
    });
  });

  describe('same users data source as stored (lists sharing one comments data source)', function() {
    it('unions the name columns, new first, and keeps the stored photo when none is set', function() {
      stored({ comments: { userDataSourceId: 12, emailColumn: 'Old Email', nameColumns: ['Last Name', 'Nickname'], photoColumn: 'Avatar' } });

      return saveCommentsConfig(widgetData({ userPhotoColumn: '' })).then(function() {
        expect(updatedDefinition().comments).toEqual({
          userDataSourceId: 12,
          emailColumn: 'Email',
          nameColumns: ['First Name', 'Last Name', 'Nickname'],
          photoColumn: 'Avatar'
        });
      });
    });

    it('uses the new photo column when set', function() {
      stored({ comments: { userDataSourceId: '12', emailColumn: 'Email', nameColumns: [], photoColumn: 'Avatar' } });

      return saveCommentsConfig().then(function() {
        expect(updatedDefinition().comments.photoColumn).toBe('Photo');
      });
    });

    it('does not update when the union is what is stored', function() {
      stored({ comments: { userDataSourceId: 12, emailColumn: 'Email', nameColumns: ['Last Name', 'Nickname'], photoColumn: 'Photo' } });

      return saveCommentsConfig(widgetData({ userNameFields: ['Last Name'] })).then(function() {
        expect(update).not.toHaveBeenCalled();
      });
    });

    describe('columns this list saved before', function() {
      var previous = { nameColumns: ['First Name', 'Last Name'], photoColumn: 'Photo' };

      it('removes a name column the list no longer uses', function() {
        stored({ comments: config });

        return saveCommentsConfig(widgetData({ userNameFields: ['First Name'] }), previous).then(function() {
          expect(updatedDefinition().comments).toEqual(Object.assign({}, config, { nameColumns: ['First Name'] }));
        });
      });

      it('clears the photo column when the list sets it to none', function() {
        stored({ comments: config });

        return saveCommentsConfig(widgetData({ userPhotoColumn: 'none' }), previous).then(function() {
          expect(updatedDefinition().comments).toEqual(Object.assign({}, config, { photoColumn: '' }));
        });
      });

      it('keeps the columns other lists saved', function() {
        stored({ comments: { userDataSourceId: 12, emailColumn: 'Email', nameColumns: ['First Name', 'Last Name', 'Nickname'], photoColumn: 'Avatar' } });

        return saveCommentsConfig(widgetData({ userNameFields: ['First Name'], userPhotoColumn: 'none' }), previous).then(function() {
          expect(updatedDefinition().comments).toEqual({ userDataSourceId: 12, emailColumn: 'Email', nameColumns: ['First Name', 'Nickname'], photoColumn: 'Avatar' });
        });
      });

      it('does not update when the list did not change', function() {
        stored({ comments: config });

        return saveCommentsConfig(widgetData(), previous).then(function() {
          expect(update).not.toHaveBeenCalled();
        });
      });
    });

    it('keeps at most 20 name columns', function() {
      var many = [];

      for (var i = 0; i < 25; i++) {
        many.push('Column ' + i);
      }

      stored({ comments: { userDataSourceId: 12, emailColumn: 'Email', nameColumns: many, photoColumn: 'Photo' } });

      return saveCommentsConfig().then(function() {
        var nameColumns = updatedDefinition().comments.nameColumns;

        expect(nameColumns.length).toBe(20);
        expect(nameColumns.slice(0, 3)).toEqual(['First Name', 'Last Name', 'Column 0']);
      });
    });
  });

  it('replaces the config of a different users data source', function() {
    stored({ comments: { userDataSourceId: 99, emailColumn: 'Mail', nameColumns: ['Nickname'], photoColumn: 'Avatar' } });

    return saveCommentsConfig(widgetData({ userPhotoColumn: 'none' }), { nameColumns: [], photoColumn: 'Avatar' }).then(function() {
      expect(updatedDefinition().comments).toEqual({ userDataSourceId: 12, emailColumn: 'Email', nameColumns: ['First Name', 'Last Name'], photoColumn: '' });
    });
  });

  it('resolves and logs when the update fails', function() {
    update = jest.fn().mockRejectedValue(new Error('denied'));

    return saveCommentsConfig().then(function(result) {
      expect(result).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  it('resolves and logs when getById fails', function() {
    getById = jest.fn().mockRejectedValue(new Error('down'));

    return saveCommentsConfig().then(function() {
      expect(warn).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();
    });
  });

  it('stops waiting after 5 seconds', function() {
    var done = false;

    getById = jest.fn().mockReturnValue(new Promise(function() {}));

    var result = saveCommentsConfig().then(function() {
      done = true;
    });

    return jest.advanceTimersByTimeAsync(4999).then(function() {
      expect(done).toBe(false);

      return jest.advanceTimersByTimeAsync(1);
    }).then(function() {
      return result;
    }).then(function() {
      expect(done).toBe(true);
      expect(update).not.toHaveBeenCalled();
    });
  });

  [
    ['comments are off', { social: { comments: false } }],
    ['social is missing', { social: undefined }],
    ['there is no comments data source', { commentsDataSourceId: '' }],
    ['there is no users data source', { userDataSourceId: undefined }],
    ['the users data source is "none"', { userDataSourceId: 'none' }],
    ['the users data source is not a positive id', { userDataSourceId: '-3' }]
  ].forEach(function(test) {
    it('skips when ' + test[0], function() {
      return saveCommentsConfig(widgetData(test[1])).then(function() {
        expect(getById).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
      });
    });
  });
});
