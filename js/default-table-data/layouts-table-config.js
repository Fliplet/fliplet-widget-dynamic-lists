window.flListLayoutTableColumnConfig = {
  'small-card': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise'],
  'news-feed': ['Title', 'Date', 'Categories', 'Image', 'Content', 'Word count'],
  'agenda': ['Title', 'Poll', 'Survey', 'Questions', 'Full Date', 'Start Time', 'End Time', 'Location', 'Content'],
  'small-h-card': ['First Name', 'Last Name', 'Title', 'Location', 'Image', 'Email', 'Telephone', 'Linkedin', 'Bio', 'Sectors', 'Expertise'],
  'simple-list': ['Title', 'Image', 'Category', 'Description']
};
window.flListLayoutTableConfig = {
  'small-card': [
    {
      'First Name': 'Jane',
      'Last Name': 'Smith',
      'Title': 'Head of Marketing',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jasmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'Candy crush marketer, wearable tech captain, tech whisperer. Deeper dives start here.',
      'Sectors': 'Software, IT, Marketing, Design',
      'Expertise': 'SEO'
    },
    {
      'First Name': 'John',
      'Last Name': 'Smith',
      'Title': 'Head of Product',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jsmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'MySpace ambassador, bitcoin virtuoso, android soothsayer. Beanie baby collector.',
      'Sectors': 'Software, IT, Programming, Design, Development, Management',
      'Expertise': 'Design'
    },
    {
      'First Name': 'Mary',
      'Last Name': 'Jane',
      'Title': 'Consultant',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jsmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'Content czar, BuzzFeed egghead-in-chief, interwebz sherpa. Burning the candle at both ends.',
      'Sectors': 'Management, Finance, Business',
      'Expertise': 'Business Management'
    }
  ],
  'news-feed': [
    {
      'Title': 'This year’s most popular business apps',
      'Image': 'https://cdn.fliplet.com/apps/2659/de1ac7174a201cff518f13b38a293d30363-001-3021.jpg',
      'Categories': 'Enterprise software',
      'Date': moment().locale('en').subtract(3, 'months').format('YYYY-MM-DD'),
      'Content': '<p>Most enteprises now agree that their bottom line could benefit from bespoke apps.  But which ones are they building and where do they think the real value lies?</p><p>Fliplet works with many of the world’s industry leading businesses. We’ve crunched the data to identify the trends in the world of enterprise app building.  In this report we’ll share some of the findings and talk through a few case studies that are at the cutting edge</p><h3>Revenue generation or cost savings</h3><p>Technology in the workplace is often thought of as a way to streamline process, reducing friction and ultimately creating cost savings.  However it is actually the revenue generating functions that are making the widest use of apps.  Sales and marketing teams are using apps to reach out to new clients and engage more with existing ones.  They tend to be amongst the most prolific app builders - producing an a new app every couple of months</p><p>To learn more about enterprise app trends - visit <a href=“https://fliplet.com”>Fliplet.com</a></p>',
      'Word count': 1750
    },
    {
      'Title': 'Artificial intelligence in the workplace',
      'Image': 'https://cdn.fliplet.com/apps/2659/7b98218ffd06b23fd5b99bfaf53bbd7c194-850-1800.jpg',
      'Categories': 'Machine Learning',
      'Date': moment().locale('en').subtract(1, 'week').format('YYYY-MM-DD'),
      'Content': '<p>Venture capitalists are investing heavily in AI; China has made dominance in AI a national goal; Elon Musk and Stephen Hawking have warned us about letting AI escape from our grip...  So why haven’t we seen more of it in our every day lives...</p><p>The short answer is that we have - it’s just that AI is often invisible; working in the background; making existing processes 5-10% more efficient rather than inventing entirely new processes.  This is particularly true in the areas of recommendation engines, big data analysis and healthcare diagnosis</p><p>The areas where AI has had the greatest media coverage have been impersonating humans, chess playing and of course as evil overlords of humans. This is a vast overstatement of AIs current powers.  It might be something to be wary of in the future but current manifestations of AI fall somewhat short of the media hype</p>',
      'Word count': '1500'
    },
    {
      'Title': 'Why do business apps lag so far behind consumer apps?',
      'Image': 'https://cdn.fliplet.com/apps/2659/5f292d9d7898a4c654ad87c90a40f66c156-875-9870.jpg',
      'Categories': 'Apps',
      'Date': moment().locale('en').subtract(1, 'months').subtract(3, 'days').format('YYYY-MM-DD'),
      'Content': '<p>When I started my first job I was amazed at the cutting edge technology my employer had lavished on me. Not one but two flat screens greeted me. No clunky cathode ray tubes in site. Swipe card passes granted me swift access to a lift that arrived as I walked up to it. And of course the icing on the cake - a shiny new Blackberry</p><p>But somewhere along the way business technology brands got left behind.  Consumer brands surged forward. Apple shot passed Blackberry and Microsoft. Google and Amazon - two consumer brands at their core - made huge inroads into enterprise software and server architecture. An average consumer app today makes its corporate equivalent look prehistoric.</p>',
      'Word count': '2000'
    }
  ],
  'agenda': [
    {
      'Title': 'Registration and coffee',
      'Poll': 'Session 1 Poll',
      'Survey': 'Session Survey',
      'Questions': 'Session Questions',
      'Full Date': moment().locale('en').add(1, 'month').format('YYYY-MM-DD'),
      'Start Time': '09:00',
      'End Time': '09:45',
      'Location': 'Hotel\'s Restaurant',
      'Content': '<p>Registration will take place in the foyer.  Please make sure to pick up you badge and brochure.</p>'
    },
    {
      'Title': 'What does the future hold',
      'Poll': 'Session 2 Poll',
      'Survey': 'Session Survey',
      'Full Date': moment().locale('en').add(1, 'month').format('YYYY-MM-DD'),
      'Start Time': '10:00',
      'End Time': '11:30',
      'Location': 'Room 123',
      'Content': '<p>Professor John Smith will discuss the future trends in our industry. This will be followed by a group activity</p>'
    },
    {
      'Title': 'Team work',
      'Questions': 'Session Questions',
      'Full Date': moment().locale('en').add(1, 'month').format('YYYY-MM-DD'),
      'Start Time': '14:00',
      'End Time': '15:00',
      'Location': 'Room 156',
      'Content': '<p>Time to roll up your sleeves. We\'ve got a range of team building activities lined up.  The sessions will be hosted by the Legz Akimbo theatre company. Good luck!!</p>'
    },
    {
      'Title': 'Morning coffee',
      'Full Date': moment().locale('en').add(1, 'month').add(1, 'day').format('YYYY-MM-DD'),
      'Start Time': '09:00',
      'End Time': '09:45',
      'Location': 'Hotel\'s Restaurant',
      'Content': '<p>Rise and shine! Have a great breakfast.</p>'
    },
    {
      'Title': 'Defining success in our industry',
      'Poll': 'Session 5 Poll',
      'Questions': 'Session Questions',
      'Full Date': moment().locale('en').add(1, 'month').add(1, 'day').format('YYYY-MM-DD'),
      'Start Time': '10:00',
      'End Time': '11:30',
      'Location': 'Room 144',
      'Content': '<p>Professor John Smith will discuss what defines success in our industry. This will be followed by a group activity</p>'
    },
    {
      'Title': 'Day 2 round up',
      'Poll': 'Session 6 Poll',
      'Full Date': moment().locale('en').add(1, 'month').add(1, 'day').format('YYYY-MM-DD'),
      'Start Time': '17:00',
      'End Time': '18:00',
      'Location': 'Room 101',
      'Content': '<p>A round up of the days events hosted by your team director. The session will be used to answer any of your questions and discuss the key takeaways from the activities.</p>'
    }
  ],
  'small-h-card': [
    {
      'First Name': 'Jane',
      'Last Name': 'Smith',
      'Title': 'Head of Marketing',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jasmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'Candy crush marketer, wearable tech captain, tech whisperer. Deeper dives start here.',
      'Sectors': 'Software, IT, Marketing, Design',
      'Expertise': 'SEO'
    },
    {
      'First Name': 'John',
      'Last Name': 'Smith',
      'Title': 'Head of Product',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jsmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'MySpace ambassador, bitcoin virtuoso, android soothsayer. Beanie baby collector.',
      'Sectors': 'Software, IT, Programming, Design, Development, Management',
      'Expertise': 'Design'
    },
    {
      'First Name': 'Mary',
      'Last Name': 'Jane',
      'Title': 'Consultant',
      'Location': 'London',
      'Image': 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
      'Email': 'jsmith@email.com',
      'Telephone': '+440000000000',
      'Linkedin': 'https://www.linkedin.com/in/user/',
      'Bio': 'Content czar, BuzzFeed egghead-in-chief, interwebz sherpa. Burning the candle at both ends.',
      'Sectors': 'Management, Finance, Business',
      'Expertise': 'Business Management'
    }
  ],
  'simple-list': [
    {
      'Title': 'This year’s most popular business apps',
      'Image': 'https://cdn.fliplet.com/apps/2659/de1ac7174a201cff518f13b38a293d30363-001-3021.jpg',
      'Category': 'Enterprise software',
      'Description': '<p>Most enteprises now agree that their bottom line could benefit from bespoke apps.  But which ones are they building and where do they think the real value lies?</p><p>Fliplet works with many of the world’s industry leading businesses. We’ve crunched the data to identify the trends in the world of enterprise app building.  In this report we’ll share some of the findings and talk through a few case studies that are at the cutting edge</p><h3>Revenue generation or cost savings</h3><p>Technology in the workplace is often thought of as a way to streamline process, reducing friction and ultimately creating cost savings.  However it is actually the revenue generating functions that are making the widest use of apps.  Sales and marketing teams are using apps to reach out to new clients and engage more with existing ones.  They tend to be amongst the most prolific app builders - producing an a new app every couple of months</p><p>To learn more about enterprise app trends - visit <a href=“https://fliplet.com”>Fliplet.com</a></p>'
    },
    {
      'Title': 'Artificial intelligence in the workplace',
      'Image': 'https://cdn.fliplet.com/apps/2659/7b98218ffd06b23fd5b99bfaf53bbd7c194-850-1800.jpg',
      'Category': 'Machine Learning',
      'Description': '<p>Venture capitalists are investing heavily in AI; China has made dominance in AI a national goal; Elon Musk and Stephen Hawking have warned us about letting AI escape from our grip...  So why haven’t we seen more of it in our every day lives...</p><p>The short answer is that we have - it’s just that AI is often invisible; working in the background; making existing processes 5-10% more efficient rather than inventing entirely new processes.  This is particularly true in the areas of recommendation engines, big data analysis and healthcare diagnosis</p><p>The areas where AI has had the greatest media coverage have been impersonating humans, chess playing and of course as evil overlords of humans. This is a vast overstatement of AIs current powers.  It might be something to be wary of in the future but current manifestations of AI fall somewhat short of the media hype</p>'
    },
    {
      'Title': 'Why do business apps lag so far behind consumer apps?',
      'Image': 'https://cdn.fliplet.com/apps/2659/5f292d9d7898a4c654ad87c90a40f66c156-875-9870.jpg',
      'Category': 'Apps',
      'Description': '<p>When I started my first job I was amazed at the cutting edge technology my employer had lavished on me. Not one but two flat screens greeted me. No clunky cathode ray tubes in site. Swipe card passes granted me swift access to a lift that arrived as I walked up to it. And of course the icing on the cake - a shiny new Blackberry</p><p>But somewhere along the way business technology brands got left behind.  Consumer brands surged forward. Apple shot passed Blackberry and Microsoft. Google and Amazon - two consumer brands at their core - made huge inroads into enterprise software and server architecture. An average consumer app today makes its corporate equivalent look prehistoric.</p>'
    }
  ]
};
