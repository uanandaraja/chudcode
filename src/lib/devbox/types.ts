export type SandboxState = "running" | "paused";

export interface ProfileDefinition {
  id: string;
  label: string;
  description: string;
  template: string;
  timeoutMs: number;
  cwd: string;
  terminalCommand: string;
  bootstrapCommand?: string;
  env: Record<string, string>;
  metadata: Record<string, string>;
}

export interface ListedSandbox {
  alias?: string;
  cpuCount: number;
  diskSizeMB: number;
  endAt: string;
  envdVersion: string;
  memoryMB: number;
  metadata?: Record<string, string>;
  sandboxID: string;
  startedAt: string;
  state: SandboxState;
  templateID: string;
}

export interface SandboxDetail {
  alias?: string;
  cpuCount: number;
  diskSizeMB: number;
  domain?: string | null;
  endAt: string;
  envdVersion: string;
  memoryMB: number;
  metadata?: Record<string, string>;
  sandboxID: string;
  startedAt: string;
  state: SandboxState;
  templateID: string;
}

export interface DashboardData {
  profiles: ProfileDefinition[];
  sandboxes: ListedSandbox[];
}
