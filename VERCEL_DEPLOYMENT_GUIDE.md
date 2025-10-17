# 🚀 VERCEL DEPLOYMENT GUIDE - BAS Backend

## Prerequisites
- ✅ Vercel account created
- ✅ MongoDB Atlas cluster configured
- ✅ GitHub repository (recommended for continuous deployment)

---

## Step 1: Prepare MongoDB Atlas

### 1.1 Configure Network Access
1. Go to MongoDB Atlas Dashboard
2. Click "Network Access" in left sidebar
3. Click "Add IP Address"
4. Select "Allow access from anywhere" (0.0.0.0/0)
   - This is required for Vercel serverless functions
5. Click "Confirm"

### 1.2 Verify Connection String
Your MongoDB URI:
```
mongodb+srv://avnxk3:OS06ULy8EfD4cCD8@retailaidatacluster.pfxdh.mongodb.net/bams_production?retryWrites=true&w=majority&appName=RetailAIDataCluster
```

**⚠️ Security Note**: Change password after deployment for security.

---

## Step 2: Update package.json

Add the following to your `package.json`:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "vercel-build": "npm run build"
  },
  "engines": {
    "node": ">=18.x"
  }
}
```

---

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd "D:\Bhishma Solutions\Bhisshma Attendendence monitoring system\bas-backend"
   vercel
   ```

4. **Follow prompts**:
   - Set up and deploy: `Yes`
   - Which scope: Select your account
   - Link to existing project: `No`
   - Project name: `bas-backend` (or your choice)
   - Directory: `./` (current directory)
   - Override settings: `No`

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your Git repository (or upload folder)
4. Configure project:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Click "Deploy"

---

## Step 4: Configure Environment Variables in Vercel

After deployment, set environment variables:

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Environment Variables"
3. Add the following variables:

### Required Environment Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `PORT` | `4000` | Production |
| `HOST` | `0.0.0.0` | Production |
| `NODE_ENV` | `production` | Production |
| `MONGO_URI` | `mongodb+srv://avnxk3:OS06ULy8EfD4cCD8@retailaidatacluster.pfxdh.mongodb.net/bams_production?retryWrites=true&w=majority&appName=RetailAIDataCluster` | Production |
| `SESSION_TIMEOUT_HOURS` | `8` | Production |
| `HEARTBEAT_MINUTES` | `5` | Production |
| `AUTO_LOGOUT_CHECK_MINUTES` | `10` | Production |
| `LOCATION_PROXIMITY_METERS` | `3000` | Production |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app,https://your-admin.vercel.app` | Production |

**⚠️ Important**: Replace `CORS_ORIGINS` with your actual frontend URLs after you deploy them.

4. Click "Save" for each variable
5. Click "Redeploy" to apply the new environment variables

---

## Step 5: Get Your Production API URL

After deployment, Vercel will provide a URL like:
```
https://bas-backend-XXXXXX.vercel.app
```

Or if you configured a custom domain:
```
https://api.yourdomain.com
```

---

## Step 6: Update Frontend Configuration

### For Employee Mobile App (.env.production):
```properties
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
REACT_APP_API_TIMEOUT=15000
REACT_APP_API_RETRY_ATTEMPTS=3

REACT_APP_LOCATION_TIMEOUT=15000
REACT_APP_LOCATION_HIGH_ACCURACY=true
REACT_APP_LOCATION_MAX_AGE=60000

REACT_APP_HEARTBEAT_INTERVAL=300000
REACT_APP_HEARTBEAT_MAX_FAILURES=3
```

### For Admin Dashboard (.env.production):
```properties
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
REACT_APP_API_TIMEOUT=15000
REACT_APP_API_RETRY_ATTEMPTS=3
```

---

## Step 7: Test Production APIs

Test all endpoints with your production URL:

```bash
# Test health check
curl https://bas-backend-XXXXXX.vercel.app/api/auth/verify-session

# Test login
curl -X POST https://bas-backend-XXXXXX.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password",
    "deviceId": "test-device",
    "location": {"lat": 0, "lon": 0, "accuracy": 10}
  }'
```

---

## Step 8: Update CORS_ORIGINS

After deploying your frontends:

1. Go to Vercel Dashboard → Your Backend Project
2. Settings → Environment Variables
3. Update `CORS_ORIGINS` with actual frontend URLs:
   ```
   https://employee-app.vercel.app,https://admin-dashboard.vercel.app
   ```
4. Click "Redeploy" to apply changes

---

