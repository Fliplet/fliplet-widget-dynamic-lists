window.flListLayoutConfig = {
  'small-card': {
    'filtersEnabled': true,
    'filterFields': ['Location', 'Sectors', 'Expertize'],
    'filtersInOverlay': false,
    'searchEnabled': true,
    'searchFields': ['First Name', 'Last Name', 'Title'],
    'sortOptions': [
      {
        'column': 'First Name',
        'columns': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Bio', 'Sectors', 'Expertize'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'alphabetical',
        'title': 'First Name - Alphabetical - Ascending'
      }
    ],
    'style-specific': ['list-filter', 'list-search']
  },
  'news-feed': {
    'filtersEnabled': true,
    'filterFields': ['Categories'],
    'filtersInOverlay': false,
    'searchEnabled': true,
    'searchFields': ['Title', 'Categories', 'Content'],
    'sortOptions': [
      {
        'column': 'Date',
        'columns': ['Title', 'Date', 'Categories', 'Image', 'Content'],
        'id': 'ajdmjZrT',
        'orderBy': 'descending',
        'sortBy': 'date',
        'title': 'Date - Date - Descending'
      }
    ],
    'social': {
      'likes': true,
      'bookmark': true,
      'comments': true
    },
    'style-specific': ['list-filter', 'list-search', 'list-likes', 'list-bookmark', 'list-comments']
  },
  'agenda': {
    'filtersEnabled': false,
    'filterFields': [],
    'filtersInOverlay': false,
    'searchEnabled': false,
    'searchFields': [],
    'sortOptions': [
      {
        'column': 'Date',
        'columns': ['Title', 'Date', 'Start Time', 'End Time', 'Content'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'date',
        'title': 'Date - Date - Ascending'
      },
      {
        'column': 'Start Time',
        'columns': ['Title', 'Date', 'Start Time', 'End Time', 'Content'],
        'id': 'ajdmjZrZ',
        'orderBy': 'ascending',
        'sortBy': 'date',
        'title': 'Start Time - Date - Ascending'
      }
    ],
    'social': {
      'bookmark': true
    },
    'style-specific': ['list-bookmark']
  },
  'small-h-card': {
    'filtersEnabled': false,
    'filterFields': [],
    'filtersInOverlay': false,
    'searchEnabled': false,
    'searchFields': [],
    'sortOptions': [
      {
        'column': 'First Name',
        'columns': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Bio', 'Sectors', 'Expertize'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'alphabetical',
        'title': 'First Name - Alphabetical - Ascending'
      }
    ],
    'style-specific': []
  },
  'simple-list': {
    'filtersEnabled': true,
    'filterFields': ['Category'],
    'filtersInOverlay': false,
    'searchEnabled': true,
    'searchFields': ['Title', 'Category'],
    'style-specific': ['list-filter', 'list-search'],
    'summary-fields': [
      {
        id: 'ajdmjRrT',
        location: 'Title',
        type: 'text',
        column: 'Title'
      },
      {
        id: 'aJdnjRrT',
        location: 'Description',
        type: 'text',
        column: 'Description'
      },
      {
        id: 'ajdmJrlT',
        location: 'Category',
        type: 'text',
        column: 'Category'
      },
      {
        id: 'gHlmJrlT',
        location: 'Image',
        type: 'image',
        column: 'Image'
      }
    ]
  }
}