import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InternalReportsController } from './internal-reports.controller';
import { InternalReportsAuthService } from './internal-reports-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';

describe('InternalReportsController', () => {
  let controller: InternalReportsController;
  let auth: { assertBffAuth: jest.Mock };
  let prisma: { program: { findUnique: jest.Mock } };
  let programRegistrations: { listRegistrationsForAdmin: jest.Mock };

  beforeEach(() => {
    auth = { assertBffAuth: jest.fn() };
    prisma = { program: { findUnique: jest.fn() } };
    programRegistrations = { listRegistrationsForAdmin: jest.fn() };

    controller = new InternalReportsController(
      auth as unknown as InternalReportsAuthService,
      prisma as unknown as PrismaService,
      programRegistrations as unknown as ProgramRegistrationsService,
    );
  });

  it('rejects when auth check fails', async () => {
    auth.assertBffAuth.mockImplementation(() => {
      throw new UnauthorizedException('Invalid X-BFF-Auth secret');
    });

    await expect(
      controller.listRegistrations('program-1', 'wrong-secret'),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.program.findUnique).not.toHaveBeenCalled();
  });

  it('throws 404 when the program does not exist', async () => {
    prisma.program.findUnique.mockResolvedValue(null);

    await expect(
      controller.listRegistrations('missing-program', 'test-secret'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns a trimmed registration shape, not the full admin payload', async () => {
    prisma.program.findUnique.mockResolvedValue({ id: 'program-1' });
    programRegistrations.listRegistrationsForAdmin.mockResolvedValue([
      {
        id: 'reg-1',
        status: 'APPROVED',
        user: {
          id: 'user-1',
          email: 'doc@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          specialty: 'Medical Oncology',
          institution: 'UCSF',
          role: 'HCP',
        },
        postEventAttendanceStatus: 'VERIFIED',
        adminNotes: 'internal note, should not leak',
        postEventSurveyAnswers: { q1: 'sensitive' },
      },
    ]);

    const result = await controller.listRegistrations('program-1', 'test-secret');

    expect(result.registrations).toHaveLength(1);
    const row = result.registrations[0];
    expect(row).toEqual({
      id: 'reg-1',
      status: 'APPROVED',
      user: {
        id: 'user-1',
        email: 'doc@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        specialty: 'Medical Oncology',
        institution: 'UCSF',
        role: 'HCP',
      },
      postEventAttendanceStatus: 'VERIFIED',
    });
    expect(row).not.toHaveProperty('adminNotes');
    expect(row).not.toHaveProperty('postEventSurveyAnswers');
  });
});
