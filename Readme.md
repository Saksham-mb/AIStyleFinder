# AI Style Finder 🧥✨

> **An AI-powered fashion discovery engine that analyzes outfit images, identifies key clothing items, and instantly searches the web for premium matches and budget-friendly dupes.**

## 🚀 Overview

AI Style Finder bridges the gap between inspiration and acquisition. Users can upload or snap a photo of any outfit, and the platform uses multi-modal AI to break down the look into specific garments. It then queries real-time shopping data to provide exactly where to buy the premium originals alongside affordable alternatives.

This project was engineered with a focus on **API quota protection, secure client-server data handoffs, and scalable architecture**, transitioning from local SQLite development to a production-ready PostgreSQL cloud deployment.

## 🏗️ Architecture & Tech Stack

### Frontend (Client)
* **Framework:** React + Vite
* **Styling:** Tailwind CSS (Custom Dark/Gold Aesthetic)
* **State Management:** React Hooks with optimized derived state
* **Authentication:** Firebase Auth (Google OAuth)
* **Deployment:** Vercel

### Backend (API Server)
* **Framework:** FastAPI (Python)
* **Database ORM:** SQLModel (SQLAlchemy)
* **Security/Traffic:** `slowapi` for endpoint rate-limiting, explicit payload type validation
* **Deployment:** Render (Web Service)

### External APIs & Cloud Services
* **AI Vision Model:** Google Gemini 2.5 Flash (for image parsing and item extraction)
* **Search Engine:** SerpApi (Google Shopping Engine)
* **Image CDN:** Cloudinary (Secure, temporary blob storage)
* **Database:** Supabase (PostgreSQL with Transaction Pooler)

## ⚡ Core Engineering Features

* **Multi-Modal AI Pipeline:** Safely buffers image uploads, performs MIME type checks, and routes via Cloudinary to Gemini for robust vision-to-text JSON extraction.
* **Defensive API Integration:** Includes hard array-length limits (max 5 items per scan) and strict type validation on LLM outputs to prevent silent frontend crashes and API quota draining.
* **Thread-Safe Database Migrations:** Architected with dynamic connection strings (`os.getenv`), bypassing SQLite thread locks locally while seamlessly supporting PostgreSQL connection pools in production.
* **Robust Rate Limiting:** Global rate limiting (2 scans/min, 1 search/min) using `slowapi` to protect free-tier limits, complete with graceful UI fallback components (HTTP 429 interception).
* **The "Google Moat" Navigation:** Strategically designed to parse Google Shopping immersive product links, maintaining high brand diversity for the V1 launch.

## 🔒 Security Measures Implemented
* **File Upload Protection:** 5MB hard limit with in-memory byte checking to prevent server RAM exhaustion.
* **Data Pollution Shields:** Server-side regex/domain validation on all CDN image links passed from the client before DB insertion.
* **Secure Token Decoding:** Uses `firebase-admin` to decode Bearer tokens on the backend, ensuring users can only read/write to their specific `uid` rows in the database.

## 🗺️ Future Roadmap (V2.0)
* **Direct Merchant Routing:** Implement backend URL unrolling to bypass Google Shopping redirects for deeper affiliate monetization.
* **Multi-Store Scraper:** Expand beyond SerpApi to directly query Myntra, Ajio, and Amazon APIs.
* **Freemium Subscription:** Integrate Stripe to offer 3 free scans/month with a paid tier for unlimited searches.

### 1. Clone the repository
```
bash
git clone [https://github.com/yourusername/ai-style-finder.git](https://github.com/yourusername/ai-style-finder.git)
cd ai-style-finder
```