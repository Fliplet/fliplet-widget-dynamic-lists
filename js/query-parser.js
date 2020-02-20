/**
 * this basically gets data out of the url as an INPUT,
 * parses it, and as an OUTPUT sets all the required variables used by LFD
 * for prepopulating, prefiltering and opening an entry
 */
Fliplet.Registry.set('dynamicListQueryParser', function() {
  var _this = this;

  function splitQueryValues(input) {
    var testPattern = /^(?:\[[\w\W]*\])$/;

    if (_.isNil(input)) {
      return input;
    }

    return _.map(_this.Utils.String.splitByCommas('' + input), function (str) {
      str = str.trim();

      if (!testPattern.test(str)) {
        return str;
      }

      return _.compact(splitQueryValues(str.substring(1, str.length-1)));
    });
  }

  // we do not execute previousScreen like in the PV case so we don't open ourselves up to an xss attack
  this.previousScreen = Fliplet.Navigate.query['dynamicListPreviousScreen'] === 'true';

  // action is intentionally ommited so we don't open ourselves up to an xss attack
  this.pvGoBack = _.pickBy({
    enableButton: Fliplet.Navigate.query['dynamicListEnableButton'],
    hijackBack: Fliplet.Navigate.query['dynamicListHijackBack']
  });
  this.queryGoBack = _(this.pvGoBack).size() > 0;

  // cast to booleans
  this.pvGoBack.enableButton = this.pvGoBack.enableButton === 'true';
  this.pvGoBack.hijackBack = this.pvGoBack.hijackBack === 'true';
  this.pvGoBack = this.queryGoBack ? this.pvGoBack : null;

  // example input
  // ?dynamicListPrefilterColumn=Name,Age&dynamicListPrefilterLogic=contains,<&dynamicListPrefilterValue=Angel,2
  this.pvPreFilterQuery = _.pickBy({
    column: Fliplet.Navigate.query['dynamicListPrefilterColumn'],
    logic: Fliplet.Navigate.query['dynamicListPrefilterLogic'],
    value: Fliplet.Navigate.query['dynamicListPrefilterValue']
  });
  this.queryPreFilter = _(this.pvPreFilterQuery).size() > 0;

  if (this.queryPreFilter) {
    // take the query parameters and parse them down to arrays
    var prefilterColumnParts = splitQueryValues(this.pvPreFilterQuery.column) || [];
    var prefilterLogicParts = splitQueryValues(this.pvPreFilterQuery.logic) || [];
    var prefilterValueParts = splitQueryValues(this.pvPreFilterQuery.value) || [];

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
      for (let i = 0; i < maxPartCount; i++) {
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
  this.pvOpenQuery = _.pickBy({
    id: parseInt(Fliplet.Navigate.query['dynamicListOpenId'], 10),
    column: Fliplet.Navigate.query['dynamicListOpenColumn'],
    value: Fliplet.Navigate.query['dynamicListOpenValue']
  });
  this.queryOpen = _(this.pvOpenQuery).size() > 0;
  this.pvOpenQuery = this.queryOpen ? this.pvOpenQuery : null;

  this.pvSearchQuery = _.pickBy({
    column: Fliplet.Navigate.query['dynamicListSearchColumn'],
    value: Fliplet.Navigate.query['dynamicListSearchValue'],
    openSingleEntry: Fliplet.Navigate.query['dynamicListOpenSingleEntry']
  });
  this.querySearch = !_.isUndefined(_.get(this.pvSearchQuery, 'value'));

  if (this.querySearch) {
    // check if a comma separated list of columns were passed as column
    this.pvSearchQuery.column = splitQueryValues(this.pvSearchQuery.column);
    this.pvSearchQuery.openSingleEntry = (this.pvSearchQuery.openSingleEntry || '').toLowerCase() === 'true';
    this.data.searchEnabled = this.querySearch;
  } else {
    this.querySearch = null;
  }

  this.pvFilterQuery = _.pickBy({
    column: Fliplet.Navigate.query['dynamicListFilterColumn'],
    value: Fliplet.Navigate.query['dynamicListFilterValue'],
    hideControls: Fliplet.Navigate.query['dynamicListFilterHideControls']
  });
  this.queryFilter = !_.isUndefined(_.get(this.pvFilterQuery, 'value'));

  if (this.queryFilter) {
    // check if a comma separated list of columns/values were passed as column/value
    this.pvFilterQuery.column = splitQueryValues(this.pvFilterQuery.column) || [];
    this.pvFilterQuery.value = splitQueryValues(this.pvFilterQuery.value) || [];

    if (!_.isEmpty(this.pvFilterQuery.column) && !_.isEmpty(this.pvFilterQuery.value)
      && this.pvFilterQuery.column.length !== this.pvFilterQuery.value.length) {
      this.pvFilterQuery.column = undefined;
      this.pvFilterQuery.value = undefined;
      this.queryFilter = false;
      console.warn('Please supply an equal number of parameter to the dynamicListFilterColumn and dynamicListFilterValue.');
    }

    // cast to boolean
    this.pvFilterQuery.hideControls = (this.pvFilterQuery.hideControls || '').toLowerCase() === 'true';
    this.data.filtersEnabled = this.queryFilter;
  } else {
    this.queryFilter = null;
  }

  return this.previousScreen
    || this.queryGoBack
    || this.queryPreFilter
    || this.queryOpen
    || this.querySearch
    || this.queryFilter;
});
