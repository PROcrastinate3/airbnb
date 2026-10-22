# Backend handoff

**Rule:** only the files in `src/services/` talk to data. Keep every function name, argument list and return shape the same
and the UI keeps working. Search for `FIREBASE:` / `STRIPE:` comments for hints. Delete `services/db.js` when done.

Pure business rules are in `services/rules.js` (refund %, availability, rating math). Port them to Cloud Functions as-is.

## Collections

| Collection | Key fields |
|---|---|
| `users` | name, email, role (`guest`/`host`/`admin`), status (`active`/`suspended`), phone, bio, avatar, `hostApplication {status: pending/approved/rejected/deactivated, businessName, about, note, submittedAt}` |
| `listings` | hostId, title, description, address fields, category, propertyType, pricePerNight, cleaningFee, maxGuests, bedrooms, beds, baths, amenities[], images[], **houseRules[], checkInTime, checkOutTime, cancellationPolicy (`flexible`/`moderate`/`strict`), instantBook, blockedDates[]**, status (`pending`/`published`/`rejected`/`suspended`/`unlisted`), rating, reviewCount |
| `bookings` | listingId, guestId, hostId, checkIn, checkOut (`YYYY-MM-DD`), guests, nights, subtotal, cleaningFee, serviceFee, total, status (`pending_payment`/`pending`/`confirmed`/`completed`/`cancelled`), paymentId, cancelledAt, cancelledBy, refundAmount |
| `payments` | bookingId, guestId, hostId, amount, status (`succeeded`/`partially_refunded`/`refunded`/`pending`), refundAmount, brand, last4, stripePaymentIntentId |
| `reviews` | listingId, guestId, bookingId, rating, comment, status (`visible`/`hidden`), reported {by, reason, at, resolved} |
| `notifications` | userId, type, title, message, link, read, createdAt |
| `settings/platform` | serviceFeeRate, categories[{id,label,icon}] |
| `users/{uid}/wishlist` | listingId |

Dates are plain `YYYY-MM-DD` strings; timestamps are ISO strings. Convert Firestore `Timestamp` inside the services.

## Functions to implement (signature = contract)

**authService** `signIn(email,password)` · `signUp({name,email,password,role})` (role `host` only starts an application; user stays `guest`) · `signOut()` · `restoreSession()` → `onAuthStateChanged` · `updateProfile(userId,data)` · `applyAsHost(userId,{businessName,phone,about})` · `changePassword(userId,current,next)` · `getUser(id)`

**listingService** `getListings(filters)` (q, category, minPrice, maxPrice, guests, propertyType, sort, **checkIn/checkOut → exclude booked/blocked**) · `getListing(id)` (includes host + visible reviews) · `getHostListings(hostId)` · `createListing(hostId,data)` · `updateListing(id,data,actor)` · `deleteListing(id,actor)` · `getReviewEligibility(userId,listingId)` · `getReviewedListingIds(userId)` · `addReview({...})` · `getHostReviews(hostId)` · `reportReview(reviewId,reason,actor)` · wishlist: `getWishlistIds`, `getWishlist`, `toggleWishlist`

**bookingService** `createBooking(...)` · `getBooking(id)` · `getGuestBookings(guestId)` · `getHostBookings(hostId)` · `getUnavailableRanges(listingId)` · `isAvailable(...)` · `getCancellationPreview(bookingId)` · `updateBookingStatus(id,status,actor)` · `getCalendarData(listingId,actor)` · `setBlockedDates(listingId,dates,block,actor)` · `calculatePricing` / `nightsBetween` (sync helpers; recompute the price server-side too)

**paymentService** `createPaymentIntent(bookingId)` → `{clientSecret}` · `confirmPayment(...)` (with real Stripe: a webhook sets booking `confirmed`, or `pending` when `listing.instantBook === false`)

**notificationService** `getNotifications(userId)` · `getUnreadCount(userId)` (currently sync, used by the bell) · `markRead` · `markAllRead` · `deleteNotification` · `pushNotification`/`notifyAdmins` (call from Cloud Functions on the events below)

**settingsService** `getSettings` / `getServiceFeeRate` / `getCategories` (currently sync: load once at app start) · `updateServiceFee` · `addCategory` · `updateCategory` · `removeCategory`

**adminService** `getAdminStats` · `getAnalytics(months)` · users: `getAllUsers`, `setUserStatus`, `updateUserDetails`, `setUserRole` · hosts: `getHostAccounts`, `reviewHostApplication`, `setHostActive` · `getAllListings` · `setListingStatus` · `removeListing` · `getAllBookings` · `getAllPayments` · `refundPayment` · reviews: `getAllReviews`, `setReviewStatus`, `deleteReview`, `dismissReport`

**hostService** `getHostStats(hostId)` · `getHostPayouts(hostId)`

## Rules that MUST be enforced server-side (the UI only hides buttons)

