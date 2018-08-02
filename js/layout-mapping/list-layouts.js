var widgetId = Fliplet.Widget.getDefaultId();

window.flWidgetLayout = [
  {
    'id': 'small-card',
    'name': 'Small expandable cards',
    'description': 'Suitable for directories of people',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/small-card.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/small-card.jpg'
  },
  {
    'id': 'news-feed',
    'name': 'Cards with description',
    'description': 'Suitable for news feeds',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/news-feed.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/news-feed.jpg'
  },
  {
    'id': 'feed-comments',
    'name': 'Feed with comments',
    'warning': 'Comments require login',
    'description': 'Feed list with ability to add comments',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/feed-comments.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/feed-comments.jpg'
  },
  {
    'id': 'agenda',
    'name': 'Agenda',
    'warning': 'Requires full screen',
    'description': 'Create an agenda',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/agenda.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/agenda.jpg'
  },
  {
    'id': 'small-h-card',
    'name': 'Small horizontal cards',
    'description': 'Suitable for featured items',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/small-h-card.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/small-h-card.jpg'
  }
];