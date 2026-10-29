import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({
  children,
  title,
  subtitle,
  mode = 'demo',
  region = 'us-east-1',
  isRefreshing = false,
  onRefresh
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar mode={mode} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          mode={mode}
          region={region}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
