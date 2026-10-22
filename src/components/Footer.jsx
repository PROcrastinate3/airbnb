import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="container-page grid gap-8 py-12 text-sm sm:grid-cols-3">
        <div>
          <h4 className="mb-3 font-semibold">Support</h4>
          <ul className="space-y-2 text-gray-600">
            <li>Help Center</li>
            <li>Cancellation options</li>
            <li>Safety information</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Hosting</h4>
          <ul className="space-y-2 text-gray-600">
            <li>
              <Link to="/become-a-host" className="hover:underline">
                NAME? your home
              </Link>
            </li>
            <li>Hosting resources</li>
            <li>Community forum</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">NAME?</h4>
          <ul className="space-y-2 text-gray-600">
            <li>About us</li>
            <li>Careers</li>
            <li>Investors</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} NAME?, Inc. · A demo project — not
        affiliated with Airbnb.
      </div>
    </footer>
  );
}
