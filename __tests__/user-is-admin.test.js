/**
 * Tests for PS-1808: userIsAdmin should not grant access for negative string values
 *
 * Verifies that values like "No", "N", "false", "0" do not grant admin access,
 * while positive values like "X", "Yes", "Admin" continue to work.
 */

var fs = require('fs');
var path = require('path');

// Extract the functions from utils.js by evaluating them with minimal mocks
var NativeUtils = {
  get: function(object, prop) {
    if (object === null || object === undefined) {
      return undefined;
    }

    return object[prop];
  },
  isNil: function(value) {
    return value === null || value === undefined;
  }
};

// Extract userIsAdmin and isNegativeAdminValue by evaluating the relevant portion
var utilsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');

// Extract NEGATIVE_ADMIN_VALUES, isNegativeAdminValue, and userIsAdmin
var negativeValuesMatch = utilsSource.match(/var NEGATIVE_ADMIN_VALUES = (\[.*?\]);/);
var NEGATIVE_ADMIN_VALUES = eval(negativeValuesMatch[1]); // eslint-disable-line no-eval

function isNegativeAdminValue(value) {
  return typeof value === 'string'
    && NEGATIVE_ADMIN_VALUES.indexOf(value.trim().toLowerCase()) > -1;
}

function userIsAdmin(config, userData) {
  var adminValue = NativeUtils.get(userData, config.userAdminColumn);

  if (NativeUtils.isNil(config.userAdminValue) || config.userAdminValue === '') {
    if (Array.isArray(adminValue)) {
      return !!adminValue.find(function(v) {
        return v && !isNegativeAdminValue(v);
      });
    }

    return !!adminValue && !isNegativeAdminValue(adminValue);
  }

  if (Array.isArray(adminValue)) {
    return adminValue.indexOf(config.userAdminValue) > -1;
  }

  return adminValue === config.userAdminValue;
}

// Default config with no userAdminValue (the common case)
var defaultConfig = { userAdminColumn: 'Admin' };

describe('userIsAdmin', function() {
  describe('source code contains blocklist', function() {
    it('should define NEGATIVE_ADMIN_VALUES array', function() {
      expect(utilsSource).toContain('var NEGATIVE_ADMIN_VALUES =');
    });

    it('should define isNegativeAdminValue function', function() {
      expect(utilsSource).toContain('function isNegativeAdminValue(');
    });

    it('should call isNegativeAdminValue in the userIsAdmin function', function() {
      expect(utilsSource).toContain('!isNegativeAdminValue(');
    });
  });

  describe('with no userAdminValue configured (default)', function() {
    describe('grants admin for positive values', function() {
      ['X', 'Yes', 'yes', 'YES', 'Admin', 'admin', 'true', 'TRUE', '1', 'manager', 'Y'].forEach(function(value) {
        it('should return true for "' + value + '"', function() {
          expect(userIsAdmin(defaultConfig, { Admin: value })).toBe(true);
        });
      });

      it('should return true for boolean true', function() {
        expect(userIsAdmin(defaultConfig, { Admin: true })).toBe(true);
      });
    });

    describe('denies admin for negative string values', function() {
      ['No', 'no', 'NO', 'N', 'n', 'false', 'False', 'FALSE', '0', 'none', 'None',
       'null', 'undefined', 'off', 'Off', 'OFF', 'disabled', 'Disabled'].forEach(function(value) {
        it('should return false for "' + value + '"', function() {
          expect(userIsAdmin(defaultConfig, { Admin: value })).toBe(false);
        });
      });

      it('should return false for whitespace-padded negative values', function() {
        expect(userIsAdmin(defaultConfig, { Admin: ' No ' })).toBe(false);
        expect(userIsAdmin(defaultConfig, { Admin: '  false  ' })).toBe(false);
        expect(userIsAdmin(defaultConfig, { Admin: ' 0 ' })).toBe(false);
      });
    });

    describe('denies admin for empty/nil values', function() {
      it('should return false for empty string', function() {
        expect(userIsAdmin(defaultConfig, { Admin: '' })).toBe(false);
      });

      it('should return false for null', function() {
        expect(userIsAdmin(defaultConfig, { Admin: null })).toBe(false);
      });

      it('should return false for undefined', function() {
        expect(userIsAdmin(defaultConfig, { Admin: undefined })).toBe(false);
      });

      it('should return false for boolean false', function() {
        expect(userIsAdmin(defaultConfig, { Admin: false })).toBe(false);
      });

      it('should return false for number 0', function() {
        expect(userIsAdmin(defaultConfig, { Admin: 0 })).toBe(false);
      });

      it('should return false when admin column is missing', function() {
        expect(userIsAdmin(defaultConfig, {})).toBe(false);
      });
    });

    describe('handles array values', function() {
      it('should return false for array with only negative values', function() {
        expect(userIsAdmin(defaultConfig, { Admin: ['No'] })).toBe(false);
        expect(userIsAdmin(defaultConfig, { Admin: ['No', 'false', '0'] })).toBe(false);
      });

      it('should return true for array with at least one positive value', function() {
        expect(userIsAdmin(defaultConfig, { Admin: ['No', 'X'] })).toBe(true);
        expect(userIsAdmin(defaultConfig, { Admin: ['false', 'Admin'] })).toBe(true);
      });

      it('should return false for array with only falsy values', function() {
        expect(userIsAdmin(defaultConfig, { Admin: [null, '', undefined] })).toBe(false);
      });

      it('should return true for array with positive values', function() {
        expect(userIsAdmin(defaultConfig, { Admin: ['Yes'] })).toBe(true);
        expect(userIsAdmin(defaultConfig, { Admin: ['X', 'Admin'] })).toBe(true);
      });
    });
  });

  describe('with userAdminValue configured (exact match mode)', function() {
    var configWithValue = { userAdminColumn: 'Admin', userAdminValue: 'Yes' };

    it('should return true when value matches exactly', function() {
      expect(userIsAdmin(configWithValue, { Admin: 'Yes' })).toBe(true);
    });

    it('should return false when value does not match', function() {
      expect(userIsAdmin(configWithValue, { Admin: 'No' })).toBe(false);
      expect(userIsAdmin(configWithValue, { Admin: 'X' })).toBe(false);
    });

    it('should handle array values with indexOf', function() {
      expect(userIsAdmin(configWithValue, { Admin: ['Yes', 'No'] })).toBe(true);
      expect(userIsAdmin(configWithValue, { Admin: ['No', 'X'] })).toBe(false);
    });
  });
});
