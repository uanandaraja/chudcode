export type SandboxState = "running";

export type Workspace = {
  id: string;
  name: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInput = {
  name: string;
  repoUrl: string;
  defaultBranch?: string | null;
  notes?: string | null;
};

export type ListedSandbox = {
  metadata?: {
    workspaceId: string;
    workspaceName: string;
    repoOwner: string;
    repoName: string;
    repoFullName: string;
  };
  sandboxID: string;
  startedAt: string;
  state: SandboxState;
};

export type SandboxDetail = ListedSandbox;

export type PreviewCandidate = {
  port: number;
  url: string;
  active: boolean;
};

export type BrowserSession = {
  sandboxId: string;
  status: "idle" | "starting" | "open" | "empty" | "error";
  selectedPort?: number;
  url?: string;
  devtoolsUrl?: string;
  candidates: PreviewCandidate[];
  message?: string;
};

export type DashboardData = {
  workspaces: Workspace[];
  sandboxes: ListedSandbox[];
};
