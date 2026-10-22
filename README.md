# no name — Airbnb-style frontend (React + Tailwind + React Router)

All data is mock data, behind a service layer, so moving to Firebase means editing one folder.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

## Demo accounts

| Role  | Email             | Password |
| ----- | ----------------- | -------- |
| Guest | guest@staybnb.com | guest123 |
| Host  | host@staybnb.com  | host123  |
| Admin | admin@staybnb.com | admin123 |

(The login page has one-click buttons for these.) Data is saved in `localStorage`; use **Account → Reset demo data** to restore the seed.

## Routes

| Area   | Route                                   | Page                                             |
| ------ | --------------------------------------- | ------------------------------------------------ |
| Public | `/`                                     | Landing page (hero search, categories, listings) |
|        | `/search`                               | Search + filters (price, type, category, sort)   |
|        | `/listing/:id`                          | Listing detail, gallery, reviews, booking widget |
|        | `/login`, `/register`, `/become-a-host` | Auth + host onboarding                           |
| Guest  | `/checkout`                             | **Payment page (Stripe integration point)**      |
|        | `/booking/:id/confirmation`             | Booking confirmation                             |
|        | `/trips`, `/wishlist`, `/profile`       | Trips (cancel), wishlist, account                |
| Host   | `/host`                                 | Dashboard (stats, earnings chart)                |
|        | `/host/listings`, `/new`, `/:id/edit`   | Listing CRUD                                     |
|        | `/host/reservations`                    | Accept / decline / complete bookings             |
|        | `/host/earnings`                        | Earnings + payout history                        |
| Admin  | `/admin`                                | Platform overview                                |
|        | `/admin/users`                          | Suspend / reactivate users, change roles         |
|        | `/admin/listings`                       | Approve / reject / suspend listings              |
|        | `/admin/bookings`, `/admin/payments`    | All bookings; payments + refunds                 |

Route protection lives in `src/components/RouteGuards.jsx` (`RequireAuth` with optional `roles`).

## Project structure

```
src/
  data/mockData.js          seed data (each export = one Firestore collection)
  services/                 <-- the ONLY layer to rewrite for Firebase
    db.js                   in-memory + localStorage store (delete when on Firebase)
    authService.js          sign in / up / out, profile
    listingService.js       listings, reviews, wishlist
    bookingService.js       availability, pricing, bookings
    paymentService.js       payments (Stripe integration point)
    hostService.js          host stats / payouts
    adminService.js         admin stats, moderation, refunds
  context/AuthContext.jsx   current user + wishlist state
  components/               Navbar, Footer, SearchBar, ListingCard, layouts, guards, ui kit
  pages/                    public, guest/, host/, admin/
```

Pages never import mock data directly (except static constants such as category lists) —
they only call functions from `src/services`. Every service function is `async` and returns plain JSON-like objects,
so the call sites will not change when the implementation becomes Firestore.

## Converting to Firebase

1. `npm i firebase` and create `src/firebase.js` (`initializeApp`, `getAuth`, `getFirestore`, `getStorage`).
2. Rewrite each service function. Comments marked `FIREBASE:` show the Firestore equivalent, e.g.
   - `signIn` → `signInWithEmailAndPassword` + `getDoc(doc(db,'users',uid))`
   - `getListings` → `query(collection(db,'listings'), where('status','==','published'))`
   - `createBooking` → `addDoc(collection(db,'bookings'), …)` (best done in a Cloud Function so prices are computed server-side)
3. In `AuthContext.jsx`, replace the `restoreSession` effect with `onAuthStateChanged`.
4. Listing photos: replace the URL/file input in `ListingForm.jsx` with Firebase Storage `uploadBytes` + `getDownloadURL`.
5. Roles: store `role` on `/users/{uid}` and as a custom claim. The route guards are for UX only — enforce access in **Firestore security rules**.
6. Delete `services/db.js` and `data/mockData.js` once everything is migrated.

Suggested collections: `users`, `listings`, `bookings`, `payments`, `reviews`, and `users/{uid}/wishlist`.
Dates are ISO strings today; use `Timestamp` in Firestore if you want server-side date queries.

## Integrating Stripe

The payment page is `src/pages/guest/Checkout.jsx`; the logic is in `src/services/paymentService.js`.
Today it validates a card and simulates success (`4242 4242 4242 4242`) or decline (`4000 0000 0000 0002`).

1. `npm i @stripe/stripe-js @stripe/react-stripe-js`
2. Backend (Cloud Function or Express): create a PaymentIntent for the booking total (in cents) and return its `client_secret`.
3. `createPaymentIntent()` → `fetch` that endpoint.
4. In `Checkout.jsx` wrap the form in `<Elements stripe={stripePromise} options={{ clientSecret }}>`, swap the mock card inputs for `<PaymentElement />`, and call `stripe.confirmPayment({ elements, confirmParams: { return_url } })`.
5. Add a webhook for `payment_intent.succeeded` that writes the `/payments` doc and sets the booking to `confirmed`.
6. Refunds (admin) → `stripe.refunds.create({ payment_intent })`; host payouts → Stripe Connect.

Never trust prices from the browser: compute totals on the server from the listing price and dates.

## Feature checklist (added)

| Area                                                         | Where                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Notifications (bell + page)                                  | `components/NotificationBell.jsx`, `pages/Notifications.jsx`, `services/notificationService.js` |
| Review eligibility (completed stay, once per listing)        | `listingService.reviewEligibility`, `components/ReviewForm.jsx`                                 |
| Request-to-book (`pending`) vs instant book                  | `paymentService.confirmPayment`, host form checkbox                                             |
| House rules, check-in/out times, cancellation policy         | `ListingForm`, `ListingDetail`, `rules.js`                                                      |
| Refunds by cancellation policy                               | `rules.refundFor`, `bookingService.updateBookingStatus`                                         |
| Host availability calendar (block dates)                     | `pages/host/HostCalendar.jsx`                                                                   |
| Host review management + report review                       | `pages/host/HostReviews.jsx`                                                                    |
| Host application / admin approval                            | `pages/BecomeHost.jsx`, `pages/admin/AdminHosts.jsx`                                            |
| Review moderation                                            | `pages/admin/AdminReviews.jsx`                                                                  |
| Analytics                                                    | `pages/admin/AdminAnalytics.jsx`                                                                |
| Categories + service-fee settings                            | `pages/admin/AdminSettings.jsx`, `services/settingsService.js`                                  |
| Date-aware search, delete restrictions, authorization checks | `listingService`, `bookingService`                                                              |

### Demo accounts

`admin@staybnb.com / admin123` · `host@staybnb.com / host123` · `maria@staybnb.com / host123`
`guest@staybnb.com / guest123` · `leo@staybnb.com / guest123` · `paolo@staybnb.com / guest123` (pending host application)

The mock database key was bumped to `staybnb_db_v3`, so old browser data is ignored automatically.
Business rules live in `services/rules.js` (pure functions) so the backend dev can port them to Cloud Functions as-is.
