# 🚀 QUICK START - Deploy in 30 Minutes

## Step 1: MongoDB Atlas (5 min)
1. Go to https://cloud.mongodb.com
2. Navigate to "Network Access"
3. Click "Add IP Address" → "Allow access from anywhere" (0.0.0.0/0)
4. Click "Confirm"

## Step 2: Deploy to Vercel (10 min)
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Navigate to project
cd "D:\Bhishma Solutions\Bhisshma Attendendence monitoring system\bas-backend"

# Deploy
vercel --prod
```

## Step 3: Set Environment Variables in Vercel (5 min)
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add these (copy-paste ready):

```
PORT = 4000
HOST = 0.0.0.0
NODE_ENV = production
MONGO_URI = mongodb+srv://avnxk3:OS06ULy8EfD4cCD8@retailaidatacluster.pfxdh.mongodb.net/bams_production?retryWrites=true&w=majority&appName=RetailAIDataCluster
SESSION_TIMEOUT_HOURS = 8
HEARTBEAT_MINUTES = 5
AUTO_LOGOUT_CHECK_MINUTES = 10
LOCATION_PROXIMITY_METERS = 3000
CORS_ORIGINS = (leave empty for now, add frontend URLs later)
```

4. Click "Redeploy"

## Step 4: Get Your API URL
After deployment, Vercel shows:
```
https://bas-backend-XXXXXX.vercel.app
```

## Step 5: Update Frontend (5 min)
### Employee App .env.production:
```
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
REACT_APP_HEARTBEAT_INTERVAL=300000
```

### Admin Dashboard .env.production:
```
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
```

## Step 6: Deploy Frontends & Update CORS (5 min)
1. Deploy your frontend apps to Vercel
2. Get their URLs (e.g., https://employee-app.vercel.app)
3. Go back to backend in Vercel
4. Settings → Environment Variables
5. Update `CORS_ORIGINS`:
   ```
   https://employee-app.vercel.app,https://admin-dashboard.vercel.app
   ```
6. Click "Redeploy"

## ✅ Done! Test Your APIs

```bash
# Test verify-session
curl https://bas-backend-XXXXXX.vercel.app/api/auth/verify-session

# Should return 401 or error (expected since no session)
```

---

## 📚 Full Documentation
- **DEPLOYMENT_SUMMARY.md** - Complete overview
- **VERCEL_DEPLOYMENT_GUIDE.md** - Detailed steps
- **FRONTEND_INTEGRATION_GUIDE.md** - API reference
- **PRODUCTION_READINESS_REPORT.md** - Technical analysis

---

## 🎉 You're Live!
Your production API is now running on Vercel with MongoDB Atlas! 🚀
