# Fliplet Dynamic Lists Widget - AI Agent Documentation

## Overview
This is a comprehensive Fliplet widget that generates dynamic lists from data sources. The widget provides multiple layout options and extensive customization capabilities for displaying data in various formats.

**Package**: com.fliplet.dynamic-lists  
**Version**: 1.4.0  
**Category**: List component  

## Component Architecture

### Core Files Structure

```
fliplet-widget-dynamic-lists/
├── widget.json                 # Widget configuration and dependencies
├── package.json               # NPM package configuration
├── interface.html             # Widget configuration interface
├── build.html                 # Widget runtime HTML structure
├── js/
│   ├── build.js              # Main widget runtime initialization
│   ├── build-lists.js        # Core DynamicLists class (minimal constructor)
│   ├── interface.js          # Widget configuration interface logic
│   ├── interface-lists.js    # Interface list management
│   ├── utils.js              # Utility functions and helpers
│   ├── query-parser.js       # Data query parsing functionality
│   ├── build.templates.js    # Compiled Handlebars templates for runtime
│   ├── interface.templates.js # Compiled Handlebars templates for interface
│   ├── layout-mapping/
│   │   ├── list-layouts.js   # Available layout definitions
│   │   └── layout-mapping.js # Layout configuration mapping
│   ├── layout-javascript/    # Layout-specific JavaScript files
│   │   ├── small-card-code.js
│   │   ├── news-feed-code.js
│   │   ├── agenda-code.js
│   │   ├── small-h-card-code.js
│   │   └── simple-list-code.js
│   └── default-configs/      # Default configuration files
│       └── layouts-config.js
├── css/
│   ├── build.css             # Main widget styles
│   ├── interface.css         # Configuration interface styles
│   └── layout-css/           # Layout-specific CSS files
│       ├── small-card-style.upload.css
│       ├── news-feed-style.upload.css
│       ├── agenda-style.upload.css
│       ├── small-h-card-style.upload.css
│       └── simple-list-style.upload.css
├── templates/
│   ├── build/                # Runtime Handlebars templates
│   │   ├── [layout]-base.build.hbs
│   │   ├── [layout]-loop.build.hbs
│   │   ├── [layout]-detail.build.hbs
│   │   └── [layout]-filters.build.hbs
│   └── interface/            # Interface Handlebars templates
│       ├── layouts.interface.hbs
│       ├── filter-panels.interface.hbs
│       ├── sort-panels.interface.hbs
│       ├── summary-view-panels.interface.hbs
│       └── detail-view-panels.interface.hbs
├── img/                      # Layout preview images and icons
└── vendor/                   # Third-party dependencies
```

## Available Layouts

The widget supports 5 predefined layouts:

1. **Small Card (Directory)** - `small-card`
   - Suitable for directories of people
   - Displays compact card-style entries

2. **News Feed** - `news-feed`
   - Suitable for news feeds and social-style content
   - Supports comments and social interactions

3. **Agenda** - `agenda`
   - Create agenda/calendar-style displays
   - Requires full screen layout
   - Date-based organization

4. **Small H-Card (Featured List)** - `small-h-card`
   - Suitable for featured items
   - Horizontal card layout

5. **Simple List** - `simple-list`
   - Suitable for simple data lists
   - Minimalist list display

## Core Functionality

### Data Source Integration
- Connects to Fliplet data sources for dynamic content
- Supports multiple data source types (main data, user data, likes, bookmarks, comments)
- Handles data source views and filtering

### Key Features
- **Search**: Full-text search across data entries
- **Filtering**: Multiple filter options with custom configurations
- **Sorting**: Configurable sort options
- **Social Features**: Likes, bookmarks, comments integration
- **Detail Views**: Expandable detail views for entries
- **Responsive Design**: Mobile-optimized layouts
- **Real-time Updates**: Live data synchronization

### Dependencies

#### Interface Dependencies
- fliplet-core: Core Fliplet functionality
- fliplet-datasources: Data source integration
- fliplet-studio-ui: Studio interface components
- jquery-ui: UI components and interactions
- bootstrap: CSS framework
- handlebars: Template engine
- codemirror: Code editor for custom templates

#### Runtime Dependencies
- fliplet-core: Core runtime functionality
- fliplet-session: Session management
- fliplet-datasources: Data source access
- fliplet-media: Media handling
- bootstrap: UI framework
- moment: Date/time manipulation
- lodash: Utility functions
- handlebars: Template rendering
- hammer.js: Touch gesture support

## Configuration Options

