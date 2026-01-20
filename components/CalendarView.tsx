'use client';

import { useMemo, useState } from 'react';
import { ClosedPosition } from '@/types';

interface CalendarViewProps {
  positions: ClosedPosition[];
}

interface DayPnL {
  date: string; // YYYY-MM-DD
  day: number;
  pnl: number;
  positions: ClosedPosition[];
}

interface MonthPnL {
  month: string; // YYYY-MM
  monthDisplay: string;
  pnl: number;
  days: Map<string, DayPnL>; // date -> DayPnL
  positions: ClosedPosition[];
}

function formatNumber(num: number, decimals: number = 2): string {
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

function getTopWinsAndLosses(positions: ClosedPosition[]) {
  const wins = positions.filter(pos => pos.realizedPnL > 0);
  const losses = positions.filter(pos => pos.realizedPnL < 0);
  
  wins.sort((a, b) => b.realizedPnL - a.realizedPnL);
  losses.sort((a, b) => a.realizedPnL - b.realizedPnL);
  
  return {
    topWins: wins.slice(0, 5),
    topLosses: losses.slice(0, 5),
  };
}

export default function CalendarView({ positions }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Default to first month with data, or current month
    if (positions.length > 0) {
      const firstPos = positions[0];
      const date = firstPos.closedAt ? new Date(firstPos.closedAt) : new Date(firstPos.openedAt);
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { monthsData, yearsData } = useMemo(() => {
    if (positions.length === 0) {
      return { monthsData: new Map<string, MonthPnL>(), yearsData: new Map<string, MonthPnL[]>() };
    }

    // Group positions by day
    const positionsByDay = new Map<string, ClosedPosition[]>();
    
    for (const pos of positions) {
      const closeDate = pos.closedAt ? new Date(pos.closedAt) : new Date(pos.openedAt);
      const dateKey = closeDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!positionsByDay.has(dateKey)) {
        positionsByDay.set(dateKey, []);
      }
      positionsByDay.get(dateKey)!.push(pos);
    }

    // Create day-level data
    const daysMap = new Map<string, DayPnL>();
    for (const [dateKey, dayPositions] of positionsByDay.entries()) {
      const pnl = dayPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
      const date = new Date(dateKey);
      
      daysMap.set(dateKey, {
        date: dateKey,
        day: date.getDate(),
        pnl,
        positions: dayPositions,
      });
    }

    // Group days by month
    const monthsData = new Map<string, MonthPnL>();
    for (const [dateKey, dayData] of daysMap.entries()) {
      const monthKey = dateKey.substring(0, 7); // YYYY-MM
      
      if (!monthsData.has(monthKey)) {
        const monthDate = new Date(monthKey + '-01');
        monthsData.set(monthKey, {
          month: monthKey,
          monthDisplay: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          pnl: 0,
          days: new Map(),
          positions: [],
        });
      }
      
      const month = monthsData.get(monthKey)!;
      month.days.set(dateKey, dayData);
      month.pnl += dayData.pnl;
      month.positions.push(...dayData.positions);
    }

    // Group months by year
    const yearsData = new Map<string, MonthPnL[]>();
    for (const month of monthsData.values()) {
      const yearKey = month.month.substring(0, 4);
      if (!yearsData.has(yearKey)) {
        yearsData.set(yearKey, []);
      }
      yearsData.get(yearKey)!.push(month);
    }

    // Sort months within each year
    for (const months of yearsData.values()) {
      months.sort((a, b) => a.month.localeCompare(b.month));
    }

    return { monthsData, yearsData };
  }, [positions]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      let { year, month } = prev;
      if (direction === 'next') {
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      } else {
        month--;
        if (month < 0) {
          month = 11;
          year--;
        }
      }
      return { year, month };
    });
  };

  const renderMonthGrid = (year: number, month: number) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthData = monthsData.get(monthKey);
    
    // Get first day of month and what day of week it falls on
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Get last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get last few days of previous month for padding
    const prevMonthLastDay = new Date(year, month, 0);
    const daysInPrevMonth = prevMonthLastDay.getDate();
    
    const days: Array<{ day: number; date: string; pnl: number | null; positions: ClosedPosition[] }> = [];
    
    // Add days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, date: dateKey, pnl: null, positions: [] });
    }
    
    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = monthData?.days.get(dateKey);
      days.push({
        day,
        date: dateKey,
        pnl: dayData?.pnl ?? null,
        positions: dayData?.positions ?? [],
      });
    }
    
    // Add days from next month to fill the grid (6 rows = 42 cells)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, date: dateKey, pnl: null, positions: [] });
    }

    const monthDisplay = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const totalPnL = monthData?.pnl ?? 0;

    return (
      <div className="h-full flex flex-col min-h-0">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-1.5 py-0.5 text-hyper-textSecondary hover:text-hyper-textPrimary hover:bg-hyper-panelHover rounded transition-colors text-[10px]"
            >
              ←
            </button>
            <h3 className="text-[10px] font-medium text-hyper-textPrimary">{monthDisplay}</h3>
            <button
              onClick={() => navigateMonth('next')}
              className="px-1.5 py-0.5 text-hyper-textSecondary hover:text-hyper-textPrimary hover:bg-hyper-panelHover rounded transition-colors text-[10px]"
            >
              →
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono-numeric ${
              totalPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(totalPnL)}
            </span>
            <span className="text-[9px] text-hyper-textSecondary">
              ({monthData?.positions.length ?? 0})
            </span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0.5 flex-1 min-h-0 auto-rows-fr">
          {/* Day Headers */}
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-[9px] text-hyper-textSecondary text-center font-medium flex items-center justify-center">
              {day}
            </div>
          ))}
          
          {/* Day Tiles */}
          {days.map((dayData, idx) => {
            const isCurrentMonth = idx >= firstDayOfWeek && idx < firstDayOfWeek + daysInMonth;
            const isOtherMonth = !isCurrentMonth;
            const hasData = dayData.pnl !== null;
            const { topWins, topLosses } = hasData ? getTopWinsAndLosses(dayData.positions) : { topWins: [], topLosses: [] };
            
            let bgColor = 'bg-hyper-bg';
            let textColor = 'text-hyper-textSecondary';
            let pnlColor = 'text-hyper-textSecondary';
            
            if (isOtherMonth) {
              bgColor = 'bg-hyper-bg';
              textColor = 'text-hyper-muted';
            } else if (hasData) {
              if (dayData.pnl! > 0) {
                bgColor = 'bg-hyper-accent/20'; // Accent color with opacity
                textColor = 'text-white';
                pnlColor = 'text-hyper-accent'; // Accent color
              } else if (dayData.pnl! < 0) {
                bgColor = 'bg-hyper-negative/20'; // Negative color with opacity
                textColor = 'text-white';
                pnlColor = 'text-hyper-negative'; // Negative color
              } else {
                bgColor = 'bg-hyper-border'; // Dark gray
                textColor = 'text-hyper-textSecondary';
                pnlColor = 'text-hyper-textSecondary';
              }
            } else {
              bgColor = 'bg-hyper-border'; // Dark gray for no trades
              textColor = 'text-hyper-textSecondary';
              pnlColor = 'text-hyper-textSecondary';
            }

            return (
              <div
                key={dayData.date}
                className={`${bgColor} border border-hyper-border rounded p-0.5 flex flex-col justify-between relative group cursor-pointer min-h-0`}
              >
                <div className={`text-[9px] ${textColor} font-medium leading-tight`}>
                  {dayData.day}
                </div>
                <div className={`text-[8px] ${pnlColor} font-mono-numeric leading-tight truncate`}>
                  {hasData ? (
                    `$${formatNumber(dayData.pnl!)}`
                  ) : isCurrentMonth ? (
                    <span className="text-hyper-muted text-[7px]">no trade</span>
                  ) : null}
                </div>
                
                {/* Hover Tooltip */}
                {hasData && (topWins.length > 0 || topLosses.length > 0) && (
                  <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-hyper-panel border border-hyper-border rounded p-2 text-[10px] shadow-lg">
                    <div className="text-hyper-textSecondary mb-2 font-medium">
                      {new Date(dayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    
                    <div className="text-hyper-textPrimary mb-1">
                      PnL: <span className={`font-mono-numeric ${dayData.pnl! >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'}`}>
                        ${formatNumber(dayData.pnl!)}
                      </span>
                    </div>
                    
                    {topWins.length > 0 && (
                      <div className="mb-2">
                        <div className="text-hyper-textSecondary mb-1 text-[9px] font-medium">Top Wins:</div>
                        <div className="space-y-0.5">
                          {topWins.map((pos, i) => (
                            <div key={i} className="flex justify-between items-start gap-2">
                              <div className="text-hyper-textPrimary truncate flex-1" title={pos.marketTitle || pos.eventTitle || 'Unknown'}>
                                {pos.marketTitle || pos.eventTitle || 'Unknown'}
                              </div>
                              <div className="font-mono-numeric text-hyper-accent whitespace-nowrap">
                                ${formatNumber(pos.realizedPnL)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {topLosses.length > 0 && (
                      <div>
                        <div className="text-hyper-textSecondary mb-1 text-[9px] font-medium">Top Losses:</div>
                        <div className="space-y-0.5">
                          {topLosses.map((pos, i) => (
                            <div key={i} className="flex justify-between items-start gap-2">
                              <div className="text-hyper-textPrimary truncate flex-1" title={pos.marketTitle || pos.eventTitle || 'Unknown'}>
                                {pos.marketTitle || pos.eventTitle || 'Unknown'}
                              </div>
                              <div className="font-mono-numeric text-hyper-negative whitespace-nowrap">
                                ${formatNumber(pos.realizedPnL)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    // Only get months that actually have data
    const allMonths: Array<{ year: number; month: number; monthKey: string; monthData: MonthPnL }> = [];
    
    for (const [monthKey, monthData] of monthsData.entries()) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1; // Convert to 0-indexed
      
      allMonths.push({
        year,
        month,
        monthKey,
        monthData,
      });
    }

    // Group by year and sort months within each year
    const monthsByYear = new Map<number, typeof allMonths>();
    for (const monthInfo of allMonths) {
      if (!monthsByYear.has(monthInfo.year)) {
        monthsByYear.set(monthInfo.year, []);
      }
      monthsByYear.get(monthInfo.year)!.push(monthInfo);
    }

    // Sort months within each year
    for (const months of monthsByYear.values()) {
      months.sort((a, b) => a.month - b.month);
    }

    return (
      <div className="space-y-6">
        {Array.from(monthsByYear.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([year, months]) => (
            <div key={year}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-hyper-textPrimary">{year}</h3>
                <div className="text-[10px] text-hyper-textSecondary">
                  Total: <span className={`font-mono-numeric ${
                    months.reduce((sum, m) => sum + (m.monthData?.pnl ?? 0), 0) >= 0 
                      ? 'text-hyper-accent' 
                      : 'text-hyper-negative'
                  }`}>
                    ${formatNumber(months.reduce((sum, m) => sum + (m.monthData?.pnl ?? 0), 0))}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {months.map((monthInfo) => {
                  const { month, monthKey, monthData } = monthInfo;
                  const monthDate = new Date(year, month, 1);
                  const monthDisplay = monthDate.toLocaleDateString('en-US', { month: 'long' });
                  const totalPnL = monthData?.pnl ?? 0;
                  
                  // Get first day of month
                  const firstDay = new Date(year, month, 1);
                  const firstDayOfWeek = firstDay.getDay();
                  const lastDay = new Date(year, month + 1, 0);
                  const daysInMonth = lastDay.getDate();
                  
                  // Build days array (simplified for year view)
                  const days: Array<{ day: number; date: string; pnl: number | null; positions: ClosedPosition[] }> = [];
                  
                  // Add padding for first day
                  for (let i = 0; i < firstDayOfWeek; i++) {
                    days.push({ day: 0, date: '', pnl: null, positions: [] });
                  }
                  
                  // Add days from current month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayData = monthData?.days.get(dateKey);
                    days.push({
                      day,
                      date: dateKey,
                      pnl: dayData?.pnl ?? null,
                      positions: dayData?.positions ?? [],
                    });
                  }

                  return (
                    <div key={monthKey} className="border border-hyper-border rounded p-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-medium text-hyper-textPrimary">{monthDisplay}</h4>
                        <span className={`text-[10px] font-mono-numeric ${
                          totalPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                        }`}>
                          ${formatNumber(totalPnL)}
                        </span>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                          <div key={day} className="text-[8px] text-hyper-textSecondary text-center">
                            {day}
                          </div>
                        ))}
                        {days.map((dayData, idx) => {
                          if (dayData.day === 0) {
                            return <div key={idx} className="h-4" />;
                          }
                          
                          const hasData = dayData.pnl !== null;
                          const { topWins, topLosses } = hasData ? getTopWinsAndLosses(dayData.positions) : { topWins: [], topLosses: [] };
                          
                          let bgColor = 'bg-hyper-bg';
                          let pnlColor = 'text-hyper-textSecondary';
                          
                          if (hasData) {
                            if (dayData.pnl! > 0) {
                              bgColor = 'bg-hyper-accent/20';
                              pnlColor = 'text-hyper-accent';
                            } else if (dayData.pnl! < 0) {
                              bgColor = 'bg-hyper-negative/20';
                              pnlColor = 'text-hyper-negative';
                            } else {
                              bgColor = 'bg-hyper-border';
                            }
                          } else {
                            bgColor = 'bg-hyper-border';
                          }

                          return (
                            <div
                              key={dayData.date || idx}
                              className={`${bgColor} border border-hyper-border rounded p-0.5 min-h-[20px] flex items-center justify-center text-[7px] group relative cursor-pointer`}
                            >
                              <span className={pnlColor}>{dayData.day}</span>
                              
                              {/* Hover Tooltip */}
                              {hasData && (topWins.length > 0 || topLosses.length > 0) && (
                                <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-56 bg-hyper-panel border border-hyper-border rounded p-2 text-[9px] shadow-lg">
                                  <div className="text-hyper-textSecondary mb-1 font-medium">
                                    {new Date(dayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                  <div className="text-hyper-textPrimary mb-1">
                                    PnL: <span className={`font-mono-numeric ${dayData.pnl! >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'}`}>
                                      ${formatNumber(dayData.pnl!)}
                                    </span>
                                  </div>
                                  {topWins.length > 0 && (
                                    <div className="mb-1">
                                      <div className="text-hyper-textSecondary text-[8px] mb-0.5">Top Wins:</div>
                                      {topWins.slice(0, 3).map((pos, i) => (
                                        <div key={i} className="flex justify-between text-[8px]">
                                          <span className="truncate flex-1">{pos.marketTitle || pos.eventTitle || 'Unknown'}</span>
                                          <span className="text-hyper-accent ml-1">${formatNumber(pos.realizedPnL)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {topLosses.length > 0 && (
                                    <div>
                                      <div className="text-hyper-textSecondary text-[8px] mb-0.5">Top Losses:</div>
                                      {topLosses.slice(0, 3).map((pos, i) => (
                                        <div key={i} className="flex justify-between text-[8px]">
                                          <span className="truncate flex-1">{pos.marketTitle || pos.eventTitle || 'Unknown'}</span>
                                          <span className="text-hyper-negative ml-1">${formatNumber(pos.realizedPnL)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    );
  };

  if (positions.length === 0) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 h-64 flex items-center justify-center">
        <div className="text-xs text-hyper-textSecondary text-center">
          No data to display
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="text-[10px] text-hyper-textSecondary font-medium">
          PnL Calendar
        </div>
        <div className="flex items-center gap-1 bg-hyper-bg border border-hyper-border rounded p-0.5">
          <button
            onClick={() => setViewMode('month')}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              viewMode === 'month'
                ? 'bg-hyper-accent text-hyper-bg'
                : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('year')}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              viewMode === 'year'
                ? 'bg-hyper-accent text-hyper-bg'
                : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
            }`}
          >
            Year
          </button>
        </div>
      </div>
      
      <div className={`flex-1 min-h-0 ${viewMode === 'month' ? 'overflow-y-auto' : 'overflow-y-auto pr-2'}`}>
        {viewMode === 'month' ? (
          renderMonthGrid(currentMonth.year, currentMonth.month)
        ) : (
          renderYearView()
        )}
      </div>
    </div>
  );
}
