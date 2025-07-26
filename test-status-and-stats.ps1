# Test PATCH /api/admin-events/:id/status and GET /api/admin-events/stats/overview - PowerShell Script

$BaseUrl = "http://localhost:5000"

Write-Host "🚀 Testing Status Update and Statistics Endpoints" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Step 1: Login to get token
Write-Host "`n1️⃣ Logging in as admin..." -ForegroundColor Yellow

$LoginBody = @{
    email = "admin@test.com"
    password = "password123"
} | ConvertTo-Json

try {
    $LoginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin/login" -Method POST -Headers @{
        "Content-Type" = "application/json"
    } -Body $LoginBody
    
    $Token = $LoginResponse.token
    Write-Host "✅ Login successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create a test event
Write-Host "`n2️⃣ Creating a test event..." -ForegroundColor Yellow

$CreateEventBody = @{
    eventName = "Test Event for Status Updates"
    date = "2024-06-15"
    eventTime = @{
        from = "10:00"
        to = "16:00"
    }
    place = "Test Venue"
    tags = @("test", "status")
    image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    pricing = @(
        @{
            name = "Test Pricing"
            description = "Test pricing tier"
            price = 50.00
            tags = @("test")
            slotsAvailable = 25
        }
    )
    discountOptions = @(
        @{
            name = "Test Discount"
            totalMembersNeeded = 3
            percentageDiscount = 10
        }
    )
    organizer = "Test Organizer"
    description = "Test event for status updates"
    duration = "6 hours"
    maxAttendees = 50
    availableSlots = 40
    status = "draft"
} | ConvertTo-Json -Depth 10

try {
    $CreateEventResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events" -Method POST -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $CreateEventBody
    
    $EventId = $CreateEventResponse.data._id
    Write-Host "✅ Event created successfully!" -ForegroundColor Green
    Write-Host "Event ID: $EventId" -ForegroundColor Cyan
    Write-Host "Initial Status: $($CreateEventResponse.data.status)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to create event: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test PATCH /api/admin-events/:id/status
Write-Host "`n3️⃣ Testing PATCH /api/admin-events/:id/status..." -ForegroundColor Yellow

$Statuses = @("published", "cancelled", "completed", "draft")

foreach ($status in $Statuses) {
    Write-Host "  Testing status: $status" -ForegroundColor White
    
    $StatusBody = @{
        status = $status
    } | ConvertTo-Json

    try {
        $StatusResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId/status" -Method PATCH -Headers @{
            "Authorization" = "Bearer $Token"
            "Content-Type" = "application/json"
        } -Body $StatusBody
        
        Write-Host "    ✅ Status updated to: $($StatusResponse.data.status)" -ForegroundColor Green
        Write-Host "    Event Name: $($StatusResponse.data.eventName)" -ForegroundColor Cyan
        Write-Host "    Place: $($StatusResponse.data.place)" -ForegroundColor Cyan
        Write-Host "    Tags: $($StatusResponse.data.tags -join ', ')" -ForegroundColor Cyan
        Write-Host "    Duration: $($StatusResponse.data.duration)" -ForegroundColor Cyan
        Write-Host "    Max Attendees: $($StatusResponse.data.maxAttendees)" -ForegroundColor Cyan
        Write-Host "    Available Slots: $($StatusResponse.data.availableSlots)" -ForegroundColor Cyan
        
    } catch {
        Write-Host "    ❌ Failed to update status to $status`: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

# Step 4: Test GET /api/admin-events/stats/overview
Write-Host "`n4️⃣ Testing GET /api/admin-events/stats/overview..." -ForegroundColor Yellow

try {
    $StatsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/stats/overview" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    
    Write-Host "✅ Statistics retrieved successfully!" -ForegroundColor Green
    Write-Host "`n📊 Event Statistics:" -ForegroundColor Magenta
    Write-Host "  Total Events: $($StatsResponse.data.total)" -ForegroundColor White
    Write-Host "  Published: $($StatsResponse.data.published)" -ForegroundColor White
    Write-Host "  Draft: $($StatsResponse.data.draft)" -ForegroundColor White
    Write-Host "  Completed: $($StatsResponse.data.completed)" -ForegroundColor White
    Write-Host "  Cancelled: $($StatsResponse.data.cancelled)" -ForegroundColor White
    Write-Host "  Upcoming: $($StatsResponse.data.upcoming)" -ForegroundColor White
    Write-Host "  Recent (30 days): $($StatsResponse.data.recent)" -ForegroundColor White
    Write-Host "  Total Attendees: $($StatsResponse.data.totalAttendees)" -ForegroundColor White
    
    Write-Host "`n🏷️ Top Tags:" -ForegroundColor Magenta
    foreach ($tag in $StatsResponse.data.byTags) {
        Write-Host "  $($tag._id): $($tag.count) events" -ForegroundColor White
    }
    
    Write-Host "`n👥 Top Organizers:" -ForegroundColor Magenta
    foreach ($organizer in $StatsResponse.data.byOrganizer) {
        Write-Host "  $($organizer._id): $($organizer.count) events" -ForegroundColor White
    }
    
    Write-Host "`n📍 Top Venues:" -ForegroundColor Magenta
    foreach ($place in $StatsResponse.data.byPlace) {
        Write-Host "  $($place._id): $($place.count) events" -ForegroundColor White
    }
    
    Write-Host "`n💰 Pricing & Slots:" -ForegroundColor Magenta
    $slots = $StatsResponse.data.slotsAndPricing
    Write-Host "  Total Max Attendees: $($slots.totalMaxAttendees)" -ForegroundColor White
    Write-Host "  Total Available Slots: $($slots.totalAvailableSlots)" -ForegroundColor White
    Write-Host "  Total Pricing Options: $($slots.totalPricingOptions)" -ForegroundColor White
    Write-Host "  Total Discount Options: $($slots.totalDiscountOptions)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Failed to get statistics: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $ErrorResponse = $_.Exception.Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($ErrorResponse)
        $ResponseBody = $Reader.ReadToEnd()
        Write-Host "Error details: $ResponseBody" -ForegroundColor Red
    }
}

# Step 5: Test invalid status
Write-Host "`n5️⃣ Testing invalid status..." -ForegroundColor Yellow

$InvalidStatusBody = @{
    status = "invalid_status"
} | ConvertTo-Json

try {
    $InvalidResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId/status" -Method PATCH -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $InvalidStatusBody
    
    Write-Host "❌ Should have failed with invalid status" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected invalid status: $($_.Exception.Message)" -ForegroundColor Green
}

# Step 6: Clean up - Delete the test event
Write-Host "`n6️⃣ Cleaning up - Deleting test event..." -ForegroundColor Yellow

try {
    $DeleteResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method DELETE -Headers @{
        "Authorization" = "Bearer $Token"
    }
    
    Write-Host "✅ Test event deleted successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to delete test event: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Status and Statistics testing completed!" -ForegroundColor Green 