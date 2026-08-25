from fastapi import FastAPI

from app.api.router import router
from app.modules.auth import router as auth_router
from app.modules.athletes.routers import router as athletes_router
from app.modules.clubs.routers import router as clubs_router
from app.modules.education.routers import router as education_router
from app.modules.equipment.routers import router as equipment_router
from app.modules.identity.routers import router as identity_router
from app.modules.media.router import router as media_router
from app.modules.ratings.router import router as ratings_router
from app.modules.rules.routers import router as rules_router
from app.modules.tournaments.routers import router as tournaments_router

app = FastAPI(
    title="Mstina Platform API",
    version="0.1.0",
    description="Backend foundation for the Mstinskaya Tradition Platform.",
)

app.include_router(router)
app.include_router(auth_router)
app.include_router(identity_router)
app.include_router(clubs_router)
app.include_router(athletes_router)
app.include_router(education_router)
app.include_router(equipment_router)
app.include_router(media_router)
app.include_router(ratings_router)
app.include_router(rules_router)
app.include_router(tournaments_router)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"message": "Mstina Platform API"}
