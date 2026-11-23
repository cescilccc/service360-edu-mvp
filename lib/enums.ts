// Shared enums — the single source of truth for DB, zod schemas, and UI.

export const ROOM_TYPES = ["BOARDROOM", "TRAINING_ROOM", "MEETING_ROOM"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const MEETING_IMPACTS = [
  "LIVE_NOW",
  "WITHIN_HOUR",
  "TODAY",
  "NONE",
] as const;
export type MeetingImpact = (typeof MEETING_IMPACTS)[number];

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;
export type Status = (typeof STATUSES)[number];

export const ISSUE_TYPES = [
  "NO_DISPLAY",
  "NO_AUDIO",
  "CANT_JOIN_CALL",
  "CAMERA_ISSUE",
  "CONTENT_SHARING",
  "TOUCH_PANEL",
  "MIC_ISSUE",
  "OTHER",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  NO_DISPLAY: "No display / screen",
  NO_AUDIO: "No audio / sound",
  CANT_JOIN_CALL: "Can't join call",
  CAMERA_ISSUE: "Camera issue",
  CONTENT_SHARING: "Content sharing",
  TOUCH_PANEL: "Touch panel",
  MIC_ISSUE: "Microphone issue",
  OTHER: "Other",
};

export const MEETING_IMPACT_LABELS: Record<MeetingImpact, string> = {
  LIVE_NOW: "A meeting is affected right now",
  WITHIN_HOUR: "A meeting starts within the hour",
  TODAY: "A meeting later today",
  NONE: "No active meeting impact",
};
