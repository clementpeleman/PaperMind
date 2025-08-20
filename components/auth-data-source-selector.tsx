"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Shield, Database } from "lucide-react";
import { SupabaseAuth } from "./supabase-auth";
import { ZoteroAuth } from "./zotero-auth";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface AuthDataSourceSelectorProps {
  onSelectSampleData: () => void;
}

export function AuthDataSourceSelector({ onSelectSampleData }: AuthDataSourceSelectorProps) {
  const { user } = useSupabaseAuth();
  const [showZoteroAuth, setShowZoteroAuth] = React.useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Welcome to PaperMind</h2>
        <p className="text-muted-foreground">
          AI-powered research paper analysis and management
        </p>
      </div>

      {!user ? (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Authentication */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Get Started
              </CardTitle>
              <CardDescription>
                Sign in to save your AI analysis, sync with Zotero, and access your data across devices
              </CardDescription>
              <Badge className="absolute top-4 right-4">Recommended</Badge>
            </CardHeader>
            <CardContent>
              <SupabaseAuth />
            </CardContent>
          </Card>

          {/* Sample Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Try Sample Data
              </CardTitle>
              <CardDescription>
                Explore PaperMind&apos;s features with curated research papers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>4 sample AI research papers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>Test all AI analysis features</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>No registration required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>Data not saved</span>
                </div>
              </div>
              
              <Button onClick={onSelectSampleData} variant="outline" className="w-full">
                Explore with Sample Data
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Zotero Integration */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Connect Zotero
              </CardTitle>
              <CardDescription>
                Sync your personal Zotero library for real-time analysis
              </CardDescription>
              <Badge className="absolute top-4 right-4">Your Data</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Real-time sync with your library</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Access all collections and tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>AI analysis saved to your account</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Secure OAuth connection</span>
                </div>
              </div>
              
              {!showZoteroAuth ? (
                <Button onClick={() => setShowZoteroAuth(true)} className="w-full">
                  Connect Zotero Library
                </Button>
              ) : (
                <ZoteroAuth />
              )}
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Your Saved Data
              </CardTitle>
              <CardDescription>
                Access your previously saved AI analysis and custom columns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Saved AI column definitions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Generated content history</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Cross-device synchronization</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Persistent preferences</span>
                </div>
              </div>
              
              <Button variant="outline" className="w-full">
                Browse Saved Data
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          You can always switch between data sources later in your settings
        </p>
      </div>
    </div>
  );
}