from app.domain.models import Asset, Line, Site
from app.persistence.repositories import AssetRepository, LineRepository, SiteRepository
from app.persistence.sqlite import connect_sqlite, initialize_schema


def test_sqlite_runs_in_wal_and_persists_asset(tmp_path):
    db = tmp_path / 'industrial.db'
    conn = connect_sqlite(str(db))
    initialize_schema(conn)
    assert conn.execute('PRAGMA journal_mode').fetchone()[0].lower() == 'wal'

    sites = SiteRepository(conn)
    lines = LineRepository(conn)
    assets = AssetRepository(conn)

    sites.create(
        Site(
            site_id='site-1',
            name='Demo',
            country='BJ',
            timezone='Africa/Porto-Novo',
            industry='agro',
            operating_status='active',
            data_residency_policy='local',
        )
    )
    lines.create(
        Line(
            line_id='line-1',
            site_id='site-1',
            name='Line 1',
            process_type='packing',
            rated_capacity=100.0,
            unit='units/hour',
        )
    )
    assets.create(
        Asset(
            asset_id='motor-1',
            site_id='site-1',
            line_id='line-1',
            asset_type='motor',
            manufacturer='Synthetic',
            model='M1',
            criticality='high',
            commissioning_date=None,
            protocol_profile='simulator',
            status='online',
        )
    )
    assert assets.list_all()[0].asset_id == 'motor-1'


def test_foreign_key_rejects_asset_for_unknown_line(tmp_path):
    conn = connect_sqlite(str(tmp_path / 'industrial.db'))
    initialize_schema(conn)
    sites = SiteRepository(conn)
    assets = AssetRepository(conn)
    sites.create(Site('s1', 'Demo', 'BJ', 'Africa/Porto-Novo', 'agro', 'active', 'local'))

    unknown = Asset('a1', 's1', 'missing', 'motor', 'Synthetic', 'M1', 'high', None, 'simulator', 'online')
    try:
        assets.create(unknown)
    except ValueError as exc:
        assert 'line' in str(exc).lower()
    else:
        raise AssertionError('asset with unknown line must be rejected')
