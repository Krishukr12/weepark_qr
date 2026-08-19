import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './apiError';

export const PARK_AUTH_TYP = 'park_auth';
export const PARK_SESSION_TYP = 'park_session';

export interface ParkAuthClaims {
  typ: typeof PARK_AUTH_TYP;
  vehicleId: string;
  siteId: string;
  siteCode: string;
}

export interface ParkSessionClaims {
  typ: typeof PARK_SESSION_TYP;
  parkingEntryId: string;
  ticketCode: string;
  vehicleNumber: string;
  siteId: string;
  siteCode: string;
}

const PARK_AUTH_EXPIRES = '10m';
const PARK_SESSION_EXPIRES = '24h';

export function signParkAuth(claims: Omit<ParkAuthClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: PARK_AUTH_TYP }, env.JWT_ACCESS_SECRET, {
    expiresIn: PARK_AUTH_EXPIRES,
    issuer: 'weepark',
  } as SignOptions);
}

export function signParkSession(claims: Omit<ParkSessionClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: PARK_SESSION_TYP }, env.JWT_ACCESS_SECRET, {
    expiresIn: PARK_SESSION_EXPIRES,
    issuer: 'weepark',
  } as SignOptions);
}

function verifyTyped<T extends { typ: string }>(token: string, typ: T['typ']): T {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'weepark' }) as T;
    if (payload.typ !== typ) throw ApiError.unauthorized('Invalid parking token');
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid or expired parking token');
  }
}

export function verifyParkAuth(token: string): ParkAuthClaims {
  const payload = verifyTyped<ParkAuthClaims>(token, PARK_AUTH_TYP);
  if (!payload.vehicleId || !payload.siteId || !payload.siteCode) {
    throw ApiError.unauthorized('Invalid parking token');
  }
  return payload;
}

export function verifyParkSession(token: string): ParkSessionClaims {
  const payload = verifyTyped<ParkSessionClaims>(token, PARK_SESSION_TYP);
  if (!payload.parkingEntryId || !payload.ticketCode || !payload.vehicleNumber || !payload.siteCode) {
    throw ApiError.unauthorized('Invalid parking session');
  }
  return payload;
}
