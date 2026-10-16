import asyncio
from datetime import time
from pathlib import Path
import sys

# Ensure backend root is on python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uuid6
from sqlalchemy import select
from app.infrastructure.db.session import async_session_factory
from app.infrastructure.db.models import (
    ClubModel, CourtModel, BusinessHoursModel, PricingRuleModel, ClubLayoutModel,
    UserModel, ClubMemberModel
)
from app.infrastructure.security.password import hash_password

async def seed_demo_club():
    async with async_session_factory() as session:
        # Check or create club-alpha
        club = await session.scalar(select(ClubModel).where(ClubModel.slug == "club-alpha"))
        if not club:
            club_id = uuid6.uuid7()
            club = ClubModel(
                id=club_id,
                slug="club-alpha",
                name="Club Deportivo Campestre Alpha",
                timezone="America/Bogota",
                address="Av. El Dorado #68C-61, Bogotá",
                phone="+57 310 987 6543",
                is_published=True,
                subscription_status="active",
                settings={"deposit_percentage": 0, "payment_mode": "on_site"}
            )
            session.add(club)

            layout_id = uuid6.uuid7()
            layout = ClubLayoutModel(
                id=layout_id,
                club_id=club_id,
                name="Plano General Sede Campestre Alpha",
                view_box_w=1000,
                view_box_h=800,
                is_default=True,
                decorations=[
                    {
                        "label": "Recepción & Cafetería Central",
                        "icon": "coffee",
                        "shape": {"kind": "rect", "x": 400, "y": 20, "w": 200, "h": 60, "rotation": 0}
                    },
                    {
                        "label": "Vestuarios y Lockers",
                        "icon": "shield",
                        "shape": {"kind": "rect", "x": 60, "y": 720, "w": 250, "h": 60, "rotation": 0}
                    },
                    {
                        "label": "Parqueadero Principal",
                        "icon": "car",
                        "shape": {"kind": "rect", "x": 690, "y": 720, "w": 250, "h": 60, "rotation": 0}
                    }
                ]
            )
            session.add(layout)

            # 4 Courts
            c1 = CourtModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                layout_id=layout_id,
                name="Cancha 1 (Pádel Panorámica)",
                sport="padel",
                surface="synthetic_grass",
                player_format="doubles",
                is_covered=True,
                has_lighting=True,
                is_active=True,
                position=1,
                shape={"kind": "rect", "x": 60, "y": 100, "w": 400, "h": 220, "rotation": 0}
            )
            c2 = CourtModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                layout_id=layout_id,
                name="Cancha 2 (Pádel Cristal)",
                sport="padel",
                surface="synthetic_grass",
                player_format="doubles",
                is_covered=True,
                has_lighting=True,
                is_active=True,
                position=2,
                shape={"kind": "rect", "x": 540, "y": 100, "w": 400, "h": 220, "rotation": 0}
            )
            c3 = CourtModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                layout_id=layout_id,
                name="Cancha 3 (Tenis Polvo de Ladrillo)",
                sport="tennis",
                surface="clay",
                player_format="singles",
                is_covered=False,
                has_lighting=True,
                is_active=True,
                position=3,
                shape={"kind": "rect", "x": 60, "y": 420, "w": 400, "h": 260, "rotation": 0}
            )
            c4 = CourtModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                layout_id=layout_id,
                name="Cancha 4 (Fútbol 5 Sintética)",
                sport="football5",
                surface="synthetic_grass",
                player_format="fives",
                is_covered=False,
                has_lighting=True,
                is_active=True,
                position=4,
                shape={"kind": "rect", "x": 540, "y": 420, "w": 400, "h": 260, "rotation": 0}
            )
            session.add_all([c1, c2, c3, c4])

            # Business hours: Mon-Sun 06:00 to 23:00
            for day in range(7):
                bh = BusinessHoursModel(
                    id=uuid6.uuid7(),
                    club_id=club_id,
                    weekday=day,
                    opens_at=time(6, 0),
                    closes_at=time(23, 0),
                    closes_next_day=False
                )
                session.add(bh)

            # Pricing rules for each court
            for court in [c1, c2, c3, c4]:
                pr = PricingRuleModel(
                    id=uuid6.uuid7(),
                    club_id=club_id,
                    court_id=court.id,
                    weekday_mask=127,
                    start_time=time(6, 0),
                    end_time=time(23, 0),
                    price_cents=6500000 if "Pádel" in court.name else 5000000,
                    currency="COP"
                )
                session.add(pr)

            await session.flush()
            print("Club 'club-alpha' and layout seeded.")

        # Ensure Admin User
        admin_email = "admin@canchariane.com"
        admin_user = await session.scalar(select(UserModel).where(UserModel.email == admin_email))
        if not admin_user:
            admin_user = UserModel(
                id=uuid6.uuid7(),
                email=admin_email,
                password_hash=hash_password("AdminPassword123!"),
                full_name="Carlos Moreno (Administrador)",
                phone="+57 300 123 4567",
                is_superadmin=True
            )
            session.add(admin_user)
            await session.flush()
            print("Admin user 'admin@canchariane.com' created.")

        admin_mem = await session.scalar(
            select(ClubMemberModel).where(
                ClubMemberModel.user_id == admin_user.id,
                ClubMemberModel.club_id == club.id
            )
        )
        if not admin_mem:
            session.add(ClubMemberModel(
                id=uuid6.uuid7(),
                user_id=admin_user.id,
                club_id=club.id,
                role="admin",
                is_active=True
            ))
            print(f"Admin membership granted for club {club.slug}.")

        # Ensure Staff User
        staff_email = "staff@canchariane.com"
        staff_user = await session.scalar(select(UserModel).where(UserModel.email == staff_email))
        if not staff_user:
            staff_user = UserModel(
                id=uuid6.uuid7(),
                email=staff_email,
                password_hash=hash_password("StaffPassword123!"),
                full_name="Recepcionista Turno Tarde",
                phone="+57 311 987 6543",
                is_superadmin=False
            )
            session.add(staff_user)
            await session.flush()
            print("Staff user 'staff@canchariane.com' created.")

        staff_mem = await session.scalar(
            select(ClubMemberModel).where(
                ClubMemberModel.user_id == staff_user.id,
                ClubMemberModel.club_id == club.id
            )
        )
        if not staff_mem:
            session.add(ClubMemberModel(
                id=uuid6.uuid7(),
                user_id=staff_user.id,
                club_id=club.id,
                role="staff",
                is_active=True
            ))
            print(f"Staff membership granted for club {club.slug}.")

        await session.commit()
        print("Demo credentials ready:")
        print(" -> Admin: admin@canchariane.com / AdminPassword123!")
        print(" -> Staff: staff@canchariane.com / StaffPassword123!")

if __name__ == "__main__":
    asyncio.run(seed_demo_club())
