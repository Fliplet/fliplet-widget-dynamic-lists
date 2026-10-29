/**
 * Native JavaScript utilities to replace lodash methods
 * These functions provide equivalent functionality to commonly used lodash methods
 */

window.NativeUtils = {
  /**
   * Safely get a nested property from an object
   * Replacement for _.get()
   * @param {Object} object - The object to query
   * @param {string|Array|number} path - The path to the property (dot notation string, array of keys, or numeric key)
   * @param {*} [defaultValue] - The value returned if the path is not found
   * @returns {*} The resolved value or defaultValue
   * @description Safely retrieves a nested property value from an object using dot notation or array path
   * @example
   * NativeUtils.get({a: {b: 2}}, 'a.b'); // 2
   * NativeUtils.get({a: {b: 2}}, ['a', 'b']); // 2
   * NativeUtils.get({a: {b: 2}}, 'a.c', 'default'); // 'default'
   */
  get: function(object, path, defaultValue) {
    // Handle null or undefined object
    if (object === null || object === undefined) {
      return defaultValue;
    }

    // Handle empty array path - return default value if provided, otherwise undefined
    if (Array.isArray(path) && path.length === 0) {
      return defaultValue !== undefined ? defaultValue : undefined;
    }

    // Convert path to array if it's a string
    let pathArray;

    if (typeof path === 'string') {
      // Check if the key exists as a direct property first (key over path behavior)
      if (object.hasOwnProperty(path)) {
        return object[path];
      }

      // Handle bracket notation like 'a[]' or 'a[1]'
      if (path.includes('[') && path.includes(']')) {
        // Split on brackets and handle empty brackets specially
        const parts = path.split(/\[|\]/);

        pathArray = [];

        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 0) {
            // Even indices are the parts before brackets
            if (parts[i] !== '') {
              const dotParts = parts[i].split('.');

              for (let j = 0; j < dotParts.length; j++) {
                if (dotParts[j] !== '') {
                  pathArray.push(dotParts[j]);
                }
              }
            }
          } else if (parts[i] === '') {
            // Odd indices are the bracket contents - empty bracket means empty string key
            pathArray.push('');
          } else {
            pathArray.push(parts[i]);
          }
        }
      } else if (path === '') {
        // Empty string should create a property with empty string key
        pathArray = [''];
      } else {
        pathArray = path.split('.').filter(part => part !== '');
      }
    } else if (Array.isArray(path)) {
      pathArray = path;
    } else {
      // Handle other types
      pathArray = [path];
    }

    // If path array is empty, return undefined (like lodash baseGet)
    if (pathArray.length === 0) {
      return defaultValue !== undefined ? defaultValue : undefined;
    }

    // Navigate through the object using the path
    let result = object;

    for (let i = 0; i < pathArray.length; i++) {
      const key = pathArray[i];

      // If result is null or undefined, return default value
      if (result === null || result === undefined) {
        return defaultValue;
      }

      // Get the value at the current key
      result = result[key];
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
    const excludeSet = new Set(values.reduce(function(acc, val) { return acc.concat(val); }, []));
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    return this.uniq(arrays.reduce(function(acc, val) { return acc.concat(val); }, []));
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
    if (obj === null || obj === undefined) {
      return {};
    }

    // Convert to object if primitive
    const source = Object(obj);
    const result = {};

    // Handle null/undefined predicate
    if (predicate === null || predicate === undefined) {
      predicate = (value) => value;
    }

    // Get all enumerable properties including inherited ones
    const keys = [];

    // Use for...in to get all enumerable properties including inherited ones
    for (const key in source) {
      if (keys.indexOf(key) === -1) {
        keys.push(key);
      }
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = source[key];

      if (predicate(value, key, source)) {
        result[key] = value;
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
    if (!obj || typeof obj !== 'object') {
      return {};
    }
    const result = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && !predicate(obj[key], key)) {
        result[key] = obj[key];
      }
    }
    return result;
  },

  /**
   * Creates an array of elements, sorted in ascending or descending order by the results of running each element through an iteratee
   * Replacement for _.orderBy()
   * @param {Array|Object} collection - Collection to iterate over
   * @param {Array|Function|string|number} iteratees - Iteratees (function or path: string|number|array). Arrays can also be arrays of iteratees.
   * @param {Array<string>|string} orders - Sort orders ('asc' or 'desc')
   * @returns {Array} Returns the new sorted array
   */
  orderBy: function(collection, iteratees, orders) {
    // Handle null/undefined collection
    if (collection === null || collection === undefined) {
      return [];
    }

    // Handle non-array, non-object input (treat as empty)
    if (!Array.isArray(collection) && (typeof collection !== 'object' || collection === null)) {
      return [];
    }

    // Convert to array if it's an object
    let array;

    if (Array.isArray(collection)) {
      array = collection.slice(); // Create a copy to avoid mutating original
    } else {
      // Handle objects - convert to array of values
      array = [];

      const keys = Object.keys(collection);

      for (let i = 0; i < keys.length; i++) {
        array.push(collection[keys[i]]);
      }
    }

    // Normalize iteratees parameter
    let normalizedIteratees;

    if (iteratees === null || iteratees === undefined) {
      normalizedIteratees = [(value) => value];
    } else if (!Array.isArray(iteratees)) {
      normalizedIteratees = [iteratees];
    } else {
      normalizedIteratees = iteratees.slice();
    }

    // Normalize orders parameter
    let normalizedOrders;

    if (orders === null || orders === undefined) {
      normalizedOrders = [];
    } else if (!Array.isArray(orders)) {
      normalizedOrders = [orders];
    } else {
      normalizedOrders = orders.slice();
    }

    // Fill missing orders with 'asc'
    while (normalizedOrders.length < normalizedIteratees.length) {
      normalizedOrders.push('asc');
    }

    // Convert iteratees to functions
    const iterateeFunctions = normalizedIteratees.map(iteratee => {
      if (typeof iteratee === 'function') {
        return iteratee;
      } else if (typeof iteratee === 'string' || typeof iteratee === 'number') {
        const path = iteratee;

        return (value) => this.get(value, path);
      }

      if (Array.isArray(iteratee)) {
        // Handle nested array paths like [['address', 'zipCode']]
        const path = iteratee;

        return (value) => this.get(value, path);
      }

      return (value) => value;
    });

    // Sort the array
    return array.sort((a, b) => {
      for (let i = 0; i < iterateeFunctions.length; i++) {
        const iterateeFunc = iterateeFunctions[i];
        const order = String(normalizedOrders[i]).toLowerCase();
        const isDesc = order === 'desc';

        const aValue = iterateeFunc(a);
        const bValue = iterateeFunc(b);

        // Handle NaN values (move to end)
        const aIsNaN = Number.isNaN(aValue);
        const bIsNaN = Number.isNaN(bValue);

        if (aIsNaN && bIsNaN) continue;
        if (aIsNaN) return 1;
        if (bIsNaN) return -1;

        // Handle null/undefined values (move to end)
        const aIsNullish = aValue === null || aValue === undefined;
        const bIsNullish = bValue === null || bValue === undefined;

        if (aIsNullish && bIsNullish) continue;
        if (aIsNullish) return 1;
        if (bIsNullish) return -1;

        // Normal comparison
        let comparison = 0;

        if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }

        // Apply order direction
        if (comparison !== 0) {
          return isDesc ? -comparison : comparison;
        }
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
    if (!Array.isArray(array)) {
      return {};
    }
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
    if (typeof str !== 'string') {
      return '';
    }
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
    if (typeof str !== 'string' || str.length === 0) {
      return '';
    }
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
    if (!Array.isArray(array)) {
      return undefined;
    }
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
  fill: function(array, value, start = 0, end) {
    if (!Array.isArray(array)) {
      return [];
    }
    if (end === undefined) {
      end = array.length;
    }
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
    if (!Array.isArray(array)) {
      return -1;
    }
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
    if (!Array.isArray(array)) {
      return undefined;
    }
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
    if (!Array.isArray(array)) {
      return false;
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array) || !Array.isArray(other)) {
      return [];
    }
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
    if (!target || typeof target !== 'object') {
      return target;
    }
    var sources = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      if (source && typeof source === 'object') {
        for (var key in source) {
          if (source.hasOwnProperty(key)) {
            target[key] = source[key];
          }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!collection) {
      return;
    }
    if (Array.isArray(collection)) {
      collection.forEach(iteratee);
    } else if (typeof collection === 'object') {
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
    if (!obj || typeof obj !== 'object') {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return [];
    }
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
    if (!Array.isArray(array) || !Array.isArray(other)) {
      return Array.isArray(array) ? array : [];
    }
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
    if (!Array.isArray(array) || !Array.isArray(other)) {
      return [];
    }
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
    if (!Array.isArray(array)) {
      return -1;
    }
    return array.indexOf(value, fromIndex);
  },

  /**
   * Return the value if it is a non-empty array, otherwise the fallback.
   * Guards against the "empty array is truthy" footgun where `value || fallback`
   * keeps an empty `[]` instead of using the fallback.
   * @param {*} value - The candidate array
   * @param {*} fallback - Returned when value is not a non-empty array
   * @returns {*} value when it is a non-empty array, otherwise fallback
   * @example
   * NativeUtils.coalesceArray(['a'], ['x']); // ['a']
   * NativeUtils.coalesceArray([], ['x']);    // ['x']
   * NativeUtils.coalesceArray(undefined, ['x']); // ['x']
   */
  coalesceArray: function(value, fallback) {
    return (Array.isArray(value) && value.length) ? value : fallback;
  },

  /**
   * Normalize a layout's default detail fields against the connected data source columns.
   *
   * A locked default (`paranoid: true`) is a template slot, not a plain field: `location`
   * names a fixed position in the layout's detail template (e.g. the Email/Telephone/
   * Linkedin action buttons on the card layouts) and `column` is whichever data source
   * column the user maps into it. Those slots are kept whatever the data source looks
   * like, because "Add field" only creates rows without a `location`, so a dropped slot
   * cannot be recreated from the interface. When the hardcoded column is not in the data
   * source the column is reset to 'none' ("-- Select a data field") so the stored config
   * says what the interface shows: updateDetailsRowContainer() runs validateColumn() over
   * every row and coerces an unknown column to 'none' on render anyway.
   *
   * A non-locked default owns no slot, so when its column is missing it is just an empty
   * row the user has to delete by hand. Those are dropped.
   *
   * Non-array columns (undefined, null, or an empty array from a data source with no
   * entries) are treated as "no columns known", which keeps every locked slot unmapped
   * rather than discarding it.
   *
   * Returns new objects. The inputs are shared with window.flListLayoutConfig and must
   * never be mutated.
   *
   * @param {Array} defaultDetailFields - The layout's 'detail-fields' defaults
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Array} A new array of new field objects, safe to seed or restore from
   * @example
   * // data source has none of the hardcoded columns
   * NativeUtils.normalizeDefaultDetailFields(
   *   [{ location: 'Email', column: 'Email', paranoid: true }, { location: 'Bio', column: 'Bio' }],
   *   ['Name', 'Work Email']
   * ); // [{ location: 'Email', column: 'none', paranoid: true }]
   */
  normalizeDefaultDetailFields: function(defaultDetailFields, dataSourceColumns) {
    const fields = Array.isArray(defaultDetailFields) ? defaultDetailFields : [];
    const columns = Array.isArray(dataSourceColumns) ? dataSourceColumns : [];

    return fields.reduce(function(result, field) {
      if (columns.indexOf(field.column) !== -1) {
        result.push(Object.assign({}, field));
      } else if (field.paranoid) {
        result.push(Object.assign({}, field, { column: 'none' }));
      }

      return result;
    }, []);
  },

  /**
   * Resolve which data source columns the detail view has already offered the user.
   *
   * "I want the detail view to auto update when new fields are added" only adds columns
   * that are absent from this list, so this is what decides whether a column counts as
   * new (add it) or as one the user has already seen and possibly removed (leave it out).
   *
   * detailViewKnownColumns is the snapshot written on each save. When it is missing (a
   * list last saved before the snapshot existed) or empty, dataSourceColumns is used
   * instead: every save has always written the columns it saw there, so it still tells
   * a column added since then from one the user removed. An empty dataSourceColumns is
   * kept: the data source had no columns at that save, so every column it has gained
   * since is new. A save that happened before the columns had loaded writes no
   * dataSourceColumns, and only then are the current data source columns used, which
   * treats every column as already offered -- that last fallback is what stops such a
   * list from re-adding fields the user deleted.
   *
   * The fallback is wrong in one case: a detail view that has never been populated. The
   * 'news-feed' layout is marked 'detail-fields-disabled', so the first-load seed in
   * interface.js never runs for it and this merge is the only thing that can ever add a
   * field. Falling back to the current columns there marks every column as already
   * offered, and the field list can never populate, while news-feed's built-in detail
   * template keeps rendering in Preview. detailViewSeeded records that the list has held
   * at least one field, set as soon as fields are put in (prepareDetailViewOptions,
   * changeDetailViewDataSource) and kept by every save, which is what separates "never
   * populated" from "the user deleted every field"; only the latter keeps the fallback.
   *
   * @param {Object} settings - Widget config (interface) or runtime data, read for
   *   detailViewOptions, detailViewKnownColumns, dataSourceColumns and detailViewSeeded
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Array} The columns to treat as already offered; always an array
   * @example
   * // never populated: nothing has been offered yet, so every column is new
   * NativeUtils.knownDetailViewColumns(
   *   { detailViewOptions: [], detailViewKnownColumns: ['a', 'b'] }, ['a', 'b']
   * ); // []
   * @example
   * // populated once, then emptied by the user: the snapshot still applies
   * NativeUtils.knownDetailViewColumns(
   *   { detailViewOptions: [], detailViewKnownColumns: ['a', 'b'], detailViewSeeded: true },
   *   ['a', 'b']
   * ); // ['a', 'b']
   * @example
   * // saved before the snapshot existed: the columns that save saw, so 'c' is new
   * NativeUtils.knownDetailViewColumns(
   *   { detailViewOptions: [{ column: 'b' }], dataSourceColumns: ['a', 'b'] }, ['a', 'b', 'c']
   * ); // ['a', 'b']
   * @example
   * // saved against a data source with no columns yet: every column is new
   * NativeUtils.knownDetailViewColumns(
   *   { detailViewOptions: [{ column: 'none' }], detailViewKnownColumns: [], dataSourceColumns: [] }, ['a']
   * ); // []
   */
  knownDetailViewColumns: function(settings, dataSourceColumns) {
    const config = settings || {};
    const options = Array.isArray(config.detailViewOptions) ? config.detailViewOptions : [];
    const columns = Array.isArray(dataSourceColumns) ? dataSourceColumns : [];

    if (!options.length && !config.detailViewSeeded) {
      return [];
    }

    return this.coalesceArray(config.detailViewKnownColumns, Array.isArray(config.dataSourceColumns) ? config.dataSourceColumns : columns);
  },

  /**
   * Resolve the data source columns "auto update when new fields are added" should add
   * to the detail view: those neither already saved nor already offered (see
   * knownDetailViewColumns). Shared by the settings interface and every runtime layout,
   * which each pass the saved columns they read.
   *
   * @param {Object} settings - Widget config (interface) or runtime data
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @param {Array} savedColumns - Columns of the saved detail view options
   * @returns {Array} The columns to add, in data source order; always an array
   * @example
   * NativeUtils.newDetailViewColumns(
   *   { detailViewOptions: [{ column: 'a' }], detailViewKnownColumns: ['a', 'b'] }, ['a', 'b', 'c'], ['a']
   * ); // ['c']
   */
  newDetailViewColumns: function(settings, dataSourceColumns, savedColumns) {
    const columns = Array.isArray(dataSourceColumns) ? dataSourceColumns : [];
    const saved = Array.isArray(savedColumns) ? savedColumns : [];

    return this.difference(columns, saved, this.knownDetailViewColumns(settings, columns));
  },

  /**
   * The id to give a detail field added to an existing list.
   *
   * The settings rows are looked up by id (`#detail_select_field_<id>`), so a new field
   * must never reuse one. `detailViewOptions.length + 1` did as soon as a field had been
   * deleted: the new column took over the row that already had that id and was saved
   * in its place. Only numeric ids count; "Add field" and the layout defaults use random
   * strings, which a number can never equal.
   *
   * @param {Array} options - The current detail view options
   * @returns {number} One more than the highest numeric id, or 1 when there is none
   * @example
   * NativeUtils.nextDetailViewOptionId([{ id: 1 }, { id: 2 }, { id: 4 }]); // 5
   * NativeUtils.nextDetailViewOptionId([{ id: 'nMytReWq' }, { id: 3 }]); // 4
   */
  nextDetailViewOptionId: function(options) {
    const list = Array.isArray(options) ? options : [];

    return list.reduce(function(max, option) {
      const id = option ? parseInt(option.id, 10) : NaN;

      return String(id) === String(option && option.id) && id > max ? id : max;
    }, 0) + 1;
  },

  /**
   * Append the auto-update's new columns (newDetailViewColumns) to the detail view
   * options of the settings interface, each with an id no other field holds.
   *
   * @param {Object} config - Widget config, read for detailViewOptions and the snapshot
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Array} A new options array: the existing options, then one per new column
   */
  appendNewDetailViewColumns: function(config, dataSourceColumns) {
    const options = Array.isArray(config && config.detailViewOptions) ? config.detailViewOptions.slice() : [];
    const columns = Array.isArray(dataSourceColumns) ? dataSourceColumns : [];
    const savedColumns = options.map(function(option) { return option.column; });

    this.newDetailViewColumns(config, columns, savedColumns).forEach(function(column) {
      options.push({
        id: this.nextDetailViewOptionId(options),
        columns: columns,
        column: column,
        type: 'text',
        fieldLabel: 'column-name',
        editable: true
      });
    }, this);

    return options;
  },

  /**
   * Build the detail view options a list starts with on a data source: one plain field
   * per column, the layout's default fields matched onto them (see
   * normalizeDefaultDetailFields), then the layout's ignored columns removed and, unless
   * the layout shows the summary fields in the detail view, the columns the summary
   * fields already show. Used when a list has no detail fields yet, and again when its
   * data source changes before the user has edited them (rebuildSeededDetailViewOptions).
   *
   * @param {Object} layoutSettings - The layout's entry in window.flListLayoutConfig
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @param {Array} summaryFields - The list's summary fields
   * @returns {Array} New option objects; empty for a 'detail-fields-disabled' layout
   */
  seedDetailViewOptions: function(layoutSettings, dataSourceColumns, summaryFields) {
    const settings = layoutSettings || {};
    const columns = Array.isArray(dataSourceColumns) ? dataSourceColumns : [];
    const ignored = settings['detail-fields-ignore'] || [];

    if (settings['detail-fields-disabled']) {
      return [];
    }

    let options = columns.map(function(column, index) {
      return {
        id: index + 1,
        columns: columns,
        column: column,
        type: 'text',
        fieldLabel: 'column-name',
        editable: true
      };
    });

    this.normalizeDefaultDetailFields(settings['detail-fields'], columns).forEach(function(field) {
      const item = {
        id: field.id,
        columns: columns,
        column: field.column,
        type: field.type,
        fieldLabel: 'column-name',
        location: field.location,
        editable: !field.paranoid,
        helper: field.helper
      };

      // 'none' is a placeholder, not a column: matching on it would collapse every
      // unmapped slot onto one row, so an unmapped slot always gets its own row.
      const foundMatch = item.column === 'none'
        ? undefined
        : options.find(function(option) {
          return option.column === item.column;
        });

      if (foundMatch) {
        foundMatch.fieldLabel = 'no-label';
        foundMatch.location = item.location;
        foundMatch.editable = item.editable;
        foundMatch.type = item.type;
        foundMatch.helper = item.helper;
      } else {
        options.push(item);
      }
    });

    options = options.filter(function(option) {
      return ignored.indexOf(option.column) === -1;
    });

    if (!settings.showSummaryFieldsInDetailView) {
      // The summary fields are rendered at the top of the detail view already. Locked
      // slots stay: their template spot (e.g. the Email button) has no other source.
      const summaryColumns = (Array.isArray(summaryFields) ? summaryFields : []).map(function(field) {
        return field && field.column;
      }).filter(function(column) {
        return column && column !== 'none' && column !== 'custom';
      });

      options = options.filter(function(option) {
        return !option.editable || summaryColumns.indexOf(option.column) === -1;
      });
    }

    return options;
  },

  /**
   * A short fingerprint of the detail view options: per field its id, column, slot,
   * type, label setting, custom field/label, image source and folder, in order. Taken
   * when the options are seeded (detailViewSeedSignature), so a later match proves the
   * user has not changed them since. Keys the save adds without user input are
   * normalised to their defaults, so a save on its own does not change it.
   *
   * @param {Array} options - Detail view options
   * @returns {string} The field count and a hash of the fields
   */
  detailViewSignature: function(options) {
    const list = Array.isArray(options) ? options : [];
    const text = JSON.stringify(list.map(function(option) {
      const type = option.type || 'text';

      return [
        option.id,
        option.column,
        option.location || null,
        type,
        option.fieldLabel || 'column-name',
        !!option.editable,
        option.customField || '',
        option.customFieldLabel || '',
        type === 'image' ? option.imageField || 'url' : null,
        !!option.folder
      ];
    }));
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }

    return list.length + ':' + (hash >>> 0).toString(36);
  },

  /**
   * Seed the detail view options (seedDetailViewOptions) into the config and record
   * their fingerprint, so a data source change can tell they are still untouched.
   *
   * @param {Object} config - Widget config, read for 'summary-fields' and updated in place
   * @param {Object} layoutSettings - The layout's entry in window.flListLayoutConfig
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Object} The same config
   */
  applyDetailViewSeed: function(config, layoutSettings, dataSourceColumns) {
    config.detailViewOptions = this.seedDetailViewOptions(layoutSettings, dataSourceColumns, config['summary-fields']);
    config.detailViewSeedSignature = this.detailViewSignature(config.detailViewOptions);

    return config;
  },

  /**
   * The detail view options when the settings interface loads: seeded when the list has
   * never held a field (except on a 'detail-fields-disabled' layout), otherwise topped up
   * with the auto-update's new columns when that is on. A list the user emptied
   * (detailViewSeeded) is not seeded again. A fresh seed already holds every column, so
   * the auto-update has nothing to add to it. A list holding fields afterwards is marked
   * as populated (markDetailViewPopulated).
   *
   * @param {Object} config - Widget config, updated in place
   * @param {Object} layoutSettings - The layout's entry in window.flListLayoutConfig
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Object} The same config
   */
  prepareDetailViewOptions: function(config, layoutSettings, dataSourceColumns) {
    const settings = layoutSettings || {};
    const options = Array.isArray(config.detailViewOptions) ? config.detailViewOptions : [];

    if (!options.length && !config.detailViewSeeded && !settings['detail-fields-disabled']) {
      this.applyDetailViewSeed(config, settings, dataSourceColumns);
    } else if (config.detailViewAutoUpdate) {
      // PS-1879: only columns genuinely NEW to this widget, each with an unused id
      config.detailViewOptions = this.appendNewDetailViewColumns(config, dataSourceColumns);
    }

    return this.markDetailViewPopulated(config);
  },

  /**
   * Set detailViewSeeded once the detail view options hold a field.
   *
   * The save only sets it when the list still holds a field at that point, so fields
   * put in by the seed or the auto-update and then all deleted before the next save
   * looked like a list that was never populated, and came back on reopen. Recording it
   * as soon as the settings interface has fields keeps that deletion.
   *
   * @param {Object} config - Widget config, updated in place
   * @returns {Object} The same config
   */
  markDetailViewPopulated: function(config) {
    if (Array.isArray(config.detailViewOptions) && config.detailViewOptions.length) {
      config.detailViewSeeded = true;
    }

    return config;
  },

  /**
   * Rebuild the detail view options for a newly selected data source when they are
   * still exactly as seeded.
   *
   * Picking a layout seeds the detail fields from the layout's demo columns. Choosing
   * another data source afterwards only re-validated those rows, so every demo column
   * the new data source lacks became a blank "-- Select a data field" row. When the
   * options still match the fingerprint taken at seeding (detailViewSeedSignature), the
   * user has not edited them, and they are seeded again for the new columns, as if the
   * list had been opened with that data source. Any edit (a deleted, added, reordered
   * or re-typed field, a label, a custom value or a folder) keeps the user's options.
   * Call it after the summary fields have been re-validated against the new columns.
   *
   * @param {Object} config - Widget config, updated in place when rebuilt
   * @param {Object} layoutSettings - The layout's entry in window.flListLayoutConfig
   * @param {Array} previousColumns - Columns before the change
   * @param {Array} nextColumns - Columns of the newly selected data source
   * @returns {boolean} True when the options were rebuilt
   */
  rebuildSeededDetailViewOptions: function(config, layoutSettings, previousColumns, nextColumns) {
    if (!config || !config.detailViewSeedSignature || !Array.isArray(previousColumns) || !previousColumns.length || !Array.isArray(nextColumns)) {
      return false;
    }

    const sameColumns = previousColumns.length === nextColumns.length && previousColumns.every(function(column) {
      return nextColumns.indexOf(column) !== -1;
    });

    if (sameColumns || this.detailViewSignature(config.detailViewOptions) !== config.detailViewSeedSignature) {
      return false;
    }

    this.applyDetailViewSeed(config, layoutSettings, nextColumns);

    return true;
  },

  /**
   * The detail view options when another data source is selected: rebuilt when still as
   * seeded (rebuildSeededDetailViewOptions), otherwise topped up with the columns new
   * with this data source when the auto-update is on.
   *
   * The save that follows snapshots the new data source's columns into
   * detailViewKnownColumns, so a column not added before then would count as already
   * offered and never appear. The merge therefore runs here, as if the list had been
   * saved just before the change: every column of the previous data source counts as
   * offered, and a list that has never held a field still gets every column.
   *
   * @param {Object} config - Widget config, updated in place
   * @param {Object} layoutSettings - The layout's entry in window.flListLayoutConfig
   * @param {Array} previousColumns - Columns before the change
   * @param {Array} nextColumns - Columns of the newly selected data source
   * @param {boolean} autoUpdate - Whether "auto update when new fields are added" is ticked
   * @returns {boolean} True when the options were rebuilt or gained a column
   */
  changeDetailViewDataSource: function(config, layoutSettings, previousColumns, nextColumns, autoUpdate) {
    if (this.rebuildSeededDetailViewOptions(config, layoutSettings, previousColumns, nextColumns)) {
      this.markDetailViewPopulated(config);

      return true;
    }

    if (!config || !autoUpdate || !Array.isArray(previousColumns) || !previousColumns.length) {
      return false;
    }

    const count = Array.isArray(config.detailViewOptions) ? config.detailViewOptions.length : 0;
    const savedBeforeChange = Object.assign({}, config, this.detailViewSaveState(config, previousColumns));

    config.detailViewOptions = this.appendNewDetailViewColumns(savedBeforeChange, nextColumns);
    this.markDetailViewPopulated(config);

    return config.detailViewOptions.length > count;
  },

  /**
   * The PS-1879 keys written on every save of the settings interface.
   *
   * detailViewKnownColumns snapshots the current data source columns, so later "new
   * field" detection can tell a genuinely new column from one the user removed.
   * detailViewSeeded records that the field list has held at least one field, so a save
   * made while it was still empty cannot mark every column as already known. It is
   * sticky: once populated, emptying the list is a deliberate choice to be respected.
   *
   * @param {Object} config - Widget config, read for the column fallbacks and the options
   * @param {Array} dataSourceColumns - Columns of the connected data source
   * @returns {Object} { detailViewKnownColumns, detailViewSeeded }
   */
  detailViewSaveState: function(config, dataSourceColumns) {
    const settings = config || {};
    const options = Array.isArray(settings.detailViewOptions) ? settings.detailViewOptions : [];

    return {
      detailViewKnownColumns: dataSourceColumns || settings.dataSourceColumns || settings.defaultColumns || [],
      detailViewSeeded: !!settings.detailViewSeeded || options.length > 0
    };
  }
};