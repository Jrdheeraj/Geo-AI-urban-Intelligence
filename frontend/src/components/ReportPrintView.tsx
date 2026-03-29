import React from "react";
import { ReportData } from "@/lib/reportGenerator";
import { LULC_COLORS } from "@/types/api";

export const ReportPrintView: React.FC<{ data: ReportData }> = ({ data }) => {
  const { cityName, year, startYear, endYear, analytics, change, risk, hotspots, insights, simulation } = data;

  return (
    <div className="p-12 max-w-4xl mx-auto bg-white text-slate-900 font-sans leading-relaxed print:p-0">
      <header className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter text-slate-900">SolarScan Intelligence Report</h1>
          <p className="text-slate-500 font-medium">Urban Growth & LULC Analysis Dashboard</p>
        </div>
        <div className="text-right text-sm">
          <p><strong>City:</strong> {cityName}</p>
          <p><strong>Period:</strong> {startYear} - {endYear}</p>
          <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-l-4 border-slate-900 pl-3">1. Executive Summary</h2>
        <p className="text-slate-700">
          This document provides a detailed intelligence assessment of urban land-use and land-cover (LULC) dynamics in {cityName}. 
          The analysis covers the transition period from {startYear} to {endYear}, with a primary focus on the targeted analysis year of {year}.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4 border-l-4 border-slate-900 pl-3">2. LULC Distribution ({year})</h2>
        <div className="flex gap-8 items-center">
          <div className="flex-1 space-y-2">
            {Object.entries(analytics.distribution).map(([key, val]) => {
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              const color = LULC_COLORS[label === "Builtup" ? "Built-up" : label] || "#ccc";
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium w-32">{label}:</span>
                  <span className="text-small font-bold">{(val * 100).toFixed(1)}%</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${val * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-10 break-inside-avoid">
        <h2 className="text-xl font-bold mb-4 border-l-4 border-slate-900 pl-3">3. Transition Matrix (% Shift)</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border p-2 text-left">From \ To</th>
              <th className="border p-2">Forest</th>
              <th className="border p-2">Water</th>
              <th className="border p-2">Agri</th>
              <th className="border p-2">Barren</th>
              <th className="border p-2">Built-up</th>
            </tr>
          </thead>
          <tbody>
            {analytics.transition_matrix.map((row, i) => (
              <tr key={i}>
                <td className="border p-2 font-bold bg-slate-50">
                  {["Forest", "Water", "Agri", "Barren", "Built-up"][i]}
                </td>
                {row.map((val, j) => (
                  <td key={j} className="border p-2 text-center">
                    {(val * 100).toFixed(1)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {risk && risk.alerts.length > 0 && (
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-bold mb-4 border-l-4 border-slate-900 pl-3">4. AI Risk Assessment</h2>
          <div className="space-y-3">
            {risk.alerts.map((alert, i) => (
              <div key={i} className="p-4 bg-slate-50 border-l-4 border-red-500 flex gap-3 italic text-slate-700">
                <span>⚠️</span>
                <span>{alert}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {insights && insights.recommendations.length > 0 && (
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-bold mb-4 border-l-4 border-slate-900 pl-3">5. Strategic Recommendations</h2>
          <div className="grid grid-cols-2 gap-4">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm font-bold mb-1">Policy Objective {i + 1}</p>
                <p className="text-xs text-slate-600">{rec}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-20 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
        <p>This report was autonomously generated by SolarScan AI. Data is based on processed satellite imagery and spatial modeling.</p>
        <p>© {new Date().getFullYear()} GeoAI Urban Growth Intelligence. All Rights Reserved.</p>
      </footer>
    </div>
  );
};
