"""Every competition an athlete entered, newest first.

Split out of ``read_service.py``'s "athlete history" section — a report
built on top of :class:`TournamentReadService` (entity lookups) and
:class:`StandingsService` (for round-robin/group outcomes), with no state of
its own that anything else needs.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tournaments.models import Competition, Match, Participant, Tournament
from app.modules.tournaments.schemas.views import AthleteParticipationView
from app.modules.tournaments.services.read_common import parse_id
from app.modules.tournaments.services.standings_service import StandingsService

#: Formats read from a round-robin-style standings table rather than a
#: playoff bracket — mirrors the tab logic in the competition workspace UI.
STANDINGS_FORMATS = {"ROUND_ROBIN", "GROUP_PLAYOFF"}


class AthleteHistoryService:
    @staticmethod
    async def athlete_history(session: AsyncSession, athlete_id: str) -> list[AthleteParticipationView]:
        """Every competition an athlete entered, newest first.

        Read-only projection over existing rows — nothing new is stored, and
        no placement is invented (see ``AthleteParticipationView``).
        """
        aid = parse_id(athlete_id, "athlete")
        participants = list(
            await session.scalars(
                select(Participant)
                .where(Participant.athlete_id == aid)
                .order_by(Participant.created_at.desc())
            )
        )
        if not participants:
            return []

        competition_ids = {p.competition_id for p in participants if p.competition_id is not None}
        competitions: dict[UUID, Competition] = {}
        if competition_ids:
            rows = await session.scalars(select(Competition).where(Competition.id.in_(competition_ids)))
            competitions = {c.id: c for c in rows}

        tournament_ids = {c.tournament_id for c in competitions.values()}
        tournaments: dict[UUID, Tournament] = {}
        if tournament_ids:
            rows = await session.scalars(select(Tournament).where(Tournament.id.in_(tournament_ids)))
            tournaments = {t.id: t for t in rows}

        results: list[AthleteParticipationView] = []
        for participant in participants:
            competition = competitions.get(participant.competition_id) if participant.competition_id else None
            if competition is None:
                continue
            tournament = tournaments.get(competition.tournament_id)

            view = AthleteParticipationView(
                participant_id=str(participant.id),
                tournament_id=str(competition.tournament_id),
                tournament_title=tournament.title if tournament else "—",
                competition_id=str(competition.id),
                competition_name=competition.name,
                format=competition.format,
                competition_status=competition.status,
                participant_status=participant.status,
                city=participant.city,
                seed=participant.seed,
            )

            if participant.status == "WITHDRAWN":
                view.outcome = "WITHDRAWN"
            elif participant.status == "DISQUALIFIED":
                view.outcome = "DISQUALIFIED"
            elif competition.format in STANDINGS_FORMATS:
                standings = await StandingsService.standings(session, str(competition.id))
                row = next((r for r in standings.rows if r.participant.id == str(participant.id)), None)
                if row is not None:
                    view.outcome = "STANDINGS"
                    view.standings_wins = row.wins
                    view.standings_losses = row.losses
                    view.standings_position = row.position
                    view.standings_tied = row.tied_with_previous
                    view.standings_provisional = standings.provisional
            else:
                matches = list(
                    await session.scalars(
                        select(Match)
                        .where(
                            Match.competition_id == competition.id,
                            or_(
                                Match.participant_red_id == participant.id,
                                Match.participant_blue_id == participant.id,
                            ),
                        )
                        .order_by(Match.round_number.asc().nulls_last(), Match.created_at.asc())
                    )
                )
                final = next((m for m in matches if (m.stage_name or "").upper() == "FINAL"), None)
                if final is not None and final.status == "FINISHED" and final.winner_id is not None:
                    view.outcome = "CHAMPION" if final.winner_id == participant.id else "FINALIST"
                else:
                    finished = [m for m in matches if m.status == "FINISHED" and not m.is_bye]
                    if finished:
                        last = finished[-1]
                        if last.winner_id == participant.id:
                            view.outcome = "IN_PROGRESS"
                        else:
                            view.outcome = "ELIMINATED"
                            view.eliminated_at_stage = last.stage_name

            results.append(view)
        return results
