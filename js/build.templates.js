this["Fliplet"] = this["Fliplet"] || {};
this["Fliplet"]["Widget"] = this["Fliplet"]["Widget"] || {};
this["Fliplet"]["Widget"]["Templates"] = this["Fliplet"]["Widget"]["Templates"] || {};

this["Fliplet"]["Widget"]["Templates"]["templates.build.cards-desc-base"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"fl-feed-list\">\n  <div id=\"contentArea\" class=\"fl-card-holder clusterize-content\">\n    <!-- Cards will be appended here -->\n  </div>\n  <!-- Loading -->\n  <div class=\"offline-holder\">\n    <i class=\"fa fa-exclamation-triangle\"></i> Hmm... no connection\n  </div>\n  <div class=\"loading-holder\">\n    <i class=\"fa fa-circle-o-notch fa-spin\"></i> Loading...\n  </div>\n</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.build.cards-desc-loop"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "{{#each this}}\n  <div class=\"fl-card mix {{data.[categoryClass]}}\" data-id=\"{{id}}\">\n    <div class=\"fl-card-content\">\n      <section class=\"slide-under\">\n        <div class=\"banner\" data-height=\"20vh\" data-height-expanded=\"45vh\" style=\"height: 20vh; background-image: url('{{data.[thumbnail]}}');\"></div>\n      </section>\n      <div class=\"container-fluid slide-over\">\n        <div class=\"inner-content\" data-position=\"20vh\" data-position-expanded=\"40vh\" style=\"top: 20vh\">\n          <h2 class=\"title\">{{data.[title]}}</h2>\n          <div class=\"description\">\n            {{{data.[content]}}}\n          </div>\n        </div>\n      </div>\n      <div class=\"close-btn-wrapper\">\n      <div class=\"close-btn\"><i class=\"fa fa-times\"></i></div>\n      </div>\n    </div>\n  </div>\n  {{/each}}";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.build.small-card-base"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"content-section\">\n  {{#ifCond searchEnabled '||' filtersEnabled}}\n  <div class=\"section-label-wrapper\">\n    <div class=\"directory-search-icon\">\n      <div class=\"directory-search-cancel\"><span class=\"fa fa-times\"></span></div>\n      {{#ifCond searchEnabled '&&' filtersEnabled}}\n      <i class=\"fa fa-search\"></i>\n      {{else}}\n        {{#if searchEnabled}}\n        <i class=\"fa fa-search\"></i>\n        {{/if}}\n        {{#if filtersEnabled}}\n        <i class=\"fa fa-filter\"></i>\n        {{/if}}\n      {{/ifCond}}\n    </div>\n  </div>\n  <div class=\"hidden-filter-controls\">\n    <div class=\"hidden-filter-controls-content\">\n      {{#if searchEnabled}}\n      <div class=\"hidden-filter-controls-search\">\n        <div class=\"search-holder\">\n          <i class=\"fa fa-search\"></i>\n          <input type=\"search\" name=\"search-feed\" class=\"form-control search-feed\" placeholder=\"Search...\">\n        </div>\n        <div class=\"search-query-holder\">\n          <div class=\"search-query\">\n          Searching for: <span class=\"current-query-wrapper\"><span class=\"current-query\"></span><span class=\"clear-search\"><i class=\"fa fa-times\"></i></span></span>\n          </div>\n        </div>\n      </div>\n      {{/if}}\n      {{#if filtersEnabled}}\n      <div class=\"filter-holder\">\n        <!-- Filters here -->\n      </div>\n      {{/if}}\n    </div>\n  </div>\n  {{/ifCond}}\n  <div class=\"directory-longlist-wrapper\" id=\"directory-longlist-wrapper-{{id}}\">\n      <!-- Longlist content will appear here -->\n  </div>\n  <div class=\"loading-data\">\n    <i class=\"fa fa-circle-o-notch fa-spin\"></i> Loading...\n  </div>\n</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.build.small-card-filters"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "{{#each this}}\n<div class=\"hidden-filter-controls-label\">Filter by <span>{{[name]}}</span></div>\n<div class=\"hidden-filter-controls-filter-container\">\n  <div class=\"hidden-filter-controls-filter-wrapper\">\n    <fieldset data-filter-group>\n      {{#each [data]}}\n      <div class=\"btn hidden-filter-controls-filter\" data-toggle=\"{{[class]}}\">{{[name]}}</div>\n      {{/each}}\n    </fieldset>\n  </div>\n</div>\n{{/each}}";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.build.small-card-loop"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "{{#each this}}\n  <div class=\"longlist-item {{data.[classes]}}\">\n    <div class=\"longlist-image\">\n      <div class=\"directory-detail-wrapper\" data-entry-id=\"{{id}}\">\n        <div class=\"directory-detail-image-wrapper\">\n          <div class=\"directory-detail-image\" style=\"background-image: url('{{data.[Image]}}')\"></div>\n          <i class=\"fa fa-user\"></i>\n        </div>\n        \n        <!-- Detail view -->\n        <div class=\"directory-detail-close-btn\"><i class=\"fa fa-times\"></i></div>\n        <div class=\"directory-detail-content-scroll-wrapper\">\n          <div class=\"directory-detail-content-wrapper\">\n            <div class=\"directory-detail-name\">{{data.[First Name]}} {{data.[Last Name]}}</div>\n            <div class=\"directory-detail-role\">{{data.[Title]}}</div>\n            <div class=\"directory-detail-location\">{{data.[Location]}}</div>\n            {{#unless isCurrentUser}}\n            <div class=\"directory-detail-buttons-wrapper\">\n              <div class=\"directory-detail-button\">\n                <div class=\"send-message\">\n                  <div class=\"directory-detail-button-image\"><span class=\"icon-message\"></span></div>\n                  <div class=\"directory-detail-button-text\">MESSAGE</div>\n                </div>\n              </div>\n              {{#if data.[Email]}}\n              <div class=\"directory-detail-button\">\n                <a href=\"mailto:{{data.[Email]}}\" target=\"_blank\">\n                  <div class=\"directory-detail-button-image\"><span class=\"icon-email\"></span></div>\n                  <div class=\"directory-detail-button-text\">EMAIL</div>\n                </a>\n              </div>\n              {{/if}}\n              {{#if data.[Telephone]}}\n              <div class=\"directory-detail-button\">\n                <a href=\"tel:{{data.[Telephone]}}\" target=\"_blank\">\n                  <div class=\"directory-detail-button-image\"><span class=\"icon-call\"></span></div>\n                  <div class=\"directory-detail-button-text\">CALL</div>\n                </a>\n              </div>\n              {{/if}}\n              {{#if data.[Linkedin]}}\n              <div class=\"directory-detail-button\">\n                <a href=\"{{data.[Linkedin]}}\" target=\"_blank\">\n                  <div class=\"directory-detail-button-image\"><span class=\"icon-linkedin\"></span></div>\n                  <div class=\"directory-detail-button-text\">LINKEDIN</div>\n                </a>\n              </div>\n              {{/if}}\n            </div>\n            {{/unless}}\n            <div class=\"directory-detail-label\">Bio</div>\n            <div class=\"directory-detail-body-text\">\n              Bio would go here....\n            </div>\n            <div class=\"directory-detail-label\">Sector</div>\n            <div class=\"directory-detail-body-text\">{{data.[Sectors]}}</div>\n            <div class=\"directory-detail-label\">Workflows</div>\n            <div class=\"directory-detail-body-text\">{{data.[Workstreams]}}</div>\n            <div class=\"directory-detail-label\">Telephone</div>\n            <div class=\"directory-detail-body-text\">{{data.[Telephone]}}</div>\n            <div class=\"directory-detail-label\">Email</div>\n            <div class=\"directory-detail-body-text\">{{data.[Email]}}</div>\n          </div>\n        </div>\n        <!-- End of detail view -->\n\n      </div>\n    </div>\n    <div class=\"longlist-text-wrapper\">\n      <div class=\"longlist-name\">{{data.[First Name]}} {{data.[Last Name]}}</div>\n      <div class=\"longlist-role\">{{data.[Title]}}</div>\n      <div class=\"longlist-location\">{{data.[Location]}}</div>\n    </div>\n  </div>\n  {{/each}}";
},"useData":true});