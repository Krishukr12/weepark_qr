import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/employee.validator';

export const employeeRoutes = Router();

employeeRoutes.use(authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'));

employeeRoutes.get('/', employeeController.list);
employeeRoutes.get('/:id', employeeController.getById);
employeeRoutes.post('/', validate({ body: createEmployeeSchema }), employeeController.create);
employeeRoutes.patch('/:id', validate({ body: updateEmployeeSchema }), employeeController.update);
employeeRoutes.delete('/:id', employeeController.remove);
