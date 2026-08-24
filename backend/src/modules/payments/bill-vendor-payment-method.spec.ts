/**
 * Unit coverage for ACH ↔ CHECK bank sync helpers on BillService.
 * Bill.com no longer accepts bank updates via PATCH /vendors.
 */

import { BillService } from './bill.service';

describe('BillService vendor payment method sync', () => {
  let service: BillService;

  beforeEach(() => {
    service = Object.create(BillService.prototype) as BillService;
    (service as unknown as { logger: { log: jest.Mock; warn: jest.Mock } }).logger =
      {
        log: jest.fn(),
        warn: jest.fn(),
      };
  });

  describe('ensureVendorPaymentMethodMatches', () => {
    it('passes when ACH has a bank account', async () => {
      service.getVendorBankAccount = jest
        .fn()
        .mockResolvedValue({ accountNumber: '****1234' });

      await expect(
        service.ensureVendorPaymentMethodMatches('009abc', 'ACH'),
      ).resolves.toBeUndefined();
    });

    it('fails when ACH has no bank account', async () => {
      service.getVendorBankAccount = jest.fn().mockResolvedValue(null);

      await expect(
        service.ensureVendorPaymentMethodMatches('009abc', 'ACH'),
      ).rejects.toThrow(/no Bill.com bank account/);
    });

    it('fails when CHECK still has a bank account', async () => {
      service.getVendorBankAccount = jest
        .fn()
        .mockResolvedValue({ accountNumber: '****1234' });

      await expect(
        service.ensureVendorPaymentMethodMatches('009abc', 'CHECK'),
      ).rejects.toThrow(/still has a Bill.com bank account/);
    });

    it('passes when CHECK has no bank account', async () => {
      service.getVendorBankAccount = jest.fn().mockResolvedValue(null);

      await expect(
        service.ensureVendorPaymentMethodMatches('009abc', 'CHECK'),
      ).resolves.toBeUndefined();
    });
  });

  describe('syncVendorPaymentMethod', () => {
    it('deletes bank account for CHECK', async () => {
      service.deleteVendorBankAccountIfPresent = jest
        .fn()
        .mockResolvedValue(true);
      service.createVendorBankAccount = jest.fn();

      await service.syncVendorPaymentMethod('009abc', 'CHECK');

      expect(service.deleteVendorBankAccountIfPresent).toHaveBeenCalledWith(
        '009abc',
      );
      expect(service.createVendorBankAccount).not.toHaveBeenCalled();
    });

    it('replaces bank account for ACH', async () => {
      service.deleteVendorBankAccountIfPresent = jest
        .fn()
        .mockResolvedValue(true);
      service.createVendorBankAccount = jest.fn().mockResolvedValue({});

      const bank = {
        nameOnAccount: 'Jane Doe',
        accountNumber: '111222333',
        routingNumber: '074000010',
      };

      await service.syncVendorPaymentMethod('009abc', 'ACH', bank);

      expect(service.deleteVendorBankAccountIfPresent).toHaveBeenCalledWith(
        '009abc',
      );
      expect(service.createVendorBankAccount).toHaveBeenCalledWith(
        '009abc',
        bank,
      );
    });

    it('rejects ACH without bank details', async () => {
      service.deleteVendorBankAccountIfPresent = jest.fn();
      service.createVendorBankAccount = jest.fn();

      await expect(
        service.syncVendorPaymentMethod('009abc', 'ACH'),
      ).rejects.toThrow(/Bank account details are required/);
    });
  });
});
