from fastapi import FastAPI

from app.api.router import router
from app.modules.identity.routers import router as identity_router

app = FastAPI(
    title="Mstina Platform API",
    version="0.1.0",
    description="Backend foundation for the Mstinskaya Tradition Platform.",
)

app.include_router(router)
app.include_router(identity_router)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"message": "Mstina Platform API"}
