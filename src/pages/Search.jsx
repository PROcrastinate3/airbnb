import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
import { PROPERTY_TYPES } from "../data/constants.js";
import { getCategories } from "../services/settingsService.js";
import { fmtDate } from "../utils/format.js";
import { getListings } from "../services/listingService.js";
import { useAsync } from "../hooks/useAsync.js";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const CATEGORIES = getCategories();
  const filters = useMemo(
    () => ({
      q: params.get("q") || "",
      checkIn: params.get("checkIn") || "",
      checkOut: params.get("checkOut") || "",
      guests: params.get("guests") || "",
      category: params.get("category") || "all",
      propertyType: params.get("type") || "any",
      minPrice: params.get("min") || "",
      maxPrice: params.get("max") || "",
      sort: params.get("sort") || "relevance",
    }),
    [params],
  );

  const { data: listings, loading } = useAsync(
    () => getListings(filters),
    [params.toString()],
  );

  // keep the chosen dates / guests when opening a listing
  const carryParams = new URLSearchParams();
  ["checkIn", "checkOut", "guests"].forEach(
    (k) => filters[k] && carryParams.set(k, filters[k]),
  );
  const carry = carryParams.toString() ? `?${carryParams}` : "";

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clear = () => {
    const next = new URLSearchParams();
    ["q", "checkIn", "checkOut", "guests"].forEach(
      (k) => params.get(k) && next.set(k, params.get(k)),
    );
    setParams(next);
  };

  return (
    <div className="container-page py-8">
      <SearchBar compact initial={filters} key={params.toString()} />

      <div className="mt-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 p-4">
        <div>
          <label className="label">Category</label>
          <select
            className="input py-2"
            value={filters.category}
            onChange={(e) =>
              set("category", e.target.value === "all" ? "" : e.target.value)
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Property type</label>
          <select
            className="input py-2"
            value={filters.propertyType}
            onChange={(e) =>
              set("type", e.target.value === "any" ? "" : e.target.value)
            }
          >
            <option value="any">Any type</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Min price</label>
          <input
            type="number"
            min="0"
            className="input w-28 py-2"
            value={filters.minPrice}
            onChange={(e) => set("min", e.target.value)}
            placeholder="$0"
          />
        </div>
        <div>
          <label className="label">Max price</label>
          <input
            type="number"
            min="0"
            className="input w-28 py-2"
            value={filters.maxPrice}
            onChange={(e) => set("max", e.target.value)}
            placeholder="Any"
          />
        </div>
        <div>
          <label className="label">Sort by</label>
          <select
            className="input py-2"
            value={filters.sort}
            onChange={(e) =>
              set("sort", e.target.value === "relevance" ? "" : e.target.value)
            }
          >
            <option value="relevance">Recommended</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
        <button className="btn-ghost ml-auto" onClick={clear}>
          Clear filters
        </button>
      </div>

      <div className="mt-8">
        {loading ? (
          <Spinner />
        ) : listings.length === 0 ? (
          <EmptyState
            title="No exact matches"
            text="Try changing or removing some of your filters."
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              {listings.length} stay{listings.length === 1 ? "" : "s"}
              {filters.checkIn &&
                filters.checkOut &&
                ` available ${fmtDate(filters.checkIn, { month: "short", day: "numeric" })} – ${fmtDate(filters.checkOut, { month: "short", day: "numeric" })}`}
            </p>
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} search={carry} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
