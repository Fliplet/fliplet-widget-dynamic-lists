# Template Documentation - Dynamic Lists Widget

## Overview
The Dynamic Lists widget uses Handlebars templating system to render both the configuration interface and the runtime display. Templates are organized by purpose and layout type.

## Template Categories

### 1. Interface Templates (`templates/interface/`)
Used for the widget configuration interface in Fliplet Studio.

#### `layouts.interface.hbs`
Renders the layout selection grid showing available layout options.

**Context Variables:**
- `id`: Layout identifier
- `name`: Display name 
- `description`: Layout description
- `warning`: Optional warning message
- `gif`: Animated preview image URL
- `image`: Static preview image URL

#### `filter-panels.interface.hbs`
Creates filter configuration panels in the interface.

#### `sort-panels.interface.hbs`
Creates sort configuration panels in the interface.

#### `summary-view-panels.interface.hbs`
Configures which data fields appear in the summary/list view.

#### `detail-view-panels.interface.hbs`
Configures which data fields appear in the detail view.

#### `field-token.interface.hbs`
Renders individual field tokens for drag-and-drop configuration.

### 2. Build Templates (`templates/build/`)
Used for runtime rendering of the widget content.

#### Base Templates (`[layout]-base.build.hbs`)
Main structure template for each layout containing:
- Container wrapper
- Search interface
- Filter controls
- Sort controls
- Loading states
- Error states
- Detail view overlay
- Social interaction panels

**Example Structure (simple-list-base.build.hbs):**
```handlebars
<div class="simple-list-container loading">
  <!-- Search and Filter Controls -->
  {{#if searchEnabled}}
    <!-- Search input and controls -->
  {{/if}}
  
  <!-- Main content wrapper -->
  <div class="simple-list-wrapper" id="simple-list-wrapper-{{id}}" role="list">
    <!-- List items will appear here -->
  </div>
  
  <!-- Detail view overlay -->
  <div class="simple-list-detail-overlay" id="simple-list-detail-overlay-{{id}}">
    <!-- Detail content -->
  </div>
</div>
```

#### Loop Templates (`[layout]-loop.build.hbs`)
Defines how individual data items are rendered in the list.

**Example Structure (simple-list-loop.build.hbs):**
```handlebars
{{#each this}}
<div class="simple-list-item mix {{[flClasses]}} focus-outline" 
     tabindex="0" 
     data-entry-id="{{id}}" 
     role="listitem">
  {{#if [Image]}}
  <div class="list-item-image" style="background-image: url('{{auth [Image]}}')"></div>
  {{/if}}
  
  <div class="list-item-body">
    {{#if [Title]}}
    <div class="list-item-title">{{[Title]}}</div>
    {{/if}}
    
    {{#if [Description]}}
    <div class="list-item-description">{{plaintext [Description]}}</div>
    {{/if}}
    
    <!-- Social interaction buttons -->
    <div class="simple-list-social-holder">
      {{#if likesEnabled}}
      <div class="simple-list-like-holder">
        <i class="fa fa-heart-o fa-lg like-placeholder"></i>
      </div>
      {{/if}}
    </div>
  </div>
</div>
{{/each}}
```

#### Detail Templates (`[layout]-detail.build.hbs`)
Renders the expanded detail view for individual items.

#### Filter Templates (`[layout]-filters.build.hbs`)
Renders filter controls specific to each layout.

#### Additional Templates
- `[layout]-comment.build.hbs`: Comment display template
- `[layout]-single-comment.build.hbs`: Individual comment template
- `[layout]-temp-comment.build.hbs`: Temporary comment template during submission

### 3. Specialized Templates

#### Agenda Layout Templates
- `agenda-cards-*.build.hbs`: Card-based agenda items
- `agenda-dates-loop.build.hbs`: Date grouping for agenda
- `agenda-filters.build.hbs`: Date-based filtering

#### News Feed Templates
- `news-feed-*.build.hbs`: Social media style feed layout
- Supports comments, likes, and social interactions

#### Directory Templates
- `small-card-*.build.hbs`: Directory-style people listings
- `small-card-profile-icon.build.hbs`: Profile icon display
- `small-card-user-profile.build.hbs`: User profile card

## Template Variables

