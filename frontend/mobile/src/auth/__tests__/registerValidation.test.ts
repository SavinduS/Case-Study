import { describe, expect, it } from 'vitest';
import { validateRegisterForm } from '../registerValidation';

const VALID = {
  name: 'Soma Silva',
  phone: '+9471 234 5678',
  email: 'soma@example.com',
  password: 'secret123',
  confirm: 'secret123'
};

describe('validateRegisterForm (villager sign-up form)', () => {
  it('accepts a fully valid form', () => {
    expect(validateRegisterForm(VALID)).toEqual({});
  });

  it('accepts an empty email — it is optional', () => {
    expect(validateRegisterForm({ ...VALID, email: '' })).toEqual({});
  });

  it('requires a name', () => {
    expect(validateRegisterForm({ ...VALID, name: '   ' }).name).toMatch(/full name/i);
  });

  it('requires a phone and rejects nonsense', () => {
    expect(validateRegisterForm({ ...VALID, phone: '' }).phone).toMatch(/phone/i);
    expect(validateRegisterForm({ ...VALID, phone: 'call-me' }).phone).toMatch(/valid/i);
  });

  it('rejects a malformed email but not a missing one', () => {
    expect(validateRegisterForm({ ...VALID, email: 'not-an-address' }).email).toMatch(
      /valid email/i
    );
    expect(validateRegisterForm({ ...VALID, email: '' }).email).toBeUndefined();
  });

  it('requires the password to be at least 6 characters', () => {
    expect(validateRegisterForm({ ...VALID, password: '', confirm: '' }).password).toMatch(
      /choose/i
    );
    expect(
      validateRegisterForm({ ...VALID, password: 'abc', confirm: 'abc' }).password
    ).toMatch(/6 characters/i);
  });

  it('requires the confirmation to match', () => {
    expect(validateRegisterForm({ ...VALID, confirm: 'different' }).confirm).toMatch(
      /match/i
    );
  });

  it('reports several problems at once, one per field', () => {
    const errors = validateRegisterForm({
      name: '',
      phone: 'xx',
      email: 'nope',
      password: 'a',
      confirm: 'b'
    });
    expect(Object.keys(errors).sort()).toEqual([
      'confirm',
      'email',
      'name',
      'password',
      'phone'
    ]);
  });
});
