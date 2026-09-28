import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Phone, RefreshCw, Search, UserRound, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import { listRegisteredCustomers } from "../../services/authApi";
import { formatDate } from "../../utils/format";

/**
 * A phone-friendly, staff-only view of customers who created accounts.
 * It intentionally exposes contact details, not password or staff data.
 */
export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      const data = await listRegisteredCustomers();
      setCustomers(Array.isArray(data) ? data : data?.results || []);
    } catch (apiError) {
      setError(apiError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return customers;

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.username,
        customer.email,
        customer.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [customers, query]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Staff · Customer care"
        title="Customers"
        description={`${customers.length} registered account${customers.length === 1 ? "" : "s"} available to contact.`}
        actions={
          <AdminButton icon={RefreshCw} onClick={load} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
      />

      <div className="relative mt-5">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email or phone"
          aria-label="Search registered customers"
          className="w-full rounded-xl border border-white/10 bg-[#181818] py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {loading && <AdminLoading label="Loading registered customers..." />}
      {!loading && error && (
        <Alert tone="error" title="Could not load customers" details={error.fieldErrors} onRetry={load} className="mt-6">
          {error.message}
        </Alert>
      )}
      {!loading && !error && shown.length === 0 && (
        <AdminEmpty
          title={query ? "No matching customers" : "No registered customers"}
          body={query ? `No customer matches “${query}”.` : "New account registrations will appear here."}
          onRetry={load}
        />
      )}
      {!loading && !error && shown.length > 0 && (
        <div className="mt-5 grid gap-3">
          {shown.map((customer) => {
            const name = customer.full_name || customer.username;
            return (
              <AdminPanel key={customer.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6a85f]/25 bg-[#d6a85f]/10 text-[#d6a85f]">
                    <UserRound size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-xl leading-none text-white">{name}</p>
                    <p className="mt-2 truncate text-xs text-white/45">@{customer.username}</p>
                  </div>
                  <p className="max-w-28 shrink-0 text-right text-[10px] uppercase leading-4 tracking-[0.12em] text-white/30">
                    Joined {formatDate(customer.created_at)}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm">
                  <a href={`mailto:${customer.email}`} className="flex min-w-0 items-center gap-2 text-white/65 transition hover:text-[#d6a85f]">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </a>
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex min-w-0 items-center gap-2 text-white/65 transition hover:text-[#d6a85f]">
                      <Phone size={14} className="shrink-0" />
                      <span className="truncate">{customer.phone}</span>
                    </a>
                  )}
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
