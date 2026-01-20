'use client';

import { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClosedPosition } from '@/types';

interface PnLGraphProps {
  positions: ClosedPosition[];
}

function formatNumber(num: number, decimals: number = 0): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}m`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}k`;
  } else {
    return `${sign}${absNum.toFixed(decimals)}`;
  }
}

export default function PnLGraph({ positions }: PnLGraphProps) {
  // Prevent SSR hydration mismatch with recharts
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate cumulative PnL over time
  const data = useMemo(() => {
    if (positions.length === 0) return [];

    // Sort positions by closedAt date
    const sorted = [...positions].sort((a, b) => {
      const dateA = a.closedAt ? new Date(a.closedAt).getTime() : new Date(a.openedAt).getTime();
      const dateB = b.closedAt ? new Date(b.closedAt).getTime() : new Date(b.openedAt).getTime();
      return dateA - dateB;
    });

    // Calculate cumulative PnL
    let cumulativePnL = 0;
    const chartData: Array<{ date: string; pnl: number; cumulativePnL: number }> = [];

    for (const pos of sorted) {
      const closeDate = pos.closedAt ? new Date(pos.closedAt) : new Date(pos.openedAt);
      cumulativePnL += pos.realizedPnL;
      
      chartData.push({
        date: closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: pos.realizedPnL,
        cumulativePnL: cumulativePnL,
      });
    }

    return chartData;
  }, [positions]);

  if (!isMounted) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 h-64 flex items-center justify-center">
        <div className="text-xs text-hyper-textSecondary text-center">
          Loading...
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 h-64 flex items-center justify-center">
        <div className="text-xs text-hyper-textSecondary text-center">
          No data to display
        </div>
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-hyper-panel border border-hyper-border rounded p-2 text-[10px]">
          <div className="text-hyper-textSecondary mb-1">{data.date}</div>
          <div className="text-hyper-textPrimary">
            PnL: <span className={`font-mono-numeric ${data.pnl >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'}`}>
              ${formatNumber(data.pnl)}
            </span>
          </div>
          <div className="text-hyper-textPrimary mt-1">
            Cumulative: <span className={`font-mono-numeric ${data.cumulativePnL >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'}`}>
              ${formatNumber(data.cumulativePnL)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded p-3 h-64">
      <div className="text-[10px] text-hyper-textSecondary mb-2 font-medium">
        Cumulative PnL Over Time
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1D2A3A" />
          <XAxis 
            dataKey="date" 
            stroke="#9AA7B2"
            tick={{ fill: '#9AA7B2', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#9AA7B2"
            tick={{ fill: '#9AA7B2', fontSize: 10 }}
            tickFormatter={(value) => formatNumber(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="cumulativePnL" 
            stroke="#2DD4BF"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#2DD4BF' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
