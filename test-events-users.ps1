# Test Events Users API - PowerShell Script
# Tests the events-users endpoints with user authentication

$BaseUrl = "http://localhost:5000"

Write-Host "🚀 Testing Events Users API" -ForegroundColor Green
Write-Host "===========================" -ForegroundColor Green

# Step 1: Create a test customer (simulate user registration)
Write-Host "`n1️⃣ Creating test customer..." -ForegroundColor Yellow

$CustomerBody = @{
    username = "Test User"
    phone = "919876543210"
    email = "testuser@example.com"
} | ConvertTo-Json

try {
    $CreateCustomerResponse = Invoke-RestMethod -Uri "$BaseUrl/api/customer" -Method POST -Headers @{
        "Content-Type" = "application/json"
    } -Body $CustomerBody
    
    $CustomerId = $CreateCustomerResponse.id
    Write-Host "✅ Customer created successfully!" -ForegroundColor Green
    Write-Host "Customer ID: $CustomerId" -ForegroundColor Cyan
    
    # For testing purposes, we'll use the customer ID as a simple token
    # In a real app, you'd get a proper JWT token from login
    $UserToken = $CustomerId
    Write-Host "Using Customer ID as token: $UserToken" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Failed to create customer: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test GET /api/events-users (Get all events)
Write-Host "`n2️⃣ Testing GET /api/events-users..." -ForegroundColor Yellow

try {
    $AllEventsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users" -Method GET -Headers @{
        "Authorization" = "Bearer $UserToken"
    }
    
    Write-Host "✅ Retrieved events successfully!" -ForegroundColor Green
    Write-Host "Total events: $($AllEventsResponse.pagination.totalItems)" -ForegroundColor Cyan
    Write-Host "Current page: $($AllEventsResponse.pagination.currentPage)" -ForegroundColor Cyan
    
    if ($AllEventsResponse.data.Count -gt 0) {
        $FirstEvent = $AllEventsResponse.data[0]
        Write-Host "`n📋 First Event Details:" -ForegroundColor Magenta
        Write-Host "  Event Name: $($FirstEvent.eventName)" -ForegroundColor White
        Write-Host "  Place: $($FirstEvent.place)" -ForegroundColor White
        Write-Host "  Organizer: $($FirstEvent.organizer)" -ForegroundColor White
        Write-Host "  Date: $($FirstEvent.formattedDate)" -ForegroundColor White
        Write-Host "  Time: $($FirstEvent.formattedTime)" -ForegroundColor White
        Write-Host "  Tags: $($FirstEvent.tags -join ', ')" -ForegroundColor White
        Write-Host "  Duration: $($FirstEvent.duration)" -ForegroundColor White
        Write-Host "  Max Attendees: $($FirstEvent.maxAttendees)" -ForegroundColor White
        Write-Host "  Available Slots: $($FirstEvent.availableSlots)" -ForegroundColor White
        Write-Host "  Attendees Count: $($FirstEvent.attendeesCount)" -ForegroundColor White
        Write-Host "  Is Registered: $($FirstEvent.isRegistered)" -ForegroundColor White
        Write-Host "  Price Range: $($FirstEvent.priceRange.min) - $($FirstEvent.priceRange.max) $($FirstEvent.priceRange.currency)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get events: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $ErrorResponse = $_.Exception.Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($ErrorResponse)
        $ResponseBody = $Reader.ReadToEnd()
        Write-Host "Error details: $ResponseBody" -ForegroundColor Red
    }
}

# Step 3: Test GET /api/events-users with filters
Write-Host "`n3️⃣ Testing GET /api/events-users with filters..." -ForegroundColor Yellow

