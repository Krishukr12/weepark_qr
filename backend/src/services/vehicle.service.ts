import { vehicleRepository, type VehicleWithOwner } from '../repositories/vehicle.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { ApiError } from '../utils/apiError';
import { buildPaginatedResult } from '../utils/pagination';
import { recordAudit } from './audit.service';
import type { AuthenticatedUser, PaginatedResult, PaginationParams } from '../types';
import type { CreateVehicleInput, UpdateVehicleInput } from '../validators/vehicle.validator';

function assertVehicleScope(actor: AuthenticatedUser, vehicle: VehicleWithOwner): void {
  if (actor.role === 'ORG_ADMIN' && vehicle.employee.organization.id !== actor.organizationId) {
    throw ApiError.forbidden('You cannot access vehicles of another organization');
  }
}

export const vehicleService = {
  async list(
    actor: AuthenticatedUser,
    params: PaginationParams & { organizationId?: string; employeeId?: string },
  ): Promise<PaginatedResult<VehicleWithOwner>> {
    const organizationId = actor.role === 'ORG_ADMIN' ? (actor.organizationId ?? undefined) : params.organizationId;
    const { items, total } = await vehicleRepository.findMany({ ...params, organizationId });
    return buildPaginatedResult(items, total, params);
  },

  async getById(actor: AuthenticatedUser, id: string): Promise<VehicleWithOwner> {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw ApiError.notFound('Vehicle not found');
    assertVehicleScope(actor, vehicle);
    return vehicle;
  },

  async create(actor: AuthenticatedUser, input: CreateVehicleInput): Promise<VehicleWithOwner> {
    const employee = await employeeRepository.findById(input.employeeId);
    if (!employee) throw ApiError.notFound('Employee not found');
    if (actor.role === 'ORG_ADMIN' && employee.organizationId !== actor.organizationId) {
      throw ApiError.forbidden('You cannot add vehicles for another organization');
    }

    const existing = await vehicleRepository.findByNumber(input.vehicleNumber);
    if (existing) throw ApiError.conflict(`Vehicle ${input.vehicleNumber} is already registered`);

    if (input.isPrimary) {
      await vehicleRepository.clearPrimaryFlag(input.employeeId);
    }

    const vehicle = await vehicleRepository.create({
      vehicleNumber: input.vehicleNumber,
      vehicleType: input.vehicleType,
      brand: input.brand || null,
      model: input.model || null,
      color: input.color || null,
      fuelType: input.fuelType,
      isPrimary: input.isPrimary,
      rcNumber: input.rcNumber || null,
      employee: { connect: { id: input.employeeId } },
    });

    await recordAudit({ userId: actor.id, action: 'VEHICLE_CREATED', entity: 'Vehicle', entityId: vehicle.id });
    return vehicle;
  },

  async update(actor: AuthenticatedUser, id: string, input: UpdateVehicleInput): Promise<VehicleWithOwner> {
    const vehicle = await this.getById(actor, id);

    if (input.isPrimary) {
      await vehicleRepository.clearPrimaryFlag(vehicle.employee.id);
    }

    const updated = await vehicleRepository.update(id, {
      ...(input.vehicleNumber !== undefined ? { vehicleNumber: input.vehicleNumber } : {}),
      ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType } : {}),
      ...(input.brand !== undefined ? { brand: input.brand || null } : {}),
      ...(input.model !== undefined ? { model: input.model || null } : {}),
      ...(input.color !== undefined ? { color: input.color || null } : {}),
      ...(input.fuelType !== undefined ? { fuelType: input.fuelType } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.rcNumber !== undefined ? { rcNumber: input.rcNumber || null } : {}),
    });

    await recordAudit({ userId: actor.id, action: 'VEHICLE_UPDATED', entity: 'Vehicle', entityId: id });
    return updated;
  },

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.getById(actor, id); // scope check
    await vehicleRepository.delete(id);
    await recordAudit({ userId: actor.id, action: 'VEHICLE_DELETED', entity: 'Vehicle', entityId: id });
  },
};
