
import React from 'react';
import { SparklesIcon, ChartBarIcon } from './icons';

export const AdminAnalyticsScreen: React.FC = () => {
  // Mock Data
  const kpis = [
    { label: 'Antal loggade pass (v.42)', value: '124', change: '+12%', isPositive: true },
    { label: 'Snitt-RPE', value: '7.2', change: '-0.5', isPositive: false }, // Maybe neutral context
    { label: 'Nöjdhet (Känsla)', value: '85%', sub: 'Positivt', change: '+5%', isPositive: true },
  ];

  const popularExercises = [
    { name: 'Knäböj', count: 450 },
    { name: 'Marklyft', count: 380 },
    { name: 'Kettlebell Swing', count: 320 },
  ];

  const challengingExercises = [
    { name: 'Overhead Squat', issue: 'Teknik/Rörlighet', reports: 12 },
    { name: 'Burpees', issue: 'Hög puls/Illamående', reports: 8 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Analys & Insikter</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                Se hur medlemmarna presterar och mår baserat på loggade data.
            </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpis.map((kpi, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                    <div className="mt-2 flex items-baseline gap-3">
                        <span className="text-4xl font-black text-gray-900 dark:text-white">{kpi.value}</span>
                        {kpi.sub && <span className="text-lg font-medium text-gray-600 dark:text-gray-300">{kpi.sub}</span>}
                    </div>
                    {kpi.change && (
                        <div className={`mt-2 text-sm font-bold ${kpi.isPositive ? 'text-green-600' : 'text-yellow-600'}`}>
                            {kpi.change} sedan förra veckan
                        </div>
                    )}
                </div>
            ))}
        </div>

        {/* AI Trendspaning */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-indigo-100 dark:border-indigo-800/30 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <SparklesIcon className="w-32 h-32 text-indigo-600 dark:text-indigo-400" />
             </div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">AI-Trendspaning</h3>
                </div>
                <p className="text-lg text-indigo-800 dark:text-indigo-200 leading-relaxed font-medium">
                    "Generellt hög energi i början av veckan, men många rapporterar känningar i axlar efter onsdagens press-pass. Rekommendation: Lägg in mer rörlighet i uppvärmningen."
                </p>
             </div>
        </div>

        {/* Pass-analys */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Popular Exercises */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="text-green-500">Top 3</span> Populära Övningar
                </h4>
                <div className="space-y-4">
                    {popularExercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full font-bold text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-600">{i + 1}</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{ex.name}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{ex.count} reps</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Challenges */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="text-red-500">⚠️</span> Veckans Utmaning
                </h4>
                <div className="space-y-4">
                    {challengingExercises.map((ex, i) => (
                        <div key={i} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-900 dark:text-white">{ex.name}</span>
                                <span className="text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">{ex.reports} rapporter</span>
                            </div>
                            <p className="text-sm text-red-600 dark:text-red-300 mt-1">Rapporterat: {ex.issue}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};