# Test PUT /api/admin-events/:id Endpoint - PowerShell Script
# Tests updating an event with all available fields

$BaseUrl = "http://localhost:5000"

Write-Host "🚀 Testing PUT /api/admin-events/:id Endpoint" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

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

# Step 2: Create an event first (if needed)
Write-Host "`n2️⃣ Creating a test event..." -ForegroundColor Yellow

$CreateEventBody = @{
    eventName = "Test Event for Update"
    date = "2024-04-15"
    eventTime = @{
        from = "10:00"
        to = "16:00"
    }
    place = "Test Venue"
    tags = @("test", "update")
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
    description = "Test event for updating"
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
} catch {
    Write-Host "❌ Failed to create event: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Update the event with all fields
Write-Host "`n3️⃣ Updating event with all fields..." -ForegroundColor Yellow

$UpdateEventBody = @{
    eventName = "Updated Test Event"
    date = "2024-05-20"
    eventTime = @{
        from = "14:00"
        to = "20:00"
    }
    place = "Updated Test Venue"
    tags = @("updated", "test", "modified")
    image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    pricing = @(
        @{
            name = "Updated Early Bird"
            description = "Updated early bird pricing"
            price = 75.00
            tags = @("early-bird", "updated")
            slotsAvailable = 30
        },
        @{
            name = "Updated Regular"
            description = "Updated regular pricing"
            price = 100.00
            tags = @("regular", "updated")
            slotsAvailable = 50
        }
    )
    discountOptions = @(
        @{
            name = "Updated Group Discount"
            totalMembersNeeded = 5
            percentageDiscount = 15
        },
        @{
            name = "Updated Student Discount"
            totalMembersNeeded = 1
            percentageDiscount = 20
        }
    )
    organizer = "Updated Test Organizer"
    description = "This is an updated test event with all fields modified"
    duration = "6 hours"
    maxAttendees = 80
    availableSlots = 60
    status = "published"
} | ConvertTo-Json -Depth 10

try {
    $UpdateEventResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method PUT -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $UpdateEventBody
    
    Write-Host "✅ Event updated successfully!" -ForegroundColor Green
    Write-Host "Updated Event Name: $($UpdateEventResponse.data.eventName)" -ForegroundColor Cyan
    Write-Host "Updated Place: $($UpdateEventResponse.data.place)" -ForegroundColor Cyan
    Write-Host "Updated Date: $($UpdateEventResponse.data.date)" -ForegroundColor Cyan
    Write-Host "Updated Status: $($UpdateEventResponse.data.status)" -ForegroundColor Cyan
    Write-Host "Updated Tags: $($UpdateEventResponse.data.tags -join ', ')" -ForegroundColor Cyan
    Write-Host "Updated Duration: $($UpdateEventResponse.data.duration)" -ForegroundColor Cyan
    Write-Host "Updated Max Attendees: $($UpdateEventResponse.data.maxAttendees)" -ForegroundColor Cyan
    Write-Host "Updated Available Slots: $($UpdateEventResponse.data.availableSlots)" -ForegroundColor Cyan
    Write-Host "Pricing Tiers: $($UpdateEventResponse.data.pricing.Count)" -ForegroundColor Cyan
    Write-Host "Discount Options: $($UpdateEventResponse.data.discountOptions.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to update event: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $ErrorResponse = $_.Exception.Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($ErrorResponse)
        $ResponseBody = $Reader.ReadToEnd()
        Write-Host "Error details: $ResponseBody" -ForegroundColor Red
    }
}

# Step 4: Test partial update (only some fields)
Write-Host "`n4️⃣ Testing partial update..." -ForegroundColor Yellow

$PartialUpdateBody = @{
    eventName = "Partially Updated Event"
    status = "draft"
    tags = @("partial", "update")
} | ConvertTo-Json

try {
    $PartialUpdateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method PUT -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    } -Body $PartialUpdateBody
    
    Write-Host "✅ Partial update successful!" -ForegroundColor Green
    Write-Host "Updated Event Name: $($PartialUpdateResponse.data.eventName)" -ForegroundColor Cyan
    Write-Host "Updated Status: $($PartialUpdateResponse.data.status)" -ForegroundColor Cyan
    Write-Host "Updated Tags: $($PartialUpdateResponse.data.tags -join ', ')" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to partially update event: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Clean up - Delete the test event
Write-Host "`n5️⃣ Cleaning up - Deleting test event..." -ForegroundColor Yellow

try {
    $DeleteResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events/$EventId" -Method DELETE -Headers @{
        "Authorization" = "Bearer $Token"
    }
    
    Write-Host "✅ Test event deleted successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to delete test event: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 PUT endpoint testing completed!" -ForegroundColor Green 