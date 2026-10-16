"""Benchmark script: Seeds 50,000 bookings with GiST exclusion constraint and events,

then measures latency (<200ms target) with EXPLAIN (ANALYZE, BUFFERS).
"""

import asyncio
import random
import sys
import time as pytime
from datetime import UTC, datetime, time, timedelta
from pathlib import Path

# Ensure backend root is on python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncpg
import uuid6

from app.config import settings

BENCHMARK_CLUB_SLUG = "club-benchmark-50k"
TOTAL_BOOKINGS = 50_000
COURT_COUNT = 4


async def get_raw_connection() -> asyncpg.Connection:
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    return await asyncpg.connect(dsn)


async def seed_data(conn: asyncpg.Connection) -> tuple[uuid6.UUID, list[uuid6.UUID]]:
    print(f"[*] Preparing benchmark club with {TOTAL_BOOKINGS:,} bookings...")

    # 1. Clean previous benchmark data if present
    existing_club = await conn.fetchrow("SELECT id FROM clubs WHERE slug = $1", BENCHMARK_CLUB_SLUG)
    if existing_club:
        club_id = existing_club["id"]
        count = await conn.fetchval("SELECT COUNT(*) FROM bookings WHERE club_id = $1", club_id)
        if count >= TOTAL_BOOKINGS:
            print(f"[+] Existing benchmark club already has {count:,} bookings. Skipping re-seed.")
            courts = await conn.fetch("SELECT id FROM courts WHERE club_id = $1", club_id)
            return club_id, [c["id"] for c in courts]
        else:
            print(f"[-] Deleting existing partial club ({count} bookings)...")
            await conn.execute("DELETE FROM clubs WHERE id = $1", club_id)

    # 2. Insert Club
    club_id = uuid6.uuid7()
    await conn.execute(
        """
        INSERT INTO clubs (id, slug, name, timezone, address, phone, is_published, subscription_status, settings, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        """,
        club_id,
        BENCHMARK_CLUB_SLUG,
        "Club Benchmark 50K Pro",
        "America/Bogota",
        "Autopista Norte # 200",
        "+573009998877",
        True,
        "active",
        '{"currency": "COP", "deposit_percentage": 0}',
    )

    # 3. Insert Business Hours
    for dow in range(7):
        await conn.execute(
            """
            INSERT INTO business_hours (id, club_id, weekday, opens_at, closes_at, closes_next_day, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            """,
            uuid6.uuid7(),
            club_id,
            dow,
            time(6, 0),
            time(23, 0),
            False,
        )

    # 4. Insert 4 Courts
    court_ids: list[uuid6.UUID] = []
    for i in range(1, COURT_COUNT + 1):
        c_id = uuid6.uuid7()
        court_ids.append(c_id)
        await conn.execute(
            """
            INSERT INTO courts (id, club_id, name, sport, surface, player_format, is_covered, has_lighting, is_active, position, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            """,
            c_id,
            club_id,
            f"Pista Bench #{i}",
            "padel",
            "turf",
            "doubles",
            True,
            True,
            True,
            i,
        )

    # 5. Generate 50,000 non-overlapping bookings (12,500 per court)
    bookings_per_court = TOTAL_BOOKINGS // COURT_COUNT
    slots_per_day = 14  # 07:00 to 21:00 (1 hour each)
    base_start_date = datetime(2024, 1, 1, 7, 0, tzinfo=UTC)
    now_utc = datetime.now(UTC)

    print(f"[*] Generating {TOTAL_BOOKINGS:,} bookings and events in memory...")
    booking_records: list[tuple] = []
    event_records: list[tuple] = []

    code_counter = 100_000

    for court_id in court_ids:
        for slot_idx in range(bookings_per_court):
            day_offset = slot_idx // slots_per_day
            slot_of_day = slot_idx % slots_per_day
            slot_start = base_start_date + timedelta(days=day_offset, hours=slot_of_day)
            slot_end = slot_start + timedelta(hours=1)

            b_id = uuid6.uuid7()
            code_counter += 1
            code_suffix = f"{code_counter:06d}"
            code = f"BNK-{code_suffix}"
            status = "completed" if slot_end < now_utc else "confirmed"
            price = random.choice([70_000_00, 80_000_00, 95_000_00, 110_000_00])

            period_range = asyncpg.Range(slot_start, slot_end, lower_inc=True, upper_inc=False)

            created_at = slot_start - timedelta(days=2)
            booking_records.append(
                (
                    b_id,
                    code,
                    club_id,
                    court_id,
                    period_range,
                    status,
                    f"Jugador Bench {slot_idx}",
                    "+573001234567",
                    f"bench{slot_idx}@padelbench.com",
                    price,
                    "COP",
                    "paid",
                    None,
                    created_at,
                    created_at,
                )
            )

            # Corresponding event
            e_id = uuid6.uuid7()
            event_records.append(
                (
                    e_id,
                    b_id,
                    "confirmed",
                    None,
                    "system",
                    '{"source": "benchmark_seeder"}',
                    created_at,
                )
            )

    print(f"[*] Inserting {len(booking_records):,} bookings into PostgreSQL via COPY...")
    t0 = pytime.perf_counter()
    await conn.copy_records_to_table(
        "bookings",
        records=booking_records,
        columns=[
            "id",
            "code",
            "club_id",
            "court_id",
            "period",
            "status",
            "customer_name",
            "customer_phone",
            "customer_email",
            "price_cents",
            "currency",
            "payment_status",
            "recurrence_id",
            "created_at",
            "updated_at",
        ],
    )
    t_bookings = pytime.perf_counter() - t0
    print(
        f"[+] Bookings copied in {t_bookings:.2f}s ({len(booking_records) / t_bookings:,.0f} rows/s)"
    )

    print(f"[*] Inserting {len(event_records):,} booking events via COPY...")
    t0 = pytime.perf_counter()
    await conn.copy_records_to_table(
        "booking_events",
        records=event_records,
        columns=[
            "id",
            "booking_id",
            "event_type",
            "actor_id",
            "actor_type",
            "payload",
            "created_at",
        ],
    )
    t_events = pytime.perf_counter() - t0
    print(f"[+] Events copied in {t_events:.2f}s ({len(event_records) / t_events:,.0f} rows/s)")

    print("[*] Running ANALYZE bookings, booking_events...")
    await conn.execute("ANALYZE bookings")
    await conn.execute("ANALYZE booking_events")
    print("[+] Seeding completed successfully.")

    return club_id, court_ids


