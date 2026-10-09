import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import IncidentTypePicker from '../IncidentTypePicker';

const ALL_LABELS = [
  'Elephant Sighting',
  'Crop Damage',
  'Wildlife Near Home',
  'Wildlife Blocking Road',
  'Other Wildlife Conflict'
];

describe('IncidentTypePicker', () => {
  it('renders all five incident types', async () => {
    const { getByLabelText } = await render(<IncidentTypePicker value={null} onChange={jest.fn()} />);
    for (const label of ALL_LABELS) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('marks the selected value as checked', async () => {
    const { getByLabelText } = await render(
      <IncidentTypePicker value="crop_damage" onChange={jest.fn()} />
    );
    expect(getByLabelText('Crop Damage').props.accessibilityState.checked).toBe(true);
    expect(getByLabelText('Elephant Sighting').props.accessibilityState.checked).toBe(false);
  });

  it('calls onChange with the pressed incident type', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(<IncidentTypePicker value={null} onChange={onChange} />);
    await fireEvent.press(getByLabelText('Wildlife Blocking Road'));
    expect(onChange).toHaveBeenCalledWith('wildlife_blocking_road');
  });
});
