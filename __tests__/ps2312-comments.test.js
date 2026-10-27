/* eslint-env jest */

/**
 * PS-2312: comments need a login, store only the public user columns,
 * spot the current user's comments by the server-set email, and the comments
 * user columns are saved on the comments data source.
 */

var fs = require('fs');
var path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8').replace(/\r\n/g, '\n');
}

function fn(code, name) {
  var start = code.indexOf('DynamicList.prototype.' + name + ' = function');
  var end = code.indexOf('\nDynamicList.prototype.', start + 1);

  expect(start).toBeGreaterThan(-1);

  return code.slice(start, end > -1 ? end : undefined);
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

    it('sendComment stores only the name, photo and email columns', function() {
      var sendComment = fn(code, 'sendComment');

      expect(sendComment).not.toContain('user: _this.myUserData.isSaml2 ? userFromDataSource.data : _this.myUserData');
      expect(sendComment).toContain('.concat(_this.data.userPhotoColumn, _this.data.userEmailColumn)');
      expect(sendComment).toContain('return column && column !== \'none\';');
      expect(sendComment).toMatch(/user: NativeUtils\.pickBy\([^]*?return userColumns\.indexOf\(key\) > -1;/);
    });

    it('the own-comment check prefers data.user.email and falls back to the email column', function() {
      var isOwnComment = fn(code, 'isOwnComment');

      expect(isOwnComment).toContain('NativeUtils.get(commentEntry, \'data.user.email\') || commentUser[this.data.userEmailColumn]');
      expect(isOwnComment).toContain('if (!myEmail || !commentEmail) {');
    });

    it('the SAML2 match guards failed regex matches', function() {
      expect(fn(code, 'isOwnComment')).toContain('!!(myEmailParts && commentEmailParts) && myEmailParts[0]');
    });

    it('showComments and replaceComment use the own-comment check', function() {
      ['showComments', 'replaceComment'].forEach(function(name) {
        var body = fn(code, name);

        expect(body).toContain('_this.isOwnComment(');
        expect(body).not.toContain('Parts[0]');
      });
    });
  });
});

describe('PS-2312 comments settings on the comments data source', function() {
  var code = read('interface-lists.js');
  var helper = code.slice(code.indexOf('function saveCommentsConfig()'), code.indexOf('function save(notifyComplete)'));

  it('merges definition.comments into the existing definition', function() {
    expect(helper).toContain('Fliplet.DataSources.getById(dataSourceId, { cache: false })');
    expect(helper).toContain('NativeUtils.isEqual(definition.comments, comments)');
    expect(helper).toContain('definition: Object.assign({}, definition, { comments: comments })');
    expect(helper).toMatch(/nameColumns: \(widgetData\.userNameFields \|\| \[\]\)\.filter/);
  });

  it('never fails the save and stops waiting after 5 seconds', function() {
    expect(helper).toContain('}).catch(function(error) {\n    console.warn(');
    expect(helper).toContain('setTimeout(resolve, 5000)');
  });

  it('save waits for it before reloading', function() {
    expect(code).toContain('Promise.all([Fliplet.Widget.save(widgetData), saveCommentsConfig()]).then(function() {');
  });
});
