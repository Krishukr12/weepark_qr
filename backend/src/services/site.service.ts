import type { Site } from '@prisma/client';
import { prisma } from '../config/prisma';
import { siteRepository, type SiteWithCounts } from '../repositories/site.repository';
import { parkingRepository } from '../repositories/parking.repository';
import { ApiError } from '../utils/apiError';
import { generateSiteCode } from '../utils/codes';
import { generateSiteQrDataUrl, generateSiteQrPngBuffer, getSiteParkingUrl } from '../utils/qrcode';
import { buildPaginatedResult } from '../utils/pagination';
import { recordAudit } from './audit.service';
import type { PaginatedResult, PaginationParams } from '../types';
import type { CreateSiteInput, UpdateSiteInput } from '../validators/site.validator';

export interface SiteOccupancy {
  totalCapacity: number;
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

export const siteService = {
  async list(params: PaginationParams & { isActive?: boolean }): Promise<PaginatedResult<SiteWithCounts & { occupancy: SiteOccupancy }>> {
    const { items, total } = await siteRepository.findMany(params);
    const enriched = await Promise.all(
      items.map(async (site) => ({ ...site, occupancy: await getOccupancy(site) })),
    );
    return buildPaginatedResult(enriched, total, params);
  },

  async getById(id: string): Promise<Site & { occupancy: SiteOccupancy; qrDataUrl: string; parkingUrl: string; valets: unknown[] }> {
    const site = await siteRepository.findById(id);
    if (!site) throw ApiError.notFound('Site not found');

    const [occupancy, qrDataUrl, assignments] = await Promise.all([
      getOccupancy(site),
      generateSiteQrDataUrl(site.siteCode),
      prisma.valetSiteAssignment.findMany({
        where: { siteId: id },
        select: {
          assignedAt: true,
          valet: { select: { id: true, name: true, email: true, phone: true, photoUrl: true, isActive: true } },
        },
      }),
    ]);

    return {
      ...site,
      occupancy,
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
  async getPublicByCode(siteCode: string): Promise<Pick<Site, 'id' | 'siteCode' | 'name' | 'address' | 'latitude' | 'longitude' | 'googleMapsLink'> & { occupancy: SiteOccupancy }> {
    const site = await siteRepository.findByCode(siteCode);
    if (!site || !site.isActive) throw ApiError.notFound('This parking site does not exist or is inactive');

    return {
      id: site.id,
      siteCode: site.siteCode,
      name: site.name,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      googleMapsLink: site.googleMapsLink,
      occupancy: await getOccupancy(site),
    };
  },
};
