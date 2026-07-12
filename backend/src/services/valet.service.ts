import { userRepository } from '../repositories/user.repository';
import { valetRepository, type ValetWithSites } from '../repositories/valet.repository';
import { siteRepository } from '../repositories/site.repository';
import { ApiError } from '../utils/apiError';
import { hashPassword } from '../utils/password';
import { generateRandomPassword } from '../utils/token';
import { buildPaginatedResult } from '../utils/pagination';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { recordAudit } from './audit.service';
import type { PaginatedResult, PaginationParams } from '../types';
import type { CreateValetInput, UpdateValetInput } from '../validators/valet.validator';

export const valetService = {
  async list(params: PaginationParams & { siteId?: string }): Promise<PaginatedResult<ValetWithSites>> {
    const { items, total } = await valetRepository.findMany(params);
    return buildPaginatedResult(items, total, params);
  },

  async getById(id: string): Promise<ValetWithSites> {
    const valet = await valetRepository.findById(id);
    if (!valet) throw ApiError.notFound('Valet not found');
    return valet;
  },

  async create(input: CreateValetInput, actorId: string): Promise<ValetWithSites> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('A user with this email already exists');

    const password = input.password ?? generateRandomPassword();
    const user = await userRepository.create({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await hashPassword(password),
      role: 'VALET',
      photoUrl: input.photoUrl || null,
      isActive: input.isActive,
    });

    if (input.siteIds.length > 0) {
      await valetRepository.setSites(user.id, input.siteIds);
    }

    await emailService.sendValetCredentials({ to: user.email, name: user.name, email: user.email, password });
    await recordAudit({ userId: actorId, action: 'VALET_CREATED', entity: 'User', entityId: user.id, metadata: { email: user.email } });

    return this.getById(user.id);
  },

  async update(id: string, input: UpdateValetInput, actorId: string): Promise<ValetWithSites> {
    const valet = await valetRepository.findById(id);
    if (!valet) throw ApiError.notFound('Valet not found');

    await userRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    if (input.siteIds !== undefined) {
      await valetRepository.setSites(id, input.siteIds);
    }

    await recordAudit({ userId: actorId, action: 'VALET_UPDATED', entity: 'User', entityId: id });
    return this.getById(id);
  },

  async deactivate(id: string, actorId: string): Promise<void> {
    const valet = await valetRepository.findById(id);
    if (!valet) throw ApiError.notFound('Valet not found');
    await userRepository.update(id, { isActive: false });
    await recordAudit({ userId: actorId, action: 'VALET_DEACTIVATED', entity: 'User', entityId: id });
  },

  async assignSite(valetId: string, siteId: string, actorId: string): Promise<void> {
    const [valet, site] = await Promise.all([valetRepository.findById(valetId), siteRepository.findById(siteId)]);
    if (!valet) throw ApiError.notFound('Valet not found');
    if (!site) throw ApiError.notFound('Site not found');

    await valetRepository.addSite(valetId, siteId);
    await notificationService.notifyUser({
      userId: valetId,
      type: 'VALET_ASSIGNED',
      title: 'New site assignment',
      message: `You have been assigned to ${site.name} (${site.siteCode})`,
      data: { siteId, siteCode: site.siteCode },
    });
    await recordAudit({ userId: actorId, action: 'VALET_SITE_ASSIGNED', entity: 'ValetSiteAssignment', metadata: { valetId, siteId } });
  },

  async unassignSite(valetId: string, siteId: string, actorId: string): Promise<void> {
    await valetRepository.removeSite(valetId, siteId);
    await recordAudit({ userId: actorId, action: 'VALET_SITE_UNASSIGNED', entity: 'ValetSiteAssignment', metadata: { valetId, siteId } });
  },

  async getAssignedSiteIds(valetId: string): Promise<string[]> {
    const rows = await valetRepository.getAssignedSiteIds(valetId);
    return rows.map((r) => r.siteId);
  },
};
