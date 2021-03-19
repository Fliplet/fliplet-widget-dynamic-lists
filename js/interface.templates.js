this["Fliplet"] = this["Fliplet"] || {};
this["Fliplet"]["Widget"] = this["Fliplet"]["Widget"] || {};
this["Fliplet"]["Widget"]["Templates"] = this["Fliplet"]["Widget"]["Templates"] || {};

this["Fliplet"]["Widget"]["Templates"]["templates.interface.detail-view-panels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    return "editable";
},"3":function(container,depth0,helpers,partials,data) {
    return "no-editable";
},"5":function(container,depth0,helpers,partials,data) {
    return "  <div class=\"reorder-handle\">\r\n    <i class=\"fa fa-ellipsis-v\"></i><i class=\"fa fa-ellipsis-v\"></i>\r\n  </div>\r\n";
},"7":function(container,depth0,helpers,partials,data) {
    return "  <div class=\"reorder-handle-placeholder\">\r\n    <i class=\"fa fa-ellipsis-v\"></i><i class=\"fa fa-ellipsis-v\"></i>\r\n  </div>\r\n";
},"9":function(container,depth0,helpers,partials,data) {
    var helper;

  return container.escapeExpression(((helper = (helper = helpers.helper || (depth0 != null ? depth0.helper : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"helper","hash":{},"data":data}) : helper)));
},"11":function(container,depth0,helpers,partials,data) {
    return "Data field";
},"13":function(container,depth0,helpers,partials,data) {
    var alias1=container.lambda, alias2=container.escapeExpression;

  return "        <option value=\""
    + alias2(alias1(depth0, depth0))
    + "\">"
    + alias2(alias1(depth0, depth0))
    + "</option>\r\n";
},"15":function(container,depth0,helpers,partials,data) {
    return "disabled";
},"17":function(container,depth0,helpers,partials,data) {
    return "    <div class=\"rTableCell title delete\">\r\n      <i class=\"fa fa-trash-o\"></i>\r\n    </div>\r\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<div class=\"rTableRow clearfix "
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.editable : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data})) != null ? stack1 : "")
    + "\" data-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n"
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.editable : depth0),{"name":"if","hash":{},"fn":container.program(5, data, 0),"inverse":container.program(7, data, 0),"data":data})) != null ? stack1 : "")
    + "  <div class=\"original-row clearfix\">\r\n    <div class=\"rTableCell title\">\r\n      "
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.helper : depth0),{"name":"if","hash":{},"fn":container.program(9, data, 0),"inverse":container.program(11, data, 0),"data":data})) != null ? stack1 : "")
    + "\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <select name=\"detail_select_field\" id=\"detail_select_field_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"form-control\">\r\n        <option value=\"none\">-- Select a data field</option>\r\n        <option disabled>------</option>\r\n        <option value=\"custom\">Custom</option>\r\n        <option disabled>------</option>\r\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.columns : depth0),{"name":"each","hash":{},"fn":container.program(13, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "      </select>\r\n    </div>\r\n    <div class=\"rTableCell select type\">\r\n      <select name=\"detail_field_type\" id=\"detail_select_type_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"form-control\" "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.editable : depth0),{"name":"unless","hash":{},"fn":container.program(15, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + ">\r\n        <option value=\"image\">Image</option>\r\n        <option value=\"text\" selected>Plain text</option>\r\n        <option value=\"html\">HTML</option>\r\n        <option value=\"url\">URL</option>\r\n        <option value=\"tel\">Telephone</option>\r\n        <option value=\"mail\">Email</option>\r\n        <option value=\"date\">Date (e.g. "
    + alias4(((helper = (helper = helpers.date || (depth0 != null ? depth0.date : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"date","hash":{},"data":data}) : helper)))
    + ")</option>\r\n        <option value=\"file\">File</option>\r\n      </select>\r\n    </div>\r\n    <div class=\"rTableCell select type\">\r\n      <select name=\"select_field_label\" id=\"detail_select_label_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"form-control\" "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.editable : depth0),{"name":"unless","hash":{},"fn":container.program(15, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + ">\r\n        <option value=\"column-name\">Column name as label</option>\r\n        <option value=\"custom-label\">Custom label</option>\r\n        <option value=\"no-label\">No label</option>\r\n      </select>\r\n    </div>\r\n"
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.editable : depth0),{"name":"if","hash":{},"fn":container.program(17, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "  </div>\r\n  <div class=\"custom-field-input clearfix hidden\">\r\n    <div class=\"rTableCell title text-right\">\r\n      <small>Custom field</small>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <input type=\"text\" class=\"form-control\" id=\"detail_custom_field_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <p class=\"text-muted field-text-info\">Use <code>{{[*]}}</code> to wrap around a field name, e.g. <code>{{[city]}}, {{[country]}}</code>.</p>\r\n    </div>\r\n  </div>\r\n  <div class=\"image-type-select clearfix hidden\">\r\n    <div class=\"rTableCell title flex-right\"><small>Data type</small></div>\r\n    <div class=\"rTableCell select field\">\r\n      <select class=\"form-control\" id=\"detail_image_field_type_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" name=\"image_type_select\" data-current-id="
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + ">\r\n        <option value=\"all-folders\">Image folder</option>\r\n        <option value=\"url\" selected>URL to external image</option>\r\n      </select>\r\n    </div>\r\n    <div class=\"rTableCell select field picker-provider-button hidden\" data-field-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"btn btn-default file-picker-btn\" data-file-picker-details>Select a folder</div>\r\n      <div class=\"selected-folder hidden\">Selected folder: <span></span></div>\r\n      <div class=\"text-danger error-message hidden\" data-submission-error><span>Please select a folder to continue</span></div>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <p class=\"text-muted field-text-info folders-only\">In the list data use the file name only (e.g. <code>image</code> or <code>image.jpg</code>)</p>\r\n      <p class=\"text-muted field-text-info url-only hidden\">In the list data use a URL (e.g. <code>http://fliplet.com/image.jpg</code>)</p>\r\n    </div>\r\n  </div>\r\n  <div class=\"custom-label-input clearfix hidden\">\r\n    <div class=\"rTableCell title text-right\">\r\n      <small>Custom label</small>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <input type=\"text\" class=\"form-control\" id=\"detail_custom_field_name_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n    </div>\r\n  </div>\r\n</div>\r\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.interface.field-token"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<input class=\"tokenfield\" type=\"text\" name=\""
    + alias4(((helper = (helper = helpers.name || (depth0 != null ? depth0.name : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data}) : helper)))
    + "\" id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" value=\""
    + alias4(((helper = (helper = helpers.value || (depth0 != null ? depth0.value : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"value","hash":{},"data":data}) : helper)))
    + "\" placeholder=\"Type field name and hit enter\" />";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.interface.filter-panels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    return "down";
},"3":function(container,depth0,helpers,partials,data) {
    return "up";
},"5":function(container,depth0,helpers,partials,data) {
    return "in";
},"7":function(container,depth0,helpers,partials,data) {
    var alias1=container.lambda, alias2=container.escapeExpression;

  return "              <option value=\""
    + alias2(alias1(depth0, depth0))
    + "\">"
    + alias2(alias1(depth0, depth0))
    + "</option>\r\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<div class=\"panel panel-default filter-panel\" data-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n  <div class=\"panel-heading ui-sortable-handle\">\r\n    <h4 class=\"panel-title\" data-toggle=\"collapse\" data-parent=\"#filter-accordion\" data-target=\"#collapse-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"screen-reorder-handle\">\r\n        <i class=\"fa fa-ellipsis-v\"></i><i class=\"fa fa-ellipsis-v\"></i>\r\n      </div>\r\n      <span class=\"panel-title-text\">\r\n        <span class=\"column\">"
    + alias4(((helper = (helper = helpers.columnLabel || (depth0 != null ? depth0.columnLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"columnLabel","hash":{},"data":data}) : helper)))
    + "</span>\r\n      </span>\r\n      <span class=\"fa fa-chevron-"
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.fromLoading : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data})) != null ? stack1 : "")
    + " panel-chevron\"></span>\r\n    </h4>\r\n    <a href=\"#\"><span class=\"icon-delete fa fa-trash\"></span></a>\r\n  </div>\r\n  <div id=\"collapse-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"panel-collapse collapse "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.fromLoading : depth0),{"name":"unless","hash":{},"fn":container.program(5, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "\">\r\n    <div class=\"panel-body\">\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Data field</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"field\" data-label=\"-- Select a data field\" class=\"hidden-select form-control\">\r\n              <option value=\"none\">-- Select a data field</option>\r\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.columns : depth0),{"name":"each","hash":{},"fn":container.program(7, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n            <span class=\"select-value-proxy\">-- Please wait</span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Logic</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"logic-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"logic-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"logic-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" filter-item-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"logic\" data-label=\"-- Select an option\" class=\"hidden-select form-control\">\r\n              <optgroup>\r\n                <option value=\"empty\">Is empty</option>\r\n                <option value=\"notempty\">Is not empty</option>\r\n                <option value=\"==\" selected>Equals</option>\r\n                <option value=\"!=\">Doesn't equal</option>\r\n                <option value=\"oneof\">Is one of</option>\r\n              </optgroup>\r\n              <optgroup label=\"Text\">\r\n                <option value=\"contains\">Text contains</option>\r\n                <option value=\"notcontain\">Text doesn't contain</option>\r\n                <option value=\"regex\">Text matches regex</option>\r\n              </optgroup>\r\n              <optgroup label=\"Number\">\r\n                <option value=\">\">Is greater than</option>\r\n                <option value=\">=\">Is greater or equal to</option>\r\n                <option value=\"<\">Is less than</option>\r\n                <option value=\"<=\">Is less or equal to</option>\r\n                <option value=\"between\">Is between</option>\r\n              </optgroup>\r\n              <optgroup label=\"Date\">\r\n                <option value=\"dateis\">Date is</option>\r\n                <option value=\"datebefore\">Date is before</option>\r\n                <option value=\"dateafter\">Date is after</option>\r\n                <option value=\"datebetween\">Date is between</option>\r\n              </optgroup>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div id=\"date-logic-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n        <div class=\"form-group clearfix\">\r\n          <div class=\"col-sm-4 control-label\">\r\n            <label>Date</label>\r\n          </div>\r\n          <div class=\"col-sm-8\">\r\n            <label for=\"date-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n              <select name=\"date-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"date-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"date\" filter-item-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"hidden-select form-control\">\r\n                <optgroup>\r\n                  <option value=\"today\">Current date (Today)</option>\r\n                  <option value=\"now\">Current date &amp; time (Now)</option>\r\n                </optgroup>\r\n                <optgroup label=\"&mdash;\">\r\n                  <option value=\"nowaddminutes\">Now + number of minutes</option>\r\n                  <option value=\"nowaddhours\">Now + number of hours</option>\r\n                  <option value=\"todayadddays\">Today + number of days</option>\r\n                  <option value=\"todayaddmonths\">Today + number of months</option>\r\n                  <option value=\"todayaddyears\">Today + number of years</option>\r\n                </optgroup>\r\n                <optgroup label=\"&mdash;\">\r\n                  <option value=\"nowsubtractminutes\">Now - number of minutes</option>\r\n                  <option value=\"nowsubtracthours\">Now - number of hours</option>\r\n                  <option value=\"todayminusdays\">Today - number of days</option>\r\n                  <option value=\"todayminusmonths\">Today - number of months</option>\r\n                  <option value=\"todayminusyears\">Today - number of years</option>\r\n                </optgroup>\r\n              </select>\r\n              <span class=\"icon fa fa-chevron-down\"></span>\r\n            </label>\r\n            <div class=\"checkbox checkbox-icon hidden\">\r\n              <input type=\"checkbox\" id=\"enable-timezone-default-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n              <label for=\"enable-timezone-default-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n                <span class=\"check\"><i class=\"fa fa-check\"></i></span> Compare using device timezone\r\n              </label>\r\n            </div>\r\n          </div>\r\n        </div>\r\n\r\n        <div class=\"form-group clearfix hidden\" id=\"date-number-default-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n          <div class=\"col-sm-4 control-label\">\r\n            <label for=\"number-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Number</label>\r\n          </div>\r\n          <div class=\"col-sm-8\">\r\n            <input type=\"text\" placeholder=\"Enter positive integer\" name=\"number-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"number-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"number\" class=\"form-control\">\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\" id=\"filter-value-type-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Value type</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"valueType\" filter-item-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"hidden-select form-control\">\r\n              <option value=\"enter-value\">Enter a value</option>\r\n              <option value=\"user-profile-data\">User profile data</option>\r\n              <option value=\"link-query-parameter\">Link query parameter</option>\r\n              <option value=\"app-storage-data\">App storage data</option>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\" id=\"filter-value-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label for=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Value</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <input type=\"text\" name=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"value\" class=\"form-control\">\r\n        </div>\r\n      </div>\r\n    </div>\r\n\r\n    <div id=\"logic-comparison-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Value type (from)</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-type-field-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"valueType\" class=\"hidden-select form-control\">\r\n              <option value=\"enter-value\">Enter a value</option>\r\n              <option value=\"user-profile-data\">User profile data</option>\r\n              <option value=\"link-query-parameter\">Link query parameter</option>\r\n              <option value=\"app-storage-data\">App storage data</option>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label for=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Value (from)</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <input type=\"text\" name=\"value-field-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-field-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"value\" class=\"form-control\">\r\n        </div>\r\n      </div>\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Value type (to)</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"value-type-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-type-field-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"valueType\" class=\"hidden-select form-control\">\r\n              <option value=\"enter-value\">Enter a value</option>\r\n              <option value=\"user-profile-data\">User profile data</option>\r\n              <option value=\"link-query-parameter\">Link query parameter</option>\r\n              <option value=\"app-storage-data\">App storage data</option>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label for=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Value (to)</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <input type=\"text\" name=\"value-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"value-field-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"value\" class=\"form-control\">\r\n        </div>\r\n      </div>\r\n\r\n    </div>\r\n\r\n    <div id=\"date-between-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>From date</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"date-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"date-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"date-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"date-from\" filter-item-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"hidden-select form-control\">\r\n              <optgroup>\r\n                <option value=\"today\">Current date (Today)</option>\r\n                <option value=\"now\">Current date &amp; time (Now)</option>\r\n              </optgroup>\r\n              <optgroup label=\"&mdash;\">\r\n                <option value=\"nowaddminutes\">Now + number of minutes</option>\r\n                <option value=\"nowaddhours\">Now + number of hours</option>\r\n                <option value=\"todayadddays\">Today + number of days</option>\r\n                <option value=\"todayaddmonths\">Today + number of months</option>\r\n                <option value=\"todayaddyears\">Today + number of years</option>\r\n              </optgroup>\r\n              <optgroup label=\"&mdash;\">\r\n                <option value=\"nowsubtractminutes\">Now - number of minutes</option>\r\n                <option value=\"nowsubtracthours\">Now - number of hours</option>\r\n                <option value=\"todayminusdays\">Today - number of days</option>\r\n                <option value=\"todayminusmonths\">Today - number of months</option>\r\n                <option value=\"todayminusyears\">Today - number of years</option>\r\n              </optgroup>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n          <div class=\"checkbox checkbox-icon hidden\">\r\n            <input type=\"checkbox\" id=\"enable-timezone-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n            <label for=\"enable-timezone-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n              <span class=\"check\"><i class=\"fa fa-check\"></i></span> Compare using device timezone\r\n            </label>\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix hidden\" id=\"date-number-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label for=\"number-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Number</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <input type=\"text\" placeholder=\"Enter positive integer\" name=\"number-field-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"number-field-from-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"number\" class=\"form-control\">\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>To date</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"date-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"date-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"date-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"date-to\" filter-item-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"hidden-select form-control\">\r\n              <optgroup>\r\n                <option value=\"today\">Current date (Today)</option>\r\n                <option value=\"now\">Current date &amp; time (Now)</option>\r\n              </optgroup>\r\n              <optgroup label=\"&mdash;\">\r\n                <option value=\"nowaddminutes\">Now + number of minutes</option>\r\n                <option value=\"nowaddhours\">Now + number of hours</option>\r\n                <option value=\"todayadddays\">Today + number of days</option>\r\n                <option value=\"todayaddmonths\">Today + number of months</option>\r\n                <option value=\"todayaddyears\">Today + number of years</option>\r\n              </optgroup>\r\n              <optgroup label=\"&mdash;\">\r\n                <option value=\"nowsubtractminutes\">Now - number of minutes</option>\r\n                <option value=\"nowsubtracthours\">Now - number of hours</option>\r\n                <option value=\"todayminusdays\">Today - number of days</option>\r\n                <option value=\"todayminusmonths\">Today - number of months</option>\r\n                <option value=\"todayminusyears\">Today - number of years</option>\r\n              </optgroup>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n          </label>\r\n          <div class=\"checkbox checkbox-icon hidden\">\r\n            <input type=\"checkbox\" id=\"enable-timezone-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n            <label for=\"enable-timezone-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n              <span class=\"check\"><i class=\"fa fa-check\"></i></span> Compare using device timezone\r\n            </label>\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix hidden\" id=\"date-number-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label for=\"number-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">Number</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <input type=\"text\" placeholder=\"Enter positive integer\" name=\"number-field-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"number-field-to-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"number\" class=\"form-control\">\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.interface.layouts"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "  <div class=\"layout-holder\" data-layout=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n    <div class=\"layout-info\">\r\n      <p class=\"title\">"
    + alias4(((helper = (helper = helpers.name || (depth0 != null ? depth0.name : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data}) : helper)))
    + " "
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.warning : depth0),{"name":"if","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</p>\r\n      <p class=\"description\">"
    + alias4(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"description","hash":{},"data":data}) : helper)))
    + "</p>\r\n    </div>\r\n    <div class=\"image-holder\">\r\n      <div class=\"selected-screen\">\r\n        <i class=\"fa fa-check-circle\"></i>\r\n        <div class=\"layout-info\">\r\n          \r\n        </div>\r\n      </div>\r\n      <img class=\"animated-gif\" src=\""
    + alias4(((helper = (helper = helpers.gif || (depth0 != null ? depth0.gif : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"gif","hash":{},"data":data}) : helper)))
    + "\" />\r\n      <img class=\"static-img\" src=\""
    + alias4(((helper = (helper = helpers.image || (depth0 != null ? depth0.image : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"image","hash":{},"data":data}) : helper)))
    + "\" />\r\n    </div>\r\n  </div>\r\n";
},"2":function(container,depth0,helpers,partials,data) {
    var helper;

  return "<span class=\"label label-warning\">"
    + container.escapeExpression(((helper = (helper = helpers.warning || (depth0 != null ? depth0.warning : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"warning","hash":{},"data":data}) : helper)))
    + "</span>";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers.each.call(depth0 != null ? depth0 : (container.nullContext || {}),depth0,{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "");
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.interface.sort-panels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    return "down";
},"3":function(container,depth0,helpers,partials,data) {
    return "up";
},"5":function(container,depth0,helpers,partials,data) {
    return "in";
},"7":function(container,depth0,helpers,partials,data) {
    var alias1=container.lambda, alias2=container.escapeExpression;

  return "              <option value=\""
    + alias2(alias1(depth0, depth0))
    + "\">"
    + alias2(alias1(depth0, depth0))
    + "</option>\r\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<div class=\"panel panel-default sort-panel\" data-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n  <div class=\"panel-heading ui-sortable-handle\">\r\n    <h4 class=\"panel-title\" data-toggle=\"collapse\" data-parent=\"#sort-accordion\" data-target=\"#collapse-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"screen-reorder-handle\">\r\n        <i class=\"fa fa-ellipsis-v\"></i><i class=\"fa fa-ellipsis-v\"></i>\r\n      </div>\r\n      <span class=\"panel-title-text\">\r\n        <span class=\"column\">"
    + alias4(((helper = (helper = helpers.columnLabel || (depth0 != null ? depth0.columnLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"columnLabel","hash":{},"data":data}) : helper)))
    + "</span> - <span class=\"sort-by\">"
    + alias4(((helper = (helper = helpers.sortByLabel || (depth0 != null ? depth0.sortByLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"sortByLabel","hash":{},"data":data}) : helper)))
    + "</span> - <span class=\"order-by\">"
    + alias4(((helper = (helper = helpers.orderByLabel || (depth0 != null ? depth0.orderByLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"orderByLabel","hash":{},"data":data}) : helper)))
    + "</span>\r\n      </span>\r\n      <span class=\"fa fa-chevron-"
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.fromLoading : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data})) != null ? stack1 : "")
    + " panel-chevron\"></span>\r\n    </h4>\r\n    <a href=\"#\"><span class=\"icon-delete fa fa-trash\"></span></a>\r\n  </div>\r\n  <div id=\"collapse-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"panel-collapse collapse "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.fromLoading : depth0),{"name":"unless","hash":{},"fn":container.program(5, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "\">\r\n    <div class=\"panel-body\">\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Data field name</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"select-data-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"field\" data-label=\"-- Select a data field\" class=\"hidden-select form-control\">\r\n              <option value=\"none\">-- Select a data field</option>\r\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.columns : depth0),{"name":"each","hash":{},"fn":container.program(7, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n            <span class=\"select-value-proxy\">-- Please wait</span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Sort by</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"sort-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"sort-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"sort-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"sort\" data-label=\"-- Select an option\" class=\"hidden-select form-control\">\r\n              <option value=\"none\">-- Select an option</option>\r\n              <option value=\"alphabetical\">Alphabetical (A-Z)</option>\r\n              <option value=\"numerical\">Numerical (0-9)</option>\r\n              <option value=\"date\">Date (YYYY-MM-DD)</option>\r\n              <option value=\"time\">Time (HH:MM)</option>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n            <span class=\"select-value-proxy\">-- Please wait</span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"form-group clearfix\">\r\n        <div class=\"col-sm-4 control-label\">\r\n          <label>Order by</label>\r\n        </div>\r\n        <div class=\"col-sm-8\">\r\n          <label for=\"order-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"select-proxy-display\">\r\n            <select name=\"order-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" id=\"order-by-field-"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" data-field=\"order\" data-label=\"-- Select an option\" class=\"hidden-select form-control\">\r\n              <option value=\"none\">-- Select an option</option>\r\n              <option value=\"ascending\">Ascending</option>\r\n              <option value=\"descending\">Descending</option>\r\n            </select>\r\n            <span class=\"icon fa fa-chevron-down\"></span>\r\n            <span class=\"select-value-proxy\">-- Please wait</span>\r\n          </label>\r\n        </div>\r\n      </div>\r\n\r\n    </div>\r\n  </div>\r\n</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.interface.summary-view-panels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var alias1=container.lambda, alias2=container.escapeExpression;

  return "        <option value=\""
    + alias2(alias1(depth0, depth0))
    + "\">"
    + alias2(alias1(depth0, depth0))
    + "</option>\r\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<div class=\"rTableRow clearfix\" data-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n  <div class=\"original-row clearfix\">\r\n    <div class=\"rTableCell title\">\r\n      "
    + alias4(((helper = (helper = helpers.interfaceName || (depth0 != null ? depth0.interfaceName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"interfaceName","hash":{},"data":data}) : helper)))
    + "\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <select name=\"summary_select_field\" id=\"summary_select_field_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"form-control\">\r\n        <option value=\"none\">-- Select a data field</option>\r\n        <option disabled>------</option>\r\n        <option value=\"empty\">None</option>\r\n        <option value=\"custom\">Custom</option>\r\n        <option disabled>------</option>\r\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.columns : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "      </select>\r\n    </div>\r\n    <div class=\"rTableCell select type\">\r\n      <select name=\"summary_field_type\" id=\"summary_select_type_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" class=\"form-control disabled\" disabled>\r\n        <option value=\"none\">-- Select a type</option>\r\n        <option disabled>------</option>\r\n        <option value=\"image\">Image</option>\r\n        <option value=\"text\">Plain text</option>\r\n        <option value=\"html\">HTML</option>\r\n        <option value=\"url\">URL</option>\r\n        <option value=\"tel\">Telephone</option>\r\n        <option value=\"mail\">Email</option>\r\n        <option value=\"date\">Date (e.g. "
    + alias4(((helper = (helper = helpers.date || (depth0 != null ? depth0.date : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"date","hash":{},"data":data}) : helper)))
    + ")</option>\r\n        <option value=\"time\">Time (e.g. "
    + alias4(((helper = (helper = helpers.time || (depth0 != null ? depth0.time : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"time","hash":{},"data":data}) : helper)))
    + ")</option>\r\n      </select>\r\n    </div>\r\n  </div>\r\n  <div class=\"custom-field-input clearfix hidden\">\r\n    <div class=\"rTableCell title text-right\">\r\n      <small>Custom field</small>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <input type=\"text\" class=\"form-control\" id=\"summary_custom_field_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <p class=\"text-muted field-text-info\">Use <code>{{[*]}}</code> to wrap around a field name, e.g. <code>{{[city]}}, {{[country]}}</code>.</p>\r\n    </div>\r\n  </div>\r\n  <div class=\"image-type-select clearfix hidden\">\r\n    <div class=\"rTableCell title flex-right\">\r\n      <small>Data type</small>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <select class=\"form-control\" id=\"summary_image_field_type_"
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\" name=\"image_type_select\" data-current-id="
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + ">\r\n        <option value=\"all-folders\">Image folder</option>\r\n        <option value=\"url\">URL to external image</option>\r\n      </select>\r\n    </div>\r\n    <div class=\"rTableCell select field picker-provider-button hidden\" data-field-id=\""
    + alias4(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data}) : helper)))
    + "\">\r\n      <div class=\"btn btn-default file-picker-btn\" data-file-picker-summary>Select a folder</div>\r\n      <div class=\"selected-folder hidden\">Selected folder: <span></span></div>\r\n      <div class=\"text-danger error-message hidden\" data-submission-error><span>Please select a folder to continue</span></div>\r\n    </div>\r\n    <div class=\"rTableCell select field\">\r\n      <p class=\"text-muted field-text-info folders-only\">In the list data use the file name only (e.g. <code>image</code> or <code>image.jpg</code>)</p>\r\n      <p class=\"text-muted field-text-info url-only hidden\">In the list data use a URL (e.g. <code>http://fliplet.com/image.jpg</code>)</p>\r\n    </div>\r\n  </div>\r\n</div>\r\n";
},"useData":true});