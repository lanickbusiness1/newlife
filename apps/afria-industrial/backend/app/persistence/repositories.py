from __future__ import annotations

import sqlite3

from app.domain.models import Asset, Line, Site, TelemetryPoint


class SiteRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, site: Site) -> Site:
        self.conn.execute(
            '''INSERT INTO sites
            (site_id, name, country, timezone, industry, operating_status, data_residency_policy)
            VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (site.site_id, site.name, site.country, site.timezone, site.industry, site.operating_status, site.data_residency_policy),
        )
        self.conn.commit()
        return site

    def list_all(self) -> list[Site]:
        return [Site(**dict(row)) for row in self.conn.execute('SELECT * FROM sites ORDER BY site_id')]


class LineRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, line: Line) -> Line:
        try:
            self.conn.execute(
                '''INSERT INTO lines (line_id, site_id, name, process_type, rated_capacity, unit)
                VALUES (?, ?, ?, ?, ?, ?)''',
                (line.line_id, line.site_id, line.name, line.process_type, line.rated_capacity, line.unit),
            )
            self.conn.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError('site referenced by line does not exist') from exc
        return line

    def list_all(self) -> list[Line]:
        return [Line(**dict(row)) for row in self.conn.execute('SELECT * FROM lines ORDER BY line_id')]


class AssetRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, asset: Asset) -> Asset:
        try:
            self.conn.execute(
                '''INSERT INTO assets
                (asset_id, site_id, line_id, asset_type, manufacturer, model, criticality,
                 commissioning_date, protocol_profile, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    asset.asset_id,
                    asset.site_id,
                    asset.line_id,
                    asset.asset_type,
                    asset.manufacturer,
                    asset.model,
                    asset.criticality,
                    asset.commissioning_date,
                    asset.protocol_profile,
                    asset.status,
                ),
            )
            self.conn.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError('site or line referenced by asset does not exist') from exc
        return asset

    def list_all(self) -> list[Asset]:
        return [Asset(**dict(row)) for row in self.conn.execute('SELECT * FROM assets ORDER BY asset_id')]

    def get(self, asset_id: str) -> Asset | None:
        row = self.conn.execute('SELECT * FROM assets WHERE asset_id=?', (asset_id,)).fetchone()
        return Asset(**dict(row)) if row else None


class TelemetryRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def insert(self, batch_id: str, point: TelemetryPoint, receipt_timestamp: str) -> bool:
        try:
            self.conn.execute(
                '''INSERT INTO telemetry
                (point_id, asset_id, metric, unit, event_timestamp, receipt_timestamp, value,
                 quality, source, provenance_id, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    point.point_id,
                    point.asset_id,
                    point.metric,
                    point.unit,
                    point.timestamp,
                    receipt_timestamp,
                    point.value,
                    point.quality,
                    point.source,
                    point.provenance_id,
                    batch_id,
                ),
            )
        except sqlite3.IntegrityError:
            return False
        return True

    def list_for_asset(self, asset_id: str, metric: str | None = None) -> list[TelemetryPoint]:
        if metric is None:
            rows = self.conn.execute(
                'SELECT * FROM telemetry WHERE asset_id=? ORDER BY event_timestamp', (asset_id,)
            )
        else:
            rows = self.conn.execute(
                'SELECT * FROM telemetry WHERE asset_id=? AND metric=? ORDER BY event_timestamp',
                (asset_id, metric),
            )
        return [
            TelemetryPoint(
                point_id=row['point_id'],
                asset_id=row['asset_id'],
                metric=row['metric'],
                unit=row['unit'],
                timestamp=row['event_timestamp'],
                receipt_timestamp=row['receipt_timestamp'],
                value=row['value'],
                quality=row['quality'],
                source=row['source'],
                provenance_id=row['provenance_id'],
            )
            for row in rows
        ]