async def run_benchmark_queries(
    conn: asyncpg.Connection, club_id: uuid6.UUID, court_ids: list[uuid6.UUID]
) -> None:
    print("\n" + "=" * 65)
    print("        CANCHARIANE V2 — 50,000 ROW BENCHMARK EXECUTION")
    print("=" * 65)

    target_court = court_ids[0]
    test_slot_start = datetime(2025, 6, 15, 10, 0, tzinfo=UTC)
    test_slot_end = test_slot_start + timedelta(hours=1)
    test_range = asyncpg.Range(test_slot_start, test_slot_end, lower_inc=True, upper_inc=False)

    # -------------------------------------------------------------
    # 1. GiST Index Exclusion & Overlap Query
    # -------------------------------------------------------------
    print("\n[BENCHMARK 1] Court Overlap Check via GiST Index (tstzrange &&)")
    q1 = """
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, code, status
    FROM bookings
    WHERE court_id = $1
      AND status IN ('held', 'confirmed')
      AND period && $2;
    """
    plan1 = await conn.fetch(q1, target_court, test_range)
    plan1_str = "\n".join(r[0] for r in plan1)
    print(plan1_str)

    # Measure raw execution latency
    latencies_1 = []
    for _ in range(50):
        t0 = pytime.perf_counter()
        await conn.fetch(
            "SELECT id FROM bookings WHERE court_id = $1 AND status IN ('held', 'confirmed') AND period && $2",
            target_court,
            test_range,
        )
        latencies_1.append((pytime.perf_counter() - t0) * 1000)
    p50_1 = sorted(latencies_1)[len(latencies_1) // 2]
    p95_1 = sorted(latencies_1)[int(len(latencies_1) * 0.95)]
    print(f"--> Latency: p50 = {p50_1:.2f} ms | p95 = {p95_1:.2f} ms")
    assert p95_1 < 200, f"Benchmark 1 exceeded 200ms limit: {p95_1:.2f} ms"

    # -------------------------------------------------------------
    # 2. Public Availability Range Query (1 Full Day Across All Courts)
    # -------------------------------------------------------------
    print("\n[BENCHMARK 2] Daily Availability Range Query Across All Courts")
    day_start = datetime(2025, 6, 15, 0, 0, tzinfo=UTC)
    day_end = day_start + timedelta(days=1)
    day_range = asyncpg.Range(day_start, day_end, lower_inc=True, upper_inc=False)

    q2 = """
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, court_id, period, status
    FROM bookings
    WHERE club_id = $1
      AND status IN ('held', 'confirmed', 'completed')
      AND period && $2;
    """
    plan2 = await conn.fetch(q2, club_id, day_range)
    print("\n".join(r[0] for r in plan2))

    latencies_2 = []
    for _ in range(50):
        t0 = pytime.perf_counter()
        await conn.fetch(
            "SELECT id, court_id, period, status FROM bookings WHERE club_id = $1 AND status IN ('held', 'confirmed', 'completed') AND period && $2",
            club_id,
            day_range,
        )
        latencies_2.append((pytime.perf_counter() - t0) * 1000)
    p50_2 = sorted(latencies_2)[len(latencies_2) // 2]
    p95_2 = sorted(latencies_2)[int(len(latencies_2) * 0.95)]
    print(f"--> Latency: p50 = {p50_2:.2f} ms | p95 = {p95_2:.2f} ms")
    assert p95_2 < 200, f"Benchmark 2 exceeded 200ms limit: {p95_2:.2f} ms"

    # -------------------------------------------------------------
    # 3. Monthly Occupancy Aggregation Report (30-day window)
    # -------------------------------------------------------------
    print("\n[BENCHMARK 3] 30-Day Occupancy Aggregation Report")
    month_start = datetime(2025, 6, 1, 0, 0, tzinfo=UTC)
    month_end = datetime(2025, 7, 1, 0, 0, tzinfo=UTC)
    month_range = asyncpg.Range(month_start, month_end, lower_inc=True, upper_inc=False)

    q3 = """
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT
        court_id,
        COUNT(*) AS total_bookings,
        SUM(EXTRACT(EPOCH FROM (upper(period) - lower(period))) / 60) AS total_minutes
    FROM bookings
    WHERE club_id = $1
      AND status IN ('confirmed', 'completed')
      AND period && $2
    GROUP BY court_id;
    """
    plan3 = await conn.fetch(q3, club_id, month_range)
    print("\n".join(r[0] for r in plan3))

    latencies_3 = []
    for _ in range(50):
        t0 = pytime.perf_counter()
        await conn.fetch(
            """
            SELECT court_id, COUNT(*), SUM(EXTRACT(EPOCH FROM (upper(period) - lower(period))) / 60)
            FROM bookings
            WHERE club_id = $1 AND status IN ('confirmed', 'completed') AND period && $2
            GROUP BY court_id
            """,
            club_id,
            month_range,
        )
        latencies_3.append((pytime.perf_counter() - t0) * 1000)
    p50_3 = sorted(latencies_3)[len(latencies_3) // 2]
    p95_3 = sorted(latencies_3)[int(len(latencies_3) * 0.95)]
    print(f"--> Latency: p50 = {p50_3:.2f} ms | p95 = {p95_3:.2f} ms")
    assert p95_3 < 200, f"Benchmark 3 exceeded 200ms limit: {p95_3:.2f} ms"

    # -------------------------------------------------------------
    # 4. Monthly Revenue Aggregation Report (Daily breakdown)
    # -------------------------------------------------------------
    print("\n[BENCHMARK 4] 30-Day Revenue Aggregation Report (Daily Grouping)")
    q4 = """
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT
        date_trunc('day', lower(period)) AS booking_date,
        COUNT(*) AS booking_count,
        SUM(price_cents) AS total_cents,
        AVG(price_cents) AS avg_ticket_cents
    FROM bookings
    WHERE club_id = $1
      AND status IN ('confirmed', 'completed')
      AND period && $2
    GROUP BY date_trunc('day', lower(period))
    ORDER BY booking_date;
    """
    plan4 = await conn.fetch(q4, club_id, month_range)
    print("\n".join(r[0] for r in plan4))

    latencies_4 = []
    for _ in range(50):
        t0 = pytime.perf_counter()
        await conn.fetch(
            """
            SELECT date_trunc('day', lower(period)), COUNT(*), SUM(price_cents), AVG(price_cents)
            FROM bookings
            WHERE club_id = $1 AND status IN ('confirmed', 'completed') AND period && $2
            GROUP BY date_trunc('day', lower(period))
            """,
            club_id,
            month_range,
        )
        latencies_4.append((pytime.perf_counter() - t0) * 1000)
    p50_4 = sorted(latencies_4)[len(latencies_4) // 2]
    p95_4 = sorted(latencies_4)[int(len(latencies_4) * 0.95)]
    print(f"--> Latency: p50 = {p50_4:.2f} ms | p95 = {p95_4:.2f} ms")
    assert p95_4 < 200, f"Benchmark 4 exceeded 200ms limit: {p95_4:.2f} ms"

    print("\n" + "=" * 65)
    print("ALL 4 BENCHMARKS SATISFIED THE ACCEPTANCE CRITERIA (< 200ms):")
    print(
        f"  1. GiST Overlap Query:            p50 = {p50_1:5.2f} ms | p95 = {p95_1:5.2f} ms (< 200ms PASS)"
    )
    print(
        f"  2. Day Availability Query:        p50 = {p50_2:5.2f} ms | p95 = {p95_2:5.2f} ms (< 200ms PASS)"
    )
    print(
        f"  3. 30-Day Occupancy Aggregation:  p50 = {p50_3:5.2f} ms | p95 = {p95_3:5.2f} ms (< 200ms PASS)"
    )
    print(
        f"  4. 30-Day Revenue Aggregation:    p50 = {p50_4:5.2f} ms | p95 = {p95_4:5.2f} ms (< 200ms PASS)"
    )
    print("=" * 65)


async def main() -> None:
    conn = await get_raw_connection()
    try:
        club_id, court_ids = await seed_data(conn)
        await run_benchmark_queries(conn, club_id, court_ids)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
