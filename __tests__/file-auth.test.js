/**
 * Tests for PS-1765: File URL authentication in detail view click handlers
 *
 * Verifies that all 5 Dynamic List layouts authenticate file URLs
 * via Fliplet.Media.authenticate() before passing them to Fliplet.Navigate.file().
 */

var fs = require('fs');
var path = require('path');

var LAYOUT_DIR = path.join(__dirname, '..', 'js', 'layout-javascript');
var TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'build');

var LAYOUTS = [
  'simple-list-code.js',
  'agenda-code.js',
  'news-feed-code.js',
  'small-card-code.js',
  'small-h-card-code.js'
];

var DETAIL_TEMPLATES = [
  'simple-list-detail.build.hbs',
  'agenda-cards-detail.build.hbs',
  'news-feed-detail.build.hbs',
  'small-card-detail.build.hbs',
  'small-h-card-detail.build.hbs'
];

describe('File click handler authentication', function() {
  LAYOUTS.forEach(function(file) {
    describe(file, function() {
      var code;

      beforeAll(function() {
        code = fs.readFileSync(path.join(LAYOUT_DIR, file), 'utf8');
      });

      it('should have a .file-item click handler', function() {
        expect(code).toMatch(/\.on\('click',\s*'\.file-item'/);
      });

      it('should call Fliplet.Media.authenticate() on the URL before navigating', function() {
        // Extract the .file-item click handler block
        var handlerMatch = code.match(
          /\.on\('click',\s*'\.file-item',\s*function\(event\)\s*\{([\s\S]*?)\}\)/
        );

        expect(handlerMatch).not.toBeNull();

        var handlerBody = handlerMatch[1];

        // Must call Fliplet.Media.authenticate
        expect(handlerBody).toContain('Fliplet.Media.authenticate(');

        // Must wrap the result in Fliplet.Navigate.file()
        expect(handlerBody).toMatch(
          /Fliplet\.Navigate\.file\(\s*Fliplet\.Media\.authenticate\(/
        );
      });

      it('should NOT call Fliplet.Navigate.file() with a raw unauthenticated URL', function() {
        var handlerMatch = code.match(
          /\.on\('click',\s*'\.file-item',\s*function\(event\)\s*\{([\s\S]*?)\}\)/
        );

        var handlerBody = handlerMatch[1];

        // Should not have Fliplet.Navigate.file(url) without authenticate wrapper
        var rawCallMatch = handlerBody.match(
          /Fliplet\.Navigate\.file\(\s*(?!Fliplet\.Media\.authenticate)\w+\s*\)/
        );

        expect(rawCallMatch).toBeNull();
      });
    });
  });
});

describe('Detail template authentication', function() {
  DETAIL_TEMPLATES.forEach(function(file) {
    describe(file, function() {
      var template;

      beforeAll(function() {
        template = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8');
      });

      it('should use {{auth this.url}} in the hidden input for file items', function() {
        // Find all hidden inputs with URL values
        var hiddenInputs = template.match(/<input\s+type="hidden"\s+value="[^"]*url[^"]*"\s*\/>/g);

        expect(hiddenInputs).not.toBeNull();
        expect(hiddenInputs.length).toBeGreaterThan(0);

        hiddenInputs.forEach(function(input) {
          // Must use {{auth this.url}}, not {{this.url}}
          expect(input).toContain('{{auth this.url}}');
          expect(input).not.toMatch(/\{\{this\.url\}\}/);
        });
      });

      it('should NOT have unauthenticated {{this.url}} in hidden inputs', function() {
        // Specifically check there's no <input type="hidden" value="{{this.url}}" />
        expect(template).not.toMatch(
          /<input\s+type="hidden"\s+value="\{\{this\.url\}\}"\s*\/>/
        );
      });
    });
  });
});
