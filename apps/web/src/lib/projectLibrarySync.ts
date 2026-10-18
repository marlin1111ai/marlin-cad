// Decides how this browser's projects and the server's copies line up.
// The higher revision wins; the server's "deleted" marker removes local copies.

export type LibrarySyncLocalProject = {
  id: string;
  revision?: number;
  thumbnailVersion?: number;
};

export type LibrarySyncServerEntry = {
  id: string;
  revision: number;
  thumbnailVersion?: unknown;
  deleted?: boolean;
};

export type LibrarySyncPlan = {
  uploads: string[];
  downloads: string[];
  localDeletes: string[];
};

export function planProjectLibrarySync(
  local: LibrarySyncLocalProject[],
  server: LibrarySyncServerEntry[],
  options: { busyIds?: ReadonlySet<string>; pendingDeleteIds?: ReadonlySet<string> } = {},
): LibrarySyncPlan {
  const busy = options.busyIds ?? new Set<string>();
  const pendingDeletes = options.pendingDeleteIds ?? new Set<string>();
  const localById = new Map(local.map((project) => [project.id, project]));
  const plan: LibrarySyncPlan = { uploads: [], downloads: [], localDeletes: [] };

  for (const entry of server) {
    const project = localById.get(entry.id);
    if (entry.deleted) {
      if (project && !busy.has(entry.id)) plan.localDeletes.push(entry.id);
      continue;
    }
    if (!project) {
      if (!pendingDeletes.has(entry.id)) plan.downloads.push(entry.id);
      continue;
    }
    const localRevision = project.revision ?? 0;
    // Same revision: only the picture can differ (a snapshot does not bump the
    // revision), so the newer picture wins. Never "upload if different", or two
    // browsers would keep overwriting each other.
    const localThumbnail = project.thumbnailVersion ?? 0;
    const serverThumbnail = typeof entry.thumbnailVersion === "number" ? entry.thumbnailVersion : 0;
    const serverNewer = entry.revision > localRevision || (entry.revision === localRevision && serverThumbnail > localThumbnail);
    const localNewer = localRevision > entry.revision || (entry.revision === localRevision && localThumbnail > serverThumbnail);
    if (serverNewer) {
      if (!busy.has(entry.id)) plan.downloads.push(entry.id);
    } else if (localNewer) {
      plan.uploads.push(entry.id);
    }
  }

  const serverIds = new Set(server.map((entry) => entry.id));
  for (const project of local) {
    if (!serverIds.has(project.id) && !pendingDeletes.has(project.id)) plan.uploads.push(project.id);
  }
  return plan;
}
