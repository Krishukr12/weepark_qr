import type { Employee, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PaginationParams } from '../types';
import { toSkipTake } from '../utils/pagination';

const employeeInclude = {
  include: {
    organization: { select: { id: true, name: true, companyName: true } },
    _count: { select: { vehicles: true, parkingEntries: true } },
  },
} satisfies Prisma.EmployeeDefaultArgs;

export type EmployeeWithRelations = Prisma.EmployeeGetPayload<typeof employeeInclude>;

export const employeeRepository = {
  async findMany(
    params: PaginationParams & { organizationId?: string },
  ): Promise<{ items: EmployeeWithRelations[]; total: number }> {
    const where: Prisma.EmployeeWhereInput = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { employeeCode: { contains: params.search, mode: 'insensitive' } },
              { department: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.EmployeeOrderByWithRelationInput = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' };

    const [items, total] = await prisma.$transaction([
      prisma.employee.findMany({ where, orderBy, ...toSkipTake(params), ...employeeInclude }),
      prisma.employee.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<EmployeeWithRelations | null> {
    return prisma.employee.findUnique({ where: { id }, ...employeeInclude });
  },

  findByEmail(email: string): Promise<Employee | null> {
    return prisma.employee.findUnique({ where: { email: email.toLowerCase() } });
  },

  create(data: Prisma.EmployeeCreateInput): Promise<Employee> {
    return prisma.employee.create({ data });
  },

  update(id: string, data: Prisma.EmployeeUpdateInput): Promise<Employee> {
    return prisma.employee.update({ where: { id }, data });
  },

  delete(id: string): Promise<Employee> {
    return prisma.employee.delete({ where: { id } });
  },
};
