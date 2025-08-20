"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { PapersTable } from "@/components/papers-table";
import { DataSourceSelector } from "@/components/data-source-selector";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";
import { useZoteroLibrary } from "@/hooks/use-zotero-library";

export default function Home() {
  const { isAuthenticated, token, userId } = useSupabaseZoteroAuth();
  const { papers, isLoading, error, refetch } = useZoteroLibrary(token, userId);

  // Show data source selector if not authenticated
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex-1 p-4 md:p-8 pt-6">
          <DataSourceSelector />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-medium tracking-tight">Zotero Papers</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {papers.length} papers loaded from Zotero
            </div>
            <button 
              onClick={refetch}
              className="text-primary hover:underline text-sm"
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <PapersTable papers={papers} isLoading={isLoading} error={error} />
        </div>
      </div>
    </DashboardLayout>
  );
}
