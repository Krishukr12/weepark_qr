import type { Prisma, Vehicle } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const vehicleInclude = {
  include: {
    employee: {
      select: {
        id: true,
        name: true,
        employeeCode: true,
        email: true,
        phone: true,
        isActive: true,
        organization: { select: { id: true, name: true, companyName: true, isActive: true } },
      },
    },
  },
} satisfies Prisma.VehicleDefaultArgs;

export type VehicleWithOwner = Prisma.VehicleGetPayload<typeof vehicleInclude>;

export const vehicleRepository = {
  async findMany(
    params: PaginationParams & { organizationId?: string; employeeId?: string },
  ): Promise<{ items: VehicleWithOwner[]; total: number }> {
    const where: Prisma.VehicleWhereInput = {
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.organizationId ? { employee: { organizationId: params.organizationId } } : {}),
      ...(params.search
        ? {
            OR: [
              { vehicleNumber: { contains: params.search.toUpperCase().replace(/[\s-]/g, ''), mode: 'insensitive' } },
              { brand: { contains: params.search, mode: 'insensitive' } },
              { model: { contains: params.search, mode: 'insensitive' } },
              { employee: { name: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.VehicleOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.vehicle.findMany({ where, orderBy, ...toSkipTake(params), ...vehicleInclude }),
      prisma.vehicle.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<VehicleWithOwner | null> {
    return prisma.vehicle.findUnique({ where: { id }, ...vehicleInclude });
  },

  findByNumber(vehicleNumber: string): Promise<VehicleWithOwner | null> {
    return prisma.vehicle.findUnique({ where: { vehicleNumber }, ...vehicleInclude });
  },

  create(data: Prisma.VehicleCreateInput): Promise<VehicleWithOwner> {
    return prisma.vehicle.create({ data, ...vehicleInclude });
  },

  update(id: string, data: Prisma.VehicleUpdateInput): Promise<VehicleWithOwner> {
    return prisma.vehicle.update({ where: { id }, data, ...vehicleInclude });
  },

  delete(id: string): Promise<Vehicle> {
    return prisma.vehicle.delete({ where: { id } });
  },

  async clearPrimaryFlag(employeeId: string): Promise<void> {
    await prisma.vehicle.updateMany({ where: { employeeId, isPrimary: true }, data: { isPrimary: false } });
  },
};
