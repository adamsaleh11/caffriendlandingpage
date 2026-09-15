'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { Workspace } from '@/lib/contracts';

/**
 * The signed-in user's workspace list, loaded once by the `/app` layout.
 *
 * It used to be state inside `WorkspaceApp`, fetched from an effect. Because the whole
 * CRM lives under one dynamic segment, `/app/[[...segments]]`, Next keys its route tree
 * by the segment's value: moving between sections is a different cache node, so React
 * unmounted the page and mounted a fresh one. The state went back to `undefined` and
 * every navigation fell behind "Loading workspace…" while the list was fetched again.
 *
 * Layouts are not remounted when a child segment's value changes, so holding the list
 * here keeps it across navigation -- and loading it on the server means there is no
 * client round trip, and so no loading state, to show at all.
 */
export type WorkspaceListState =
  | {workspaces: Workspace[]; problem: null}
  | {workspaces: null; problem: {status: number; message: string}};

const WorkspaceListContext = createContext<WorkspaceListState | null>(null);

export function WorkspaceListProvider({value, children}:{value: WorkspaceListState; children: ReactNode}) {
  return <WorkspaceListContext.Provider value={value}>{children}</WorkspaceListContext.Provider>;
}

export function useWorkspaceList(): WorkspaceListState {
  const value = useContext(WorkspaceListContext);
  if (!value) throw new Error('The workspace list is only available under the /app layout.');
  return value;
}
