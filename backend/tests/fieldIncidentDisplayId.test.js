// F1 display-ID tests — Counter is mocked so no database is needed.
jest.mock('../models/Counter');
const Counter = require('../models/Counter');
const { nextFieldIncidentDisplayId } = require('../utils/fieldIncidentDisplayId');

describe('nextFieldIncidentDisplayId (F1)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('formats the ID as FI-<year>-<4-digit sequence>', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 7 });
    const id = await nextFieldIncidentDisplayId(new Date('2026-03-04T00:00:00.000Z'));
    expect(id).toBe('FI-2026-0007');
  });

  test('uses an atomic per-year counter independent of conflict reports', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 42 });
    await nextFieldIncidentDisplayId(new Date('2026-11-01T00:00:00.000Z'));
    expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'field-incident-2026' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
  });

  test('sequences are year-scoped', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
    const id = await nextFieldIncidentDisplayId(new Date('2027-01-02T00:00:00.000Z'));
    expect(id).toBe('FI-2027-0001');
    expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'field-incident-2027' },
      expect.anything(),
      expect.anything()
    );
  });
});
