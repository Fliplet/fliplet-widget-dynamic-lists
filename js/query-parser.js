/**
 * this basically gets data out of the url as an INPUT,
 * parses it, and as an OUTPUT sets all the required variables used by LFD
 * for prepopulating, prefiltering and opening an entry
 */
Fliplet.Registry.set('dynamicListQueryParser', function() {
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
		var prefilterColumnParts = this.pvPreFilterQuery.column ? this.pvPreFilterQuery.column.split(',') : [];
		var prefilterLogicParts = this.pvPreFilterQuery.logic ? this.pvPreFilterQuery.logic.split(',') : [];
		var prefilterValueParts = this.pvPreFilterQuery.value ? this.pvPreFilterQuery.value.split(',') : [];

		if (
			prefilterColumnParts.length !== prefilterLogicParts.length ||
			prefilterLogicParts.length !== prefilterValueParts.length
		) {
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
		value: Fliplet.Navigate.query['dynamicListSearchValue']
	});
	this.querySearch = _(this.pvSearchQuery).size() > 0;
	if (this.querySearch) {
		// check if a comma separated list of columns were passed as column
		var searchColumns = this.pvSearchQuery.column ? this.pvSearchQuery.column.split(',') : null;
		this.pvSearchQuery.column = searchColumns && searchColumns.length ? searchColumns : this.pvSearchQuery.column;
		this.data.searchEnabled = this.querySearch;
	} else {
		this.querySearch = null;
	}

	this.pvFilterQuery = _.pickBy({
		value: Fliplet.Navigate.query['dynamicListFilterValue'],
		hideControls: Fliplet.Navigate.query['dynamicListFilterHideControls']
	});
	this.queryFilter = _(this.pvFilterQuery).size() > 0;
	if (this.queryFilter) {
		// check if a comma separated list of columns were passed as column
		var filterValues = this.pvFilterQuery.value ? this.pvFilterQuery.value.split(',') : null;
		this.pvFilterQuery.value = filterValues && filterValues.length ? filterValues : this.pvFilterQuery.column;

		// cast to boolean
		this.pvFilterQuery.hideControls = this.pvFilterQuery.hideControls === 'true';
		this.data.filtersEnabled = this.queryFilter;
	} else {
		this.queryFilter = null;
	}
	return (
		this.previousScreen ||
		this.queryGoBack ||
		this.queryPreFilter ||
		this.queryOpen ||
		this.querySearch ||
		this.queryFilter
	);
});
