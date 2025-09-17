/**
 * Native JavaScript utilities to replace lodash methods
 * These functions provide equivalent functionality to commonly used lodash methods
 */

window.NativeUtils = {
  /**
   * Safely get a nested property from an object
   * Replacement for _.get()
   * @param {Object} obj - The object to query
   * @param {string|Array} path - The path to the property (dot notation string or array of keys)
   * @param {*} [defaultValue] - The value returned if the path is not found
   * @returns {*} The resolved value or defaultValue
   * @description Safely retrieves a nested property value from an object using dot notation or array path
   * @example
   * NativeUtils.get({a: {b: 2}}, 'a.b'); // 2
   * NativeUtils.get({a: {b: 2}}, ['a', 'b']); // 2
   * NativeUtils.get({a: {b: 2}}, 'a.c', 'default'); // 'default'
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
   * @param {Object} obj - The object to modify
   * @param {string|Array} path - The path to the property (dot notation string or array of keys)
   * @param {*} value - The value to set
   * @returns {Object} The modified object
   * @description Sets a nested property value on an object, creating intermediate objects as needed
   * @example
   * NativeUtils.set({}, 'a.b', 2); // {a: {b: 2}}
   * NativeUtils.set({}, ['a', 'b'], 2); // {a: {b: 2}}
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
   * @param {Object} obj - The object to check
   * @param {string|Array} path - The path to check for (dot notation string or array of keys)
   * @returns {boolean} True if the path exists in the object, false otherwise
   * @description Checks if an object has a nested property at the specified path
   * @example
   * NativeUtils.hasIn({a: {b: 2}}, 'a.b'); // true
   * NativeUtils.hasIn({a: {b: 2}}, 'a.c'); // false
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
   * @param {Object} obj - The object to check
   * @param {string} key - The key to check for
   * @returns {boolean} True if the object has the specified property, false otherwise
   * @description Checks if an object has a direct property (not inherited)
   * @example
   * NativeUtils.has({a: 1}, 'a'); // true
   * NativeUtils.has({a: 1}, 'b'); // false
   */
  has: function(obj, key) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
  },

  /**
   * Check if value is empty
   * Replacement for _.isEmpty()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is empty, false otherwise
   * @description Checks if a value is empty (null, undefined, empty string, empty array, or empty object)
   * @example
   * NativeUtils.isEmpty(null); // true
   * NativeUtils.isEmpty([]); // true
   * NativeUtils.isEmpty({}); // true
   * NativeUtils.isEmpty(''); // true
   * NativeUtils.isEmpty([1, 2, 3]); // false
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
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is null or undefined, false otherwise
   * @description Checks if a value is null or undefined
   * @example
   * NativeUtils.isNil(null); // true
   * NativeUtils.isNil(undefined); // true
   * NativeUtils.isNil(0); // false
   */
  isNil: function(value) {
    return value == null;
  },

  /**
   * Check if value is undefined
   * Replacement for _.isUndefined()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is undefined, false otherwise
   * @description Checks if a value is undefined
   * @example
   * NativeUtils.isUndefined(undefined); // true
   * NativeUtils.isUndefined(null); // false
   */
  isUndefined: function(value) {
    return value === undefined;
  },

  /**
   * Check if value is null
   * Replacement for _.isNull()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is null, false otherwise
   * @description Checks if a value is null
   * @example
   * NativeUtils.isNull(null); // true
   * NativeUtils.isNull(undefined); // false
   */
  isNull: function(value) {
    return value === null;
  },

  /**
   * Check if value is a function
   * Replacement for _.isFunction()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is a function, false otherwise
   * @description Checks if a value is a function
   * @example
   * NativeUtils.isFunction(function() {}); // true
   * NativeUtils.isFunction('string'); // false
   */
  isFunction: function(value) {
    return typeof value === 'function';
  },

  /**
   * Check if value is a string
   * Replacement for _.isString()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is a string, false otherwise
   * @description Checks if a value is a string
   * @example
   * NativeUtils.isString('hello'); // true
   * NativeUtils.isString(123); // false
   */
  isString: function(value) {
    return typeof value === 'string';
  },

  /**
   * Check if value is an object
   * Replacement for _.isObject()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is an object, false otherwise
   * @description Checks if a value is an object (including arrays)
   * @example
   * NativeUtils.isObject({}); // true
   * NativeUtils.isObject([]); // true
   * NativeUtils.isObject('string'); // false
   */
  isObject: function(value) {
    return value != null && typeof value === 'object';
  },

  /**
   * Check if value is a finite number
   * Replacement for _.isFinite()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is a finite number, false otherwise
   * @description Checks if a value is a finite number (not NaN or Infinity)
   * @example
   * NativeUtils.isFinite(42); // true
   * NativeUtils.isFinite(Infinity); // false
   * NativeUtils.isFinite(NaN); // false
   */
  isFinite: function(value) {
    return typeof value === 'number' && isFinite(value);
  },

  /**
   * Check if value is NaN
   * Replacement for _.isNaN()
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is NaN, false otherwise
   * @description Checks if a value is NaN (Not a Number)
   * @example
   * NativeUtils.isNaN(NaN); // true
   * NativeUtils.isNaN(42); // false
   * NativeUtils.isNaN('hello'); // false
   */
  isNaN: function(value) {
    return typeof value === 'number' && isNaN(value);
  },

  /**
   * Check if two values are equal (deep comparison)
   * Replacement for _.isEqual() - basic version
   * @param {*} a - The first value to compare
   * @param {*} b - The second value to compare
   * @returns {boolean} True if the values are equal, false otherwise
   * @description Performs a deep comparison between two values to determine if they are equivalent
   * @example
   * NativeUtils.isEqual({a: 1}, {a: 1}); // true
   * NativeUtils.isEqual([1, 2], [1, 2]); // true
   * NativeUtils.isEqual({a: 1}, {a: 2}); // false
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
   * @param {Array} array - The array to modify
   * @param {Function} predicate - The function to test each element
   * @returns {Array} The array of removed elements
   * @description Removes elements from an array that match the predicate function and returns the removed elements
   * @example
   * const arr = [1, 2, 3, 4];
   * NativeUtils.remove(arr, x => x % 2 === 0); // [2, 4]
   * // arr is now [1, 3]
   */
  remove: function(array, predicate) {
    const removed = [];
    const indicesToRemove = [];

    // Collect indices first
    for (let i = 0; i < array.length; i++) {
      if (predicate(array[i], i, array)) {
        indicesToRemove.push(i);
        removed.push(array[i]);
      }
    }

    // Remove in reverse order to maintain indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      array.splice(indicesToRemove[i], 1);
    }

    return removed;
  },

  /**
   * Remove falsy values from array
   * Replacement for _.compact()
   * @param {Array} array - The array to compact
   * @returns {Array} A new array with falsy values removed
   * @description Creates a new array with all falsy values removed (false, null, 0, "", undefined, NaN)
   * @example
   * NativeUtils.compact([0, 1, false, 2, '', 3]); // [1, 2, 3]
   */
  compact: function(array) {
    return array.filter(Boolean);
  },

  /**
   * Get unique values from array
   * Replacement for _.uniq()
   * @param {Array} array - The array to process
   * @returns {Array} A new array with unique values
   * @description Creates a new array with duplicate values removed
   * @example
   * NativeUtils.uniq([1, 2, 2, 3, 3, 3]); // [1, 2, 3]
   */
  uniq: function(array) {
    return [...new Set(array)];
  },

  /**
   * Get unique values from array by property
   * Replacement for _.uniqBy()
   * @param {Array} array - The array to process
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Array} A new array with unique values based on the iteratee
   * @description Creates a new array with duplicate values removed based on the result of the iteratee function
   * @example
   * NativeUtils.uniqBy([{id: 1}, {id: 2}, {id: 1}], 'id'); // [{id: 1}, {id: 2}]
   * NativeUtils.uniqBy([{id: 1}, {id: 2}, {id: 1}], x => x.id); // [{id: 1}, {id: 2}]
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
   * @param {Array} array - The array to filter
   * @param {...Array} values - The values to exclude
   * @returns {Array} A new array with excluded values removed
   * @description Creates a new array with values from the first array that are not present in the other arrays
   * @example
   * NativeUtils.difference([1, 2, 3], [2, 3, 4]); // [1]
   * NativeUtils.difference([1, 2, 3], [2], [3]); // [1]
   */
  difference: function(array, ...values) {
    const excludeSet = new Set(values.flat());
    return array.filter(item => !excludeSet.has(item));
  },

  /**
   * Get array intersection
   * Replacement for _.intersection()
   * @param {Array} array - The array to filter
   * @param {...Array} arrays - The arrays to intersect with
   * @returns {Array} A new array with values that exist in all arrays
   * @description Creates a new array with values that exist in all provided arrays
   * @example
   * NativeUtils.intersection([1, 2, 3], [2, 3, 4]); // [2, 3]
   * NativeUtils.intersection([1, 2, 3], [2, 3], [3, 4]); // [3]
   */
  intersection: function(array, ...arrays) {
    const sets = arrays.map(a => new Set(a));
    return array.filter(item => sets.every(s => s.has(item)));
  },

  /**
   * Get array union
   * Replacement for _.union()
   * @param {...Array} arrays - The arrays to union
   * @returns {Array} A new array with unique values from all arrays
   * @description Creates a new array with unique values from all provided arrays
   * @example
   * NativeUtils.union([1, 2], [2, 3], [3, 4]); // [1, 2, 3, 4]
   */
  union: function(...arrays) {
    return this.uniq(arrays.flat());
  },

  /**
   * Clone object (shallow)
   * Replacement for _.clone()
   * @param {*} obj - The value to clone
   * @returns {*} A shallow clone of the value
   * @description Creates a shallow clone of the value
   * @example
   * NativeUtils.clone({a: 1}); // {a: 1}
   * NativeUtils.clone([1, 2, 3]); // [1, 2, 3]
   */
  clone: function(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return [...obj];
    return { ...obj };
  },

  /**
   * Deep clone object with support for circular references and special types
   * Replacement for _.cloneDeep()
   * @param {*} obj - The value to clone
   * @param {WeakMap} [visited] - Internal parameter for circular reference detection
   * @returns {*} A deep clone of the value
   * @description Creates a deep clone of the value with circular reference detection
   * 
   * Supports:
   * - Circular reference detection using WeakMap
   * - Date objects
   * - RegExp objects
   * - Arrays and plain objects
   * - Primitive values
   * 
   * Limitations:
   * - Does not clone functions (returns reference)
   * - Does not clone DOM elements (returns reference)
   * - Does not clone Symbol properties
   * - Does not clone non-enumerable properties
   * - Does not clone prototype chain
   * 
   * @example
   * const original = {a: {b: 1}};
   * const clone = NativeUtils.cloneDeep(original);
   * clone.a.b = 2;
   * console.log(original.a.b); // 1 (unchanged)
   */
  cloneDeep: function(obj, visited) {
    // Initialize visited WeakMap for circular reference detection
    if (!visited) {
      visited = new WeakMap();
    }
    
    // Handle primitive values and null/undefined
    if (obj == null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle circular references
    if (visited.has(obj)) {
      return visited.get(obj);
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    // Handle RegExp objects
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags);
    }
    
    // Handle Arrays
    if (Array.isArray(obj)) {
      const clonedArray = [];
      visited.set(obj, clonedArray);
      for (let i = 0; i < obj.length; i++) {
        clonedArray[i] = this.cloneDeep(obj[i], visited);
      }
      return clonedArray;
    }
    
    // Handle Functions (return reference - cannot be truly cloned)
    if (typeof obj === 'function') {
      return obj;
    }
    
    // Handle DOM elements (return reference - should not be cloned)
    if (obj.nodeType && typeof obj.cloneNode === 'function') {
      return obj;
    }
    
    // Handle plain objects
    const clonedObj = {};
    visited.set(obj, clonedObj);
    
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.cloneDeep(obj[key], visited);
      }
    }
    
    return clonedObj;
  },

  /**
   * Create object from arrays of keys and values
   * Replacement for _.zipObject()
   * @param {Array} keys - The property names
   * @param {Array} values - The property values
   * @returns {Object} A new object with keys mapped to values
   * @description Creates an object composed of keys and values
   * @example
   * NativeUtils.zipObject(['a', 'b'], [1, 2]); // {a: 1, b: 2}
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
   * @param {Object} obj - The source object
   * @param {Function} predicate - The function to test each property
   * @returns {Object} A new object with picked properties
   * @description Creates a new object with properties that pass the predicate test
   * @example
   * NativeUtils.pickBy({a: 1, b: 2, c: 3}, x => x > 1); // {b: 2, c: 3}
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
   * @param {Object} obj - The source object
   * @param {Function} predicate - The function to test each property
   * @returns {Object} A new object with omitted properties
   * @description Creates a new object with properties that fail the predicate test
   * @example
   * NativeUtils.omitBy({a: 1, b: 2, c: 3}, x => x > 1); // {a: 1}
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
   * @param {Array} array - The array to sort
   * @param {Array} iteratees - The iteratees to sort by (functions or property paths)
   * @param {Array} [orders] - The sort orders ('asc' or 'desc')
   * @returns {Array} A new sorted array
   * @description Creates a new array sorted by multiple criteria
   * @example
   * NativeUtils.orderBy([{a: 2, b: 1}, {a: 1, b: 2}], ['a', 'b'], ['asc', 'desc']);
   * // [{a: 1, b: 2}, {a: 2, b: 1}]
   */
  orderBy: function(array, iteratees, orders) {
    // Ensure iteratees is an array
    if (!Array.isArray(iteratees)) {
      iteratees = [iteratees];
    }
    
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
   * @param {Array} array - The array to group
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Object} An object with grouped arrays
   * @description Creates an object with arrays grouped by the result of the iteratee
   * @example
   * NativeUtils.groupBy([{type: 'a'}, {type: 'b'}, {type: 'a'}], 'type');
   * // {a: [{type: 'a'}, {type: 'a'}], b: [{type: 'b'}]}
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
   * @param {string} str - The string to convert
   * @returns {string} The kebab-cased string
   * @description Converts a string to kebab-case (lowercase with hyphens)
   * @example
   * NativeUtils.kebabCase('camelCase'); // 'camel-case'
   * NativeUtils.kebabCase('snake_case'); // 'snake-case'
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
   * @param {string} str - The string to capitalize
   * @returns {string} The capitalized string
   * @description Capitalizes the first letter of a string and lowercases the rest
   * @example
   * NativeUtils.capitalize('hello'); // 'Hello'
   * NativeUtils.capitalize('HELLO'); // 'Hello'
   */
  capitalize: function(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Get size of collection
   * Replacement for _.size()
   * @param {Array|Object|string} collection - The collection to inspect
   * @returns {number} The size of the collection
   * @description Gets the size of a collection (array length, object key count, or string length)
   * @example
   * NativeUtils.size([1, 2, 3]); // 3
   * NativeUtils.size({a: 1, b: 2}); // 2
   * NativeUtils.size('hello'); // 5
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
   * @param {Array} array - The array to query
   * @returns {*} The first element of the array
   * @description Gets the first element of an array
   * @example
   * NativeUtils.first([1, 2, 3]); // 1
   * NativeUtils.first([]); // undefined
   */
  first: function(array) {
    return array[0];
  },

  /**
   * Fill array with value
   * Replacement for _.fill()
   * @param {Array} array - The array to fill
   * @param {*} value - The value to fill the array with
   * @param {number} [start=0] - The start position
   * @param {number} [end=array.length] - The end position
   * @returns {Array} The filled array
   * @description Fills elements of an array with a value from start to end
   * @example
   * NativeUtils.fill([1, 2, 3], 'a'); // ['a', 'a', 'a']
   * NativeUtils.fill([1, 2, 3], 'a', 1, 2); // [1, 'a', 3]
   */
  fill: function(array, value, start = 0, end = array.length) {
    return array.fill(value, start, end);
  },

  /**
   * Find index of element
   * Replacement for _.findIndex()
   * @param {Array} array - The array to search
   * @param {Function} predicate - The function to test each element
   * @returns {number} The index of the found element, or -1 if not found
   * @description Finds the index of the first element that passes the predicate test
   * @example
   * NativeUtils.findIndex([1, 2, 3], x => x > 1); // 1
   * NativeUtils.findIndex([1, 2, 3], x => x > 5); // -1
   */
  findIndex: function(array, predicate) {
    return array.findIndex(predicate);
  },

  /**
   * Simple debounce implementation
   * Replacement for _.debounce()
   * @param {Function} func - The function to debounce
   * @param {number} wait - The number of milliseconds to delay
   * @returns {Function} The debounced function
   * @description Creates a debounced function that delays invoking func until after wait milliseconds
   * @example
   * const debouncedFn = NativeUtils.debounce(() => console.log('called'), 100);
   * debouncedFn(); // Will be called after 100ms if not called again
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
   * @param {Array} array - The array to search
   * @param {Function|Object|*} predicate - The function, object, or value to test each element
   * @returns {*} The first matching element or undefined
   * @description Finds the first element in an array that matches the predicate
   * @example
   * NativeUtils.find([1, 2, 3], x => x > 1); // 2
   * NativeUtils.find([{a: 1}, {a: 2}], {a: 2}); // {a: 2}
   * NativeUtils.find([1, 2, 3], 2); // 2
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
   * @param {Array} array - The array to check
   * @param {Function} predicate - The function to test each element
   * @returns {boolean} True if any element passes the test, false otherwise
   * @description Checks if any element in the array passes the predicate test
   * @example
   * NativeUtils.some([1, 2, 3], x => x > 2); // true
   * NativeUtils.some([1, 2, 3], x => x > 5); // false
   */
  some: function(array, predicate) {
    return array.some(predicate);
  },

  /**
   * Sort array by property or function
   * Replacement for _.sortBy()
   * @param {Array} array - The array to sort
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Array} A new sorted array
   * @description Creates a new array sorted by the result of the iteratee
   * @example
   * NativeUtils.sortBy([{a: 3}, {a: 1}, {a: 2}], 'a'); // [{a: 1}, {a: 2}, {a: 3}]
   * NativeUtils.sortBy([3, 1, 2], x => x); // [1, 2, 3]
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
   * @param {Array} array - The array to process
   * @param {Function} comparator - The comparator function to determine equality
   * @returns {Array} A new array with unique values based on the comparator
   * @description Creates a new array with duplicate values removed using a custom comparator
   * @example
   * NativeUtils.uniqWith([{a: 1}, {a: 1}, {a: 2}], (a, b) => a.a === b.a); // [{a: 1}, {a: 2}]
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
   * @param {Array} array - The first array
   * @param {Array} other - The second array
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Array} A new array with the symmetric difference
   * @description Creates a new array with elements that are in either array but not in both
   * @example
   * NativeUtils.xorBy([{a: 1}, {a: 2}], [{a: 2}, {a: 3}], 'a'); // [{a: 1}, {a: 3}]
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
   * @param {Object} target - The target object
   * @param {...Object} sources - The source objects
   * @returns {Object} The target object
   * @description Assigns properties from source objects to the target object
   * @example
   * NativeUtils.assignIn({a: 1}, {b: 2}, {c: 3}); // {a: 1, b: 2, c: 3}
   */
  assignIn: function(target) {
    var sources = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  },

  /**
   * Alias for assignIn
   * Replacement for _.extend()
   * @param {Object} target - The target object
   * @param {...Object} sources - The source objects
   * @returns {Object} The target object
   * @description Assigns properties from source objects to the target object (alias for assignIn)
   * @example
   * NativeUtils.extend({a: 1}, {b: 2}); // {a: 1, b: 2}
   */
  extend: function(target, ...sources) {
    return this.assignIn(target, ...sources);
  },

  /**
   * Flatten array one level deep
   * Replacement for _.flatten()
   * @param {Array} array - The array to flatten
   * @returns {Array} A new flattened array
   * @description Flattens an array one level deep
   * @example
   * NativeUtils.flatten([1, [2, 3], [4, [5]]]); // [1, 2, 3, 4, [5]]
   */
  flatten: function(array) {
    return array.reduce((acc, val) => acc.concat(val), []);
  },

  /**
   * Iterate over collection
   * Replacement for _.forEach()
   * @param {Array|Object} collection - The collection to iterate over
   * @param {Function} iteratee - The function to call for each element
   * @returns {void}
   * @description Iterates over elements of a collection and calls the iteratee for each element
   * @example
   * NativeUtils.forEach([1, 2, 3], x => console.log(x)); // logs 1, 2, 3
   * NativeUtils.forEach({a: 1, b: 2}, (value, key) => console.log(key, value)); // logs 'a 1', 'b 2'
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
   * @param {*} value - The value to check
   * @returns {boolean} True if the value is an array, false otherwise
   * @description Checks if a value is an array
   * @example
   * NativeUtils.isArray([1, 2, 3]); // true
   * NativeUtils.isArray('string'); // false
   */
  isArray: function(value) {
    return Array.isArray(value);
  },

  /**
   * Get object keys
   * Replacement for _.keys()
   * @param {Object} obj - The object to query
   * @returns {Array} An array of the object's keys
   * @description Gets the keys of an object
   * @example
   * NativeUtils.keys({a: 1, b: 2}); // ['a', 'b']
   */
  keys: function(obj) {
    return Object.keys(obj);
  },

  /**
   * Map array to new array
   * Replacement for _.map()
   * @param {Array} array - The array to map
   * @param {Function|string} iteratee - The function to call for each element or property path
   * @returns {Array} A new mapped array
   * @description Creates a new array with the results of calling the iteratee on every element
   * @example
   * NativeUtils.map([1, 2, 3], x => x * 2); // [2, 4, 6]
   * NativeUtils.map([{id: 1}, {id: 2}], 'id'); // [1, 2]
   */
  map: function(array, iteratee) {
    if (!array || !Array.isArray(array)) {
      return [];
    }
    if (typeof iteratee === 'string') {
      return array.map(function(item) {
        return this.get(item, iteratee);
      }.bind(this));
    }
    if (typeof iteratee !== 'function') {
      throw new Error('NativeUtils.map: iteratee must be a function or string, got ' + typeof iteratee);
    }
    return array.map(iteratee);
  },

  /**
   * Filter array by predicate
   * Replacement for _.filter()
   * @param {Array} array - The array to filter
   * @param {Function|Object|*} predicate - The function, object, or value to test each element
   * @returns {Array} A new filtered array
   * @description Creates a new array with elements that pass the predicate test
   * @example
   * NativeUtils.filter([1, 2, 3, 4], x => x > 2); // [3, 4]
   * NativeUtils.filter([{a: 1}, {a: 2}], {a: 1}); // [{a: 1}]
   * NativeUtils.filter([1, 2, 1], 1); // [1, 1]
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
   * @param {Array} array - The array to filter
   * @param {Array} other - The array to exclude values from
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Array} A new array with excluded values removed based on the iteratee
   * @description Creates a new array with values from the first array that are not present in the second array based on the iteratee
   * @example
   * NativeUtils.differenceBy([{a: 1}, {a: 2}], [{a: 1}], 'a'); // [{a: 2}]
   * NativeUtils.differenceBy([{a: 1}, {a: 2}], [{a: 1}], x => x.a); // [{a: 2}]
   */
  differenceBy: function(array, other, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    const otherKeys = new Set(other.map(getKey));
    return array.filter(item => !otherKeys.has(getKey(item)));
  },

  /**
   * Get intersection by property
   * Replacement for _.intersectionBy()
   * @param {Array} array - The array to filter
   * @param {Array} other - The array to intersect with
   * @param {Function|string} iteratee - The iteratee function or property path
   * @returns {Array} A new array with intersecting values based on the iteratee
   * @description Creates a new array with values that exist in both arrays based on the iteratee
   * @example
   * NativeUtils.intersectionBy([{a: 1}, {a: 2}], [{a: 1}], 'a'); // [{a: 1}]
   * NativeUtils.intersectionBy([{a: 1}, {a: 2}], [{a: 1}], x => x.a); // [{a: 1}]
   */
  intersectionBy: function(array, other, iteratee) {
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    const otherKeys = new Set(other.map(getKey));
    return array.filter(item => otherKeys.has(getKey(item)));
  },

  /**
   * Get index of element in array
   * Replacement for _.indexOf()
   * @param {Array} array - The array to search
   * @param {*} value - The value to search for
   * @param {number} [fromIndex=0] - The index to start searching from
   * @returns {number} The index of the found element, or -1 if not found
   * @description Gets the index of the first occurrence of a value in an array
   * @example
   * NativeUtils.indexOf([1, 2, 3, 2], 2); // 1
   * NativeUtils.indexOf([1, 2, 3, 2], 2, 2); // 3
   */
  indexOf: function(array, value, fromIndex = 0) {
    return array.indexOf(value, fromIndex);
  }
};