1. **Double booking:** reject overlapping `pending`/`pending_payment`/`confirmed` bookings and `blockedDates` (use a transaction).
2. **Price:** compute subtotal, cleaning fee and service fee on the server from `settings.serviceFeeRate`.
3. **Ownership:** only `listing.hostId` (or admin) can update/delete a listing or its calendar.
4. **Booking status transitions** (see `updateBookingStatus`): guest may cancel own `pending`/`confirmed`; host may accept `pending`, cancel, or complete `confirmed` after check-in; admin anything.
5. **Review eligibility:** a `completed` booking (or `confirmed` past check-out) for that listing and no earlier review by that user.
6. **Delete listing:** blocked while `pending`/`confirmed` bookings have `checkOut >= today`.
7. **Cancellation refund:** `rules.refundFor`; host/admin cancellations and unaccepted requests refund 100%. Issue the Stripe refund.
8. **Roles:** only `admin` can change roles, approve hosts/listings, moderate reviews, change settings. Use custom claims.
9. **Only approved hosts** (`role === 'host'`) can create listings.

## Notification events to trigger from Cloud Functions
booking paid (guest + host) · request accepted/declined · reservation cancelled (other party) · stay completed (guest: leave a review) · new review (host) · listing approved/rejected/hidden/removed (host) · host application submitted (admins) / decided (applicant) · review reported (admins) · listing submitted (admins)

## Test data
`admin@staybnb.com / admin123` · `host@staybnb.com / host123` · `guest@staybnb.com / guest123` · Stripe test card `4242 4242 4242 4242` (declined: `4000 0000 0000 0002`)

---

# Firebase-readiness changes (already done in the frontend)

**Rule now holds 100%:** nothing outside `src/services/` touches `localStorage`, `db.js` or `mockData.js` (verified by grep).

| What changed | Why it matters for Firebase |
|---|---|
| `settingsService` reads come from a cache filled by `loadSettings()`; `<SettingsProvider>` (`context/SettingsContext.jsx`) loads it once before the app renders | `getCategories/getServiceFeeRate/getSettings` were sync, which Firestore can't do. Now just implement `loadSettings()` with `getDoc(doc(db,'settings','platform'))` and have each write update Firestore **and** `cache`. `calculatePricing` stays sync and uses the cached fee (server must still recompute). |
| `notificationService.subscribeNotifications(userId, cb)` replaces the polling `getUnreadCount` in the bell | Implement with `onSnapshot`; return its unsubscribe. `getUnreadCount` is now async. |
| `authService.onAuthChange(cb)` + `AuthContext` subscribes to it | Implement with `onAuthStateChanged` + `getDoc(users/uid)`. `restoreSession` can then be deleted. |
| `services/storageService.uploadImage(file, folder)` used by `ListingForm` and `Profile` | Photos/avatars were stored as base64 inside documents (breaks Firestore's 1 MB doc limit). Implement with Storage `uploadBytes` + `getDownloadURL`; docs only ever hold URLs. |
| `services/devService.resetDemoData()` | `Profile.jsx` used to import `db.js` and clear localStorage directly. Delete `devService.js` and the "Developer tools" box when done. |
| `data/constants.js` (AMENITIES, PROPERTY_TYPES) | These are UI constants, so they survive deleting `mockData.js`. |
| `src/firebase.js`, `.env.example`, `firestore.rules`, `storage.rules` | Starter config. `firebase.js` isn't imported yet. Run `npm i firebase` first. Rules are a **starter**: review before deploying. |

## Things to know when converting
- **Passwords** are in the mock `users` objects. With Firebase Auth they are never stored in Firestore. Drop `password` from user docs; seed users via Auth. `changePassword` → `reauthenticateWithCredential` + `updatePassword`.
- **Custom claim `role`** is what `firestore.rules` checks. Set it from a Cloud Function whenever role changes (admin approves host, `setUserRole`).
- **Joins:** `enrich()` in bookingService, `getListing` (host + reviews), admin lists etc. join collections in memory. In Firestore do the extra `getDoc`s (or denormalize title/image/guest name onto the booking at creation).
- **Wishlist** is `db.wishlists[userId] = [ids]` locally; Firestore plan is `users/{uid}/wishlist/{listingId}`.
- **Availability:** guests must not read others' bookings (rules block it), so `getUnavailableRanges` / `getListings` date filtering needs a Cloud Function or a public `availability` collection.
- **Search:** `getListings` filters in memory. Firestore can't do text search or multiple range filters. Query by `status` (+ `category`) and filter the rest client-side, or add Algolia/Typesense later.
- **Indexes you will likely need:** bookings(`guestId`,`createdAt`), bookings(`hostId`,`createdAt`), bookings(`listingId`,`status`), notifications(`userId`,`createdAt` desc), reviews(`listingId`,`status`), listings(`status`,`category`).
- **IDs:** use Firestore auto-ids instead of `genId()`. Dates stay `YYYY-MM-DD` / ISO strings, so no UI changes are needed (convert `Timestamp` inside the services).
