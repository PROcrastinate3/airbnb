import { Route, Routes } from 'react-router-dom';
import { CheckoutLayout, MainLayout } from './components/Layouts.jsx';
import DashboardLayout, { adminLinks, hostLinks } from './components/DashboardLayout.jsx';
import { RequireAuth } from './components/RouteGuards.jsx';

import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import BecomeHost from './pages/BecomeHost.jsx';
import Notifications from './pages/Notifications.jsx';
import NotFound from './pages/NotFound.jsx';

import Checkout from './pages/guest/Checkout.jsx';
import BookingConfirmation from './pages/guest/BookingConfirmation.jsx';
import Trips from './pages/guest/Trips.jsx';
import Wishlist from './pages/guest/Wishlist.jsx';
import Profile from './pages/guest/Profile.jsx';

import HostDashboard from './pages/host/HostDashboard.jsx';
import HostListings from './pages/host/HostListings.jsx';
import ListingForm from './pages/host/ListingForm.jsx';
import HostReservations from './pages/host/HostReservations.jsx';
import HostEarnings from './pages/host/HostEarnings.jsx';
import HostCalendar from './pages/host/HostCalendar.jsx';
import HostReviews from './pages/host/HostReviews.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminListings from './pages/admin/AdminListings.jsx';
import AdminBookings from './pages/admin/AdminBookings.jsx';
import AdminPayments from './pages/admin/AdminPayments.jsx';
import AdminHosts from './pages/admin/AdminHosts.jsx';
import AdminReviews from './pages/admin/AdminReviews.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public + guest side */}
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="listing/:id" element={<ListingDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="become-a-host" element={<BecomeHost />} />

        <Route element={<RequireAuth />}>
          <Route path="trips" element={<Trips />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="booking/:id/confirmation" element={<BookingConfirmation />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Payment (Stripe) */}
      <Route element={<RequireAuth />}>
        <Route element={<CheckoutLayout />}>
          <Route path="checkout" element={<Checkout />} />
        </Route>
      </Route>

      {/* Host side */}
      <Route element={<RequireAuth roles={['host', 'admin']} />}>
        <Route path="host" element={<DashboardLayout title="Host" links={hostLinks} />}>
          <Route index element={<HostDashboard />} />
          <Route path="listings" element={<HostListings />} />
          <Route path="listings/new" element={<ListingForm />} />
          <Route path="listings/:id/edit" element={<ListingForm />} />
          <Route path="reservations" element={<HostReservations />} />
          <Route path="earnings" element={<HostEarnings />} />
          <Route path="calendar" element={<HostCalendar />} />
          <Route path="reviews" element={<HostReviews />} />
        </Route>
      </Route>

      {/* Admin side */}
      <Route element={<RequireAuth roles={['admin']} />}>
        <Route path="admin" element={<DashboardLayout title="Admin" links={adminLinks} />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="hosts" element={<AdminHosts />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}
