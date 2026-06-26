# Bharat Wines — Liquor Inventory & SCM Automation Platform

Bharat Wines is a comprehensive web-based platform designed for FL-2 liquor retailers in India to manage their inventory using barcode scanning, automate TP (Transport Pass) ingestion using AI, generate SCM-ready stock records, and gain real-time inventory visibility from any device.

## Features

- **Web-Based Barcode Scanning**: Scan barcodes directly from a mobile browser using the device camera for fast sales and returns.
- **AI-Powered TP Processing**: Upload Transport Pass documents and let the AI automatically extract and reconcile product details, updating stock quantities seamlessly.
- **Real-Time Dashboard**: Monitor inventory levels, track sales, and view critical alerts (like MRP mismatches) on an intuitive dashboard.
- **SCM Export**: Generate and download SCM-ready stock records with state excise codes for easy compliance reporting.
- **Responsive Design**: Built as a mobile-first PWA for easy use on phones, tablets, or desktops.

## Tech Stack

This project is built using a modern, scalable full-stack architecture:

- **Frontend**: [Next.js](https://nextjs.org/) (React), Tailwind CSS, Framer Motion, shadcn/ui.
- **Backend API**: [FastAPI](https://fastapi.tiangolo.com/) (Python) for high-performance, asynchronous endpoints.
- **Background Worker**: [Celery](https://docs.celeryq.dev/) for handling heavy background tasks (like AI document parsing and SCM generation).
- **Database**: [PostgreSQL](https://www.postgresql.org/) with SQLAlchemy (Async).
- **Cache & Message Broker**: [Redis](https://redis.io/).
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose for seamless local development.

## Project Structure

```
.
├── backend/          # FastAPI application, Alembic migrations, Celery worker
├── frontend/         # Next.js web application
├── infra/            # CI/CD and infrastructure configuration
├── documents/        # Product Requirements (PRD) and Technical specs (TRD)
├── docker-compose.yml# Local development orchestration
└── render.yaml       # Render deployment blueprint
```

## Local Development Setup

To run the full application stack locally, you need [Docker](https://docs.docker.com/get-docker/) installed.

1. **Clone the repository:**
   ```bash
   git clone git@github.com:prath2002/bharat-wines.git
   cd bharat-wines
   ```

2. **Set up Environment Variables:**
   - Create a `.env` file in the root directory. You can use `.env copy` as a template.
   - Make sure to add your `OPENAI_API_KEY` for the AI processing features to work.

3. **Start the containers:**
   ```bash
   docker compose up --build
   ```

4. **Access the Application:**
   - **Frontend App**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

## Deployment

The application is configured to be deployed using managed services for high availability and low maintenance:

### 1. Frontend (Vercel)
The `frontend` directory is ready to be deployed on [Vercel](https://vercel.com/). Connect your GitHub repository to Vercel, set the root directory to `frontend`, and configure the `NEXT_PUBLIC_API_URL` environment variable to point to your live backend.

### 2. Backend (Render)
The backend infrastructure (FastAPI, Celery, PostgreSQL, Redis) is defined in the `render.yaml` Blueprint.
1. Connect your repository to [Render](https://render.com/).
2. Create a **New Blueprint Instance** from the Render dashboard.
3. Render will automatically provision the database, Redis cache, web service, and worker.
4. Don't forget to update the `OPENAI_API_KEY` environment variable in the Render dashboard after deployment.

## CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that automatically runs on every push and pull request to the `main` branch. It ensures code quality by running:
- **Backend**: Ruff (linting), MyPy (type checking), and Pytest (unit testing).
- **Frontend**: ESLint and Next.js build verification.
