import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import ListingCard from "../../components/ListingCard.jsx";
import { EmptyState, Spinner } from "../../components/ui.jsx";
import { getWishlist } from "../../services/listingService.js";
import { useAsync } from "../../hooks/useAsync.js";

export default function Wishlist() {
  const { user, wishlist } = useAuth();
  // re-fetch whenever the wishlist ids change (heart toggled)
  const { data: listings, loading } = useAsync(
    () => getWishlist(user.id),
    [user.id, wishlist.join(",")],
  );

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold">Wishlist</h1>
      {loading && !listings ? (
        <Spinner />
      ) : !listings || listings.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Create your first wishlist"
            text="As you search, tap the heart icon to save your favourite places."
            action={
              <Link to="/search" className="btn-primary">
                Start exploring
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
