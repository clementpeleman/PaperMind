"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText } from "lucide-react";
import { ZoteroAuth } from "./zotero-auth";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";

export function DataSourceSelector() {
  const { isAuthenticated } = useSupabaseZoteroAuth();

  if (isAuthenticated) {
    // If already authenticated, don't show this selector
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Connect Your Zotero Library</h2>
        <p className="text-muted-foreground">
          Connect your Zotero library to analyze your research papers with AI
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Zotero Library
            </CardTitle>
            <CardDescription>
              Connect your personal Zotero library to analyze your research papers with AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Real-time sync with your Zotero library</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Access all your collections and tags</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>AI analysis of your actual research</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Secure OAuth authentication</span>
              </div>
            </div>
            
            <ZoteroAuth />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}