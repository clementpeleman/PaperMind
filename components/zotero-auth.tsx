"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";

export function ZoteroAuth() {
  const { isAuthenticated, isLoading, error, authenticateWithZotero, signOut } = useSupabaseZoteroAuth();

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Checking Zotero connection...</span>
        </CardContent>
      </Card>
    );
  }

  if (isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Connected to Zotero
          </CardTitle>
          <CardDescription>
            Your Zotero library is connected and ready to sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={signOut} className="w-full">
            Disconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Connect to Zotero
        </CardTitle>
        <CardDescription>
          Connect your Zotero account to sync your research papers and manage them with AI-powered analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">What you&apos;ll get:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Access to your Zotero library</li>
              <li>Real-time sync of papers and notes</li>
              <li>AI-powered analysis of your research</li>
              <li>Enhanced search and organization</li>
            </ul>
          </div>
          
          <Button onClick={authenticateWithZotero} className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Zotero Account
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            You&apos;ll be redirected to Zotero to authorize this app. No passwords are stored.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}