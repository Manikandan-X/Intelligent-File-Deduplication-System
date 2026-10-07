# Intelligent File Deduplication & Storage Optimization System

A backend system built with **FastAPI** that provides secure file management, duplicate file detection, storage analytics, safe deletion, and asynchronous background file processing.

The system identifies duplicate files based on their **content hash**, rather than filename. Therefore, files with different names but identical content can be detected as duplicates.

---

## Features

### Authentication & Authorization

* User registration and login
* JWT-based authentication
* Password hashing using Argon2
* Role-based access control
* Admin and User roles
* Protected API endpoints

### File Management

* Upload files
* Download files
* View file information
* Delete files
* Search files
* Filter files
* Pagination
* Sorting
* File metadata management
* File protection

### Duplicate Detection

* SHA-256 content hashing
* Chunk-based file hashing
* Duplicate detection based on file content
* Duplicate group creation
* Original file identification
* Duplicate count calculation
* Storage savings calculation

Files with different:

* filenames
* upload times
* storage filenames

can still be detected as duplicates when their contents are identical.

### Background Processing

Large-file processing is handled asynchronously using:

* Celery
* Redis

After a file is uploaded, the API queues background processing for:

1. File hashing
2. Duplicate detection
3. Duplicate group creation/update
4. Audit logging

This prevents lengthy hashing operations from blocking the API request.

### Storage Analytics

The backend provides storage information including:

* Total files
* Total storage
* Duplicate files
* Duplicate storage
* Potential storage savings
* Largest files
* Recent uploads

### Safe File Management

* Protected files cannot be deleted
* Deletion history is maintained
* File deletion is implemented as a logical delete
* Audit logs record important file operations

### Validation & Security

* File size validation
* File type validation
* Authentication checks
* Authorization checks
* Secure password hashing
* JWT validation
* Centralized exception handling
* Environment-based configuration
* Database error handling

---

# Technology Stack

| Technology     | Purpose                       |
| -------------- | ----------------------------- |
| Python 3.12    | Programming language          |
| FastAPI        | REST API framework            |
| SQLAlchemy     | ORM and database interaction  |
| Alembic        | Database migrations           |
| Pydantic       | Data validation               |
| MySQL 8.0      | Relational database           |
| Celery         | Background task processing    |
| Redis          | Celery broker/result backend  |
| JWT            | Authentication                |
| Argon2         | Password hashing              |
| Pytest         | Testing                       |
| Docker         | Containerization              |
| Docker Compose | Multi-container orchestration |

---

# Project Architecture

```text
backend/
│
├── app/
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   │
│   ├── db/
│   │   ├── base.py
│   │   ├── base_class.py
│   │   └── session.py
│   │
│   ├── dependencies/
│   │   └── auth.py
│   │
│   ├── models/
│   │
│   ├── repositories/
│   │
│   ├── routers/
│   │
│   ├── schemas/
│   │
│   ├── services/
│   │
│   ├── tasks/
│   │
│   ├── utils/
│   │
│   ├── celery_app.py
│   └── main.py
│
├── alembic/
│   └── versions/
│
├── test/
│
├── storage/
│   └── files/
│
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

> The `storage/files/` directory is used for locally stored uploaded files. Uploaded files are intentionally excluded from Git and Docker builds.

---

# Prerequisites

Install the following before running the project:

* Docker Desktop
* Git

No local Python virtual environment is required when running the backend through Docker.

---

# Environment Configuration

Create a `.env` file in the backend root directory.

Example:

```env
APP_NAME=Intelligent File Deduplication & Storage Optimization System
APP_VERSION=1.0.0
DEBUG=True

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=file_dedup_db
MYSQL_USER=file_dedup_user
MYSQL_PASSWORD=your_password
MYSQL_ROOT_PASSWORD=your_root_password

DATABASE_URL=mysql+pymysql://file_dedup_user:your_password@mysql:3306/file_dedup_db

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TTL=300

CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

JWT_SECRET_KEY=your_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

MAX_FILE_SIZE=92274688
```

### Important

Do **not** commit the real `.env` file to Git.

Use `.env.example` to provide the required environment variable names without exposing real credentials or secrets.

---

# Run the Backend with Docker

Open PowerShell in the backend project directory.

## 1. Build the containers

```powershell
docker compose build
```

## 2. Start the services

```powershell
docker compose up -d
```

The project starts the following services:

```text
Backend
MySQL
Redis
Celery Worker
```

---

# Check Running Containers

```powershell
docker compose ps
```

You should see containers similar to:

```text
file_dedup_backend
file_dedup_mysql
file_dedup_redis
file_dedup_celery
```

---

# Backend API

The backend is exposed on host port `8002`.

```text
http://localhost:8002
```

---

# Swagger API Documentation

FastAPI automatically provides Swagger UI.

Open:

```text
http://localhost:8002/docs
```

Swagger can be used to:

* Register users
* Login
* Authorize using JWT
* Upload files
* Download files
* Search files
* Delete files
* Manage file protection
* View duplicate groups
* View analytics
* View audit logs

---

# ReDoc

FastAPI also provides ReDoc:

```text
http://localhost:8002/redoc
```

---

# Health Check

Check whether the backend is running:

```text
GET /health
```

Using the browser or Swagger:

```text
http://localhost:8002/health
```

---

# Database Migrations

Alembic is used to manage database schema changes.

Run migrations inside the backend container:

```powershell
docker exec -it file_dedup_backend alembic upgrade head
```

Check the current migration:

```powershell
docker exec -it file_dedup_backend alembic current
```

View migration history:

```powershell
docker exec -it file_dedup_backend alembic history
```

---

# Celery Worker

The Celery worker runs in a separate container.

Check worker logs:

```powershell
docker logs file_dedup_celery
```

Follow the worker logs:

```powershell
docker logs -f file_dedup_celery
```

When a file is uploaded, the API sends the file-processing task to Celery through Redis.

---

# File Processing Flow

The general upload flow is:

```text
Client
   │
   │ Upload File
   ▼
