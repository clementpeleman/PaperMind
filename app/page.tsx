"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PapersTable } from "@/components/papers-table";
import { DataSourceSelector } from "@/components/data-source-selector";
import { CollectionSelector } from "@/components/collection-selector";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";
import { useZoteroLibrary } from "@/hooks/use-zotero-library";

export default function Home() {
  const { isAuthenticated, token, userId } = useSupabaseZoteroAuth();
  const { papers, isLoading, error, refetch } = useZoteroLibrary(token, userId);
  
  // Collection selection state
  const [selectedCollection, setSelectedCollection] = React.useState("All Papers");

  // Filter papers based on selected collection
  const filteredPapers = React.useMemo(() => {
    if (selectedCollection === "All Papers") {
      return papers;
    }
    return papers.filter(paper => 
      paper.collections && paper.collections.includes(selectedCollection)
    );
  }, [papers, selectedCollection]);

  // Reset collection selection when papers change (e.g., after refresh)
  React.useEffect(() => {
    // Check if selected collection still exists in the new paper set
    if (selectedCollection !== "All Papers") {
      const collectionsExist = papers.some(paper => 
        paper.collections && paper.collections.includes(selectedCollection)
      );
      if (!collectionsExist) {
        setSelectedCollection("All Papers");
      }
    }
  }, [papers, selectedCollection]);

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
          <CollectionSelector
            papers={papers}
            selectedCollection={selectedCollection}
            onCollectionChange={setSelectedCollection}
            isLoading={isLoading}
          />
          <div className="flex items-center gap-4">
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
          <PapersTable 
            papers={filteredPapers} 
            isLoading={isLoading} 
            error={error}
            collectionContext={{
              name: selectedCollection,
              totalPapers: papers.length,
              filteredPapers: filteredPapers.length
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
