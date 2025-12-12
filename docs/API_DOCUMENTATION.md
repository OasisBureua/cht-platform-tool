# CHT Platform API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Users API](#users-api)
- [Programs API](#programs-api)
- [Videos API](#videos-api)
- [Error Handling](#error-handling)

---

## Overview

**Base URL:** `http://localhost:3000` (development)  
**Production URL:** `https://api.chtplatform.com`

**API Version:** v1  
**Response Format:** JSON

---

## Authentication

### JWT Token Authentication

All protected endpoints require a JWT token from Auth0.

**Header:**
```
Authorization: Bearer <your_jwt_token>
```

**Public Endpoints** (no auth required):
- `GET /health`

**Protected Endpoints:**
- All user, program, and video endpoints

---

## Users API

### Create User

**Endpoint:** `POST /users`  
**Auth:** Public (for testing)  
**Role:** Any (will be Admin-only in production)

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "firstName": "Sarah",
  "lastName": "Johnson",
  "authId": "auth0|123456789",
  "npiNumber": "1234567890",
  "specialty": "Cardiology",
  "state": "NY",
  "licenseNumber": "MD12345",
  "role": "HCP"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx123abc",
  "email": "doctor@example.com",
  "firstName": "Sarah",
  "lastName": "Johnson",
  "authId": "auth0|123456789",
  "npiNumber": "1234567890",
  "specialty": "Cardiology",
  "state": "NY",
  "licenseNumber": "MD12345",
  "role": "HCP",
  "createdAt": "2024-12-11T10:30:00.000Z",
  "updatedAt": "2024-12-11T10:30:00.000Z"
}
```

**Side Effects:**
- Queues welcome email job to worker service

---

### Get All Users

**Endpoint:** `GET /users`  
**Auth:** Required  
**Role:** Admin only

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Example:**
```bash
GET /users?page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "clx123abc",
      "email": "doctor@example.com",
      "firstName": "Sarah",
      "lastName": "Johnson",
      "role": "HCP",
      "specialty": "Cardiology",
      "state": "NY",
      "createdAt": "2024-12-11T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### Get Current User

**Endpoint:** `GET /users/me`  
**Auth:** Required  
**Role:** Any authenticated user

**Response:** `200 OK`
```json
{
  "userId": "clx123abc",
  "authId": "auth0|123456789",
  "email": "doctor@example.com",
  "role": "HCP",
  "dbUser": {
    "id": "clx123abc",
    "email": "doctor@example.com",
    "firstName": "Sarah",
    "lastName": "Johnson",
    "specialty": "Cardiology",
    "npiNumber": "1234567890"
  }
}
```

---

### Get User by ID

**Endpoint:** `GET /users/:id`  
**Auth:** Required  
**Role:** Admin only

**Response:** `200 OK`
```json
{
  "id": "clx123abc",
  "email": "doctor@example.com",
  "firstName": "Sarah",
  "lastName": "Johnson",
  "authId": "auth0|123456789",
  "role": "HCP",
  "specialty": "Cardiology",
  "createdAt": "2024-12-11T10:30:00.000Z",
  "updatedAt": "2024-12-11T10:30:00.000Z"
}
```

---

### Update User

**Endpoint:** `PATCH /users/:id`  
**Auth:** Required  
**Role:** Admin only

**Request Body:**
```json
{
  "specialty": "Interventional Cardiology",
  "state": "CA"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx123abc",
  "specialty": "Interventional Cardiology",
  "state": "CA",
  "updatedAt": "2024-12-11T11:00:00.000Z"
}
```

---

### Delete User

**Endpoint:** `DELETE /users/:id`  
**Auth:** Required  
**Role:** Admin only

**Response:** `200 OK`
```json
{
  "id": "clx123abc",
  "email": "doctor@example.com"
}
```

---

## Programs API

### Create Program

**Endpoint:** `POST /programs`  
**Auth:** Public (for testing)  
**Role:** Admin only (in production)

**Request Body:**
```json
{
  "title": "Cardiovascular Health Essentials",
  "description": "Comprehensive guide to heart health and disease prevention",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "creditAmount": 2.5,
  "accreditationBody": "ACCME",
  "status": "ACTIVE",
  "sponsorName": "American Heart Association",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.999Z"
}
```

**Response:** `201 Created`
```json
{
  "id": "clx456def",
  "title": "Cardiovascular Health Essentials",
  "description": "Comprehensive guide to heart health and disease prevention",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "creditAmount": 2.5,
  "accreditationBody": "ACCME",
  "status": "ACTIVE",
  "sponsorName": "American Heart Association",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.999Z",
  "createdAt": "2024-12-11T10:30:00.000Z",
  "updatedAt": "2024-12-11T10:30:00.000Z"
}
```

---

### Get All Programs

**Endpoint:** `GET /programs`  
**Auth:** Public (for testing)  
**Role:** Any authenticated user (in production)

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `status` (optional, filter by status: DRAFT, ACTIVE, COMPLETED, ARCHIVED)

**Example:**
```bash
GET /programs?status=ACTIVE&page=1&limit=10
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "clx456def",
      "title": "Cardiovascular Health Essentials",
      "description": "Comprehensive guide to heart health",
      "creditAmount": 2.5,
      "status": "ACTIVE",
      "sponsorName": "American Heart Association",
      "_count": {
        "videos": 8,
        "enrollments": 45
      },
      "createdAt": "2024-12-11T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

---

### Get Program by ID

**Endpoint:** `GET /programs/:id`  
**Auth:** Public (for testing)  
**Role:** Any authenticated user (in production)

**Response:** `200 OK`
```json
{
  "id": "clx456def",
  "title": "Cardiovascular Health Essentials",
  "description": "Comprehensive guide to heart health",
  "creditAmount": 2.5,
  "status": "ACTIVE",
  "videos": [
    {
      "id": "clx789ghi",
      "title": "Introduction to Heart Anatomy",
      "duration": 600,
      "order": 1
    }
  ],
  "surveys": [],
  "_count": {
    "enrollments": 45
  }
}
```

---

### Enroll in Program

**Endpoint:** `POST /programs/:id/enroll`  
**Auth:** Required  
**Role:** Any authenticated user

**Response:** `201 Created`
```json
{
  "id": "clx_enrollment_id",
  "userId": "clx123abc",
  "programId": "clx456def",
  "enrolledAt": "2024-12-11T10:30:00.000Z",
  "overallProgress": 0,
  "completed": false,
  "program": {
    "id": "clx456def",
    "title": "Cardiovascular Health Essentials",
    "creditAmount": 2.5
  },
  "user": {
    "id": "clx123abc",
    "email": "doctor@example.com",
    "firstName": "Sarah",
    "lastName": "Johnson"
  }
}
```

**Side Effects:**
- Queues enrollment confirmation email

---

### Get My Enrollments

**Endpoint:** `GET /programs/my-enrollments`  
**Auth:** Required  
**Role:** Any authenticated user

**Response:** `200 OK`
```json
[
  {
    "id": "clx_enrollment_id",
    "enrolledAt": "2024-12-11T10:30:00.000Z",
    "overallProgress": 35.5,
    "completed": false,
    "program": {
      "id": "clx456def",
      "title": "Cardiovascular Health Essentials",
      "creditAmount": 2.5,
      "status": "ACTIVE"
    }
  }
]
```

---

### Get Program Enrollments

**Endpoint:** `GET /programs/:id/enrollments`  
**Auth:** Required  
**Role:** Admin only

**Response:** `200 OK`
```json
[
  {
    "id": "clx_enrollment_id",
    "enrolledAt": "2024-12-11T10:30:00.000Z",
    "completed": false,
    "user": {
      "id": "clx123abc",
      "email": "doctor@example.com",
      "firstName": "Sarah",
      "lastName": "Johnson",
      "specialty": "Cardiology",
      "state": "NY"
    }
  }
]
```

---

## Videos API

### Create Video

**Endpoint:** `POST /videos`  
**Auth:** Required  
**Role:** Admin only

**Request Body:**
```json
{
  "programId": "clx456def",
  "title": "Introduction to Heart Anatomy",
  "description": "Learn the basics of heart structure and function",
  "platform": "YOUTUBE",
  "videoId": "dQw4w9WgXcQ",
  "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "duration": 600,
  "order": 1
}
```

**Response:** `201 Created`
```json
{
  "id": "clx789ghi",
  "programId": "clx456def",
  "title": "Introduction to Heart Anatomy",
  "description": "Learn the basics of heart structure and function",
  "platform": "YOUTUBE",
  "videoId": "dQw4w9WgXcQ",
  "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "duration": 600,
  "order": 1,
  "program": {
    "id": "clx456def",
    "title": "Cardiovascular Health Essentials"
  },
  "createdAt": "2024-12-11T10:30:00.000Z"
}
```

---

### Get All Videos

**Endpoint:** `GET /videos`  
**Auth:** Required  
**Role:** Any authenticated user

**Query Parameters:**
- `programId` (optional, filter by program)

**Example:**
```bash
GET /videos?programId=clx456def
```

**Response:** `200 OK`
```json
[
  {
    "id": "clx789ghi",
    "title": "Introduction to Heart Anatomy",
    "duration": 600,
    "order": 1,
    "platform": "YOUTUBE",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "program": {
      "id": "clx456def",
      "title": "Cardiovascular Health Essentials"
    },
    "_count": {
      "views": 125
    }
  }
]
```

---

### Track Video Progress

**Endpoint:** `POST /videos/:id/track`  
**Auth:** Required  
**Role:** Any authenticated user

**Request Body:**
```json
{
  "watchedSeconds": 300,
  "completed": false
}
```

**Response:** `200 OK`
```json
{
  "id": "clx_view_id",
  "userId": "clx123abc",
  "videoId": "clx789ghi",
  "watchedSeconds": 300,
  "progress": 50.0,
  "completed": false,
  "createdAt": "2024-12-11T10:30:00.000Z",
  "updatedAt": "2024-12-11T10:35:00.000Z"
}
```

---

### Get My Video Progress

**Endpoint:** `GET /videos/:id/my-progress`  
**Auth:** Required  
**Role:** Any authenticated user

**Response:** `200 OK`
```json
{
  "id": "clx_view_id",
  "userId": "clx123abc",
  "videoId": "clx789ghi",
  "watchedSeconds": 450,
  "progress": 75.0,
  "completed": false,
  "video": {
    "id": "clx789ghi",
    "title": "Introduction to Heart Anatomy",
    "duration": 600
  }
}
```

---

### Get My Watch History

**Endpoint:** `GET /videos/my-history`  
**Auth:** Required  
**Role:** Any authenticated user

**Response:** `200 OK`
```json
[
  {
    "id": "clx_view_id",
    "watchedSeconds": 450,
    "progress": 75.0,
    "completed": false,
    "updatedAt": "2024-12-11T10:35:00.000Z",
    "video": {
      "id": "clx789ghi",
      "title": "Introduction to Heart Anatomy",
      "duration": 600,
      "program": {
        "id": "clx456def",
        "title": "Cardiovascular Health Essentials"
      }
    }
  }
]
```

---

## Error Handling

### Standard Error Response

All errors follow this format:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

### Common Errors

**Validation Error:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

**Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Forbidden (RBAC):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Not Found:**
```json
{
  "statusCode": 404,
  "message": "User with ID clx123 not found",
  "error": "Not Found"
}
```

**Conflict:**
```json
{
  "statusCode": 409,
  "message": "User with this email already exists",
  "error": "Conflict"
}
```

---

## Rate Limiting

*To be implemented*

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

**Response Meta:**
```json
{
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

---

## Webhooks

*To be documented when implemented*

---

## API Changelog

### Version 1.0.0 (Current)
- Initial API release
- Users, Programs, Videos endpoints
- JWT authentication
- Role-based access control
- Background job queue integration
