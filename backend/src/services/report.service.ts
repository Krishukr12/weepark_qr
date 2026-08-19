import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { ParkingEntryFull } from '../repositories/parking.repository';

interface ReportRow {
  ticketCode: string;
  vehicleNumber: string;
  vehicleType: string;
  employee: string;
  employeeCode: string;
  phone: string;
  organization: string;
  site: string;
  valet: string;
  status: string;
  parkedAt: string;
  pickedUpAt: string;
  durationMinutes: string;
}

const COLUMNS: { header: string; key: keyof ReportRow; width: number }[] = [
  { header: 'Ticket', key: 'ticketCode', width: 22 },
  { header: 'Vehicle Number', key: 'vehicleNumber', width: 16 },
  { header: 'Vehicle Type', key: 'vehicleType', width: 12 },
  { header: 'Employee', key: 'employee', width: 22 },
  { header: 'Employee ID', key: 'employeeCode', width: 14 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Organization', key: 'organization', width: 22 },
  { header: 'Site', key: 'site', width: 22 },
  { header: 'Valet', key: 'valet', width: 18 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'Parked At', key: 'parkedAt', width: 20 },
  { header: 'Picked Up At', key: 'pickedUpAt', width: 20 },
  { header: 'Duration (min)', key: 'durationMinutes', width: 14 },
];

function toRow(entry: ParkingEntryFull): ReportRow {
  return {
    ticketCode: entry.ticketCode,
    vehicleNumber: entry.vehicle.vehicleNumber,
    vehicleType: entry.vehicle.vehicleType,
    employee: entry.employee.name,
    employeeCode: entry.employee.employeeCode,
    phone: entry.employee.phone ?? '',
    organization: entry.organization.name,
    site: entry.site.name,
    valet: entry.valet?.name ?? '',
    status: entry.status,
    parkedAt: format(entry.parkedAt, 'yyyy-MM-dd HH:mm'),
    pickedUpAt: entry.pickedUpAt ? format(entry.pickedUpAt, 'yyyy-MM-dd HH:mm') : '',
    durationMinutes: entry.durationMinutes?.toString() ?? '',
  };
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const reportService = {
  toCsv(entries: ParkingEntryFull[]): string {
    const header = COLUMNS.map((c) => c.header).join(',');
    const rows = entries.map((entry) => {
      const row = toRow(entry);
      return COLUMNS.map((c) => escapeCsvValue(row[c.key])).join(',');
    });
    return [header, ...rows].join('\n');
  },

  async toExcel(entries: ParkingEntryFull[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WeePark';
    const sheet = workbook.addWorksheet('Parking History', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4F4F5' },
    };

    for (const entry of entries) {
      sheet.addRow(toRow(entry));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
