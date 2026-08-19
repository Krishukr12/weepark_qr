import { z } from 'zod';
import type { FuelType, VehicleType } from '@/types';

export const VEHICLE_TYPES: VehicleType[] = ['CAR', 'SUV', 'BIKE', 'SCOOTER', 'EV', 'OTHER'];
export const FUEL_TYPES: FuelType[] = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'OTHER'];

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const publicRegisterSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  fuelType: z.enum(FUEL_TYPES),
  brand: z.string().or(z.literal('')),
  model: z.string().or(z.literal('')),
  color: z.string().or(z.literal('')),
  employeeName: z.string().min(2, 'Enter your name'),
  employeeEmail: z.string().email('Enter a valid email'),
  employeePhone: z.string().min(6, 'Enter a valid phone'),
  employeeCode: z.string().min(1, 'Enter your employee ID'),
  organizationId: z.string().min(1, 'Select your organization'),
});

export const vehicleSchema = z.object({
  vehicleNumber: z.string().min(4, 'Vehicle number is too short'),
  vehicleType: z.enum(VEHICLE_TYPES),
  brand: z.string().or(z.literal('')),
  model: z.string().or(z.literal('')),
  color: z.string().or(z.literal('')),
  fuelType: z.enum(FUEL_TYPES),
  rcNumber: z.string().or(z.literal('')),
  isPrimary: z.boolean(),
  employeeId: z.string().min(1, 'Select an employee'),
});

export const valetSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number')
    .or(z.literal('')),
  photoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
  siteIds: z.array(z.string()),
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  phone: z.string().or(z.literal('')),
  photoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
});

export const siteAllocationSchema = z.object({
  siteId: z.string().min(1),
  allocatedSpaces: z.coerce.number<number>().int().min(1, 'At least 1 space'),
});

export const orgSchema = z.object({
  name: z.string().min(2, 'Organization name is too short'),
  companyName: z.string().min(2, 'Company name is too short'),
  gstNumber: z.string().or(z.literal('')),
  adminName: z.string().min(2, 'Admin name is too short'),
  adminEmail: z.string().email('Enter a valid email'),
  adminPhone: z.string().or(z.literal('')),
  address: z.string().or(z.literal('')),
  logoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
  siteAllocations: z.array(siteAllocationSchema),
});

export const employeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee ID is required'),
  name: z.string().min(2, 'Name is too short'),
  department: z.string().or(z.literal('')),
  designation: z.string().or(z.literal('')),
  phone: z.string().or(z.literal('')),
  email: z.string().email('Enter a valid email'),
  organizationId: z.string().optional(),
});

export const siteSchema = z.object({
  name: z.string().min(2, 'Site name is too short'),
  address: z.string().min(4, 'Address is too short'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  googleMapsLink: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  totalCapacity: z.coerce.number<number>().int().min(1, 'Capacity must be at least 1'),
  isActive: z.boolean(),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type PublicRegisterForm = z.infer<typeof publicRegisterSchema>;
export type VehicleForm = z.infer<typeof vehicleSchema>;
export type ValetForm = z.infer<typeof valetSchema>;
export type ProfileForm = z.infer<typeof profileSchema>;
export type OrgForm = z.infer<typeof orgSchema>;
export type EmployeeForm = z.infer<typeof employeeSchema>;
export type SiteForm = z.infer<typeof siteSchema>;