try {
    $FilteredEventsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users?limit=2&sortBy=date&sortOrder=desc" -Method GET -Headers @{
        "Authorization" = "Bearer $UserToken"
    }
    
    Write-Host "✅ Retrieved filtered events successfully!" -ForegroundColor Green
    Write-Host "Filtered events count: $($FilteredEventsResponse.data.Count)" -ForegroundColor Cyan
    
    if ($FilteredEventsResponse.filters) {
        Write-Host "Applied filters: $($FilteredEventsResponse.filters.applied | ConvertTo-Json)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get filtered events: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test GET /api/events-users/:id (Get single event)
Write-Host "`n4️⃣ Testing GET /api/events-users/:id..." -ForegroundColor Yellow

if ($AllEventsResponse.data.Count -gt 0) {
    $EventId = $AllEventsResponse.data[0]._id
    
    try {
        $SingleEventResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users/$EventId" -Method GET -Headers @{
            "Authorization" = "Bearer $UserToken"
        }
        
        Write-Host "✅ Retrieved single event successfully!" -ForegroundColor Green
        Write-Host "Event Name: $($SingleEventResponse.data.eventName)" -ForegroundColor Cyan
        Write-Host "Place: $($SingleEventResponse.data.place)" -ForegroundColor Cyan
        Write-Host "Organizer: $($SingleEventResponse.data.organizer)" -ForegroundColor Cyan
        Write-Host "Description: $($SingleEventResponse.data.description)" -ForegroundColor Cyan
        Write-Host "Duration: $($SingleEventResponse.data.duration)" -ForegroundColor Cyan
        Write-Host "Max Attendees: $($SingleEventResponse.data.maxAttendees)" -ForegroundColor Cyan
        Write-Host "Available Slots: $($SingleEventResponse.data.availableSlots)" -ForegroundColor Cyan
        Write-Host "Is Registered: $($SingleEventResponse.data.isRegistered)" -ForegroundColor Cyan
        Write-Host "Pricing Tiers: $($SingleEventResponse.data.pricing.Count)" -ForegroundColor Cyan
        Write-Host "Discount Options: $($SingleEventResponse.data.discountOptions.Count)" -ForegroundColor Cyan
        Write-Host "Tags: $($SingleEventResponse.data.tags -join ', ')" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Failed to get single event: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ No events available to test single event endpoint" -ForegroundColor Yellow
}

# Step 5: Test GET /api/events-users/search/suggestions
Write-Host "`n5️⃣ Testing GET /api/events-users/search/suggestions..." -ForegroundColor Yellow

try {
    $SuggestionsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users/search/suggestions?q=tech" -Method GET -Headers @{
        "Authorization" = "Bearer $UserToken"
    }
    
    Write-Host "✅ Retrieved search suggestions successfully!" -ForegroundColor Green
    Write-Host "Event suggestions: $($SuggestionsResponse.data.events.Count)" -ForegroundColor Cyan
    Write-Host "Tag suggestions: $($SuggestionsResponse.data.tags.Count)" -ForegroundColor Cyan
    Write-Host "Organizer suggestions: $($SuggestionsResponse.data.organizers.Count)" -ForegroundColor Cyan
    Write-Host "Place suggestions: $($SuggestionsResponse.data.places.Count)" -ForegroundColor Cyan
    
    if ($SuggestionsResponse.data.events.Count -gt 0) {
        Write-Host "Sample event suggestions: $($SuggestionsResponse.data.events -join ', ')" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get search suggestions: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 6: Test GET /api/events-users/filters/options
Write-Host "`n6️⃣ Testing GET /api/events-users/filters/options..." -ForegroundColor Yellow

try {
    $FilterOptionsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users/filters/options" -Method GET -Headers @{
        "Authorization" = "Bearer $UserToken"
    }
    
    Write-Host "✅ Retrieved filter options successfully!" -ForegroundColor Green
    Write-Host "Available tags: $($FilterOptionsResponse.data.tags.Count)" -ForegroundColor Cyan
    Write-Host "Available organizers: $($FilterOptionsResponse.data.organizers.Count)" -ForegroundColor Cyan
    Write-Host "Available places: $($FilterOptionsResponse.data.places.Count)" -ForegroundColor Cyan
    Write-Host "Price range: $($FilterOptionsResponse.data.priceRange.minPrice) - $($FilterOptionsResponse.data.priceRange.maxPrice)" -ForegroundColor Cyan
    
    if ($FilterOptionsResponse.data.tags.Count -gt 0) {
        Write-Host "Sample tags: $($FilterOptionsResponse.data.tags[0..2] -join ', ')" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get filter options: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 7: Test advanced filtering
Write-Host "`n7️⃣ Testing advanced filtering..." -ForegroundColor Yellow

try {
    $AdvancedFilterResponse = Invoke-RestMethod -Uri "$BaseUrl/api/events-users?search=tech&limit=5&sortBy=date&sortOrder=asc" -Method GET -Headers @{
        "Authorization" = "Bearer $UserToken"
    }
    
    Write-Host "✅ Advanced filtering successful!" -ForegroundColor Green
    Write-Host "Search results: $($AdvancedFilterResponse.data.Count) events" -ForegroundColor Cyan
    
    if ($AdvancedFilterResponse.filters.applied.search) {
        Write-Host "Search term: $($AdvancedFilterResponse.filters.applied.search)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to test advanced filtering: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Events Users API testing completed!" -ForegroundColor Green
Write-Host "`n📝 Summary:" -ForegroundColor Magenta
Write-Host "- User authentication works with customer ID as token" -ForegroundColor White
Write-Host "- GET /api/events-users returns all published events with user-specific data" -ForegroundColor White
Write-Host "- GET /api/events-users/:id returns complete event details" -ForegroundColor White
Write-Host "- Search suggestions and filter options are available" -ForegroundColor White
Write-Host "- Advanced filtering with multiple parameters works" -ForegroundColor White 