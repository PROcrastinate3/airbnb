import { useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";
import { getCategories } from "../services/settingsService.js";
import { getListings } from "../services/listingService.js";
import { useAsync } from "../hooks/useAsync.js";

const DESTINATIONS = [
  { name: "Siargao", q: "Siargao", img: "photo-1507525428034-b723cf961d3e" },
  { name: "Palawan", q: "Palawan", img: "photo-1537996194471-e657df975ab4" },
  { name: "Baguio", q: "Baguio", img: "photo-1464822759023-fed622ff2c3b" },
  { name: "Cebu", q: "Cebu", img: "photo-1519046904884-53103b34b206" },
];

export default function Home() {
  const [category, setCategory] = useState("all");
  const { data: listings, loading } = useAsync(
    () => getListings({ category }),
    [category],
  );
  const { data: featured } = useAsync(
    () => getListings({ sort: "rating" }),
    [],
  );
  const CATEGORIES = getCategories();

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <div
          className="h-[480px] bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.45)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=70')",
          }}
        >
          <div className="container-page flex h-full flex-col items-center justify-center text-center text-white">
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Find your next stay, anywhere you want to be.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Unique homes, cabins and beachfront villas hosted by local people.
            </p>
          </div>
        </div>
        <div className="container-page relative -mt-10 pb-2">
          <SearchBar />
        </div>
      </section>

      {/* Featured stays */}
      {featured && featured.length > 0 && (
        <section className="container-page mt-12">
          <h2 className="text-2xl font-semibold">Featured stays</h2>
          <p className="text-sm text-gray-500">Our guests' top-rated places.</p>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {featured.slice(0, 4).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Categories + listings */}
      <section className="container-page mt-16">
        <h2 className="mb-4 text-2xl font-semibold">Browse by category</h2>
        <div className="flex gap-8 overflow-x-auto border-b border-gray-200 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`flex shrink-0 flex-col items-center gap-1 border-b-2 px-1 pb-3 text-xs font-medium transition ${
                category === c.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <span className="text-2xl">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : listings.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No stays in this category yet"
              text="Try another category or search a destination."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {/* Destinations */}
      <section className="container-page mt-20">
        <h2 className="text-2xl font-semibold">Popular destinations</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.name}
              to={`/search?q=${d.q}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-2xl"
            >
              <img
                src={`https://images.unsplash.com/${d.img}?auto=format&fit=crop&w=600&q=70`}
                alt={d.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-4 left-4 text-lg font-semibold text-white">
                {d.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Host CTA */}
      <section className="container-page mt-20">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-gray-900 text-white md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <h2 className="text-3xl font-bold">Try hosting on NAME?</h2>
            <p className="mt-3 text-white/80">
              Earn extra income and unlock new opportunities by sharing your
              space with travellers.
            </p>
            <Link to="/become-a-host" className="btn-primary mt-6">
              Get started
            </Link>
          </div>
          <img
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=70"
            alt=""
            className="h-64 w-full object-cover md:h-full"
          />
        </div>
      </section>
    </div>
  );
}
