/**
 * This gets data out of the URL as an INPUT,
 * parses it, and as an OUTPUT sets all the required variables used by LFD
 * for prepopulating, prefiltering and opening an entry
 *
 * Note: Boolean flags are treated as strings as Fliplet.Navigate.query
 * does not parse the values into boolean values.
 *
 * @description Parses URL query parameters for dynamic list functionality including
 * search, filter, sort, prefilter, and entry opening operations
 * @returns {boolean} Returns true if any query parameters were parsed and processed,
 * false if no relevant query parameters were found or if in interact mode
 */
Fliplet.Registry.set('dynamicListQueryParser', function() {
  var _this = this;

  if (Fliplet.Env.get('mode') === 'interact') {
    // Don't parse queries when editing in Studio
    return false;
  }

  // we do not execute previousScreen like in the PV case so we don't open ourselves up to an xss attack
  this.previousScreen = Fliplet.Navigate.query['dynamicListPreviousScreen'] === 'true';

  // action is intentionally ommited so we don't open ourselves up to an xss attack
  this.pvGoBack = NativeUtils.pickBy({
    enableButton: Fliplet.Navigate.query['dynamicListEnableButton'],
    hijackBack: Fliplet.Navigate.query['dynamicListHijackBack']
  }, function(value) { return !NativeUtils.isNil(value); });
  this.queryGoBack = NativeUtils.size(this.pvGoBack) > 0;

  // cast to booleans
  this.pvGoBack.enableButton = this.pvGoBack.enableButton === 'true';
  this.pvGoBack.hijackBack = this.pvGoBack.hijackBack === 'true';
  this.pvGoBack = this.queryGoBack ? this.pvGoBack : null;

  // example input
  // ?dynamicListPrefilterColumn=Name,Age&dynamicListPrefilterLogic=contains,<&dynamicListPrefilterValue=Angel,2
  this.pvPreFilterQuery = NativeUtils.pickBy({
    column: Fliplet.Navigate.query['dynamicListPrefilterColumn'],
    logic: Fliplet.Navigate.query['dynamicListPrefilterLogic'],
    value: Fliplet.Navigate.query['dynamicListPrefilterValue']
  }, function(value) { return !NativeUtils.isNil(value); });
  this.queryPreFilter = NativeUtils.size(this.pvPreFilterQuery) > 0;

  if (this.queryPreFilter) {
    // take the query parameters and parse them down to arrays
    var prefilterColumnParts = _this.Utils.String.splitByCommas(this.pvPreFilterQuery.column);
    var prefilterLogicParts = _this.Utils.String.splitByCommas(this.pvPreFilterQuery.logic);
    var prefilterValueParts = _this.Utils.String.splitByCommas(this.pvPreFilterQuery.value);

    if (prefilterColumnParts.length !== prefilterLogicParts.length
      || prefilterLogicParts.length !== prefilterValueParts.length) {
      this.pvPreFilterQuery = null;
      this.queryPreFilter = false;
      console.warn('Please supply an equal number of parameter to the dynamicListPrefilter filters.');
    } else {
      this.pvPreFilterQuery = [];

      var maxPartCount = Math.max(
        prefilterColumnParts.length,
        prefilterLogicParts.length,
        prefilterValueParts.length
      );

      // loop through the query parts and create new filters with every one
      for (var i = 0; i < maxPartCount; i++) {
        var filter = {
          column: prefilterColumnParts.pop(),
          logic: prefilterLogicParts.pop(),
          value: prefilterValueParts.pop()
        };

        this.pvPreFilterQuery.push(filter);
      }
    }
  } else {
    this.pvPreFilterQuery = null;
  }

  // dataSourceEntryId is always numeric
  // we cast the one coming from query to a number
  // so the equality check later passes
  const openId = parseInt(Fliplet.Navigate.query['dynamicListOpenId'], 10);
  const commentId = parseInt(Fliplet.Navigate.query['dynamicListCommentId'], 10);

  this.pvOpenQuery = NativeUtils.pickBy({
    id: NativeUtils.isFinite(openId) ? openId : undefined,
    column: Fliplet.Navigate.query['dynamicListOpenColumn'],
    value: Fliplet.Navigate.query['dynamicListOpenValue'],
    openComments: (('' + Fliplet.Navigate.query['dynamicListOpenComments']) || '').toLowerCase() === 'true',
    commentId: NativeUtils.isFinite(commentId) ? commentId : undefined
  }, function(value) { return !NativeUtils.isNil(value) && value !== false; });
  this.queryOpen = NativeUtils.size(this.pvOpenQuery) > 0;
  this.pvOpenQuery = this.queryOpen ? this.pvOpenQuery : null;

  this.pvSearchQuery = NativeUtils.pickBy({
    column: Fliplet.Navigate.query['dynamicListSearchColumn'],
    value: Fliplet.Navigate.query['dynamicListSearchValue'],
    openSingleEntry: Fliplet.Navigate.query['dynamicListOpenSingleEntry']
  }, function(value) { return !NativeUtils.isNil(value); });

  const hasSearchQueryValue = !NativeUtils.isUndefined(NativeUtils.get(this.pvSearchQuery, 'value'));

  // Determine if query-based search should be active
  // If user has disabled search in settings, then no search query should be parsed and processed
  this.querySearch = this.data.searchEnabled && hasSearchQueryValue;

  if (this.querySearch) {
    // check if a comma separated list of columns were passed as column
    this.pvSearchQuery.column = _this.Utils.String.splitByCommas(this.pvSearchQuery.column, false);
    this.pvSearchQuery.openSingleEntry = (('' + this.pvSearchQuery.openSingleEntry) || '').toLowerCase() === 'true';
  } else {
    this.pvSearchQuery = this.data.searchEnabled ? this.pvSearchQuery : null;
    this.querySearch = null;
  }

  this.pvFilterQuery = NativeUtils.pickBy({
    column: Fliplet.Navigate.query['dynamicListFilterColumn'],
    value: Fliplet.Navigate.query['dynamicListFilterValue'],
    hideControls: Fliplet.Navigate.query['dynamicListFilterHideControls']
  }, function(value) { return !NativeUtils.isNil(value); });

  const hasFilterQueryValue = !NativeUtils.isUndefined(NativeUtils.get(this.pvFilterQuery, 'value'));

  this.queryFilter = this.data.filtersEnabled && hasFilterQueryValue;

  if (this.queryFilter) {
    // check if a comma separated list of columns/values were passed as column/value
    this.pvFilterQuery.column = _this.Utils.String.splitByCommas(this.pvFilterQuery.column);
    this.pvFilterQuery.value = _this.Utils.String.splitByCommas(this.pvFilterQuery.value);

    if (!NativeUtils.isEmpty(this.pvFilterQuery.column) && !NativeUtils.isEmpty(this.pvFilterQuery.value)
      && this.pvFilterQuery.column.length !== this.pvFilterQuery.value.length) {
      this.pvFilterQuery.column = undefined;
      this.pvFilterQuery.value = undefined;
      this.queryFilter = false;
      console.warn('Please supply an equal number of parameter to the dynamicListFilterColumn and dynamicListFilterValue.');
    }

    // cast to boolean
    this.pvFilterQuery.hideControls = (('' + this.pvFilterQuery.hideControls) || '').toLowerCase() === 'true';
    this.data.filtersEnabled = this.data.filtersEnabled || this.queryFilter;
  } else {
    this.pvFilterQuery = this.data.filtersEnabled ? this.pvFilterQuery : null;
    this.queryFilter = null;
  }

  // We can sort only by one column that is why this syntax doesn't support
  // ?dynamicListSortColumn=Name,Age&dynamicListSortOrder=asc
  // Correct example is
  // ?dynamicListSortColumn=Name&dynamicListSortOrder=asc
  this.pvPreSortQuery = NativeUtils.pickBy({
    column: Fliplet.Navigate.query['dynamicListSortColumn'],
    order: Fliplet.Navigate.query['dynamicListSortOrder']
  }, function(value) { return !NativeUtils.isNil(value); });

  if (!this.data.sortEnabled) {
    this.pvPreSortQuery = null;
  } else if (this.pvPreSortQuery.order) {
    // Validate sort queries
    this.pvPreSortQuery.order = this.pvPreSortQuery.order.toLowerCase().trim();

    if (!this.pvPreSortQuery.column
      || ['asc', 'desc'].indexOf(this.pvPreSortQuery.order) === -1) {
      this.pvPreSortQuery = {};
    }
  }

  this.querySort = NativeUtils.size(this.pvPreSortQuery) === 2;

  if (this.querySort) {
    // Ensures sorting is configured correctly to match the query
    this.data.sortEnabled = true;
    this.data.sortFields = NativeUtils.uniq([].concat(this.data.sortFields, [this.pvPreSortQuery.column]));
    this.data.searchIconsEnabled = true;

    this.sortOrder = this.pvPreSortQuery.order || 'asc';
    this.sortField = this.pvPreSortQuery.column;
  }

  return this.previousScreen
    || this.queryGoBack
    || this.queryPreFilter
    || this.queryOpen
    || this.querySearch
    || this.queryFilter
    || this.querySort;
});
