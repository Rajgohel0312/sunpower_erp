import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Plus,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Building2,
  HardHat,
  Truck,
  Wrench,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Badge from '../../components/common/Badge.jsx';

export function ProjectProfitabilityPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [pnl, setPnl] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Record Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('LABOR');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      loadProfitability(selectedOrderId);
      loadExpenses(selectedOrderId);
    }
  }, [selectedOrderId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/orders?limit=100');
      const orderList = res.data || [];
      setOrders(orderList);
      if (orderList.length > 0) {
        setSelectedOrderId(orderList[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadProfitability = async (orderId) => {
    try {
      const res = await apiRequest(`/finance/profitability/${orderId}`);
      setPnl(res.data);
    } catch (err) {
      console.warn('Could not load project P&L', err);
    }
  };

  const loadExpenses = async (orderId) => {
    try {
      const res = await apiRequest(`/finance/expenses?sales_order_id=${orderId}&limit=50`);
      setExpenses(res.data || []);
    } catch (err) {
      console.warn('Could not load expenses', err);
    }
  };

  const handleRecordExpense = async (e) => {
    e.preventDefault();
    if (!selectedOrderId || !expenseVendor || !expenseAmount) {
      alert('Please fill all required expense fields');
      return;
    }

    try {
      setSubmittingExpense(true);
      await apiRequest('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          sales_order_id: selectedOrderId,
          category: expenseCategory,
          vendor_name: expenseVendor,
          amount: Number(expenseAmount),
          expense_date: expenseDate,
          notes: expenseNotes || null
        })
      });

      setShowExpenseModal(false);
      setExpenseVendor('');
      setExpenseAmount('');
      setExpenseNotes('');
      loadProfitability(selectedOrderId);
      loadExpenses(selectedOrderId);
    } catch (err) {
      alert(err.message || 'Failed to record project expense');
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-solar-gold" />
            Project Profitability & Cost Ledger (P&L)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Realized gross margins: Invoiced Revenue vs Dispatched Hardware Costs & Direct Site Expenses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-solar-gold/50 max-w-xs"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_number} — {o.customers?.full_name || 'Customer'}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-semibold rounded-lg shadow-sm text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Site Expense
          </button>
        </div>
      </div>

      {pnl && (
        <>
          {/* 2. Data Completeness Alert */}
          {!pnl.is_cost_data_complete && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Preliminary Estimate:</strong> Hardware dispatch purchase ledger is incomplete; baseline hardware cost is estimated at standard procurement ratios.
              </span>
            </div>
          )}

          {/* 3. P&L Scorecard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Contract Value</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                ₹{Number(pnl.contract_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Invoiced: ₹{Number(pnl.invoiced_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Direct Cost</span>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                ₹{Number(pnl.total_direct_cost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Hardware + Direct Site Expenses
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">Gross Profit (₹)</span>
              <h3 className={`text-2xl font-bold mt-1 ${pnl.gross_margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₹{Number(pnl.gross_margin).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Net project contribution</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">Gross Margin (%)</span>
                <h3 className={`text-3xl font-extrabold mt-1 ${pnl.gross_margin_pct >= 20 ? 'text-emerald-600' : pnl.gross_margin_pct >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {pnl.gross_margin_pct}%
                </h3>
              </div>
              <Badge variant={pnl.health_status}>{pnl.health_status}</Badge>
            </div>
          </div>

          {/* 4. Cost Structure Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Margin Bar */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4">
              <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                <PieChart className="w-5 h-5 text-solar-gold" />
                Cost Breakdown
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1 font-medium">
                    <span>Solar Hardware (Panels/Inverter)</span>
                    <span className="font-mono text-slate-900">₹{Number(pnl.hardware_cost).toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{
                        width: `${pnl.total_direct_cost > 0 ? (pnl.hardware_cost / pnl.total_direct_cost) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-1 font-medium">
                    <span>Site Labour & Installation</span>
                    <span className="font-mono text-slate-900">₹{Number(pnl.expense_breakdown?.LABOR || 0).toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{
                        width: `${pnl.total_direct_cost > 0 ? ((pnl.expense_breakdown?.LABOR || 0) / pnl.total_direct_cost) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-1 font-medium">
                    <span>Transport & Logistics</span>
                    <span className="font-mono text-slate-900">₹{Number(pnl.expense_breakdown?.TRANSPORT || 0).toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{
                        width: `${pnl.total_direct_cost > 0 ? ((pnl.expense_breakdown?.TRANSPORT || 0) / pnl.total_direct_cost) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-1 font-medium">
                    <span>BOS Consumables & Liasoning</span>
                    <span className="font-mono text-slate-900">
                      ₹{(
                        Number(pnl.expense_breakdown?.ELECTRICAL_CONSUMABLES || 0) +
                        Number(pnl.expense_breakdown?.LIASONING || 0) +
                        Number(pnl.expense_breakdown?.CRANE_RENTAL || 0) +
                        Number(pnl.expense_breakdown?.MISCELLANEOUS || 0)
                      ).toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{
                        width: `${pnl.total_direct_cost > 0 ? (((pnl.expense_breakdown?.ELECTRICAL_CONSUMABLES || 0) + (pnl.expense_breakdown?.LIASONING || 0)) / pnl.total_direct_cost) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                Total Expenses Logged: <strong>{pnl.expenses_count} items</strong>
              </div>
            </div>

            {/* Direct Project Expenses Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-solar-gold" />
                  Direct Project Expense Ledger
                </h3>
                <span className="text-xs text-slate-500">
                  Total: ₹{Number(pnl.direct_expenses_total).toLocaleString('en-IN')}
                </span>
              </div>

              {expenses.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <HardHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No direct expenses logged for this sales order yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        <th className="py-2.5 px-3">Expense #</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Vendor / Recipient</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-900 font-semibold">{exp.expense_number}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">{exp.vendor_name}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹{Number(exp.amount).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <Badge variant={exp.status}>{exp.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 5. Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <HardHat className="w-5 h-5 text-solar-gold" />
                Record Project Site Expense
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Expense Category *
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="LABOR">Site Labour & Electrician</option>
                  <option value="TRANSPORT">Truck & Freight Logistics</option>
                  <option value="CRANE_RENTAL">Crane / Lifting Equipment</option>
                  <option value="LIASONING">DISCOM Liasoning & Approvals</option>
                  <option value="ELECTRICAL_CONSUMABLES">BOS Consumables & Conduits</option>
                  <option value="CIVIL_MATERIALS">Civil Foundation & Concrete</option>
                  <option value="MISCELLANEOUS">Miscellaneous / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Vendor / Contractor Name *
                </label>
                <input
                  type="text"
                  required
                  value={expenseVendor}
                  onChange={(e) => setExpenseVendor(e.target.value)}
                  placeholder="e.g. Apex Electricals"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Receipt Remark
                </label>
                <textarea
                  rows="2"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Scope of work or receipt reference..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-sm"
                >
                  {submittingExpense ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectProfitabilityPage;
