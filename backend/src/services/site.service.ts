import type { Site } from '@prisma/client';
import { prisma } from '../config/prisma';
import { organizationRepository } from '../repositories/organization.repository';
import { siteRepository, type SiteWithCounts } from '../repositories/site.repository';
import { parkingRepository } from '../repositories/parking.repository';
import { ApiError } from '../utils/apiError';
import { generateSiteCode } from '../utils/codes';
import { generateSiteQrDataUrl, generateSiteQrPngBuffer, getSiteParkingUrl } from '../utils/qrcode';
import { buildPaginatedResult } from '../utils/pagination';
import { recordAudit } from './audit.service';
import { getSiteParkingContext, type ParkingMode } from './parking-mode';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';
import type { CreateSiteInput, UpdateSiteInput } from '../validators/site.validator';

export interface SiteOccupancy {
  totalCapacity: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}

/** An organization's allocated slice of a site vs currently parked vehicles. */
export interface OrgSiteAllocation {
  allocatedSpaces: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}

async function getOccupancy(site: Pick<Site, 'id' | 'totalCapacity'>): Promise<SiteOccupancy> {
  const occupied = await parkingRepository.countActiveInSite(site.id);
  const available = Math.max(0, site.totalCapacity - occupied);
  return {
    totalCapacity: site.totalCapacity,
    occupied,
    available,
    occupancyRate: site.totalCapacity > 0 ? Math.round((occupied / site.totalCapacity) * 100) : 0,
  };
}

async function getOrgAllocation(organizationId: string, siteId: string): Promise<OrgSiteAllocation | null> {
  const allocated = await organizationRepository.getAllocation(organizationId, siteId);
  if (allocated === null) return null;
  const occupied = await parkingRepository.countActiveForOrgInSite(organizationId, siteId);
  const available = Math.max(0, allocated - occupied);
  return {
    allocatedSpaces: allocated,
    occupied,
    available,
    occupancyRate: allocated > 0 ? Math.round((occupied / allocated) * 100) : 0,
  };
}

async function assertCanViewSite(actor: AuthenticatedUser, siteId: string): Promise<void> {
  if (actor.role === 'SUPER_ADMIN') return;

  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
    const assigned = await organizationRepository.isAssignedToSite(actor.organizationId, siteId);
    if (!assigned) throw ApiError.forbidden('This site is not assigned to your organization');
    return;
  }

  if (actor.role === 'VALET') {
    const assignment = await prisma.valetSiteAssignment.findUnique({
      where: { valetId_siteId: { valetId: actor.id, siteId } },
    });
    if (!assignment) throw ApiError.forbidden('You are not assigned to this site');
  }
}

