import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-extrabold text-brand-500">404</p>
      <h1 className="mt-3 text-2xl font-semibold">We can't find that page</h1>
      <p className="mt-1 text-gray-500">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
