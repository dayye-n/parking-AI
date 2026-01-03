# ParkSense - Parking Recommendation App

A full-stack parking recommendation application with a FastAPI backend and React Native (Expo) mobile frontend. ParkSense helps users find the best parking spots near their destination by analyzing driving time, walking distance, traffic congestion, and pricing.

## Features

- **Location-based Search**: Uses your current location and destination to find nearby parking
- **Google Places Integration**: Autocomplete destination search with Google Places API
- **Smart Recommendations**: Ranks parking options by walk time, congestion, drive time, and price
- **Real-time Traffic Data**: Uses Google Distance Matrix to calculate actual driving times with traffic
- **Optional Authentication**: Search works without login; users can optionally register to save favorites later

## Project Structure

```
parksense/
├── backend/          # FastAPI backend with PostgreSQL
│   ├── alembic/      # Database migrations
│   ├── data/         # Seed data
│   ├── main.py       # FastAPI app (existing + new auth endpoints)
│   ├── models.py     # SQLAlchemy models
│   ├── schemas.py    # Pydantic schemas
│   ├── auth.py       # JWT & password hashing
│   ├── database.py   # Database configuration
│   ├── dependencies.py # Auth dependencies
│   └── docker-compose.yml
└── mobile/           # React Native Expo app
    ├── src/
    │   ├── screens/  # Login, Register, Home, CreateSpot, SpotDetails
    │   ├── api/      # API client & endpoints
    │   ├── context/  # Auth context
    │   └── config.ts # API configuration
    └── App.tsx
```

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm/yarn
- PostgreSQL 15+ (or Docker)
- Expo CLI (`npm install -g expo-cli`)

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://parksense_user:parksense_pass@localhost:5432/parksense_db

# JWT Secret Key (change in production!)
SECRET_KEY=your-super-secret-key-change-in-production-min-32-characters-long

# Qdrant (existing)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Google Maps API (existing)
GOOGLE_MAPS_API_KEY=
```

### 3. Start PostgreSQL

**Option A: Using Docker Compose (Recommended)**

```bash
cd backend
docker-compose up -d
```

**Option B: Local PostgreSQL**

1. Install PostgreSQL 15+
2. Create database:
   ```sql
   CREATE USER parksense_user WITH PASSWORD 'parksense_pass';
   CREATE DATABASE parksense_db OWNER parksense_user;
   ```
3. Update `DATABASE_URL` in `.env` if needed

### 4. Run Database Migrations

```bash
cd backend

# Initialize Alembic (if not already done)
# alembic init alembic  # Already created

# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

### 5. Start the Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

**API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Mobile App Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure API Base URL

Edit `mobile/src/config.ts` and set `API_BASE_URL` based on your setup:

- **Android Emulator**: `http://10.0.2.2:8000`
- **iOS Simulator**: `http://localhost:8000`
- **Physical Device**: `http://YOUR_COMPUTER_IP:8000` (e.g., `http://192.168.1.100:8000`)

**To find your computer's IP:**
- Windows: Run `ipconfig` and look for "IPv4 Address"
- Mac/Linux: Run `ifconfig` or `ip addr`

### 3. Start the Mobile App

```bash
cd mobile
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on physical device

## How to Test ParkSense End-to-End

### 1. Test Backend Endpoints

**Get autocomplete suggestions:**
```bash
curl "http://localhost:8000/places/autocomplete?q=Dubai%20Mall"
```

**Get place details:**
```bash
curl "http://localhost:8000/places/details?place_id=ChIJ..."
```

**Get parking recommendations:**
```bash
curl -X POST "http://localhost:8000/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_lat": 25.2048,
    "origin_lng": 55.2708,
    "destination_place_id": "ChIJN1t_tDeuXz4RBY9KGkI2jVI",
    "results": 6,
    "sort": "best"
  }'
```

### 2. Test Mobile App Flow

1. **Start the app**: Run `npm start` in the mobile directory
2. **Allow location access**: Grant location permissions when prompted
3. **Search destination**: Type a destination (e.g., "Dubai Mall") in the search box
4. **Select suggestion**: Tap a suggestion from the autocomplete dropdown
5. **Find parking**: Tap "Find Parking" button
6. **View results**: See ranked parking recommendations with:
   - Walk time to destination
   - Drive time from your location
   - Traffic congestion indicator
   - Price estimate
   - Reasons why each parking is recommended
7. **Open directions**: Tap any recommendation card or "Open in Google Maps" to get directions
8. **Sort results**: Use the sort buttons (Best, Distance, Price, Congestion) to reorder results

### 3. Test with Swagger UI

Visit http://localhost:8000/docs to test all endpoints interactively.

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (OAuth2 password flow)
- `GET /auth/me` - Get current user (protected)

### Parking Spots (Protected)

- `GET /parking-spots` - List user's parking spots
- `GET /parking-spots/{id}` - Get parking spot by ID
- `POST /parking-spots` - Create new parking spot
- `PUT /parking-spots/{id}` - Update parking spot
- `DELETE /parking-spots/{id}` - Delete parking spot

### Existing Endpoints (Public)

- `POST /suggest` - Get parking suggestions
- `GET /geocode` - Geocode address
- `GET /insights` - Get insights
- `GET /timeline` - Get timeline events
- `GET /status-board` - Get status board
- `GET /dispatch` - Get dispatch events
- `GET /config` - Get configuration

## Database Schema

### Users Table
- `id` (Integer, Primary Key)
- `email` (String, Unique, Indexed)
- `hashed_password` (String)
- `full_name` (String, Nullable)
- `created_at` (DateTime)
- `updated_at` (DateTime)

### Parking Spots Table
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key → users.id)
- `title` (String)
- `location` (String)
- `status` (String, Default: "active")
- `lat` (Float, Nullable)
- `lng` (Float, Nullable)
- `notes` (Text, Nullable)
- `created_at` (DateTime)
- `updated_at` (DateTime)

## Security Features

- **JWT Authentication**: Access tokens with 30-day expiration
- **Password Hashing**: bcrypt via passlib
- **Protected Routes**: User can only access their own parking spots
- **Secure Token Storage**: expo-secure-store for mobile app
- **CORS**: Enabled for local development

## Troubleshooting

### Backend Issues

**Database connection error:**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Verify database exists and user has permissions

**Migration errors:**
- Run `alembic upgrade head` to apply migrations
- If tables already exist, use `alembic revision --autogenerate` to sync

**Import errors:**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Activate virtual environment

### Mobile App Issues

**Cannot connect to API:**
- Check `API_BASE_URL` in `mobile/src/config.ts`
- For physical device: Ensure phone and computer are on same network
- For Android emulator: Use `10.0.2.2` instead of `localhost`
- Check backend is running on port 8000

**Token not persisting:**
- Ensure `expo-secure-store` is installed
- Check device/simulator supports secure storage

**Navigation errors:**
- Ensure all screen components are properly exported
- Check navigation stack configuration in `App.tsx`

## Development Notes

- Backend uses SQLAlchemy 2.0 with async support ready
- Alembic migrations are set up for database versioning
- Mobile app uses React Navigation for routing
- Axios interceptors handle token attachment and 401 errors
- Auth context manages authentication state globally

## Next Steps

- Add refresh tokens for better security
- Implement password reset functionality
- Add parking spot search and filtering
- Integrate with maps for location selection
- Add push notifications
- Deploy backend to production (e.g., Railway, Render)
- Build and publish mobile app to stores