### Common Context Variables
All templates receive these standard variables:

#### Widget Configuration
- `id`: Widget instance ID
- `layout`: Selected layout type
- `searchEnabled`: Boolean for search functionality
- `filtersEnabled`: Boolean for filtering
- `sortEnabled`: Boolean for sorting
- `likesEnabled`: Boolean for likes feature
- `bookmarksEnabled`: Boolean for bookmarks
- `commentsEnabled`: Boolean for comments

#### Data Entry Variables
- `[Title]`: Entry title field
- `[Description]`: Entry description field
- `[Image]`: Entry image field
- `[Category]`: Entry category field
- `[Date]`: Entry date field
- `[flClasses]`: CSS classes for filtering/sorting
- `id`: Entry unique identifier

#### UI State Variables
- `filtersInOverlay`: Boolean for filter overlay display
- `searchIconsEnabled`: Boolean for search icon display
- `showAddEntry`: Boolean for add entry button
- `previousScreen`: Boolean for navigation state
- `enabledLimitEntries`: Boolean for entry limiting
- `limitEntries`: Number of entries to limit

### Template Helpers

#### Built-in Helpers
- `{{#if condition}}`: Conditional rendering
- `{{#unless condition}}`: Negative conditional
- `{{#each array}}`: Loop over arrays
- `{{#ifCond a '==' b}}`: Conditional comparison

#### Custom Helpers
- `{{auth url}}`: Authentication-aware URL handling
- `{{plaintext text}}`: Strip HTML from text
- `{{T "key"}}`: Translation/internationalization
- `{{[fieldName]}}`: Dynamic field access

## Template Compilation

Templates are pre-compiled into JavaScript files:
- `js/build.templates.js`: Runtime templates
- `js/interface.templates.js`: Interface templates

Access compiled templates via:
```javascript
Fliplet.Widget.Templates['templates.build.template-name']
Fliplet.Widget.Templates['templates.interface.template-name']
```

## Customization Guidelines

### Adding New Templates
1. Create `.hbs` file in appropriate directory
2. Follow naming convention: `[layout]-[purpose].build.hbs`
3. Recompile templates after changes
4. Update template references in JavaScript

### Template Best Practices
1. **Accessibility**: Include proper ARIA labels and roles
2. **Responsive Design**: Use appropriate CSS classes
3. **Performance**: Minimize template complexity
4. **Localization**: Use `{{T "key"}}` for all user-facing text
5. **Data Binding**: Use `{{[fieldName]}}` for dynamic fields

### Common Patterns

#### Conditional Rendering
```handlebars
{{#if fieldName}}
  <div class="field-content">{{fieldName}}</div>
{{/if}}
```

#### Loop with Fallback
```handlebars
{{#each items}}
  <div class="item">{{this}}</div>
{{else}}
  <div class="no-items">No items found</div>
{{/each}}
```

#### Dynamic Field Access
```handlebars
{{#if [customField]}}
  <div class="custom-field">{{[customField]}}</div>
{{/if}}
```

#### Social Features
```handlebars
{{#if likesEnabled}}
<div class="like-holder like-holder-{{id}}">
  <i class="fa fa-heart-o fa-lg like-placeholder"></i>
</div>
{{/if}}
```

## Layout-Specific Features

### Simple List
- Minimal design
- Focus on content readability
- Basic social interactions

### News Feed
- Rich media support
- Full comment system
- Social interaction emphasis

### Directory (Small Card)
- Profile image prominence
- Contact information display
- People-focused layout

### Agenda
- Date-based organization
- Time-sensitive display
- Calendar-style navigation

### Featured List (Small H-Card)
- Horizontal card layout
- Featured content emphasis
- Image and text balance

## Debugging Templates

### Common Issues
1. **Missing Variables**: Check data source configuration
2. **Render Errors**: Validate Handlebars syntax
3. **Style Issues**: Verify CSS class names
4. **JavaScript Errors**: Check template compilation

### Debug Tools
- Browser developer tools for DOM inspection
- Fliplet Studio preview for real-time testing
- Template compilation logs for syntax errors
- Network tab for asset loading issues

This documentation provides comprehensive guidance for understanding and customizing the Dynamic Lists widget templates.