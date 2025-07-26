const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
let TOKEN = '';

// Test photo upload functionality
const testPhotoUpload = async () => {
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

        // Create a test image file (or use existing one)
        const testImagePath = path.join(__dirname, 'test-image.jpg');
        
        // Check if test image exists, if not create a simple one
        if (!fs.existsSync(testImagePath)) {
            console.log('📸 Creating test image...');
            // Create a simple test image (1x1 pixel JPEG)
            const testImageBuffer = Buffer.from([
                0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
                0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
                0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
                0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
                0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
                0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
                0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
                0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
                0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
                0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
                0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
                0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
                0xFF, 0xD9
            ]);
            fs.writeFileSync(testImagePath, testImageBuffer);
        }

        console.log('\n📸 Testing photo upload in event creation...');
        
        // Create FormData for multipart/form-data
        const formData = new FormData();
        
        // Add the image file
        formData.append('image', fs.createReadStream(testImagePath));
        
        // Add event data as JSON string
        const eventData = {
            eventName: "Photo Upload Test Event",
            date: "2024-04-15",
            eventTime: {
                from: "10:00",
                to: "18:00"
            },
            place: "Test Venue",
            tags: ["test", "photo-upload"],
            pricing: [
                {
                    name: "Test Ticket",
                    description: "Test pricing",
                    price: 50.00,
                    tags: ["test"],
                    slotsAvailable: 100
                }
            ],
            discountOptions: [
                {
                    name: "Test Discount",
                    totalMembersNeeded: 5,
                    percentageDiscount: 10
                }
            ],
            organizer: "Test Organizer",
            description: "Testing photo upload functionality",
            duration: "8 hours",
            maxAttendees: 200,
            availableSlots: 150,
            status: "draft"
        };
        
        formData.append('eventName', eventData.eventName);
        formData.append('date', eventData.date);
        formData.append('eventTime', JSON.stringify(eventData.eventTime));
        formData.append('place', eventData.place);
        formData.append('tags', JSON.stringify(eventData.tags));
        formData.append('pricing', JSON.stringify(eventData.pricing));
        formData.append('discountOptions', JSON.stringify(eventData.discountOptions));
        formData.append('organizer', eventData.organizer);
        formData.append('description', eventData.description);
        formData.append('duration', eventData.duration);
        formData.append('maxAttendees', eventData.maxAttendees);
        formData.append('availableSlots', eventData.availableSlots);
        formData.append('status', eventData.status);

        // Make the request
        const response = await axios.post(`${BASE_URL}/api/admin-events`, formData, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                ...formData.getHeaders()
            }
        });

        if (response.data.success) {
            console.log('✅ Event created with photo successfully!');
            console.log('\n📊 Event Details:');
            console.log('================');
            console.log(`📝 Event Name: ${response.data.data.eventName}`);
            console.log(`🖼️ Image Path: ${response.data.data.image}`);
            console.log(`📅 Date: ${response.data.data.date}`);
            console.log(`👤 Organizer: ${response.data.data.organizer}`);
            console.log(`💰 Price Range: $${response.data.data.pricing[0].price}`);
            console.log(`👥 Max Attendees: ${response.data.data.maxAttendees}`);
            
            // Test accessing the uploaded image
            console.log('\n🔗 Image URL:');
            console.log(`${BASE_URL}${response.data.data.image}`);
            
            console.log('\n✅ Photo upload test completed successfully!');
        } else {
            console.log('❌ Failed to create event with photo');
            console.log(response.data);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
};

// Run the test
testPhotoUpload(); 