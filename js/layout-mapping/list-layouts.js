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
    'id': 'agenda',
    'name': 'Agenda',
    'warning': 'Requires full screen',
    'description': 'Create an agenda',
    'gif': window.__widgetData[widgetId].assetsUrl + 'img/agenda.gif',
    'image': window.__widgetData[widgetId].assetsUrl + 'img/agenda.jpg'
  }
];