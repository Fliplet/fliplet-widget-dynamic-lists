/**
 * Layout Mapping Configuration
 * 
 * Maps layout IDs to their corresponding template, CSS, and JavaScript files.
 * This configuration defines how each layout is assembled from its components:
 * 
 * - name: Display name for the layout
 * - base: Base template that provides the main structure
 * - loop: Template for rendering individual items in the list
 * - detail: Template for detailed view of individual items
 * - filter: Template for filter controls (if applicable)
 * - css: CSS file identifier for layout-specific styling
 * - js: JavaScript file identifier for layout-specific behavior
 * 
 * Additional templates may be defined for specific layouts:
 * - profile-icon: User profile icon template
 * - user-profile: User profile template
 * - comment: Comment display template
 * - single-comment: Individual comment template
 * - temp-comment: Temporary comment template
 * - search-results: Search results template
 * - dates-loop: Date grouping template (agenda layout)
 * - cards-loop: Card grouping template (agenda layout)
 * - cards-detail: Card detail template (agenda layout)
 * - cards-search-results: Card search results template (agenda layout)
 */
window.flLayoutMapping = {
  'small-card': {
    'name': 'Small expandable cards',
    'base': 'templates.build.small-card-base',
    'loop': 'templates.build.small-card-loop',
    'filter': 'templates.build.small-card-filters',
    'detail': 'templates.build.small-card-detail',
    'profile-icon': 'templates.build.small-card-profile-icon',
    'user-profile': 'templates.build.small-card-user-profile',
    'css': 'small-card',
    'js': 'small-card'
  },
  'news-feed': {
    'name': 'Cards with description',
    'base': 'templates.build.news-feed-base',
    'loop': 'templates.build.news-feed-loop',
    'detail': 'templates.build.news-feed-detail',
    'filter': 'templates.build.news-feed-filters',
    'css': 'news-feed',
    'js': 'news-feed'
  },
  'agenda': {
    'name': 'Agenda',
    'base': 'templates.build.agenda-base',
    'loop': 'templates.build.agenda-cards-loop',
    'search-results': 'templates.build.agenda-cards-search-results',
    'detail': 'templates.build.agenda-cards-detail',
    'filter': 'templates.build.agenda-filters',
    'other-loop': 'templates.build.agenda-dates-loop',
    'css': 'agenda',
    'js': 'agenda'
  },
  'small-h-card': {
    'name': 'Small horizontal cards',
    'base': 'templates.build.small-h-card-base',
    'loop': 'templates.build.small-h-card-loop',
    'detail': 'templates.build.small-h-card-detail',
    'css': 'small-h-card',
    'js': 'small-h-card'
  },
  'simple-list': {
    'name': 'Simple list',
    'base': 'templates.build.simple-list-base',
    'loop': 'templates.build.simple-list-loop',
    'detail': 'templates.build.simple-list-detail',
    'filter': 'templates.build.news-feed-filters',
    'css': 'simple-list',
    'js': 'simple-list'
  }
};