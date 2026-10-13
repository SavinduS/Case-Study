import React from 'react';
import { act, create } from 'react-test-renderer';
import { useFieldIncidentForm } from '../hooks/useFieldIncidentForm';
import type { FieldIncidentLocation } from '../fieldIncidentTypes';

const LOC: FieldIncidentLocation = {
  coordinates: [36.82, -1.29],
  accuracyMeters: 10,
  manual: false
};

function renderForm(initialDraft?: any) {
  let current: any = null;
  function Probe(props: { draft?: any }) {
    current = useFieldIncidentForm({ initialDraft: props.draft });
    return null;
  }
  let root: any = null;
  act(() => {
    root = create(<Probe draft={initialDraft} />);
  });
  return {
    get: () => current,
    unmount: () => act(() => root.unmount())
  };
}

describe('useFieldIncidentForm', () => {
  it('has correct initial state', () => {
    const h = renderForm();
    const f = h.get();
    expect(f.incidentType).toBeNull();
    expect(f.description).toBe('');
    expect(f.photoUri).toBeNull();
    expect(f.photoError).toBeNull();
    expect(f.errors).toEqual({});
    expect(f.attempted).toBe(false);
    expect(typeof f.capturedAt).toBe('string');
    expect(() => new Date(f.capturedAt).toISOString()).not.toThrow();
    h.unmount();
  });

  it('respects initialDraft values', () => {
    const h = renderForm({
      capturedAt: '2026-01-01T00:00:00.000Z',
      incidentType: 'animal_carcass',
      description: 'herd',
      photoUri: 'file:///x.jpg'
    });
    const f = h.get();
    expect(f.capturedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(f.incidentType).toBe('animal_carcass');
    expect(f.description).toBe('herd');
    expect(f.photoUri).toBe('file:///x.jpg');
    h.unmount();
  });

  it('updates incidentType and description fields', () => {
    const h = renderForm();
    act(() => h.get().setIncidentType('illegal_campsite'));
    expect(h.get().incidentType).toBe('illegal_campsite');
    act(() => h.get().setDescription('saw camp'));
    expect(h.get().description).toBe('saw camp');
    h.unmount();
  });

  it('handles photo change and clears photo error', () => {
    const h = renderForm();
    act(() => h.get().setPhotoError('bad photo'));
    expect(h.get().photoError).toBe('bad photo');
    act(() => h.get().handlePhotoChange('file:///p.jpg'));
    expect(h.get().photoUri).toBe('file:///p.jpg');
    expect(h.get().photoError).toBeNull();
    act(() => h.get().handlePhotoChange(null));
    expect(h.get().photoUri).toBeNull();
    h.unmount();
  });

  it('sets and clears photoError directly', () => {
    const h = renderForm();
    act(() => h.get().setPhotoError('oops'));
    expect(h.get().photoError).toBe('oops');
    act(() => h.get().setPhotoError(null));
    expect(h.get().photoError).toBeNull();
    h.unmount();
  });

  it('review() returns null + errors when fields missing, and sets attempted', () => {
    const h = renderForm();
    let result: any = 'unset';
    act(() => {
      result = h.get().review(null);
    });
    expect(result).toBeNull();
    expect(h.get().attempted).toBe(true);
    expect(h.get().errors.incidentType).toBeDefined();
    expect(h.get().errors.description).toBeDefined();
    expect(h.get().errors.location).toBeDefined();
    h.unmount();
  });

  it('review() succeeds with valid draft and trims description', () => {
    const h = renderForm();
    act(() => h.get().setIncidentType('snare_illegal_hunting'));
    act(() => h.get().setDescription('  wire snare  '));
    let result: any = null;
    act(() => {
      result = h.get().review(LOC);
    });
    expect(result).not.toBeNull();
    expect(result.description).toBe('wire snare');
    expect(result.incidentType).toBe('snare_illegal_hunting');
    expect(result.location).toEqual(LOC);
    expect(h.get().errors).toEqual({});
    h.unmount();
  });

  it('review() fails on over-long description', () => {
    const h = renderForm();
    act(() => h.get().setIncidentType('footprints'));
    act(() => h.get().setDescription('x'.repeat(501)));
    let result: any = 'unset';
    act(() => {
      result = h.get().review(LOC);
    });
    expect(result).toBeNull();
    expect(h.get().errors.description).toMatch(/within 500/);
    h.unmount();
  });

  it('resetting state: new mount starts clean (form reset semantics)', () => {
    const first = renderForm();
    act(() => first.get().setDescription('dirty'));
    expect(first.get().description).toBe('dirty');
    first.unmount();
    const second = renderForm();
    expect(second.get().description).toBe('');
    expect(second.get().attempted).toBe(false);
    second.unmount();
  });
});

