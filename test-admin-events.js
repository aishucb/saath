const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
let TOKEN = ''; // Will be set after login
let EVENT_ID = ''; // Will be set after creating event

// Test data
const testEvent = {
  eventName: "JavaScript Conference 2024",
  date: "2024-04-15",
  eventTime: {
    from: "10:00",
    to: "18:00"
  },
  place: "Tech Hub Downtown",
  tags: ["javascript", "web-development", "conference"],
  image: "https://example.com/js-conf.jpg",
  pricing: [
    {
      name: "Early Bird",
      description: "Limited time offer",
      price: 79.00,
      tags: ["early-bird"],
      slotsAvailable: 100
    },
    {
      name: "Regular",
      description: "Standard ticket",
      price: 129.00,
      tags: ["regular"],
      slotsAvailable: 200
    }
  ],
  discountOptions: [
    {
      name: "Student Discount",
      totalMembersNeeded: 1,
      percentageDiscount: 30
    },
    {
      name: "Group Discount",
      totalMembersNeeded: 5,
      percentageDiscount: 20
    }
  ],
  organizer: "JS Events Inc",
  description: "The biggest JavaScript conference of the year!",
  duration: "8 hours",
  maxAttendees: 300,
  availableSlots: 250,
  status: "draft"
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
};

// Test functions
const loginAdmin = async () => {
  console.log('🔐 Logging in as admin...');
  try {
    const response = await axios.post(`${BASE_URL}/api/admin/login`, {
      email: 'admin@test.com',
      password: 'password123'
    });
    
    if (response.data.success) {
      TOKEN = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
};

const createEvent = async () => {
  console.log('\n📝 Creating event...');
  const result = await makeRequest('POST', '/api/admin-events', testEvent);
  
  if (result && result.success) {
    EVENT_ID = result.data._id;
    console.log('✅ Event created successfully');
    console.log('Event ID:', EVENT_ID);
    return true;
  } else {
    console.log('❌ Failed to create event');
    return false;
  }
};

const getAllEvents = async () => {
  console.log('\n📋 Getting all events...');
  const result = await makeRequest('GET', '/api/admin-events');
  
  if (result && result.success) {
    console.log('✅ Retrieved events successfully');
    console.log(`Total events: ${result.pagination.totalItems}`);
    return true;
  } else {
    console.log('❌ Failed to get events');
    return false;
  }
};

const getSingleEvent = async () => {
  console.log('\n🔍 Getting single event...');
  const result = await makeRequest('GET', `/api/admin-events/${EVENT_ID}`);
  
  if (result && result.success) {
    console.log('✅ Retrieved single event successfully');
    console.log('Event name:', result.data.eventName);
    return true;
  } else {
    console.log('❌ Failed to get single event');
    return false;
  }
};

const updateEvent = async () => {
  console.log('\n✏️ Updating event...');
  const updateData = {
    eventName: "Updated JavaScript Conference 2024",
    status: "published"
  };
  
  const result = await makeRequest('PUT', `/api/admin-events/${EVENT_ID}`, updateData);
  
  if (result && result.success) {
    console.log('✅ Event updated successfully');
    return true;
  } else {
    console.log('❌ Failed to update event');
    return false;
  }
};

const updateEventStatus = async () => {
  console.log('\n🔄 Updating event status...');
  const result = await makeRequest('PATCH', `/api/admin-events/${EVENT_ID}/status`, {
    status: "published"
  });
  
  if (result && result.success) {
    console.log('✅ Event status updated successfully');
    return true;
  } else {
    console.log('❌ Failed to update event status');
    return false;
  }
};

const getEventStats = async () => {
  console.log('\n📊 Getting event statistics...');
  const result = await makeRequest('GET', '/api/admin-events/stats/overview');
  
  if (result && result.success) {
    console.log('✅ Retrieved statistics successfully');
    console.log('Total events:', result.data.total);
    console.log('Published events:', result.data.published);
    return true;
  } else {
    console.log('❌ Failed to get statistics');
    return false;
  }
};

const searchEvents = async () => {
  console.log('\n🔍 Searching events...');
  const result = await makeRequest('GET', '/api/admin-events?search=javascript');
  
  if (result && result.success) {
    console.log('✅ Search completed successfully');
    console.log(`Found ${result.data.length} events`);
    return true;
  } else {
    console.log('❌ Failed to search events');
    return false;
  }
};

const deleteEvent = async () => {
  console.log('\n🗑️ Deleting event...');
  const result = await makeRequest('DELETE', `/api/admin-events/${EVENT_ID}`);
  
  if (result && result.success) {
    console.log('✅ Event deleted successfully');
    return true;
  } else {
    console.log('❌ Failed to delete event');
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Admin Events API Tests');
  console.log('==================================');
  
  // Step 1: Login
  const loginSuccess = await loginAdmin();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }
  
  // Step 2: Create event
  const createSuccess = await createEvent();
  if (!createSuccess) {
    console.log('❌ Cannot proceed without creating event');
    return;
  }
  
  // Step 3: Run all tests
  await getAllEvents();
  await getSingleEvent();
  await updateEvent();
  await updateEventStatus();
  await getEventStats();
  await searchEvents();
  await deleteEvent();
  
  console.log('\n✅ All tests completed!');
};

// Run tests
runTests().catch(console.error); 