## 📋 Production API Endpoints

Once deployed, all endpoints will be available at:

### Base URL: `https://bas-backend-XXXXXX.vercel.app`

### Authentication
- POST `/api/auth/login` - User login
- POST `/api/auth/verify-session` - Verify session validity
- POST `/api/auth/logout` - User logout

### Users
- GET `/api/users` - List all users (filtered by query)
- GET `/api/users/:id` - Get user by ID
- POST `/api/users` - Create new user
- POST `/api/users/create-admin` - Create standalone admin
- PUT `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Delete user
- GET `/api/users/available-devices/:companyId` - Get available devices

### Devices
- POST `/api/device/register` - Register new device
- GET `/api/device` - List all devices (filtered by companyId)
- DELETE `/api/device/:id` - Delete device

### Sessions
- GET `/api/sessions` - Get sessions (with pagination)
- GET `/api/export` - Export sessions to CSV
- GET `/api/user-work-report` - User-specific work report

### Locations
- POST `/api/locations` - Create location
- GET `/api/locations` - List locations (filtered by companyId)
- POST `/api/locations/delete` - Delete location

### Companies
- POST `/api/companies` - Create company
- GET `/api/companies` - List all companies
- GET `/api/companies/:id` - Get company by ID
- PUT `/api/companies/:id` - Update company

### Attendance
- GET `/api/attendance/daily` - Daily attendance report
- GET `/api/attendance/monthly` - Monthly attendance report
- GET `/api/attendance/yearly` - Yearly attendance report
- GET `/api/attendance/analytics` - Attendance analytics

### Heartbeat
- POST `/api/heartbeat` - Send heartbeat to keep session alive

### Admin
- POST `/api/admin/assign-device` - Assign device to user

---

## 🔧 Troubleshooting

### Issue: "Module not found" errors
**Solution**: Ensure all dependencies are in `dependencies` (not `devDependencies`) in package.json:
```bash
npm install --save-prod @nestjs/core @nestjs/common mongoose etc.
```

### Issue: MongoDB connection timeout
**Solution**: 
1. Check MongoDB Atlas Network Access allows 0.0.0.0/0
2. Verify connection string is correct
3. Check MongoDB Atlas cluster is running

### Issue: CORS errors in frontend
**Solution**: 
1. Verify `CORS_ORIGINS` environment variable is set correctly
2. Ensure frontend URLs are exact (including https://)
3. Redeploy after updating CORS_ORIGINS

### Issue: 500 Internal Server Error
**Solution**:
1. Check Vercel function logs in Dashboard
2. Verify all environment variables are set
3. Check MongoDB connection string

### Issue: API routes return 404
**Solution**:
1. Verify `vercel.json` is in project root
2. Check build output in Vercel deployment logs
3. Ensure `dist/main.js` exists after build

---

## 📊 Monitoring

### View Logs:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments"
4. Click on latest deployment
5. View "Runtime Logs" and "Build Logs"

### MongoDB Monitoring:
1. Go to MongoDB Atlas Dashboard
2. Click "Metrics" to view:
   - Connection count
   - Query performance
   - Storage usage
   - Network traffic

---

## 🔐 Security Checklist

- [ ] MongoDB Atlas network access configured
- [ ] Environment variables set in Vercel (not in code)
- [ ] CORS restricted to specific domains
- [ ] MongoDB password is strong
- [ ] SESSION_TIMEOUT_HOURS is reasonable (8 hours)
- [ ] HEARTBEAT_MINUTES is appropriate (5 minutes)
- [ ] No sensitive data in logs
- [ ] .env files in .gitignore

---

## 🎯 Next Steps After Deployment

1. **Test all API endpoints** with production URL
2. **Deploy frontend applications** with production API URL
3. **Update CORS_ORIGINS** with actual frontend URLs
4. **Set up monitoring** and error tracking (Sentry recommended)
5. **Create first admin user** using `/api/users/create-admin`
6. **Test end-to-end flow** from mobile app login to admin dashboard
7. **Monitor MongoDB Atlas** for performance and storage
8. **Set up automatic backups** in MongoDB Atlas

---

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Check MongoDB Atlas metrics
3. Verify environment variables
4. Test API endpoints with curl/Postman
5. Review PRODUCTION_READINESS_REPORT.md for known issues

---

## 🎉 Deployment Complete!

Your production API will be available at:
```
https://bas-backend-XXXXXX.vercel.app
```

Update your frontend applications with this URL and you're ready to go! 🚀
