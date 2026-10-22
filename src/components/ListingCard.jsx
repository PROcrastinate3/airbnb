import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { areaLine, money } from "../utils/format.js";
import { Stars } from "./ui.jsx";

export default function ListingCard({ listing, search = "" }) {
  const { user, wishlist, toggleFavorite } = useAuth();
  const navigate = useNavigate();
  const liked = wishlist.includes(listing.id);

  const onHeart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await toggleFavorite(listing.id);
    if (!ok) navigate("/login", { state: { from: "/" } });
  };

  return (
    <Link to={`/listing/${listing.id}${search}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
        <img
          src={listing.images[0]}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <button
          onClick={onHeart}
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-3 top-3 text-2xl drop-shadow"
        >
          <span
            className={
              liked
                ? "text-brand-500"
                : "text-white/90 [text-shadow:0_0_3px_rgba(0,0,0,0.6)]"
            }
          >
            {liked ? "♥" : "♡"}
          </span>
        </button>
        {listing.rating >= 4.9 && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow">
            Guest favourite
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="truncate font-semibold" title={areaLine(listing)}>
          {listing.location}
        </h3>
        <Stars value={listing.rating} />
      </div>
      <p className="truncate text-sm text-gray-500">
        {listing.province ? `${listing.province} · ` : ""}
        {listing.title}
      </p>
      {listing.landmark && (
        <p className="truncate text-xs text-gray-400">📍 {listing.landmark}</p>
      )}
      <p className="mt-1 text-sm">
        <span className="font-semibold">{money(listing.pricePerNight)}</span>{" "}
        <span className="text-gray-600">night</span>
      </p>
    </Link>
  );
}
