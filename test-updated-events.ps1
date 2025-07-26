# Test Updated Admin Events API - PowerShell Script
# Tests the GET /api/admin-events endpoint with all fields included

$BaseUrl = "http://localhost:5000"

Write-Host "🚀 Testing Updated Admin Events API" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green

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

# Step 2: Test GET /api/admin-events with all fields
Write-Host "`n2️⃣ Testing GET /api/admin-events (all fields included)..." -ForegroundColor Yellow

try {
    $AllEvents = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    
    Write-Host "✅ Retrieved events successfully!" -ForegroundColor Green
    Write-Host "Total events: $($AllEvents.pagination.totalItems)" -ForegroundColor Cyan
    
    if ($AllEvents.data.Count -gt 0) {
        $FirstEvent = $AllEvents.data[0]
        Write-Host "`n📋 First Event Details:" -ForegroundColor Magenta
        Write-Host "  Event Name: $($FirstEvent.eventName)" -ForegroundColor White
        Write-Host "  Place: $($FirstEvent.place)" -ForegroundColor White
        Write-Host "  Tags: $($FirstEvent.tags -join ', ')" -ForegroundColor White
        Write-Host "  Duration: $($FirstEvent.duration)" -ForegroundColor White
        Write-Host "  Max Attendees: $($FirstEvent.maxAttendees)" -ForegroundColor White
        Write-Host "  Available Slots: $($FirstEvent.availableSlots)" -ForegroundColor White
        Write-Host "  Status: $($FirstEvent.status)" -ForegroundColor White
        Write-Host "  Created At: $($FirstEvent.createdAt)" -ForegroundColor White
        Write-Host "  Updated At: $($FirstEvent.updatedAt)" -ForegroundColor White
        
        # Check if discount options exist
        if ($FirstEvent.discountOptions -and $FirstEvent.discountOptions.Count -gt 0) {
            Write-Host "  Discount Options: $($FirstEvent.discountOptions.Count)" -ForegroundColor White
        }
        
        # Check computed fields
        Write-Host "  Formatted Date: $($FirstEvent.formattedDate)" -ForegroundColor White
        Write-Host "  Formatted Time: $($FirstEvent.formattedTime)" -ForegroundColor White
        Write-Host "  Attendees Count: $($FirstEvent.attendeesCount)" -ForegroundColor White
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

# Step 3: Test with filters
Write-Host "`n3️⃣ Testing with filters..." -ForegroundColor Yellow

try {
    $FilteredEvents = Invoke-RestMethod -Uri "$BaseUrl/api/admin-events?status=published&limit=2" -Method GET -Headers @{
        "Authorization" = "Bearer $Token"
    }
    
    Write-Host "✅ Filtered events retrieved successfully!" -ForegroundColor Green
    Write-Host "Filtered events count: $($FilteredEvents.data.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to get filtered events: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Testing completed!" -ForegroundColor Green 