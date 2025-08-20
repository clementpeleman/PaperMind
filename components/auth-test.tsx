"use client";

import { useSupabaseZoteroAuth } from '@/hooks/use-supabase-zotero-auth';
import { Button } from '@/components/ui/button';

export function AuthTest() {
  const { 
    user, 
    session, 
    zoteroCredentials, 
    isAuthenticated, 
    isLoading, 
    error,
    authenticateWithZotero,
    signOut 
  } = useSupabaseZoteroAuth();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (error) {
    return <div className="text-red-500">Auth Error: {error}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <h2>Authentication Required</h2>
        <Button onClick={authenticateWithZotero}>
          Connect with Zotero
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2>Authentication Status</h2>
      <div className="space-y-2">
        <div><strong>Supabase User ID:</strong> {user?.id}</div>
        <div><strong>Email:</strong> {user?.email}</div>
        <div><strong>Zotero User ID:</strong> {zoteroCredentials?.zoteroUserId}</div>
        <div><strong>Has Zotero Token:</strong> {zoteroCredentials?.zoteroAccessToken ? 'Yes' : 'No'}</div>
        <div><strong>Session Expires:</strong> {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Unknown'}</div>
      </div>
      <Button onClick={signOut} variant="outline">
        Sign Out
      </Button>
    </div>
  );
}