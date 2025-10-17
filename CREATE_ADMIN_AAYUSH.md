# Create Admin User - aayushhnair

## PowerShell Command:

```powershell
$body = @{
    username = "aayushhnair"
    password = "YourSecurePassword123!"
    displayName = "Aayush Nair"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:4000/api/users/create-admin" -Method POST -Body $body -ContentType "application/json"
```

## Or using curl (if available):

```bash
curl -X POST http://localhost:4000/api/users/create-admin \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"aayushhnair\",\"password\":\"YourSecurePassword123!\",\"displayName\":\"Aayush Nair\"}"
```

## Then Login:

```powershell
$loginBody = @{
    username = "aayushhnair"
    password = "YourSecurePassword123!"
    deviceId = "web-dashboard"
    location = @{
        lat = 0
        lon = 0
        accuracy = 10
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:4000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
```

## Current Situation:

**Existing Admin:** `sreedeep@bhisshma.com`
**Trying to Login:** `aayushhnair` (doesn't exist)

**Solution:** Either:
1. Login with `sreedeep@bhisshma.com` 
2. Create new admin user `aayushhnair` using the commands above
