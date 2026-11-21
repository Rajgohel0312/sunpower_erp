import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Users,
  Sun,
  Zap,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Clock,
  PhoneCall
} from 'lucide-react';
import { api } from '../../api/client.js';
import MetricCard from '../../components/common/MetricCard.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    wonLeads: 0,
    totalCustomers: 0,
    totalCapacityKw: 0,
    recentLeads: []
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [leadsRes, customersRes] = await Promise.all([
          api.get('/crm/leads', { limit: 100 }),
          api.get('/crm/customers', { limit: 100 })
        ]);

        const leads = leadsRes?.data || [];
        const customers = customersRes?.data || [];

        const newCount = leads.filter(l => l.stage === 'NEW').length;
        const wonCount = leads.filter(l => l.stage === 'WON').length;
        const totalCap = leads.reduce((acc, curr) => acc + (parseFloat(curr.requested_capacity_kw) || 0), 0);

        setStats({
          totalLeads: leadsRes?.meta?.pagination?.total || leads.length,
          newLeads: newCount,
          wonLeads: wonCount,
          totalCustomers: customersRes?.meta?.pagination?.total || customers.length,
          totalCapacityKw: totalCap.toFixed(1),
          recentLeads: leads.slice(0, 5)
        });
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-midnight">Welcome to SunPower Executive Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time solar pipeline, residential and commercial rooftop acquisitions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/leads">
            <Button variant="accent" icon={Plus}>
              Capture Lead
            </Button>
          </Link>
          <Link to="/customers">
            <Button variant="outline" icon={Users}>
              Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Pipeline Leads"
          value={stats.totalLeads}
          unit="Active"
          trend="+12% this month"
          icon={Layers}
          iconColor="text-sky-accent"
        />
        <MetricCard
          title="New Inbound Enquiries"
          value={stats.newLeads}
          unit="Pending"
          subtitle="Awaiting sales contact"
          icon={PhoneCall}
          iconColor="text-solar-gold"
        />
        <MetricCard
          title="Verified Customers"
          value={stats.totalCustomers}
          unit="Accounts"
          subtitle="Converted to contracts"
          icon={Users}
          iconColor="text-solar-green"
        />
        <MetricCard
          title="Pipeline Solar Capacity"
          value={stats.totalCapacityKw}
          unit="kW"
          subtitle="Rooftop generation"
          icon={Zap}
          iconColor="text-amber-500"
        />
      </div>

      {/* Recent Leads Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <h3 className="text-base font-bold text-midnight">Recent Leads in Pipeline</h3>
          </div>
          <Link to="/leads" className="text-xs font-semibold text-midnight hover:text-solar-gold flex items-center gap-1">
            View All Leads <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading latest solar leads...</div>
          ) : stats.recentLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No leads recorded yet. Click "Capture Lead" to start!</div>
          ) : (
            stats.recentLeads.map((lead) => (
              <div key={lead.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-midnight font-bold font-mono text-xs">
                    {lead.requested_capacity_kw || '—'}k
                  </div>
                  <div>
                    <Link to={`/leads/${lead.id}`} className="font-semibold text-sm text-midnight hover:underline">
                      {lead.full_name}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                      <span>{lead.lead_number}</span>
                      <span>•</span>
                      <span>{lead.phone_e164}</span>
                      {lead.city && (
                        <>
                          <span>•</span>
                          <span>{lead.city}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={lead.stage}>{lead.stage}</Badge>
                  <Link to={`/leads/${lead.id}`}>
                    <Button variant="ghost" size="sm">Details</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
