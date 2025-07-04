/**
 * Native JavaScript utilities to replace lodash methods
 * These functions provide equivalent functionality to commonly used lodash methods
 */

window.NativeUtils = {
  /**
   * Safely get a nested property from an object
   * Replacement for _.get()
   */
  get: function(obj, path, defaultValue) {
    if (!obj || typeof obj !== 'object') {
      return defaultValue;
    }
    
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;
    
    for (let i = 0; i < keys.length; i++) {
      if (result == null || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[keys[i]];
    }
    
    return result === undefined ? defaultValue : result;
  },

  /**
   * Safely set a nested property on an object
   * Replacement for _.set()
   */
  set: function(obj, path, value) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const keys = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] == null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return obj;
  },

  /**
   * Check if object has a nested property
   * Replacement for _.hasIn()
   */
  hasIn: function(obj, path) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    const keys = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length; i++) {
      if (current == null || typeof current !== 'object' || !(keys[i] in current)) {
        return false;
      }
      current = current[keys[i]];
    }
    
    return true;
  },

  /**
   * Check if object has own property
   * Replacement for _.has()
   */
  has: function(obj, key) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
  },

  /**
   * Check if value is empty
   * Replacement for _.isEmpty()
   */
  isEmpty: function(value) {
    if (value == null) return true;
    if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * Check if value is null or undefined
   * Replacement for _.isNil()
   */
  isNil: function(value) {
    return value == null;
  },

  /**
   * Check if value is undefined
   * Replacement for _.isUndefined()
   */
  isUndefined: function(value) {
    return value === undefined;
  },

  /**
   * Check if value is null
   * Replacement for _.isNull()
   */
  isNull: function(value) {
    return value === null;
  },

  /**
   * Check if value is a function
   * Replacement for _.isFunction()
   */
  isFunction: function(value) {
    return typeof value === 'function';
  },

  /**
   * Check if value is a string
   * Replacement for _.isString()
   */
  isString: function(value) {
    return typeof value === 'string';
  },

  /**
   * Check if value is an object
   * Replacement for _.isObject()
   */
  isObject: function(value) {
    return value != null && typeof value === 'object';
  },

  /**
   * Check if value is a finite number
   * Replacement for _.isFinite()
   */
  isFinite: function(value) {
    return typeof value === 'number' && isFinite(value);
  },

  /**
   * Check if value is NaN
   * Replacement for _.isNaN()
   */
  isNaN: function(value) {
    return typeof value === 'number' && isNaN(value);
  },

  /**
   * Check if two values are equal (shallow comparison)
   * Replacement for _.isEqual() - basic version
   */
  isEqual: function(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.isEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (let key of keysA) {
        if (!keysB.includes(key) || !this.isEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  },

  /**
   * Remove elements from array that match predicate
   * Replacement for _.remove()
   */
  remove: function(array, predicate) {
    const removed = [];
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        removed.unshift(array.splice(i, 1)[0]);
      }
    }
    return removed;
  },

  /**
   * Remove falsy values from array
   * Replacement for _.compact()
   */
  compact: function(array) {
    return array.filter(Boolean);
  },

  /**
   * Get unique values from array
   * Replacement for _.uniq()
   */
  uniq: function(array) {
    return [...new Set(array)];
  },

  /**
   * Get unique values from array by property
   * Replacement for _.uniqBy()
   */
  uniqBy: function(array, iteratee) {
    const seen = new Set();
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    
    return array.filter(item => {
      const key = getKey(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  },

  /**
   * Get array difference
   * Replacement for _.difference()
   */
  difference: function(array, ...values) {
    const excludeSet = new Set(values.flat());
    return array.filter(item => !excludeSet.has(item));
  },

  /**
   * Get array intersection
   * Replacement for _.intersection()
   */
  intersection: function(array, ...arrays) {
    const otherArrays = arrays.flat();
    return array.filter(item => otherArrays.every(arr => arr.includes(item)));
  },

  /**
   * Get array union
   * Replacement for _.union()
   */
  union: function(...arrays) {
    return this.uniq(arrays.flat());
  },

  /**
   * Clone object (shallow)
   * Replacement for _.clone()
   */
  clone: function(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return [...obj];
    return { ...obj };
  },

  /**
   * Deep clone object
   * Replacement for _.cloneDeep()
   */
  cloneDeep: function(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.cloneDeep(item));
    const cloned = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.cloneDeep(obj[key]);
      }
    }
    return cloned;
  },

  /**
   * Create object from arrays of keys and values
   * Replacement for _.zipObject()
   */
  zipObject: function(keys, values) {
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i];
    }
    return result;
  },

  /**
   * Pick object properties that match predicate
   * Replacement for _.pickBy()
   */
  pickBy: function(obj, predicate) {
    const result = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && predicate(obj[key], key)) {
        result[key] = obj[key];
      }
    }
    return result;
  },

  /**
   * Omit object properties that match predicate
   * Replacement for _.omitBy()
   */
  omitBy: function(obj, predicate) {
    const result = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && !predicate(obj[key], key)) {
        result[key] = obj[key];
      }
    }
    return result;
  },

  /**
   * Sort array by multiple criteria
   * Replacement for _.orderBy()
   */
  orderBy: function(array, iteratees, orders) {
    const getters = iteratees.map(iter => 
      typeof iter === 'function' ? iter : (item) => this.get(item, iter)
    );
    const directions = orders || iteratees.map(() => 'asc');
    
    return [...array].sort((a, b) => {
      for (let i = 0; i < getters.length; i++) {
        const valueA = getters[i](a);
        const valueB = getters[i](b);
        const direction = directions[i] === 'desc' ? -1 : 1;
        
        if (valueA < valueB) return -1 * direction;
        if (valueA > valueB) return 1 * direction;
      }
      return 0;
    });
  },

  /**
   * Group array by property
   * Replacement for _.groupBy()
   */
  groupBy: function(array, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    
    return array.reduce((groups, item) => {
      const key = getKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  },

  /**
   * Convert string to kebab-case
   * Replacement for _.kebabCase()
   */
  kebabCase: function(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },

  /**
   * Capitalize first letter
   * Replacement for _.capitalize()
   */
  capitalize: function(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Get size of collection
   * Replacement for _.size()
   */
  size: function(collection) {
    if (collection == null) return 0;
    if (Array.isArray(collection) || typeof collection === 'string') {
      return collection.length;
    }
    return Object.keys(collection).length;
  },

  /**
   * Get first element of array
   * Replacement for _.first()
   */
  first: function(array) {
    return array[0];
  },

  /**
   * Fill array with value
   * Replacement for _.fill()
   */
  fill: function(array, value, start = 0, end = array.length) {
    return array.fill(value, start, end);
  },

  /**
   * Find index of element
   * Replacement for _.findIndex()
   */
  findIndex: function(array, predicate) {
    return array.findIndex(predicate);
  },

  /**
   * Simple debounce implementation
   * Replacement for _.debounce()
   */
  debounce: function(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  },

  /**
   * Find first element matching predicate
   * Replacement for _.find()
   */
  find: function(array, predicate) {
    if (typeof predicate === 'function') {
      return array.find(predicate);
    }
    if (typeof predicate === 'object') {
      return array.find(item => {
        for (let key in predicate) {
          if (predicate.hasOwnProperty(key) && item[key] !== predicate[key]) {
            return false;
          }
        }
        return true;
      });
    }
    return array.find(item => item === predicate);
  },

  /**
   * Check if any element matches predicate
   * Replacement for _.some()
   */
  some: function(array, predicate) {
    return array.some(predicate);
  },

  /**
   * Sort array by property or function
   * Replacement for _.sortBy()
   */
  sortBy: function(array, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    return [...array].sort((a, b) => {
      const valueA = getKey(a);
      const valueB = getKey(b);
      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    });
  },

  /**
   * Get unique values using custom equality function
   * Replacement for _.uniqWith()
   */
  uniqWith: function(array, comparator) {
    const result = [];
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      let isUnique = true;
      for (let j = 0; j < result.length; j++) {
        if (comparator(item, result[j])) {
          isUnique = false;
          break;
        }
      }
      if (isUnique) {
        result.push(item);
      }
    }
    return result;
  },

  /**
   * Get symmetric difference by property
   * Replacement for _.xorBy()
   */
  xorBy: function(array, other, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    const leftKeys = new Set(array.map(getKey));
    const rightKeys = new Set(other.map(getKey));
    
    return array.filter(item => !rightKeys.has(getKey(item)))
      .concat(other.filter(item => !leftKeys.has(getKey(item))));
  },

  /**
   * Assign properties from source objects to target object
   * Replacement for _.assignIn() and _.extend()
   */
  assignIn: function(target, ...sources) {
    return Object.assign(target, ...sources);
  },

  /**
   * Alias for assignIn
   * Replacement for _.extend()
   */
  extend: function(target, ...sources) {
    return this.assignIn(target, ...sources);
  },

  /**
   * Flatten array one level deep
   * Replacement for _.flatten()
   */
  flatten: function(array) {
    return array.reduce((acc, val) => acc.concat(val), []);
  },

  /**
   * Iterate over collection
   * Replacement for _.forEach()
   */
  forEach: function(collection, iteratee) {
    if (Array.isArray(collection)) {
      collection.forEach(iteratee);
    } else if (collection && typeof collection === 'object') {
      Object.keys(collection).forEach(key => iteratee(collection[key], key));
    }
  },

  /**
   * Check if array is array
   * Replacement for _.isArray()
   */
  isArray: function(value) {
    return Array.isArray(value);
  },

  /**
   * Get object keys
   * Replacement for _.keys()
   */
  keys: function(obj) {
    return Object.keys(obj);
  },

  /**
   * Map array to new array
   * Replacement for _.map()
   */
  map: function(array, iteratee) {
    return array.map(iteratee);
  },

  /**
   * Filter array by predicate
   * Replacement for _.filter()
   */
  filter: function(array, predicate) {
    if (typeof predicate === 'function') {
      return array.filter(predicate);
    }
    if (typeof predicate === 'object') {
      return array.filter(item => {
        for (let key in predicate) {
          if (predicate.hasOwnProperty(key) && item[key] !== predicate[key]) {
            return false;
          }
        }
        return true;
      });
    }
    return array.filter(item => item === predicate);
  },

  /**
   * Get difference by property
   * Replacement for _.differenceBy()
   */
  differenceBy: function(array, other, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    const otherKeys = new Set(other.map(getKey));
    return array.filter(item => !otherKeys.has(getKey(item)));
  },

  /**
   * Get intersection by property
   * Replacement for _.intersectionBy()
   */
  intersectionBy: function(array, other, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    const otherKeys = new Set(other.map(getKey));
    return array.filter(item => otherKeys.has(getKey(item)));
  },

  /**
   * Get index of element in array
   * Replacement for _.indexOf()
   */
  indexOf: function(array, value, fromIndex = 0) {
    return array.indexOf(value, fromIndex);
  }
};