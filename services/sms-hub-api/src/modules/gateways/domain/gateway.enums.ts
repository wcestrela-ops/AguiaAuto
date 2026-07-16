export enum GatewayType {
  FAKE = 'FAKE',
  ANDROID = 'ANDROID',
  SMSMARKET = 'SMSMARKET',
}

export enum GatewayStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  DEGRADED = 'DEGRADED',
}

export enum DispatchStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  ACCEPTED_BY_GATEWAY = 'ACCEPTED_BY_GATEWAY',
  SENT = 'SENT',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}
