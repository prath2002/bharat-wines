"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function RegisterPage() {
  const { register, isRegistering, registerError } = useAuth();
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    password: '',
    confirm_password: '',
    license_number: '',
    address: '',
    state: ''
  });
  const [validationError, setValidationError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      setValidationError("Passwords do not match");
      return;
    }
    setValidationError('');
    register(formData);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 py-10">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Register Business</h1>
          <p className="text-gray-500">Create a new workspace for your store</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input id="business_name" required value={formData.business_name} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner_name">Owner Name *</Label>
            <Input id="owner_name" required value={formData.owner_name} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" required value={formData.email} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input id="password" type="password" required value={formData.password} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password *</Label>
            <Input id="confirm_password" type="password" required value={formData.confirm_password} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="license_number">FL-2 License Number</Label>
            <Input id="license_number" value={formData.license_number} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={formData.state} onChange={handleChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={formData.address} onChange={handleChange} />
          </div>
          
          {(validationError || registerError) && (
            <div className="text-sm text-red-500">
              {validationError || (registerError instanceof Error ? registerError.message : 'Registration failed')}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isRegistering}>
            {isRegistering ? 'Registering...' : 'Register'}
          </Button>
        </form>
        <div className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
