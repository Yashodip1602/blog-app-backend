# BlogSphere API Backend

A robust RESTful API backend for the BlogSphere application, built with Node.js, Fastify, TypeScript, PostgreSQL, and Sequelize. It provides secure authentication, profile management, and a foundation for scalable blog application features.

## 🚀 Tech Stack

- **Framework**: [Fastify](https://www.fastify.io/) - Fast and low overhead web framework for Node.js
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Strongly typed programming language
- **Database**: [PostgreSQL](https://www.postgresql.org/) - Powerful, open-source object-relational database
- **ORM**: [Sequelize](https://sequelize.org/) - Promise-based Node.js ORM for Postgres
- **Authentication**: JWT (JSON Web Tokens) via `@fastify/jwt`
- **File Uploads**: `multipart/form-data` via `@fastify/multipart`

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your machine:
- Node.js (v18 or higher recommended)
- PostgreSQL (v14 or higher recommended)
- npm or yarn

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd App-B-BackLog
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory based on the following template:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=blogsphere

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Create Database:**
   Ensure your PostgreSQL server is running and create a database named `blogsphere` (or whatever you set in your `.env` file).

## 🏃‍♂️ Running the Application

- **Development Mode** (with hot-reload):
  ```bash
  npm run dev
  ```
- **Production Build & Run**:
  ```bash
  npm run build
  npm start
  ```

*The server will automatically sync the database models on startup.*

## 📁 Folder Structure

```text
src/
├── config/             # Environment and Database configuration
├── controllers/        # Request handlers for API routes
├── middleware/         # Custom Fastify hooks (e.g., JWT auth)
├── models/             # Sequelize database models
├── routes/             # Fastify route definitions
├── utils/              # Helper functions (hashing, file uploads)
└── server.ts           # Application entry point and setup
```

## 🔌 API Endpoints

### 1. Authentication & Profile

Base path: `/api/auth`

| Method | Endpoint | Description | Requires Auth? |
|--------|----------|-------------|----------------|
| POST   | `/register` | Register a new user (supports `profile_photo` upload) | No |
| POST   | `/login` | Login user with email and password | No |
| GET    | `/profile` | Get the logged-in user's profile data | Yes |
| PUT    | `/profile` | Update the logged-in user's profile data/photo | Yes |

#### Postman Testing Notes
- **Register/Update Profile**: Use `form-data` in Postman to pass files (for `profile_photo`) alongside text fields (`full_name`, `email`, `phone_no`, `password`).
- **Login/Profile**: Pass the generated `token` in the `Authorization` header as a `Bearer` token for protected routes.
- **Static Files**: Uploaded images are served statically via `http://localhost:<PORT>/uploads/<filename>`.

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.
