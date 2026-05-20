from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import SQLModel

from app.core.config import settings
from app.db.session import engine
from app.routers import auth, tracks, playlists, sync

# Initialize database tables
def init_db():
    print("[Main] Initializing database tables...")
    SQLModel.metadata.create_all(engine)
    print("[Main] Database tables initialized successfully.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade, full-stack open-source AI Music Streaming Platform backend gateway.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Startup events
@app.on_event("startup")
def on_startup():
    init_db()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the Next.js origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handling middleware
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print(f"[Global Exception Handler] Unhandled error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(e)}
        )

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(tracks.router, prefix=settings.API_V1_STR)
app.include_router(playlists.router, prefix=settings.API_V1_STR)
app.include_router(sync.router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
