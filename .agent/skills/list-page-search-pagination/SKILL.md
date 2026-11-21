---
name: list-page-search-pagination
description: Use when building or modifying any list page, search bar, filter bar, table, pagination, button actions, or fast prefix indexing in SunPower ERP. Enforces uniform pagination, 300ms debouncing, 400ms button click throttling, clean single-row filter bars, and Trie/DB indexing.
---

# List Pages: Search, Filters, Debouncing, Throttling & Pagination Standards

All data listing pages in SunPower ERP (Leads, Customers, Surveys, Catalog, Users, Quotations, Orders, Invoices, Service Tickets) must follow this exact architecture and layout to ensure a coherent, responsive, and rock-solid user experience.

---

## 1. Filter Bar & Search UX Standards

### ❌ Anti-Patterns to Avoid
* **No Cluttered Category/Status Tag Pills:** Do not render long, multi-row tag pill buttons taking up vertical screen height. They clutter the UI and cause layout shifts on mobile/tablet.
* **No Un-debounced Search:** Never trigger API calls on every keystroke.
* **No Stale Pagination:** Changing search text or filter dropdowns without resetting to page 1 causes empty screens or out-of-range pages.

### ✅ Required Layout Pattern
* Place search and filters inside a single compact, elevated bar:
  ```jsx
  <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
    {/* Full-width Search Input with Clear Button */}
    <div className="relative flex-1 w-full">
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search by name, phone, code or SKU..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight bg-slate-50/50 focus:bg-white transition-colors"
      />
      {searchInput && (
        <button
          type="button"
          onClick={() => setSearchInput('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* Filter Dropdown(s) */}
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Filter className="w-4 h-4 text-slate-400 shrink-0" />
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="text-sm px-3 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 focus:ring-2 focus:ring-midnight outline-none bg-white w-full sm:w-auto cursor-pointer"
      >
        <option value="ALL">All Statuses</option>
        {STATUS_LIST.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  </div>
  ```

---

## 2. Search Debouncing Standard

* All search inputs must use the `useDebounce` hook (`client/src/hooks/useDebounce.js`) with a **300ms** delay.
* Always bind search input to an immediate local state `searchInput`, and feed `debouncedSearch` to query hooks or fetch functions:
  ```javascript
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Mandatory: Reset page to 1 whenever search query or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);
  ```

---

## 3. Button Click Throttling Standard

* All interactive buttons must use the standardized `<Button />` component (`client/src/components/common/Button.jsx`).
* `<Button />` incorporates built-in click throttling with a default **400ms** threshold (`throttleMs = 400`):
  ```jsx
  <Button
    variant="primary"
    onClick={handleAction}
    loading={submitting}
    throttleMs={400} // Enabled by default
  >
    Submit
  </Button>
  ```
* Rapid consecutive clicks within the throttle window are silently ignored, preventing:
  - Duplicate API submissions (e.g. creating multiple leads, duplicate orders, or duplicate surveys).
  - Multiple modal popups or state desynchronization.
  - Accidental double-taps on mobile devices.

---

## 4. Universal Pagination Architecture

### Client Component (`Pagination.jsx`)
Always render the reusable `<Pagination />` component (`client/src/components/common/Pagination.jsx`) directly inside or under the table container:
```jsx
import Pagination from '../../components/common/Pagination.jsx';

// In page component:
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(10);
const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

// Under table:
<Pagination
  page={page}
  limit={limit}
  total={pagination.total}
  totalPages={pagination.totalPages}
  onPageChange={setPage}
  onLimitChange={(newLimit) => {
    setLimit(newLimit);
    setPage(1);
  }}
  entityLabel="leads"
  pageSizes={[10, 20, 50, 100]}
/>
```

### Backend Repository Rules
In Express controllers and repositories, query strings `page` and `limit` are strings. **Never pass them raw into Prisma.**
Always sanitize with `parseInt` and enforce safe limits:
```javascript
export async function listEntities({ page = 1, limit = 10, search, filter } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where: whereClause,
      skip,
      take: safeLimit,
      orderBy: { created_at: 'desc' }
    }),
    prisma.entity.count({ where: whereClause })
  ]);

  return {
    data: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}
```

### Standard Response Envelope
The backend controller formats the JSON envelope as:
```json
{
  "data": [ ... ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    },
    "requestId": "req_123456"
  }
}
```

---

## 5. Trie & High-Speed Prefix Search Indexing

For ultra-fast instant search across thousands of records (SKUs, leads, customers, phone numbers, pincodes):

1. **In-Memory Prefix Trie (`server/src/utils/trie.js`):**
   - Use the `Trie` class for $O(L)$ prefix lookups and autocomplete suggestion dropdowns:
     ```javascript
     import { Trie } from '../../utils/trie.js';
     const catalogTrie = new Trie({ caseSensitive: false, tokenize: true });

     // Bulk insert records
     catalogTrie.bulkInsert(products, ['sku', 'brand', 'model_name']);

     // Instant prefix search
     const matches = catalogTrie.searchPrefix(query, 10);
     ```
2. **Database Indexes:**
   - Searchable columns must have explicit indexes in Prisma schema / PostgreSQL:
     - Exact / prefix lookups: B-Tree index on `(lead_number)`, `(survey_number)`, `(phone_e164)`, `(sku)`.
     - Text search: Trigram index (`pg_trgm`) or GIN index for partial text matching.
