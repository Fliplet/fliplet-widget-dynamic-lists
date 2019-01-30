var widgetId = Fliplet.Widget.getDefaultId();

window.flWidgetLayout = [
  {
    'id': 'small-card',
    'name': 'Directory',
    'description': 'Suitable for directories of people',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/small-card.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/small-card.jpg'
  },
  {
    'id': 'news-feed',
    'name': 'Feed',
    'description': 'Suitable for news feeds',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/news-feed.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/news-feed.jpg'
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
    'name': 'Featured list',
    'description': 'Suitable for featured items',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/small-h-card.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/small-h-card.jpg'
  },
  {
    'id': 'simple-list',
    'name': 'Simple list',
    'description': 'Suitable for simple data lists',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/simple-list.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/simple-list.jpg'
  }
];