### Data Source Configuration
- Primary data source selection
- User data source for authentication
- Social data sources (likes, bookmarks, comments)
- Data source views and filtering rules

### Layout Customization
- Layout selection from predefined options
- Custom HTML templates via Handlebars
- Custom CSS styling
- Custom JavaScript behavior

### Display Options
- Summary view field configuration
- Detail view field configuration
- Filter panel configuration
- Sort panel configuration
- Social interaction settings

### Advanced Settings
- Custom query parsing
- Data transformation options
- Performance optimization settings
- Security and access control

## Template System

### Handlebars Templates
The widget uses Handlebars for templating with the following template types:

- **Base Templates**: Main layout structure
- **Loop Templates**: Individual item rendering
- **Detail Templates**: Expanded item views
- **Filter Templates**: Filter interface components
- **Search Result Templates**: Search result formatting

### Template Compilation
Templates are pre-compiled into JavaScript files:
- `build.templates.js`: Runtime templates
- `interface.templates.js`: Configuration interface templates

## JavaScript Architecture

### Main Classes

#### DynamicLists (build-lists.js)
```javascript
var DynamicLists = function(data, container) {
  this.data = data;
  this.$container = $(container);
  return this;
};
```
- Minimal constructor for widget instances
- Handles data and container initialization

#### Interface DynamicLists (interface.js)
- Complex configuration interface logic
- Data source provider management
- Template editor integration
- Layout selection and configuration

### Key Functions

#### Widget Initialization (build.js)
```javascript
Fliplet.Widget.instance('dynamic-lists', function(data) {
  var container = this;
  var id = data.id;
  
  if (!data.layout) {
    dynamicLists[id] = new DynamicLists(data, container);
  }
});
```

#### Layout Event Handling
```javascript
Fliplet.Studio.onEvent(function(event) {
  var eventDetail = event.detail;
  
  if (eventDetail.type === 'dynamicListLayout') {
    $('.fl-widget-instance[data-id="' + eventDetail.data.id + '"]')
      .attr('data-settings-layout', eventDetail.data.layout);
  }
});
```

## Data References

The widget maintains references to various Fliplet resources:
- Data sources (main, user, likes, bookmarks, comments)
- Pages (add entry, edit entry, summary links)
- Media folders (file uploads)
- App and organization folders
- Data source views

## Development Guidelines

### Adding New Layouts
1. Create layout definition in `js/layout-mapping/list-layouts.js`
2. Add layout mapping in `js/layout-mapping/layout-mapping.js`
3. Create CSS file in `css/layout-css/[layout]-style.upload.css`
4. Create JavaScript file in `js/layout-javascript/[layout]-code.js`
5. Create Handlebars templates in `templates/build/[layout]-*.hbs`
6. Update default configurations in `js/default-configs/`

### Customization Points
- Templates: Modify Handlebars templates for custom rendering
- Styles: Override CSS for visual customization
- Behavior: Extend JavaScript for custom interactions
- Data: Configure data source connections and transformations

### Testing Considerations
- Test all layout variations
- Verify data source connections
- Test responsive behavior
- Validate social features
- Check performance with large datasets

## AI Agent Guidance

When working with this widget:

1. **Layout Selection**: Always consider the appropriate layout for the use case
2. **Data Source Integration**: Ensure proper data source configuration
3. **Template Modifications**: Use Handlebars syntax for template customization
4. **Performance**: Consider data loading and rendering performance
5. **Mobile Optimization**: Ensure responsive design considerations
6. **Social Features**: Configure social interactions appropriately
7. **Security**: Implement proper access controls and data validation

## Common Use Cases

1. **Employee Directory**: Use small-card layout with user photos and contact info
2. **News Feed**: Use news-feed layout with comments and social features
3. **Event Agenda**: Use agenda layout with date-based organization
4. **Product Catalog**: Use small-h-card layout for featured products
5. **Simple Lists**: Use simple-list layout for basic data display

## Troubleshooting

### Common Issues
1. **Data Not Loading**: Check data source configuration and permissions
2. **Layout Not Rendering**: Verify template compilation and CSS loading
3. **Search Not Working**: Check search configuration and data indexing
4. **Social Features Failing**: Verify social data source configurations
5. **Performance Issues**: Review data query optimization and caching

### Debug Information
- Widget ID and configuration data available in browser console
- Template compilation errors logged to console
- Data source connection status available via Fliplet APIs
- Network requests visible in browser developer tools

This documentation provides a comprehensive overview for AI agents working with the Fliplet Dynamic Lists widget, covering architecture, functionality, and development guidelines.