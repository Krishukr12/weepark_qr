import { employeeRepository, type EmployeeWithRelations } from '../repositories/employee.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { ApiError } from '../utils/apiError';
import { buildPaginatedResult } from '../utils/pagination';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '../validators/employee.validator';

/** Org admins are always scoped to their own organization; super admins can pass any org. */
function resolveOrganizationScope(actor: AuthenticatedUser, requestedOrgId?: string): string | undefined {
  if (actor.role === 'ORG_ADMIN') {
    if (!actor.organizationId) throw ApiError.forbidden('Your account is not linked to an organization');
    return actor.organizationId;
  }
  return requestedOrgId;
}

export const employeeService = {
  resolveOrganizationScope,

  async list(
    actor: AuthenticatedUser,
    params: PaginationParams & { organizationId?: string },
  ): Promise<PaginatedResult<EmployeeWithRelations>> {
    const organizationId = resolveOrganizationScope(actor, params.organizationId);
    const { items, total } = await employeeRepository.findMany({ ...params, organizationId });
    return buildPaginatedResult(items, total, params);
  },

  async getById(actor: AuthenticatedUser, id: string): Promise<EmployeeWithRelations> {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw ApiError.notFound('Employee not found');
    if (actor.role === 'ORG_ADMIN' && employee.organizationId !== actor.organizationId) {
      throw ApiError.forbidden('You cannot access employees of another organization');
    }
    return employee;
  },

  async create(actor: AuthenticatedUser, input: CreateEmployeeInput): Promise<EmployeeWithRelations> {
    const organizationId =
      actor.role === 'ORG_ADMIN' ? resolveOrganizationScope(actor) : input.organizationId;
    if (!organizationId) throw ApiError.badRequest('organizationId is required');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw ApiError.notFound('Organization not found');

    const existing = await employeeRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('An employee with this email already exists');

    const employee = await employeeRepository.create({
      employeeCode: input.employeeCode,
      name: input.name,
      department: input.department || null,
      designation: input.designation || null,
      phone: input.phone || null,
      email: input.email.toLowerCase(),
      isActive: input.isActive,
      organization: { connect: { id: organizationId } },
    });

    await recordAudit({ userId: actor.id, action: 'EMPLOYEE_CREATED', entity: 'Employee', entityId: employee.id });
    return this.getById(actor, employee.id);
  },

  async update(actor: AuthenticatedUser, id: string, input: UpdateEmployeeInput): Promise<EmployeeWithRelations> {
    await this.getById(actor, id); // scope check

    await employeeRepository.update(id, {
      ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.department !== undefined ? { department: input.department || null } : {}),
      ...(input.designation !== undefined ? { designation: input.designation || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    await recordAudit({ userId: actor.id, action: 'EMPLOYEE_UPDATED', entity: 'Employee', entityId: id });
    return this.getById(actor, id);
  },

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.getById(actor, id); // scope check
    await employeeRepository.delete(id);
    await recordAudit({ userId: actor.id, action: 'EMPLOYEE_DELETED', entity: 'Employee', entityId: id });
  },
};
