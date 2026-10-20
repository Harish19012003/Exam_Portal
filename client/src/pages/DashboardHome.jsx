import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './DashboardHome.css';

export const DashboardHome = () => {
  const [currentDate, setCurrentDate] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateTimeAndGreeting = () => {
      // Format date: "Friday, 09 Oct 2026"
      const options = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
      const dateStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());
      setCurrentDate(dateStr);

      // Determine greeting based on hour
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };

    updateTimeAndGreeting();
    const intervalId = setInterval(updateTimeAndGreeting, 60000); // update every minute

    return () => clearInterval(intervalId);
  }, []);

  const kpis = [
    { title: 'Total Exams', value: '1,245', change: '+12%', isPositive: true },
    { title: 'Active Exams', value: '43', change: '+5%', isPositive: true },
    { title: 'Registered Vendors', value: '128', change: '+2%', isPositive: true },
    { title: 'Exams Today', value: '12', change: '-3%', isPositive: false },
    { title: 'Total Candidates', value: '45.2K', change: '+18%', isPositive: true },
  ];

  return (
    <div className="dashboard-home">
      <div className="dashboard-greeting-section">
        <p className="dashboard-date">{currentDate}</p>
        <h1 className="dashboard-greeting">
          {greeting}<span className="greeting-dot">.</span>
        </h1>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi, index) => (
          <div className="kpi-card" key={index}>
            <div className="kpi-title">{kpi.title}</div>
            <div className="kpi-content">
              <div className="kpi-value">{kpi.value}</div>
              <div className={`kpi-change ${kpi.isPositive ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {kpi.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {Math.abs(parseFloat(kpi.change))}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
