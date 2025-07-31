# Admin Events API Test Script for PowerShell
# Make sure to replace YOUR_JWT_TOKEN with the actual token from login

$BaseUrl = "http://localhost:5000"
$Token = "YOUR_JWT_TOKEN"  # Replace with actual token

Write-Host "🚀 Testing Admin Events API" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Test 1: Create Event
Write-Host "`n1️⃣ Creating a new event..." -ForegroundColor Yellow

$CreateEventBody = @{
    eventName = "Test Tech Conference"
    date = "2024-03-15"
    eventTime = @{
        from = "09:00"
        to = "17:00"
    }
    place = "Test Convention Center"
    tags = @("test", "technology")
    pricing = @(
        @{
            name = "Test Early Bird"
            description = "Test pricing"
            price = 99.00
            tags = @("test")
            slotsAvailable = 50
        }
    )
    discountOptions = @(
        @{
            name = "Test Group Discount"
            totalMembersNeeded = 5
            percentageDiscount = 15
        }
    )
    organizer = "Test Organizer"
    description = "Test event description"
    duration = "8 hours"
    maxAttendees = 100
    availableSlots = 80
    status = "draft"
} | ConvertTo-Json -Depth 10

try {
    $CreateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events" -Method POST -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $CreateEventBody
    
    Write-Host "✅ Event created successfully" -ForegroundColor Green
    $EventId = $CreateResponse.data._id
    Write-Host "Event ID: $EventId" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to create event: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Get All Events
Write-Host "`n2️⃣ Getting all events..." -ForegroundColor Yellow
try {
    $AllEvents = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    Write-Host "✅ Retrieved events successfully" -ForegroundColor Green
    Write-Host "Total events: $($AllEvents.pagination.totalItems)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to get events: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Get Single Event
Write-Host "`n3️⃣ Getting single event..." -ForegroundColor Yellow
try {
    $SingleEvent = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    Write-Host "✅ Retrieved single event successfully" -ForegroundColor Green
    Write-Host "Event name: $($SingleEvent.data.eventName)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to get single event: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Update Event
Write-Host "`n4️⃣ Updating event..." -ForegroundColor Yellow
$UpdateBody = @{
    eventName = "Updated Test Tech Conference"
    status = "published"
} | ConvertTo-Json

try {
    $UpdateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method PUT -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $UpdateBody
    Write-Host "✅ Event updated successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update event: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Update Event Status
Write-Host "`n5️⃣ Updating event status..." -ForegroundColor Yellow
$StatusBody = @{
    status = "published"
} | ConvertTo-Json

try {
    $StatusResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId/status" -Method PATCH -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $StatusBody
    Write-Host "✅ Event status updated successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update event status: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Get Event Statistics
Write-Host "`n6️⃣ Getting event statistics..." -ForegroundColor Yellow
try {
    $Stats = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/stats/overview" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    Write-Host "✅ Retrieved statistics successfully" -ForegroundColor Green
    Write-Host "Total events: $($Stats.data.total)" -ForegroundColor Cyan
    Write-Host "Published events: $($Stats.data.published)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to get statistics: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Search Events
Write-Host "`n7️⃣ Searching events..." -ForegroundColor Yellow
try {
    $SearchResults = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events?search=tech" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    Write-Host "✅ Search completed successfully" -ForegroundColor Green
    Write-Host "Found $($SearchResults.data.Count) events" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to search events: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Delete Event
Write-Host "`n8️⃣ Deleting event..." -ForegroundColor Yellow
try {
    $DeleteResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method DELETE -Headers @{
        "Authorization" = "Bearer $Token"
    }
    Write-Host "✅ Event deleted successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to delete event: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Testing completed!" -ForegroundColor Green 