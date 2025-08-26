"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PapersTable } from "@/components/papers-table";
import { DataSourceSelector } from "@/components/data-source-selector";
import { CollectionSelector } from "@/components/collection-selector";
import { Timeline } from "@/components/timeline";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";
import { useZoteroLibrary } from "@/hooks/use-zotero-library";

export default function Home() {
  const { isAuthenticated, token, userId, user } = useSupabaseZoteroAuth();
  const { papers, isLoading, error, refetch } = useZoteroLibrary(token, userId, user);
  
  // Navigation state
  const [activeView, setActiveView] = React.useState("papers");
  
  // Collection selection state
  const [selectedCollection, setSelectedCollection] = React.useState("All Papers");
  const [hasSetDefaultCollection, setHasSetDefaultCollection] = React.useState(false);

  // Get available collections from papers
  const availableCollections = React.useMemo(() => {
    const allCollections = new Set<string>();
    papers.forEach(paper => {
      if (paper.collections && paper.collections.length > 0) {
        paper.collections.forEach(collection => {
          if (collection && collection.trim()) {
            allCollections.add(collection);
          }
        });
      }
    });
    return Array.from(allCollections).sort();
  }, [papers]);

  // Set default collection to first available collection when papers load
  React.useEffect(() => {
    if (!hasSetDefaultCollection && papers.length > 0 && availableCollections.length > 0) {
      setSelectedCollection(availableCollections[0]);
      setHasSetDefaultCollection(true);
    }
  }, [papers, availableCollections, hasSetDefaultCollection]);

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
        // If current collection doesn't exist, fall back to first available or "All Papers"
        if (availableCollections.length > 0) {
          setSelectedCollection(availableCollections[0]);
        } else {
          setSelectedCollection("All Papers");
        }
      }
    }
  }, [papers, selectedCollection, availableCollections]);

  // Show data source selector if not authenticated
  if (!isAuthenticated) {
    return (
      <DashboardLayout activeView={activeView} onNavigate={setActiveView}>
        <div className="flex-1 p-4 md:p-8 pt-6">
          <DataSourceSelector />
        </div>
      </DashboardLayout>
    );
  }

  // Render different views based on activeView
  const renderCurrentView = () => {
    switch (activeView) {
      case "timeline":
        return (
          <div className="flex-1 p-4 md:p-8 pt-6">
            <Timeline />
          </div>
        );
      case "papers":
      default:
        return (
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
        );
    }
  };

  return (
    <DashboardLayout activeView={activeView} onNavigate={setActiveView}>
      {renderCurrentView()}
    </DashboardLayout>
  );
}