export const siteService = {
  async list(
    actor: AuthenticatedUser,
    params: PaginationParams & { isActive?: boolean },
  ): Promise<
    PaginatedResult<SiteWithCounts & { occupancy: SiteOccupancy; orgAllocation?: OrgSiteAllocation | null }>
  > {
    let siteIds: string[] | undefined;

    if (actor.role === 'ORG_ADMIN') {
      if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
      siteIds = await organizationRepository.getSiteIds(actor.organizationId);
      if (siteIds.length === 0) {
        return buildPaginatedResult([], 0, params);
      }
    } else if (actor.role === 'VALET') {
      const assignments = await prisma.valetSiteAssignment.findMany({
        where: { valetId: actor.id },
        select: { siteId: true },
      });
      siteIds = assignments.map((a) => a.siteId);
      if (siteIds.length === 0) {
        return buildPaginatedResult([], 0, params);
      }
    }

    const { items, total } = await siteRepository.findMany({ ...params, siteIds });
    const enriched = await Promise.all(
      items.map(async (site) => ({
        ...site,
        occupancy: await getOccupancy(site),
        ...(actor.role === 'ORG_ADMIN' && actor.organizationId
          ? { orgAllocation: await getOrgAllocation(actor.organizationId, site.id) }
          : {}),
      })),
    );
    return buildPaginatedResult(enriched, total, params);
  },

  async getById(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<
    Site & {
      occupancy: SiteOccupancy;
      orgAllocation?: OrgSiteAllocation | null;
      qrDataUrl: string;
      parkingUrl: string;
      valets: unknown[];
    }
  > {
    const site = await siteRepository.findById(id);
    if (!site) throw ApiError.notFound('Site not found');

    await assertCanViewSite(actor, id);

    const [occupancy, qrDataUrl, assignments, orgAllocation] = await Promise.all([
      getOccupancy(site),
      generateSiteQrDataUrl(site.siteCode),
      prisma.valetSiteAssignment.findMany({
        where: { siteId: id },
        select: {
          assignedAt: true,
        valet: {
          select: {
            id: true,
            name: true,
            ...(actor.role === 'SUPER_ADMIN' ? { email: true, phone: true } : {}),
            photoUrl: true,
            isActive: true,
          },
        },
        },
      }),
      actor.role === 'ORG_ADMIN' && actor.organizationId
        ? getOrgAllocation(actor.organizationId, id)
        : Promise.resolve(undefined),
    ]);

    return {
      ...site,
      occupancy,
      ...(orgAllocation !== undefined ? { orgAllocation } : {}),
      qrDataUrl,
      parkingUrl: getSiteParkingUrl(site.siteCode),
      valets: assignments.map((a) => ({ ...a.valet, assignedAt: a.assignedAt })),
    };
  },

  async create(input: CreateSiteInput, actorId: string): Promise<Site & { qrDataUrl: string }> {
    const site = await siteRepository.create({
      name: input.name,
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      googleMapsLink: input.googleMapsLink || null,
      totalCapacity: input.totalCapacity,
      isActive: input.isActive,
      siteCode: generateSiteCode(),
    });

    await recordAudit({ userId: actorId, action: 'SITE_CREATED', entity: 'Site', entityId: site.id, metadata: { name: site.name } });
    return { ...site, qrDataUrl: await generateSiteQrDataUrl(site.siteCode) };
  },

  async update(id: string, input: UpdateSiteInput, actorId: string): Promise<Site> {
    const existing = await siteRepository.findById(id);
    if (!existing) throw ApiError.notFound('Site not found');

    const site = await siteRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.googleMapsLink !== undefined ? { googleMapsLink: input.googleMapsLink || null } : {}),
      ...(input.totalCapacity !== undefined ? { totalCapacity: input.totalCapacity } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    await recordAudit({ userId: actorId, action: 'SITE_UPDATED', entity: 'Site', entityId: id });
    return site;
  },

  async remove(id: string, actorId: string): Promise<void> {
    const active = await parkingRepository.countActiveInSite(id);
    if (active > 0) {
      throw ApiError.conflict('Cannot delete a site with actively parked vehicles');
    }
    await siteRepository.delete(id);
    await recordAudit({ userId: actorId, action: 'SITE_DELETED', entity: 'Site', entityId: id });
  },

  async getQrPng(id: string): Promise<{ buffer: Buffer; siteCode: string }> {
    const site = await siteRepository.findById(id);
    if (!site) throw ApiError.notFound('Site not found');
    return { buffer: await generateSiteQrPngBuffer(site.siteCode), siteCode: site.siteCode };
  },

  /** Public lookup used by the QR landing page. */
  async getPublicByCode(
    siteCode: string,
  ): Promise<
    Pick<Site, 'id' | 'siteCode' | 'name' | 'address' | 'latitude' | 'longitude' | 'googleMapsLink'> & {
      occupancy: SiteOccupancy;
      parkingMode: ParkingMode;
    }
  > {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    const { parkingMode } = await getSiteParkingContext(site.id);

    return {
      id: site.id,
      siteCode: site.siteCode,
      name: site.name,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      googleMapsLink: site.googleMapsLink,
      occupancy: await getOccupancy(site),
      parkingMode,
    };
  },
};
