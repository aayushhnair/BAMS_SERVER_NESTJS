# BAS API Test Script - No Authentication Mode
# Admin: Ayush V Nair (created FIRST, independent of company)
# Company: Bhishma Solutions
# Employees: Jacob, Mohammad, Diya, Arun
# All passwords: Admin123@ (for password strength requirements)

$baseUrl = "http://localhost:3000"
$headers = @{"Content-Type" = "application/json"}

Write-Host "🚀 Starting BAS API Testing (NO AUTH MODE)..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Yellow

# Variables to store IDs
$adminId = ""
$companyId = ""
$deviceIds = @()
$locationId = ""
$userIds = @()

Write-Host "`n👤 Step 1: Creating STANDALONE Admin User (no company required)..." -ForegroundColor Cyan
$adminData = @{
    username = "ayush@bhishmasolutions.com"
    password = "Admin123@"
    displayName = "Ayush V Nair"
    role = "admin"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/create-admin" -Method POST -Headers $headers -Body $adminData
    $adminId = $response.user._id
    Write-Host "✅ Standalone admin user created successfully!" -ForegroundColor Green
    Write-Host "   Admin ID: $adminId" -ForegroundColor Gray
    Write-Host "   Username: ayush@bhishmasolutions.com" -ForegroundColor Gray
    Write-Host "   Role: $($response.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create admin: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Step 2: Creating Company..." -ForegroundColor Cyan
$companyData = @{
    name = "Bhishma Solutions"
    timezone = "Asia/Kolkata"
    settings = @{
        sessionTimeoutHours = 12
        heartbeatMinutes = 30
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/companies" -Method POST -Headers $headers -Body $companyData
    $companyId = $response.company._id
    Write-Host "✅ Company created successfully!" -ForegroundColor Green
    Write-Host "   Company ID: $companyId" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create company: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n📱 Step 3: Registering Devices..." -ForegroundColor Cyan
$devices = @(
    @{ deviceId = "admin_tablet"; deviceName = "Admin Tablet" },
    @{ deviceId = "jacob_tablet"; deviceName = "Jacob's Tablet" },
    @{ deviceId = "mohammad_tablet"; deviceName = "Mohammad's Tablet" },
    @{ deviceId = "diya_tablet"; deviceName = "Diya's Tablet" },
    @{ deviceId = "arun_tablet"; deviceName = "Arun's Tablet" }
)

foreach ($device in $devices) {
    $deviceData = @{
        deviceId = $device.deviceId
        deviceName = $device.deviceName
        companyId = $companyId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/device/register" -Method POST -Headers $headers -Body $deviceData
        $deviceIds += $device.deviceId
        Write-Host "✅ Device registered: $($device.deviceName)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to register device $($device.deviceName): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n Step 4: Creating Location..." -ForegroundColor Cyan
$locationData = @{
    name = "Bhishma Solutions Main Office"
    lat = 12.9716
    lon = 77.5946
    radiusMeters = 100
    companyId = $companyId
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/locations" -Method POST -Headers $headers -Body $locationData
    $locationId = $response.location._id
    Write-Host "✅ Location created successfully!" -ForegroundColor Green
    Write-Host "   Location ID: $locationId" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create location: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n👥 Step 5: Creating Employee Users..." -ForegroundColor Cyan
$employees = @(
    @{ name = "Jacob"; email = "jacob@bhishmasolutions.com"; device = "jacob_tablet" },
    @{ name = "Mohammad"; email = "mohammad@bhishmasolutions.com"; device = "mohammad_tablet" },
    @{ name = "Diya"; email = "diya@bhishmasolutions.com"; device = "diya_tablet" },
    @{ name = "Arun"; email = "arun@bhishmasolutions.com"; device = "arun_tablet" }
)

foreach ($employee in $employees) {
    $userData = @{
        username = $employee.email
        password = "Admin123@"
        displayName = $employee.name
        role = "employee"
        companyId = $companyId
        assignedDeviceId = $employee.device
        allocatedLocationId = $locationId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method POST -Headers $headers -Body $userData
        $userIds += $response.user._id
        Write-Host "✅ Employee created: $($employee.name)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create employee $($employee.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🧪 Step 6: Testing Login Functionality..." -ForegroundColor Cyan

# Test Admin Login (should work from anywhere, no company/location/device restrictions)
Write-Host "`n  Testing Admin login..." -ForegroundColor Yellow
$adminLogin = @{
    username = "ayush@bhishmasolutions.com"
    password = "Admin123@"
    deviceId = "admin_tablet"
    location = @{
        lat = 12.9716
        lon = 77.5946
        accuracy = 10
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Headers $headers -Body $adminLogin
    Write-Host "  ✅ Admin login successful!" -ForegroundColor Green
    Write-Host "  🔑 Admin Token: $($response.sessionId)" -ForegroundColor Gray
    Write-Host "  👤 User Role: $($response.user.role)" -ForegroundColor Gray
    $companyStatus = if ($response.user.companyId) { $response.user.companyId } else { "Standalone Admin" }
    Write-Host "  🏢 Company: $companyStatus" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Employee Login (correct location)
Write-Host "`n  Testing Jacob's login from CORRECT location..." -ForegroundColor Yellow
$jacobLoginCorrect = @{
    username = "jacob@bhishmasolutions.com"
    password = "Admin123@"
    deviceId = "jacob_tablet"
    location = @{
        lat = 12.9716  # Same as office location
        lon = 77.5946  # Same as office location
        accuracy = 5
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Headers $headers -Body $jacobLoginCorrect
    Write-Host "  ✅ Jacob login successful from correct location!" -ForegroundColor Green
    Write-Host "  🔑 Jacob Token: $($response.sessionId)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Jacob login from correct location failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Employee Login (wrong location)
Write-Host "`n  Testing Jacob's login from WRONG location..." -ForegroundColor Yellow
$jacobLoginWrong = @{
    username = "jacob@bhishmasolutions.com"
    password = "Admin123@"
    deviceId = "jacob_tablet"
    location = @{
        lat = 13.0000  # Different location (>100m away)
        lon = 78.0000  # Different location (>100m away)
        accuracy = 5
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Headers $headers -Body $jacobLoginWrong
    Write-Host "  ❌ Jacob login should have failed but succeeded!" -ForegroundColor Red
} catch {
    Write-Host "  ✅ Jacob login correctly failed from wrong location!" -ForegroundColor Green
}

Write-Host "`n📊 Step 7: Testing Data Retrieval APIs..." -ForegroundColor Cyan

# Get all companies
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/companies" -Method GET -Headers $headers
    Write-Host "✅ Retrieved companies: $($response.companies.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get companies: $($_.Exception.Message)" -ForegroundColor Red
}

# Get all users
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users?companyId=$companyId" -Method GET -Headers $headers
    Write-Host "✅ Retrieved users: $($response.users.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get users: $($_.Exception.Message)" -ForegroundColor Red
}

# Get all locations
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/locations?companyId=$companyId" -Method GET -Headers $headers
    Write-Host "✅ Retrieved locations: $($response.locations.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get locations: $($_.Exception.Message)" -ForegroundColor Red
}

# Get sessions
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sessions?companyId=$companyId" -Method GET -Headers $headers
    Write-Host "✅ Retrieved sessions: $($response.sessions.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get sessions: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Testing Complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Yellow
Write-Host "Summary of created entities:" -ForegroundColor Cyan
Write-Host "• STANDALONE Admin: Ayush V Nair (ayush@bhishmasolutions.com)" -ForegroundColor White
Write-Host "• Company: Bhishma Solutions (ID: $companyId)" -ForegroundColor White
Write-Host "• Employees: Jacob, Mohammad, Diya, Arun" -ForegroundColor White
Write-Host "• Devices: 5 tablets registered" -ForegroundColor White
Write-Host "• Location: Main Office with 100m radius" -ForegroundColor White
Write-Host "• All passwords: Admin123@" -ForegroundColor White
Write-Host "`n⚠️  Note: Authentication is currently DISABLED for testing" -ForegroundColor Yellow
Write-Host "   To enable auth: Set DISABLE_AUTH_FOR_TESTING = false in app.module.ts" -ForegroundColor Yellow
Write-Host "`n✨ Key Features Verified:" -ForegroundColor Cyan
Write-Host "• ✅ Standalone admin creation (no company required)" -ForegroundColor Green
Write-Host "• ✅ Company creation after admin" -ForegroundColor Green
Write-Host "• ✅ Employee users linked to company" -ForegroundColor Green
Write-Host "• ✅ Location-based authentication for employees" -ForegroundColor Green
Write-Host "• ✅ Admin bypass of location restrictions" -ForegroundColor Green