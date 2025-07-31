const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
let TOKEN = '';

// Test the optimized admin events endpoint
const testOptimizedEvents = async () => {
    try {
        // First, login to get token
        console.log('🔐 Logging in as admin...');
        const loginResponse = await axios.post(`${BASE_URL}/api/admin/login`, {
            email: 'admin@test.com',
            password: 'password123'
        });
        
        if (loginResponse.data.success) {
            TOKEN = loginResponse.data.token;
            console.log('✅ Login successful');
        } else {
            console.log('❌ Login failed');
            return;
        }

        // Test the optimized GET /api/admin-events endpoint
        console.log('\n📋 Testing optimized GET /api/admin-events...');
        
        const response = await axios.get(`${BASE_URL}/api/admin-events`, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (response.data.success) {
            console.log('✅ Optimized events fetched successfully!');
            console.log('\n📊 Response Structure:');
            console.log('=====================');
            
            const events = response.data.data;
            if (events.length > 0) {
                const sampleEvent = events[0];
                
                console.log('\n🎯 Sample Event Response:');
                console.log('------------------------');
                console.log(`📅 Date: ${sampleEvent.formattedDate}`);
                console.log(`⏰ Time: ${sampleEvent.formattedTime}`);
                console.log(`📝 Title: ${sampleEvent.eventName}`);
                console.log(`🖼️ Photo: ${sampleEvent.image || 'No image'}`);
                console.log(`👤 Organizer: ${sampleEvent.organizer}`);
                console.log(`💰 Price Range: $${sampleEvent.priceRange.min} - $${sampleEvent.priceRange.max}`);
                console.log(`📄 Description: ${sampleEvent.description.substring(0, 100)}...`);
                console.log(`👥 Attendees Count: ${sampleEvent.attendeesCount}`);
                console.log(`📊 Status: ${sampleEvent.status}`);
                console.log(`📅 Created: ${sampleEvent.createdAt}`);
                
                console.log('\n🔍 All Fields in Response:');
                console.log('------------------------');
                console.log(Object.keys(sampleEvent));
                
                console.log('\n📊 Pagination Info:');
                console.log('------------------');
                console.log(response.data.pagination);
            } else {
                console.log('📭 No events found. Create some events first!');
            }
        } else {
            console.log('❌ Failed to fetch events');
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
};

// Run the test
testOptimizedEvents(); 