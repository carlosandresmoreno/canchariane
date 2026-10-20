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
                name="Club Campestre Deportivo Alpha",
                timezone="America/Bogota",
                address="Av. 30 de Agosto # 87-25, Sector Villa Olímpica, Pereira",
                phone="+57 310 987 6543",
                is_published=True,
                subscription_status="active",
                settings={
                    "deposit_percentage": 0,
                    "payment_mode": "on_site",
                    "allowed_durations": [30, 60, 90, 120],
                    "default_duration": 60,
                    "currency": "COP",
                    "city": "Pereira",
                    "latitude": 4.8085,
                    "longitude": -75.7142
                }
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
        else:
            s = dict(club.settings or {})
            if "allowed_durations" not in s:
                s["allowed_durations"] = [30, 60, 90, 120]
                s["default_duration"] = 60
                club.settings = s

        # 1. Superadmin User (Plataforma / Desarrollador)
        superadmin_email = "superadmin@canchariane.com"
        superadmin_user = await session.scalar(select(UserModel).where(UserModel.email == superadmin_email))
        if not superadmin_user:
            superadmin_user = UserModel(
                id=uuid6.uuid7(),
                email=superadmin_email,
                password_hash=hash_password("Superadmin123!"),
                full_name="Superadministrador (Plataforma)",
                phone="+57 300 000 0001",
                is_superadmin=True
            )
            session.add(superadmin_user)
            await session.flush()
            print("Superadmin user 'superadmin@canchariane.com' created.")
        else:
            superadmin_user.is_superadmin = True
            superadmin_user.password_hash = hash_password("Superadmin123!")
            print("Superadmin user 'superadmin@canchariane.com' updated.")

        # 2. Club Admin User (Dueño / Administrador de Sede)
        admin_email = "admin@canchariane.com"
        admin_user = await session.scalar(select(UserModel).where(UserModel.email == admin_email))
        if not admin_user:
            admin_user = UserModel(
                id=uuid6.uuid7(),
                email=admin_email,
                password_hash=hash_password("Admin123!"),
                full_name="Carlos Moreno (Administrador de Club)",
                phone="+57 300 123 4567",
                is_superadmin=False
            )
            session.add(admin_user)
            await session.flush()
            print("Admin user 'admin@canchariane.com' created.")
        else:
            admin_user.is_superadmin = False
            admin_user.password_hash = hash_password("Admin123!")
            print("Admin user 'admin@canchariane.com' updated.")

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
        else:
            admin_mem.role = "admin"
            admin_mem.is_active = True

        # 3. Club Receptionist Users (Atención de Mostrador)
        # 3a. recepcion@canchariane.com
        recep_email = "recepcion@canchariane.com"
        recep_user = await session.scalar(select(UserModel).where(UserModel.email == recep_email))
        if not recep_user:
            recep_user = UserModel(
                id=uuid6.uuid7(),
                email=recep_email,
                password_hash=hash_password("Recepcion123!"),
                full_name="Recepcionista de Mostrador",
                phone="+57 311 987 6543",
                is_superadmin=False
            )
            session.add(recep_user)
            await session.flush()
            print("Recepcionista user 'recepcion@canchariane.com' created.")
        else:
            recep_user.is_superadmin = False
            recep_user.password_hash = hash_password("Recepcion123!")
            print("Recepcionista user 'recepcion@canchariane.com' updated.")

        recep_mem = await session.scalar(
            select(ClubMemberModel).where(
                ClubMemberModel.user_id == recep_user.id,
                ClubMemberModel.club_id == club.id
            )
        )
        if not recep_mem:
            session.add(ClubMemberModel(
                id=uuid6.uuid7(),
                user_id=recep_user.id,
                club_id=club.id,
                role="staff",
                is_active=True
            ))
            print(f"Recepcionista membership granted for club {club.slug}.")
        else:
            recep_mem.role = "staff"
            recep_mem.is_active = True

        # 3b. staff@canchariane.com (compatibilidad adicional)
        staff_email = "staff@canchariane.com"
        staff_user = await session.scalar(select(UserModel).where(UserModel.email == staff_email))
        if not staff_user:
            staff_user = UserModel(
                id=uuid6.uuid7(),
                email=staff_email,
                password_hash=hash_password("Staff123!"),
                full_name="Staff Turno Tarde",
                phone="+57 312 345 6789",
                is_superadmin=False
            )
            session.add(staff_user)
            await session.flush()
            print("Staff user 'staff@canchariane.com' created.")
        else:
            staff_user.is_superadmin = False
            staff_user.password_hash = hash_password("Staff123!")
            print("Staff user 'staff@canchariane.com' updated.")

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
        else:
            staff_mem.role = "staff"
            staff_mem.is_active = True

        await session.commit()
        print("\n========================================================")
        print(" Semillas de Usuarios Listas para Despliegue & Local:")
        print(" 1. Superadmin (Plataforma):")
        print("    -> Email: superadmin@canchariane.com / Superadmin123!")
        print("    -> Ruta:  /auth/login-superadmin")
        print(" 2. Administrador de Club:")
        print("    -> Email: admin@canchariane.com / Admin123!")
        print("    -> Ruta:  /auth/login")
        print(" 3. Recepcionista de Club:")
        print("    -> Email: recepcion@canchariane.com / Recepcion123!")
        print("       (o staff@canchariane.com / Staff123!)")
        print("    -> Ruta:  /auth/login")
        print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(seed_demo_club())
