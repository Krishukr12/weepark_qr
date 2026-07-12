import { env } from './env';

/**
 * Hand-maintained OpenAPI 3 document. Kept lean: it documents every route
 * group, standard response envelope, auth scheme and key schemas.
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'WeePark API',
    version: '1.0.0',
    description:
      'REST API for the WeePark Parking Management Platform. All authenticated endpoints require a Bearer access token. Responses share the envelope `{ success, message?, data, meta? }`.',
  },
  servers: [{ url: `${env.API_URL}/api/v1` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Envelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      Site: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          siteCode: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string' },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          googleMapsLink: { type: 'string', nullable: true },
          totalCapacity: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      ParkingEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ticketCode: { type: 'string' },
          status: { type: 'string', enum: ['PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
          parkedAt: { type: 'string', format: 'date-time' },
          pickedUpAt: { type: 'string', format: 'date-time', nullable: true },
          durationMinutes: { type: 'integer', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Login, refresh, password management' },
    { name: 'Sites', description: 'Parking site management (Super Admin)' },
    { name: 'Valets', description: 'Valet management and site assignment' },
    { name: 'Organizations', description: 'Organization onboarding and management' },
    { name: 'Employees', description: 'Employee management (org scoped)' },
    { name: 'Vehicles', description: 'Vehicle management (org scoped)' },
    { name: 'Parking', description: 'Parking history, exports and QR flow' },
    { name: 'Pickups', description: 'Pickup requests and valet workflow' },
    { name: 'Notifications', description: 'In-app notifications' },
    { name: 'Dashboard', description: 'Analytics and stats' },
    { name: 'Public', description: 'Unauthenticated QR flow endpoints' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Sign in with email and password',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: { '200': { description: 'Access + refresh tokens with user profile' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], security: [], summary: 'Rotate refresh token', responses: { '200': { description: 'New token pair' } } },
    },
    '/auth/logout': { post: { tags: ['Auth'], security: [], summary: 'Revoke a refresh token', responses: { '200': { description: 'Logged out' } } } },
    '/auth/forgot-password': { post: { tags: ['Auth'], security: [], summary: 'Request a password reset email', responses: { '200': { description: 'Always succeeds' } } } },
    '/auth/reset-password': { post: { tags: ['Auth'], security: [], summary: 'Reset password with emailed token', responses: { '200': { description: 'Password reset' } } } },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user profile', responses: { '200': { description: 'User' } } },
      patch: { tags: ['Auth'], summary: 'Update profile', responses: { '200': { description: 'Updated user' } } },
    },
    '/auth/change-password': { post: { tags: ['Auth'], summary: 'Change password', responses: { '200': { description: 'Changed' } } } },
    '/sites': {
      get: { tags: ['Sites'], summary: 'List sites with occupancy (paginated, searchable)', responses: { '200': { description: 'Paginated sites' } } },
      post: { tags: ['Sites'], summary: 'Create site (auto-generates site code + QR)', responses: { '201': { description: 'Site created' } } },
    },
    '/sites/{id}': {
      get: { tags: ['Sites'], summary: 'Site details with occupancy, valets and QR', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Site' } } },
      patch: { tags: ['Sites'], summary: 'Update site', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Sites'], summary: 'Delete site', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/sites/{id}/qr': {
      get: { tags: ['Sites'], summary: 'Download the site QR as PNG', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'PNG image' } } },
    },
    '/valets': {
      get: { tags: ['Valets'], summary: 'List valets with assigned sites', responses: { '200': { description: 'Paginated valets' } } },
      post: { tags: ['Valets'], summary: 'Create valet (emails credentials)', responses: { '201': { description: 'Created' } } },
    },
    '/valets/{id}/sites/{siteId}': {
      post: { tags: ['Valets'], summary: 'Assign valet to site', responses: { '200': { description: 'Assigned' } } },
      delete: { tags: ['Valets'], summary: 'Remove valet from site', responses: { '200': { description: 'Removed' } } },
    },
    '/organizations': {
      get: { tags: ['Organizations'], summary: 'List organizations', responses: { '200': { description: 'Paginated organizations' } } },
      post: { tags: ['Organizations'], summary: 'Onboard organization (creates admin login + emails credentials)', responses: { '201': { description: 'Created' } } },
    },
    '/organizations/mine': {
      get: { tags: ['Organizations'], summary: "Org admin's own organization", responses: { '200': { description: 'Organization' } } },
    },
    '/employees': {
      get: { tags: ['Employees'], summary: 'List employees (org scoped)', responses: { '200': { description: 'Paginated employees' } } },
      post: { tags: ['Employees'], summary: 'Create employee', responses: { '201': { description: 'Created' } } },
    },
    '/vehicles': {
      get: { tags: ['Vehicles'], summary: 'List vehicles (org scoped)', responses: { '200': { description: 'Paginated vehicles' } } },
      post: { tags: ['Vehicles'], summary: 'Register vehicle for an employee', responses: { '201': { description: 'Created' } } },
    },
    '/parking': {
      get: { tags: ['Parking'], summary: 'Parking history (filter by date, org, employee, vehicle, site, valet, status)', responses: { '200': { description: 'Paginated history' } } },
    },
    '/parking/export/csv': { get: { tags: ['Parking'], summary: 'Export filtered history as CSV', responses: { '200': { description: 'CSV file' } } } },
    '/parking/export/excel': { get: { tags: ['Parking'], summary: 'Export filtered history as Excel', responses: { '200': { description: 'XLSX file' } } } },
    '/pickups': { get: { tags: ['Pickups'], summary: 'List pickup requests (valets see assigned sites only)', responses: { '200': { description: 'Paginated pickups' } } } },
    '/pickups/{id}/accept': { post: { tags: ['Pickups'], summary: 'Valet accepts a pending pickup', responses: { '200': { description: 'Accepted' }, '409': { description: 'Already accepted' } } } },
    '/pickups/{id}/complete': { post: { tags: ['Pickups'], summary: 'Valet completes an accepted pickup', responses: { '200': { description: 'Completed' } } } },
    '/notifications': { get: { tags: ['Notifications'], summary: 'List my notifications', responses: { '200': { description: 'Paginated notifications' } } } },
    '/dashboard/stats': { get: { tags: ['Dashboard'], summary: 'Role-scoped dashboard cards', responses: { '200': { description: 'Stats' } } } },
    '/dashboard/parking-trend': { get: { tags: ['Dashboard'], summary: 'Daily parking/pickup trend', responses: { '200': { description: 'Trend points' } } } },
    '/dashboard/peak-hours': { get: { tags: ['Dashboard'], summary: 'Hourly parking distribution (30d)', responses: { '200': { description: 'Peak hours' } } } },
    '/public/parking/sites/{siteCode}': {
      get: { tags: ['Public'], security: [], summary: 'QR landing: site info + occupancy', responses: { '200': { description: 'Site' }, '404': { description: 'Unknown or inactive site' } } },
    },
    '/public/parking/sites/{siteCode}/lookup': {
      post: { tags: ['Public'], security: [], summary: 'Lookup vehicle by number (returns owner, org, active parking)', responses: { '200': { description: 'Lookup result' } } },
    },
    '/public/parking/sites/{siteCode}/register': {
      post: { tags: ['Public'], security: [], summary: 'Quick-register an unknown vehicle + employee', responses: { '201': { description: 'Registered' } } },
    },
    '/public/parking/sites/{siteCode}/park': {
      post: { tags: ['Public'], security: [], summary: 'PARK MY VEHICLE — create parking record', responses: { '201': { description: 'Parked' }, '409': { description: 'Already parked / site full' } } },
    },
    '/public/pickups/request': {
      post: { tags: ['Public'], security: [], summary: 'GET MY CAR — create pickup request and notify valets', responses: { '201': { description: 'Requested' } } },
    },
  },
} as const;
