export type SystemMode = 'ONLINE' | 'DEGRADED' | 'OFFLINE_EDGE';
export type TelemetryQuality = 'GOOD' | 'STALE' | 'INVALID' | 'SUSPECT';
export type SourceKind = 'SIMULATOR' | 'MQTT' | 'OPCUA';
export interface SystemState { mode: SystemMode; source: string }
export interface Site { site_id: string; name: string; country: string; industry: string }
export interface Asset { asset_id: string; site_id: string; line_id: string; asset_type: string; manufacturer: string; model: string; criticality: string; status: string }
export interface Alert { alert_id: string; asset_id: string; severity: string; state: string; recommendation: string; raised_at: string }
export interface OperationalMetrics { ingestion_accepted: number; ingestion_rejected: number; telemetry_freshness: string | null; anomalies_by_severity: Record<string, number>; alert_backlog: number; sync_queue_depth: number; persistence_errors: number; adapter_health: Record<string, string>; system_mode: SystemMode; evidence_integrity: boolean }
export interface ReadinessDimension { score: number; confidence: number; evidence_status: 'OBSERVED' | 'DECLARED' | 'ASSUMED'; gaps: string[]; risk: string; recommended_action: string; implementation_horizon: string }
