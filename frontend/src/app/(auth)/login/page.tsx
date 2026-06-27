"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function LoginPage() {
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border bg-card text-card-foreground p-8 shadow-md">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="text-muted-foreground">Enter your email below to login to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {loginError && (
            <div className="text-sm text-red-500">
              {loginError instanceof Error ? loginError.message : 'Login failed. Please check your credentials.'}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        <div className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="underline">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
