import { NpiRegistryService } from './npi-registry.service';

describe('NpiRegistryService', () => {
  const config = {
    get: (key: string) => {
      if (key === 'npi.apiBaseUrl') {
        return 'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search';
      }
      if (key === 'npi.timeoutMs') return 5000;
      return undefined;
    },
  };

  const service = new NpiRegistryService(config as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects non-10-digit input without calling the API', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await service.lookup('123');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('invalid_format');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marks exact registry hits as valid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        1,
        ['1760880173'],
        {
          'name.full': ['KELLY, JOHN'],
          provider_type: ['Dentist'],
          'addr_practice.full': ['BETHESDA, MD'],
        },
        [['1760880173', 'KELLY, JOHN', 'Dentist']],
      ],
    } as Response);

    const result = await service.lookup('1760880173');
    expect(result).toEqual({
      valid: true,
      npi: '1760880173',
      providerName: 'KELLY, JOHN',
      providerType: 'Dentist',
      practiceAddress: 'BETHESDA, MD',
    });
  });

  it('marks empty registry results as not_found', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [0, [], null, []],
    } as Response);

    const result = await service.lookup('0000000000');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('not_found');
  });
});
