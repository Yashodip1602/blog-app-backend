# App-B-BackLog — Backend API

A professional, production-ready RESTful API backend for App-B-BackLog. It provides user authentication, role-based access control, file uploads, and a foundation for building a scalable blog management application.

**Tech stack**
- Node.js + TypeScript
- Fastify (HTTP framework)
- PostgreSQL (relational database)
- Sequelize (ORM)
- JWT for authentication

**Primary features**
- User registration and login (email/password)
- JWT-based authentication and protected routes
- Role management (admin, user, etc.) and a role seeder (`src/service/role-seed.service.ts`)
- Profile photo uploads and static file serving

**Repository layout (key files)**
- `src/server.ts` — application entry point
- `src/config/` — database and environment configuration
- `src/controllers/` — route handlers
- `src/routes/` — route definitions (including `auth` routes)
- `src/middleware/` — auth middleware and request hooks
- `src/models/` — Sequelize models (`user`, `role`, associations)
- `src/service/` — business logic (authentication, seeding)

**Quick start**
1. Clone the repository and install dependencies:
```bash
git clone https://github.com/Yashodip1602/blog-app-backend.git
cd App-B-BackLog
npm install
```
2. Create a `.env` file in the project root (see Environment variables below).
3. Start the development server:
```bash
npm run dev
```

**Environment variables**
Create a `.env` file in the project root and set the following keys. Adjust values to your environment.

```env
# Server
PORT=3000
NODE_ENV=development/production

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=app_b_backlog

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# File uploads / storage
UPLOAD_DIR=uploads

# Production (connection database or s3)

# AWS RDS
DB_HOST=
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DB_NAME=
DB_SSL=true

# AWS (S3 + credentials)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=


# Cloudinary (file uploads for development)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Notes:
- `JWT_SECRET` must be a long, unpredictable string. Keep it secret.
- `DB_*` values should match your PostgreSQL configuration.

**Running seeders**
To create default roles (admin/user) run the role seeder implemented in `src/service/role-seed.service.ts` (adapt to your project scripts or run the seeder script you have configured).

**Available scripts**
- `npm run dev` — start in development mode (hot reload)
- `npm run build` — compile TypeScript for production
- `npm start` — run the compiled production build

**API overview**
- Base auth routes are mounted under `/api/auth` (see `src/routes/auth.routes.ts`). Typical endpoints:
  - `POST /api/auth/register` — register a new user (multipart for profile photo)
  - `POST /api/auth/login` — login and receive JWT
  - `GET /api/auth/profile` — get current user's profile (protected)
  - `PUT /api/auth/profile` — update profile (protected)

When testing protected endpoints, send the JWT in the `Authorization` header as: `Authorization: Bearer <token>`.

**Development tips**
- Keep a local `.env` (do not commit it).
- Use Postman or similar to test multipart file uploads (use `form-data` for files).
- Check `src/utils/hashPassword.ts` for password hashing strategy and `src/middleware/jwt.ts` for token handling.

**Contributing**
1. Fork the repository
2. Create a feature branch
3. Open a pull request with a clear description and tests where applicable

**License**
This project is provided under the ISC License.

**Contact**
If you need help or want to contribute, open an issue or contact the maintainer listed in the repository metadata.
