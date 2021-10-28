window.flListLayoutConfig = {
  'small-card': {
    'filtersEnabled': true,
    'filterFields': ['Location', 'Sectors', 'Expertise'],
    'filtersInOverlay': false,
    'searchEnabled': true,
    'searchFields': ['First Name', 'Last Name', 'Title'],
    'sortOptions': [
      {
        'column': 'First Name',
        'columns': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'alphabetical',
        'title': 'First Name - Alphabetical - Ascending'
      }
    ],
    'style-specific': ['list-filter', 'list-search', 'list-bookmark', 'list-sort'],
    'summary-fields': [
      {
        id: 'ajdmjRrT',
        interfaceName: 'Primary text 1',
        location: 'First Name',
        type: 'text',
        column: 'First Name',
        editable: true
      },
      {
        id: 'aJdnjRrT',
        interfaceName: 'Primary text 2',
        location: 'Last Name',
        type: 'text',
        column: 'Last Name',
        editable: true
      },
      {
        id: 'ajdmJrlT',
        interfaceName: 'Secondary text',
        location: 'Title',
        type: 'text',
        column: 'Title',
        editable: true
      },
      {
        id: 'qWerTymn',
        interfaceName: 'Tertiary text',
        location: 'Location',
        type: 'text',
        column: 'Location',
        editable: true
      },
      {
        id: 'gHlmJrlT',
        interfaceName: 'Image',
        location: 'Image',
        type: 'image',
        column: 'Image'
      }
    ],
    'detail-fields': [
      {
        id: 'nMytReWq',
        location: 'Email',
        type: 'mail',
        column: 'Email',
        paranoid: true,
        helper: 'Email icon'
      },
      {
        id: 'tYrEqwMn',
        location: 'Telephone',
        type: 'tel',
        column: 'Telephone',
        paranoid: true,
        helper: 'Phone icon'
      },
      {
        id: 'XLbdTD45',
        location: 'Linkedin',
        type: 'url',
        column: 'Linkedin',
        paranoid: true,
        helper: 'LinkedIn icon'
      }
    ]
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
      'comments': false
    },
    'style-specific': ['list-filter', 'list-search', 'list-likes', 'list-bookmark', 'list-comments', 'list-sort'],
    'summary-fields': [
      {
        id: 'ajdmjRrT',
        interfaceName: 'Primary text',
        location: 'Title',
        type: 'text',
        column: 'Title',
        editable: true
      },
      {
        id: 'aJdnjRrT',
        interfaceName: 'Secondary text',
        location: 'Content',
        type: 'html',
        column: 'Content',
        editable: true
      },
      {
        id: 'gHlJkerT',
        interfaceName: 'Tertiary text 1',
        location: 'Date',
        type: 'date',
        column: 'Date',
        editable: true
      },
      {
        id: 'ajdmJrlT',
        interfaceName: 'Tertiary text 2',
        location: 'Categories',
        type: 'text',
        column: 'Categories',
        editable: true
      },
      {
        id: 'gHlmJrlT',
        interfaceName: 'Image',
        location: 'Image',
        type: 'image',
        column: 'Image'
      }
    ],
    'detail-fields-disabled': true
  },
  'agenda': {
    'filtersEnabled': false,
    'filterFields': [],
    'filtersInOverlay': false,
    'searchEnabled': false,
    'searchFields': [],
    'sortOptions': [
      {
        'column': 'Full Date',
        'columns': ['Title', 'Full Date', 'Start Time', 'End Time', 'Location', 'Content'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'date',
        'title': 'Full Date - Date - Ascending'
      },
      {
        'column': 'Start Time',
        'columns': ['Title', 'Full Date', 'Start Time', 'End Time', 'Location', 'Content'],
        'id': 'bjzxjKrP',
        'orderBy': 'ascending',
        'sortBy': 'time',
        'title': 'Start Time - Date - Ascending'
      }
    ],
    'social': {
      'bookmark': true
    },
    'style-specific': ['list-filter', 'list-search', 'list-bookmark', 'list-agenda-options'],
    'summary-fields': [
      {
        id: 'ajdmjRrT',
        interfaceName: 'Session starting time',
        location: 'Start Time',
        type: 'time',
        column: 'Start Time'
      },
      {
        id: 'aJdnjRrT',
        interfaceName: 'Session ending time',
        location: 'End Time',
        type: 'time',
        column: 'End Time'
      },
      {
        id: 'ajdmJrlT',
        interfaceName: 'Primary text',
        location: 'Title',
        type: 'text',
        column: 'Title',
        editable: true
      },
      {
        id: 'gHlmJrlT',
        interfaceName: 'Secondary text',
        location: 'Location',
        type: 'text',
        column: 'Location',
        editable: true
      }
    ],
    'detail-fields': [
      {
        id: 'KjDmjrFT',
        location: 'Full Date',
        type: 'date',
        column: 'Full Date',
        paranoid: true,
        helper: 'Full Date'
      },
      {
        id: 'KjDtRjrT',
        location: 'Content',
        type: 'html',
        column: 'Content'
      }
    ],
    'detail-fields-ignore': ['Poll', 'Survey', 'Questions']
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
        'columns': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise'],
        'id': 'ajdmjZrT',
        'orderBy': 'ascending',
        'sortBy': 'alphabetical',
        'title': 'First Name - Alphabetical - Ascending'
      }
    ],
    'style-specific': [],
    'summary-fields': [
      {
        id: 'ajdmjRrT',
        interfaceName: 'Primary text 1',
        location: 'First Name',
        type: 'text',
        column: 'First Name',
        editable: true
      },
      {
        id: 'aJdnjRrT',
        interfaceName: 'Primary text 2',
        location: 'Last Name',
        type: 'text',
        column: 'Last Name',
        editable: true
      },
      {
        id: 'ajdmJrlT',
        interfaceName: 'Secondary text',
        location: 'Title',
        type: 'text',
        column: 'Title',
        editable: true
      },
      {
        id: 'qWerTymn',
        interfaceName: 'Tertiary text',
        location: 'Location',
        type: 'text',
        column: 'Location',
        editable: true
      },
      {
        id: 'gHlmJrlT',
        interfaceName: 'Image',
        location: 'Image',
        type: 'image',
        column: 'Image'
      }
    ],
    'detail-fields': [
      {
        id: 'nMytReWq',
        location: 'Email',
        type: 'mail',
        column: 'Email',
        paranoid: true,
        helper: 'Email icon'
      },
      {
        id: 'tYrEqwMn',
        location: 'Telephone',
        type: 'tel',
        column: 'Telephone',
        paranoid: true,
        helper: 'Phone icon'
      },
      {
        id: 'XLbdTD45',
        location: 'Linkedin',
        type: 'url',
        column: 'Linkedin',
        paranoid: true,
        helper: 'LinkedIn icon'
      }
    ]
  },
  'simple-list': {
    'filtersEnabled': true,
    'filterFields': ['Category'],
    'filtersInOverlay': false,
    'searchEnabled': true,
    'searchFields': ['Title', 'Category'],
    'social': {
      'likes': true,
      'bookmark': true,
      'comments': false
    },
    'style-specific': ['list-filter', 'list-search', 'list-likes', 'list-bookmark', 'list-comments', 'list-sort'],
    'summary-fields-enabled': true,
    'summary-fields': [
      {
        id: 'gHlmJrlT',
        interfaceName: 'Image',
        location: 'Image',
        type: 'image',
        column: 'Image'
      },
      {
        id: 'ajdmjRrT',
        interfaceName: 'Primary text',
        location: 'Title',
        type: 'text',
        column: 'Title',
        editable: true
      },
      {
        id: 'aJdnjRrT',
        interfaceName: 'Secondary text',
        location: 'Description',
        type: 'text',
        column: 'Description',
        editable: true
      },
      {
        id: 'ajdmJrlT',
        interfaceName: 'Tertiary text',
        location: 'Category',
        type: 'text',
        column: 'Category',
        editable: true
      }
    ],
    'showSummaryFieldsInDetailView': true,
    'detail-fields': [
      {
        id: 'wWkqeYGN',
        location: 'Image',
        type: 'image',
        column: 'Image'
      }
    ]
  }
};
