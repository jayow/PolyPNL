/**
 * Tests for ShareCardSummary component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareCardSummary from '../ShareCardSummary';
import { PositionSummary, ClosedPosition } from '@/types';

// Mock html-to-image
jest.mock('html-to-image', () => ({
  toPng: jest.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

// Mock canvas context
const mockCanvasContext = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  setAttribute: jest.fn(),
};

beforeEach(() => {
  // Mock canvas
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext as any);
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
  
  // Reset mocks
  jest.clearAllMocks();
});

describe('ShareCardSummary', () => {
  const mockSummary: PositionSummary = {
    totalRealizedPnL: 1234.56,
    winrate: 65.5,
    avgPnLPerPosition: 12.34,
    totalPositionsClosed: 100,
    biggestWin: 500.00,
    biggestLoss: -200.00,
    avgPosSize: 50.0,
    avgHoldingTime: 5.5,
    mostUsedCategory: 'Politics',
    mostUsedTag: 'Election',
    topTags: ['Election', 'Politics', 'Sports'],
  };

  const mockPositions: ClosedPosition[] = [
    {
      conditionId: 'condition1',
      outcome: '0',
      eventTitle: 'Test Event',
      marketTitle: 'Test Market',
      side: 'Long YES',
      openedAt: '2024-01-01T00:00:00Z',
      closedAt: '2024-01-02T00:00:00Z',
      entryVWAP: 0.5,
      exitVWAP: 0.6,
      size: 100,
      realizedPnL: 10.0,
      realizedPnLPercent: 20.0,
      tradesCount: 2,
    },
    {
      conditionId: 'condition2',
      outcome: '1',
      eventTitle: 'Test Event 2',
      marketTitle: 'Test Market 2',
      side: 'Long NO',
      openedAt: '2024-01-03T00:00:00Z',
      closedAt: '2024-01-04T00:00:00Z',
      entryVWAP: 0.4,
      exitVWAP: 0.3,
      size: 50,
      realizedPnL: -5.0,
      realizedPnLPercent: -10.0,
      tradesCount: 2,
    },
  ];

  it('should render with basic props', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
        username="TestUser"
      />
    );

    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('Total Realized PnL')).toBeInTheDocument();
  });

  it('should display total PnL correctly', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
      />
    );

    // Should show formatted PnL
    const pnlElement = screen.getByText(/\$1\.23K/);
    expect(pnlElement).toBeInTheDocument();
  });

  it('should display win rate', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
      />
    );

    expect(screen.getByText('65.5%')).toBeInTheDocument();
  });

  it('should handle empty positions array', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={[]}
      />
    );

    expect(screen.getByText('Total Realized PnL')).toBeInTheDocument();
  });

  it('should display wallet address when no username', () => {
    const wallet = '0x1234567890123456789012345678901234567890';
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
        wallet={wallet}
      />
    );

    // Should show shortened wallet
    expect(screen.getByText(/0x1234\.\.\.7890/)).toBeInTheDocument();
  });

  it('should handle profile image', () => {
    const profileImage = 'https://polymarket.com/image.png';
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
        profileImage={profileImage}
      />
    );

    const img = screen.getByAltText('Profile');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('image-proxy'));
  });

  it('should calculate YES/NO stats correctly', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
      />
    );

    // Should show YES and NO PnL sections
    expect(screen.getByText('YES Realized PnL')).toBeInTheDocument();
    expect(screen.getByText('NO Realized PnL')).toBeInTheDocument();
  });

  it('should render canvas for graph', async () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
      />
    );

    // Wait for canvas to be rendered
    await waitFor(() => {
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  it('should handle single position', () => {
    const singlePosition = [mockPositions[0]];
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={singlePosition}
      />
    );

    expect(screen.getByText('Total Realized PnL')).toBeInTheDocument();
  });

  it('should format large numbers correctly', () => {
    const largeSummary: PositionSummary = {
      ...mockSummary,
      totalRealizedPnL: 1234567.89,
    };

    render(
      <ShareCardSummary
        summary={largeSummary}
        positions={mockPositions}
      />
    );

    // Should show in millions
    expect(screen.getByText(/\$1\.23M/)).toBeInTheDocument();
  });

  it('should handle negative PnL', () => {
    const negativeSummary: PositionSummary = {
      ...mockSummary,
      totalRealizedPnL: -1234.56,
    };

    render(
      <ShareCardSummary
        summary={negativeSummary}
        positions={mockPositions}
      />
    );

    // Should display negative value in total PnL
    expect(screen.getByText(/-1\.23K/)).toBeInTheDocument();
  });

  it('should display top tags', () => {
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
      />
    );

    expect(screen.getByText('Election')).toBeInTheDocument();
    expect(screen.getByText('Politics')).toBeInTheDocument();
    expect(screen.getByText('Sports')).toBeInTheDocument();
  });

  it('should handle missing top tags', () => {
    const summaryWithoutTags: PositionSummary = {
      ...mockSummary,
      topTags: [],
    };

    render(
      <ShareCardSummary
        summary={summaryWithoutTags}
        positions={mockPositions}
      />
    );

    // Should show dash for empty tags
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should apply custom background', () => {
    const customBg = 'data:image/png;base64,custom';
    render(
      <ShareCardSummary
        summary={mockSummary}
        positions={mockPositions}
        customBackground={customBg}
      />
    );

    const container = screen.getByText('Total Realized PnL').closest('div')?.parentElement;
    expect(container).toHaveStyle({
      backgroundImage: expect.stringContaining('data:image/png;base64,custom'),
    });
  });
});
