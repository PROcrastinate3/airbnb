import { useState } from "react";
import { addReview } from "../services/listingService.js";

// Shown only to guests who are eligible (completed stay, not reviewed yet).
export default function ReviewForm({ listingId, userId, onDone }) {
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addReview({ listingId, guestId: userId, ...review });
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 p-4">
      <h4 className="mb-3 font-semibold">Leave a review</h4>
      <div className="mb-3 flex items-center gap-3">
        <label className="label mb-0" htmlFor="rv-rating">
          Rating
        </label>
        <select
          id="rv-rating"
          className="input w-24 py-2"
          value={review.rating}
          onChange={(e) => setReview({ ...review, rating: e.target.value })}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </div>
      <textarea
        required
        className="input"
        rows={3}
        placeholder="Share your experience"
        value={review.comment}
        onChange={(e) => setReview({ ...review, comment: e.target.value })}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button className="btn-outline mt-3" disabled={busy}>
        {busy ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