FastAPI
   │
   ├── Validate File
   ├── Save File
   ├── Save File Metadata
   └── Queue Celery Task
             │
             ▼
           Redis
             │
             ▼
        Celery Worker
             │
             ├── Calculate SHA-256 Hash
             │
             ├── Store File Hash
             │
             ├── Detect Duplicate
             │
             ├── Create/Update Duplicate Group
             │
             └── Create Audit Log
```

---

# Duplicate Detection

Duplicate detection is based on the **content hash** of a file.

For example:

```text
File A
name: report.pdf
content: ABC123
SHA-256: XYZ789

File B
name: report_copy.pdf
content: ABC123
SHA-256: XYZ789
```

Although the filenames are different, the content hash is the same.

Therefore:

```text
File A = Original
File B = Duplicate
```

The system can then calculate the potential storage savings from removing the duplicate.

---

# File Storage

Uploaded files are stored locally under:

```text
storage/files/
```

The application generates a unique stored filename for each uploaded file.

The original filename is stored separately in the database.

For example:

```text
Original filename:
report.pdf

Stored filename:
8f4a1c...9d.pdf
```

This prevents filename collisions.

---

# Database Tables

The system uses the following main tables:

```text
users
roles
files
file_hashes
duplicate_groups
file_metadata
deletion_history
audit_logs
```

### `users`

Stores user account information and authentication details.

### `roles`

Stores application roles such as:

```text
Admin
User
```

### `files`

Stores file information such as:

* filename
* stored filename
* file path
* MIME type
* file size
* owner
* protection status
* deletion status

### `file_hashes`

Stores content hashes used for duplicate detection.

### `duplicate_groups`

Groups files with identical content hashes.

### `file_metadata`

Stores additional file metadata.

### `deletion_history`

Maintains a record of deleted files.

### `audit_logs`

Records important system and file operations.

---

# API Authentication

The API uses JWT bearer authentication.

Typical flow:

```text
Register
   ↓
Login
   ↓
Receive JWT Access Token
   ↓
Authorize API Requests
```

Authenticated requests use:

```text
Authorization: Bearer <access_token>
```

---

# Testing

Tests are written using Pytest.

Run all tests inside the backend container:

```powershell
docker exec -it file_dedup_backend pytest -v
```

Run duplicate detection tests:

```powershell
docker exec -it file_dedup_backend pytest test/test_duplicate_detection.py -v
```

Run File Management API integration tests:

```powershell
docker exec -it file_dedup_backend pytest test/test_file_api.py -v
```

---

# Stopping the Application

Stop the containers:

```powershell
docker compose down
```

Stop containers without removing them:

```powershell
docker compose stop
```

Start existing containers again:

```powershell
docker compose start
```

---

# Rebuilding After Code or Dependency Changes

Rebuild the images:

```powershell
docker compose build
```

Start the services:

```powershell
docker compose up -d
```

For a complete rebuild:

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

> Do not use `docker compose down -v` unless you intentionally want to remove the project's Docker volumes and database data.

---

# Useful Docker Commands

### View backend logs

```powershell
docker logs file_dedup_backend
```

### Follow backend logs

```powershell
docker logs -f file_dedup_backend
```

### View MySQL logs

```powershell
docker logs file_dedup_mysql
```

### View Redis logs

```powershell
docker logs file_dedup_redis
```

### Open a shell inside the backend container

```powershell
docker exec -it file_dedup_backend bash
```

### Check Redis

```powershell
docker exec -it file_dedup_redis redis-cli ping
```

Expected response:

```text
PONG
```

---

# Git Safety

The following local files/directories should not be committed:

```text
.env
storage/
__pycache__/
.pytest_cache/
.venv/
logs/
```

The following files should be committed:

```text
.env.example
Dockerfile
docker-compose.yml
requirements.txt
alembic.ini
alembic/versions/
app/
test/
README.md
.gitignore
.dockerignore
```

Never commit real:

* passwords
* JWT secret keys
* API keys
* database credentials
* private tokens

---

# Development Notes

The backend follows a layered architecture:

```text
Router
   ↓
Service
   ↓
Repository
   ↓
SQLAlchemy / Database
```

This separation keeps API handling, business logic, and database operations independent and easier to maintain.

Background processing is separated from API requests using:

```text
FastAPI → Redis → Celery Worker
```

This allows expensive file-processing operations such as hashing to run asynchronously.

---

# Current Backend Status

The backend currently includes:

* JWT authentication
* Role-based authorization
* File upload
* File download
* File deletion
* File protection
* File search/filtering
* Pagination
* Sorting
* SHA-256 hashing
* Duplicate detection
* Duplicate groups
* Storage analytics
* Deletion history
* Audit logging
* Celery background processing
* Redis integration
* Dockerized development environment
* Unit and API integration tests

--
