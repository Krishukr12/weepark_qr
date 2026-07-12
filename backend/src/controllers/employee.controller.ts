import type { Request, Response } from 'express';
import { employeeService } from '../services/employee.service';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { getPagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '../validators/employee.validator';

export const employeeController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const params = getPagination(req);
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const result = await employeeService.list(req.user, { ...params, organizationId });
    sendPaginated(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const employee = await employeeService.getById(req.user, param(req, 'id'));
    sendSuccess(res, employee);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const employee = await employeeService.create(req.user, req.body as CreateEmployeeInput);
    sendSuccess(res, employee, 201, 'Employee created successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const employee = await employeeService.update(req.user, param(req, 'id'), req.body as UpdateEmployeeInput);
    sendSuccess(res, employee, 200, 'Employee updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await employeeService.remove(req.user, param(req, 'id'));
    sendSuccess(res, null, 200, 'Employee deleted successfully');
  }),
};
