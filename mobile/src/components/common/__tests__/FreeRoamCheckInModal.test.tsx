import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock checkinApi
const mockSubmitCheckIn = jest.fn();
jest.mock('@/api/checkinApi', () => ({
  submitCheckIn: (...args: unknown[]) => mockSubmitCheckIn(...args),
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ clan: 'ember' }),
}));

import { FreeRoamCheckInModal } from '../FreeRoamCheckInModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  currentGpsLat: 12.9716,
  currentGpsLng: 77.5946,
  currentPixelX: 500,
  currentPixelY: 300,
};

describe('FreeRoamCheckInModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitCheckIn.mockResolvedValue({ success: true, checkInId: 'test-id' });
  });

  it('renders all 4 question sections', () => {
    const { getByText } = render(<FreeRoamCheckInModal {...defaultProps} />);

    expect(getByText('What are you doing here?')).toBeTruthy();
    expect(getByText("How's this space right now?")).toBeTruthy();
    expect(getByText('Would you come here without the game?')).toBeTruthy();
    expect(getByText('Which floor?')).toBeTruthy();
  });

  it('submit button disabled until all sections answered', () => {
    const { getByTestId } = render(<FreeRoamCheckInModal {...defaultProps} />);

    const submitBtn = getByTestId('submit-button');
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('submit button enabled after all 4 answered', () => {
    const { getByTestId } = render(<FreeRoamCheckInModal {...defaultProps} />);

    fireEvent.press(getByTestId('activity-high_effort_personal'));
    fireEvent.press(getByTestId('satisfaction-0.75'));
    fireEvent.press(getByTestId('sentiment-yes'));
    fireEvent.press(getByTestId('floor-ground'));

    const submitBtn = getByTestId('submit-button');
    expect(submitBtn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('selecting in one section does not deselect another', () => {
    const { getByTestId } = render(<FreeRoamCheckInModal {...defaultProps} />);

    fireEvent.press(getByTestId('activity-high_effort_personal'));
    fireEvent.press(getByTestId('satisfaction-0.5'));

    // Select a different activity — satisfaction should stay
    fireEvent.press(getByTestId('activity-low_effort_social'));
    fireEvent.press(getByTestId('sentiment-maybe'));
    fireEvent.press(getByTestId('floor-first'));

    const submitBtn = getByTestId('submit-button');
    expect(submitBtn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('GPS null warning banner appears when gpsLat is null', () => {
    const { getByText } = render(
      <FreeRoamCheckInModal
        {...defaultProps}
        currentGpsLat={null}
        currentGpsLng={null}
      />,
    );

    expect(getByText('Waiting for GPS signal...')).toBeTruthy();
  });

  it('calls onClose when X is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <FreeRoamCheckInModal {...defaultProps} onClose={onClose} />,
    );

    fireEvent.press(getByTestId('close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows success state after mock API resolves', async () => {
    const { getByTestId, getByText } = render(
      <FreeRoamCheckInModal {...defaultProps} />,
    );

    fireEvent.press(getByTestId('activity-high_effort_social'));
    fireEvent.press(getByTestId('satisfaction-1'));
    fireEvent.press(getByTestId('sentiment-no'));
    fireEvent.press(getByTestId('floor-outdoor'));

    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText(/Logged! Thanks/)).toBeTruthy();
    });

    expect(mockSubmitCheckIn).toHaveBeenCalledWith({
      gpsLat: 12.9716,
      gpsLng: 77.5946,
      pixelX: 500,
      pixelY: 300,
      activityCategory: 'high_effort_social',
      satisfaction: 1,
      sentiment: 'no',
      floor: 'outdoor',
    });
  });
});
